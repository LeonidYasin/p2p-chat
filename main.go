package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/protocol"
	dht "github.com/libp2p/go-libp2p-kad-dht"
	discoveryrouting "github.com/libp2p/go-libp2p/p2p/discovery/routing"
	discoveryutil "github.com/libp2p/go-libp2p/p2p/discovery/util"
	"github.com/libp2p/go-libp2p/p2p/discovery/mdns"
	"github.com/multiformats/go-multiaddr"
)

// Define protocol constants
const chatProtocol = protocol.ID("/libp2p/chat/1.0.0")
const mdnsServiceTag = "libp2p-local-chat"

func main() {
	// Parse command-line flags
	config := parseFlags()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	fmt.Printf("[*] Starting Peer-to-Peer node as \"%s\"...\n", config.Nickname)

	// 1. Create the libp2p host
	h, err := makeHost(config.ListenPort, config.AnnounceIPs)
	if err != nil {
		log.Fatalln("[!] Failed to create libp2p host:", err)
	}
	defer h.Close()

	fmt.Println("[+] Node created successfully!")
	fmt.Println("[+] Peer ID:", h.ID().String())
	fmt.Println("[+] Listening Addresses:")
	for _, addr := range h.Addrs() {
		fmt.Printf("    %s/p2p/%s\n", addr, h.ID())
	}
	fmt.Println()

	// 2. Set stream handler for incoming chat messages
	h.SetStreamHandler(chatProtocol, func(s network.Stream) {
		handleIncomingStream(s, config.Nickname)
	})

	// 3. Setup Discovery
	// Initialize Kademlia DHT in active mode or client mode
	kademliaDHT, err := setupDHT(ctx, h, config.BootstrapPeers)
	if err != nil {
		log.Fatalln("[!] Failed to setup DHT:", err)
	}

	// Connect to bootstrap peers
	bootstrapConnect(ctx, h, config.BootstrapPeers)

	// 4. Start mDNS local network discovery if enabled
	if config.EnableMDNS {
		fmt.Println("[*] Setting up local mDNS node discovery...")
		setupMDNS(h, mdnsServiceTag, func(peer peer.AddrInfo) {
			if peer.ID == h.ID() {
				return // Skip ourself
			}
			fmt.Printf("[mDNS] Discovered local peer %s, attempting connection...\n", peer.ID.ShortString())
			if err := h.Connect(ctx, peer); err != nil {
				// Failed to connect, but that is fine in dynamic local nets
			} else {
				fmt.Printf("[mDNS] Connected to local peer %s!\n", peer.ID.ShortString())
				openChatStream(ctx, h, peer.ID, config.Nickname)
			}
		})
	}

	// 5. Start DHT Rendezvous discovery
	if config.RendezvousString != "" {
		fmt.Printf("[*] Advertising and searching rendezvous room: \"%s\"...\n", config.RendezvousString)
		routingDiscovery := discoveryrouting.NewRoutingDiscovery(kademliaDHT)
		
		// Advertise our presence
		discoveryutil.Advertise(ctx, routingDiscovery, config.RendezvousString)

		// Continuously search for other peers in background
		go discoveryLoop(ctx, h, routingDiscovery, config.RendezvousString, config.Nickname)
	}

	// 6. Spawn Interactive Console UI
	go chatConsole(ctx, h, config.Nickname)

	// 7. Wait for terminating signal (Ctrl+C)
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh

	fmt.Println("\n[*] Shutting down node gracefully...")
}

// Config holds user-specified arguments
type Config struct {
	ListenPort       int
	Nickname         string
	RendezvousString string
	EnableMDNS       bool
	BootstrapPeers   []string
	AnnounceIPs      []string
}

func parseFlags() *Config {
	port := flag.Int("port", 0, "port to listen on (0 for random)")
	nick := flag.String("nick", "anonymous", "nickname for the chat session")
	rendezvous := flag.String("room", "chat-with-rendezvous", "rendezvous string for peer discovery")
	useMdns := flag.Bool("mdns", true, "enable local mDNS peer discovery")
	bootstrapRaw := flag.String("bootstrap", "", "comma-separated list of multiaddresses for bootstraps")
	announceRaw := flag.String("announce", "", "comma-separated list of IP addresses or multiaddresses to announce manually")

	flag.Parse()

	bootstraps := []string{
		// Default public test bootstrap peers (WSS & TCP on 443 & 4001)
		"/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfj696X5A9JNd7Sj7dFi9WjOLN4Cms99E2IJg",
		"/dns4/node0.preload.ipfs.io/tcp/443/wss/p2p/QmY7Yv7S75f1AGv9P89LscYvXWJ8rffy45PGL4G5k4U86r",
		"/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvVWZkpYgj66YhC6P2Y7K6N21w99H6GdfjTMU71",
		"/dns4/bootstrap.libp2p.io/tcp/4001/p2p/QmNnooDu7bfj696X5A9JNd7Sj7dFi9WjOLN4Cms99E2IJg",
	}
	if *bootstrapRaw != "" {
		bootstraps = strings.Split(*bootstrapRaw, ",")
	}

	var announceIPs []string
	if *announceRaw != "" {
		announceIPs = strings.Split(*announceRaw, ",")
	}

	return &Config{
		ListenPort:       *port,
		Nickname:         *nick,
		RendezvousString: *rendezvous,
		EnableMDNS:       *useMdns,
		BootstrapPeers:   bootstraps,
		AnnounceIPs:      announceIPs,
	}
}

// Helper to automatically query outbound local and public IPs without calling netlink InterfaceAddrs (which fails on Android/Termux)
func getAutoIPs() []string {
	var ips []string

	// 1. Get the local interface IP through a UDP dial (this doesn't send packets, just asks routing table for outbound interface IP)
	conn, err := net.Dial("udp", "1.1.1.1:80")
	if err == nil {
		if localAddr, ok := conn.LocalAddr().(*net.UDPAddr); ok {
			ipStr := localAddr.IP.String()
			if ipStr != "127.0.0.1" && ipStr != "::1" && ipStr != "" {
				fmt.Printf("[Programmatic Discovery] Automatically resolved local IP: %s\n", ipStr)
				ips = append(ips, ipStr)
			}
		}
		conn.Close()
	}

	// 2. Get the public WAN IP using fast public APIs in case of NAT/Internet connections or VPN
	ctx, cancel := context.WithTimeout(context.Background(), 2500*time.Millisecond)
	defer cancel()

	endpoints := []string{
		"https://api.ipify.org",
		"https://ifconfig.me/ip",
		"https://icanhazip.com",
	}

	for _, endpoint := range endpoints {
		req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
		if err != nil {
			continue
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err == nil {
			ipStr := strings.TrimSpace(string(body))
			if ipStr != "" && !strings.Contains(ipStr, " ") {
				fmt.Printf("[Programmatic Discovery] Automatically resolved public IP: %s\n", ipStr)
				ips = append(ips, ipStr)
				break // Got a valid public address, done!
			}
		}
	}

	return ips
}

// Create a new libp2p Host listening on the specified port
func makeHost(port int, announceIPs []string) (host.Host, error) {
	// Setup TCP listen address
	sourceMultiAddr, err := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/0.0.0.0/tcp/%d", port))
	if err != nil {
		return nil, err
	}

	// Setup UDP/QUIC listen address for superior NAT hole punching
	quicMultiAddr, err := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/0.0.0.0/udp/%d/quic-v1", port))
	if err != nil {
		return nil, err
	}

	opts := []libp2p.Option{
		libp2p.ListenAddrs(sourceMultiAddr, quicMultiAddr),
		// Use modern Security layer (Noise is default in go-libp2p)
		libp2p.DefaultSecurity,
		// Multiplexers: Yamux or Mplex
		libp2p.DefaultMuxers,
		libp2p.DefaultTransports,
		// UPnP & NAT-PMP active port forwarding
		libp2p.NATPortMap(),
		// Enable Circuit Relay v2 clients to connect/relay via static public routers
		libp2p.EnableRelay(),
		// Enable decentralized Direct Connection Utility for NAT Hole Punching (DCUtR) 
		libp2p.EnableHolePunching(),
	}

	// Combine manual announce IPs with programmatically discovered ones
	autoIPs := getAutoIPs()
	allAnnounceIPs := append(announceIPs, autoIPs...)

	// Configure AnnounceAddrs to override netlink interface resolution failure on Android/Termux
	if len(allAnnounceIPs) > 0 {
		var announceAddrs []multiaddr.Multiaddr
		for _, ip := range allAnnounceIPs {
			ip = strings.TrimSpace(ip)
			if ip == "" {
				continue
			}
			// If it's already a multiaddress, parse it directly
			if strings.HasPrefix(ip, "/") {
				maddr, err := multiaddr.NewMultiaddr(ip)
				if err == nil {
					announceAddrs = append(announceAddrs, maddr)
				}
			} else {
				// Otherwise, assume raw IP and build TCP and QUIC-v1 multiaddresses automatically
				maddrTCP, err := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/%s/tcp/%d", ip, port))
				if err == nil {
					announceAddrs = append(announceAddrs, maddrTCP)
				}
				maddrQUIC, err := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/%s/udp/%d/quic-v1", ip, port))
				if err == nil {
					announceAddrs = append(announceAddrs, maddrQUIC)
				}
			}
		}
		if len(announceAddrs) > 0 {
			opts = append(opts, libp2p.AnnounceAddrs(announceAddrs...))
		}
	}

	return libp2p.New(opts...)
}

// Set up DHT Routing for rendezvous lookup
func setupDHT(ctx context.Context, h host.Host, bootstrapPeers []string) (*dht.IpfsDHT, error) {
	// ModeAuto automatically determines whether to run as a DHT Server (public IP) or DHT Client (NAT)
	kademliaDHT, err := dht.New(ctx, h, dht.Mode(dht.ModeAuto))
	if err != nil {
		return nil, err
	}

	// Bootstrap DHT routing table
	if err = kademliaDHT.Bootstrap(ctx); err != nil {
		return nil, err
	}

	return kademliaDHT, nil
}

// Connect to bootstrap peers
func bootstrapConnect(ctx context.Context, h host.Host, bootstrapPeers []string) {
	if len(bootstrapPeers) == 0 {
		return
	}
	fmt.Println("[*] Connecting to DHT bootstrap nodes...")
	for _, peerAddrRaw := range bootstrapPeers {
		addr, err := multiaddr.NewMultiaddr(peerAddrRaw)
		if err != nil {
			continue
		}
		peerinfo, err := peer.AddrInfoFromP2pAddr(addr)
		if err != nil {
			continue
		}

		go func(info *peer.AddrInfo) {
			if err := h.Connect(ctx, *info); err != nil {
				// Failed to connect to this specific bootstrap, which is fine
			} else {
				fmt.Printf("[+] Established connection to bootstrap node: %s\n", info.ID.ShortString())
			}
		}(peerinfo)
	}
}

// Setup local mDNS peer discovery handler
type discoveryNotifee struct {
	h host.Host
	c func(peer.AddrInfo)
}

func (n *discoveryNotifee) HandlePeerFound(peerInfo peer.AddrInfo) {
	n.c(peerInfo)
}

func setupMDNS(h host.Host, serviceTag string, callback func(peer.AddrInfo)) {
	s := mdns.NewMdnsService(h, serviceTag, &discoveryNotifee{h: h, c: callback})
	if err := s.Start(); err != nil {
		log.Println("[!] Failed to start mDNS service:", err)
	}
}

// Periodically search for new peers via the Rendezvous string
func discoveryLoop(ctx context.Context, h host.Host, routingDiscovery *discoveryrouting.RoutingDiscovery, rendezvous string, nickname string) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Search for peers advertising this rendezvous namespace
			peerChan, err := routingDiscovery.FindPeers(ctx, rendezvous)
			if err != nil {
				continue
			}

			for peerInfo := range peerChan {
				if peerInfo.ID == h.ID() {
					continue
				}

				// Check if we are already connected to this peer
				if h.Network().Connectedness(peerInfo.ID) == network.Connected {
					continue
				}

				fmt.Printf("[Rendezvous] Found new peer in room \"%s\": %s\n", rendezvous, peerInfo.ID.ShortString())
				err := h.Connect(ctx, peerInfo)
				if err != nil {
					// Could not connect, which is common in decentralized setup
					continue
				}

				fmt.Printf("[Rendezvous] Connected to room peer %s!\n", peerInfo.ID.ShortString())
				openChatStream(ctx, h, peerInfo.ID, nickname)
			}
		}
	}
}

// Open an outgoing chat stream context to a specific peer
func openChatStream(ctx context.Context, h host.Host, peerID peer.ID, nickname string) {
	// Avoid creating multiple streams if already connected and communicating
	s, err := h.NewStream(ctx, peerID, chatProtocol)
	if err != nil {
		return
	}
	// Handshake or write initial info
	rw := bufio.NewReadWriter(bufio.NewReader(s), bufio.NewWriter(s))
	go writeStreamLoop(rw, nickname)
	go readStreamLoop(rw)
}

// Read message strings from an incoming stream network endpoint
func handleIncomingStream(s network.Stream, nickname string) {
	fmt.Printf("\n[Stream] Incoming connection opened from peer: %s\n", s.Conn().RemotePeer().ShortString())
	rw := bufio.NewReadWriter(bufio.NewReader(s), bufio.NewWriter(s))
	
	// Create reading thread
	go readStreamLoop(rw)
	// Create writing loop linking console to this stream
	go writeStreamLoop(rw, nickname)
}

var activeStreams []*bufio.ReadWriter

func readStreamLoop(rw *bufio.ReadWriter) {
	for {
		str, err := rw.ReadString('\n')
		if err != nil {
			// Stream ended on peer side
			return
		}

		if str == "" {
			continue
		}

		str = strings.TrimSuffix(str, "\n")
		parts := strings.SplitN(str, ": ", 2)
		if len(parts) == 2 {
			fmt.Printf("\r\x1b[32m[%s]:\x1b[0m %s\n> ", parts[0], parts[1])
		} else {
			fmt.Printf("\r\x1b[34m[Peer]:\x1b[0m %s\n> ", str)
		}
	}
}

func writeStreamLoop(rw *bufio.ReadWriter, nickname string) {
	activeStreams = append(activeStreams, rw)
}

// Global console engine for user shell interaction
func chatConsole(ctx context.Context, h host.Host, nickname string) {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Type your message and press ENTER. Commands: /peers, /me, /exit\n> ")

	for {
		select {
		case <-ctx.Done():
			return
		default:
			input, err := reader.ReadString('\n')
			if err != nil {
				return
			}

			input = strings.TrimSpace(input)
			if input == "" {
				fmt.Print("> ")
				continue
			}

			// Handle custom console commands
			if strings.HasPrefix(input, "/") {
				cmdParts := strings.Split(input, " ")
				switch cmdParts[0] {
				case "/peers":
					fmt.Println("--- Connected Peers ---")
					peers := h.Network().Peers()
					if len(peers) == 0 {
						fmt.Println("No active connections. Searching...")
					} else {
						for idx, p := range peers {
							fmt.Printf("[%d] %s (%s)\n", idx+1, p.String(), h.Network().Connectedness(p))
						}
					}
				case "/me":
					fmt.Printf("Nickname: %s | PeerID: %s\n", nickname, h.ID())
				case "/exit":
					fmt.Println("[*] Exiting chat...")
					os.Exit(0)
				default:
					fmt.Println("[!] Unknown command. Use /peers, /me, or /exit")
				}
				fmt.Print("> ")
				continue
			}

			// Format: "Nick: Message"
			payload := fmt.Sprintf("%s: %s\n", nickname, input)

			// Broadcast message to all discovered/connected streams
			var aliveStreams []*bufio.ReadWriter
			for _, rw := range activeStreams {
				_, err := rw.WriteString(payload)
				if err == nil {
					rw.Flush()
					aliveStreams = append(aliveStreams, rw)
				}
			}
			activeStreams = aliveStreams // Keep active streams only

			fmt.Print("> ")
		}
	}
}
