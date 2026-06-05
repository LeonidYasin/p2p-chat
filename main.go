package main

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
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
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/multiformats/go-multiaddr"
)

// Define protocol constants
const chatProtocol = protocol.ID("/libp2p/chat/1.0.0")
const mdnsServiceTag = "libp2p-local-chat"

var (
	cachedLocalIP  string
	cachedPublicIP string
)

func main() {
	// Suppress the spammy netlink-permission errors in basichost because of Android/Termux environments
	ipfslog.SetLogLevel("basichost", "fatal")

	// Parse command-line flags
	config := parseFlags()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	fmt.Printf("[*] Starting Peer-to-Peer node as \"%s\"...\n", config.Nickname)

	// 1. Create the libp2p host with automatic port conflict resolution
	var h host.Host
	var err error
	listenPort := config.ListenPort
	for attempt := 0; attempt < 20; attempt++ {
		h, err = makeHost(listenPort, config.AnnounceIPs)
		if err == nil {
			break
		}
		errStr := err.Error()
		if strings.Contains(errStr, "address already in use") || strings.Contains(errStr, "bind") {
			if config.ListenPort == 0 {
				log.Fatalln("[!] Failed to create host on random port:", err)
			}
			fmt.Printf("[!] Port %d is already in use. Retrying with port %d...\n", listenPort, listenPort+1)
			listenPort++
			continue
		}
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
	bootstrapConnect(ctx, h, kademliaDHT, config.BootstrapPeers)

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

	// 4b. Start custom UDP broadcast discovery if enabled
	if config.EnableUDP {
		fmt.Println("[*] Setting up netlink-free custom UDP broadcast discovery for Termux session sync...")
		localIP, _ := getAutoIPs()
		go setupUDPDiscovery(ctx, h, localIP, listenPort, config.Nickname)
	} else {
		fmt.Println("[*] Custom UDP Broadcast discovery is disabled via -udp=false flag.")
	}

	// 5. Start DHT Rendezvous discovery
	if config.RendezvousString != "" {
		fmt.Printf("[*] Advertising and searching rendezvous room: \"%s\"...\n", config.RendezvousString)
		routingDiscovery := discoveryrouting.NewRoutingDiscovery(kademliaDHT)
		
		// Launch background advertiser loop that waits for connection first
		go func() {
			// First, wait for at least one connection or routing table entry to establish
			for {
				select {
				case <-ctx.Done():
					return
				default:
					if len(h.Network().Conns()) > 0 || kademliaDHT.RoutingTable().Size() > 0 {
						goto StartAdvertising
					}
					time.Sleep(1 * time.Second)
				}
			}
			
StartAdvertising:
			// Periodically advertise presence to the global DHT routing table
			ticker := time.NewTicker(45 * time.Second)
			defer ticker.Stop()
			
			// Initial advertise once connection is confirmed
			fmt.Printf("\n[DHT: 📡 Advertising] Registering node in room \"%s\" on the global Kad-DHT...\n> ", config.RendezvousString)
			discoveryutil.Advertise(ctx, routingDiscovery, config.RendezvousString)
			
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					if len(h.Network().Conns()) > 0 || kademliaDHT.RoutingTable().Size() > 0 {
						discoveryutil.Advertise(ctx, routingDiscovery, config.RendezvousString)
					}
				}
			}
		}()

		// Continuously search for other peers in background
		go discoveryLoop(ctx, h, kademliaDHT, routingDiscovery, config.RendezvousString, config.Nickname, config.BootstrapPeers)
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
	EnableUDP        bool
	BootstrapPeers   []string
	AnnounceIPs      []string
}

func parseFlags() *Config {
	port := flag.Int("port", 0, "port to listen on (0 for random)")
	nick := flag.String("nick", "anonymous", "nickname for the chat session")
	rendezvous := flag.String("room", "chat-with-rendezvous", "rendezvous string for peer discovery")
	useMdns := flag.Bool("mdns", true, "enable local mDNS peer discovery")
	useUdp := flag.Bool("udp", true, "enable custom local UDP broadcast peer discovery")
	bootstrapRaw := flag.String("bootstrap", "", "comma-separated list of multiaddresses for bootstraps")
	announceRaw := flag.String("announce", "", "comma-separated list of IP addresses or multiaddresses to announce manually")

	flag.Parse()

	var bootstraps []string
	if *bootstrapRaw != "" {
		bootstraps = strings.Split(*bootstrapRaw, ",")
	} else {
		for _, addr := range dht.DefaultBootstrapPeers {
			bootstraps = append(bootstraps, addr.String())
		}
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
		EnableUDP:        *useUdp,
		BootstrapPeers:   bootstraps,
		AnnounceIPs:      announceIPs,
	}
}

// Helper to automatically query outbound local and public IPs without calling netlink InterfaceAddrs (which fails on Android/Termux)
func getAutoIPs() (string, string) {
	localIP := "127.0.0.1"
	publicIP := ""

	// 1. Get the local interface IP through a UDP dial (this doesn't send packets, just asks routing table for outbound interface IP)
	conn, err := net.Dial("udp", "1.1.1.1:80")
	if err == nil {
		if localAddr, ok := conn.LocalAddr().(*net.UDPAddr); ok {
			ipStr := localAddr.IP.String()
			if ipStr != "127.0.0.1" && ipStr != "::1" && ipStr != "" {
				fmt.Printf("[Programmatic Discovery] Automatically resolved local IP: %s\n", ipStr)
				localIP = ipStr
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
				publicIP = ipStr
				break // Got a valid public address, done!
			}
		}
	}

	return localIP, publicIP
}

// Create a new libp2p Host listening on the specified port
func makeHost(port int, announceIPs []string) (host.Host, error) {
	localIP, publicIP := getAutoIPs()
	cachedLocalIP = localIP
	cachedPublicIP = publicIP

	var listenAddrs []multiaddr.Multiaddr

	// Always listen on localhost
	maddrLocalTCP, err := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/127.0.0.1/tcp/%d", port))
	if err == nil {
		listenAddrs = append(listenAddrs, maddrLocalTCP)
	}
	maddrLocalQUIC, err := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/127.0.0.1/udp/%d/quic-v1", port))
	if err == nil {
		listenAddrs = append(listenAddrs, maddrLocalQUIC)
	}

	// Listen on dynamic programmatic local interface IP if resolved
	if localIP != "127.0.0.1" && localIP != "" {
		maddrIP4TCP, err := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/%s/tcp/%d", localIP, port))
		if err == nil {
			listenAddrs = append(listenAddrs, maddrIP4TCP)
		}
		maddrIP4QUIC, err := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/%s/udp/%d/quic-v1", localIP, port))
		if err == nil {
			listenAddrs = append(listenAddrs, maddrIP4QUIC)
		}
	}

	// Fallback to listening on 0.0.0.0 if for some reason we yielded no valid addresses
	if len(listenAddrs) == 0 {
		maddrTCPDefault, _ := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/0.0.0.0/tcp/%d", port))
		maddrQUICDefault, _ := multiaddr.NewMultiaddr(fmt.Sprintf("/ip4/0.0.0.0/udp/%d/quic-v1", port))
		listenAddrs = []multiaddr.Multiaddr{maddrTCPDefault, maddrQUICDefault}
	}

	opts := []libp2p.Option{
		libp2p.ListenAddrs(listenAddrs...),
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

	// Gather all announce addresses
	var announceAddrs []multiaddr.Multiaddr

	// Include local IP and public IP
	var allIPs []string
	if localIP != "127.0.0.1" && localIP != "" {
		allIPs = append(allIPs, localIP)
	}
	if publicIP != "" {
		allIPs = append(allIPs, publicIP)
	}
	// Add manual ones if provided as flag overrides
	for _, ip := range announceIPs {
		ip = strings.TrimSpace(ip)
		if ip != "" {
			allIPs = append(allIPs, ip)
		}
	}

	for _, ip := range allIPs {
		if strings.HasPrefix(ip, "/") {
			maddr, err := multiaddr.NewMultiaddr(ip)
			if err == nil {
				announceAddrs = append(announceAddrs, maddr)
			}
		} else {
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
		// Use AddrsFactory to yield standard listen addresses AND public/announced addresses!
		opts = append(opts, libp2p.AddrsFactory(func(addrs []multiaddr.Multiaddr) []multiaddr.Multiaddr {
			// Combine our listen addresses with the resolved manual or public announce addresses
			merged := make([]multiaddr.Multiaddr, 0, len(addrs)+len(announceAddrs))
			merged = append(merged, addrs...)

			// De-duplicate addresses
			seen := make(map[string]bool)
			for _, addr := range addrs {
				seen[addr.String()] = true
			}
			for _, maddr := range announceAddrs {
				if !seen[maddr.String()] {
					merged = append(merged, maddr)
					seen[maddr.String()] = true
				}
			}
			return merged
		}))
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

	return kademliaDHT, nil
}

// Connect to bootstrap peers
func bootstrapConnect(ctx context.Context, h host.Host, kademliaDHT *dht.IpfsDHT, bootstrapPeers []string) {
	if len(bootstrapPeers) == 0 {
		fmt.Println("[!] No bootstrap peers specified. Running in isolated mode.")
		return
	}
	fmt.Printf("[*] Connecting to %d DHT bootstrap node(s)...\n", len(bootstrapPeers))
	
	var wg sync.WaitGroup
	var successCount int32
	var failCount int32

	for _, peerAddrRaw := range bootstrapPeers {
		addr, err := multiaddr.NewMultiaddr(peerAddrRaw)
		if err != nil {
			fmt.Printf("[!] Bootstrap address parse error for %s: %v\n", peerAddrRaw, err)
			continue
		}
		peerinfo, err := peer.AddrInfoFromP2pAddr(addr)
		if err != nil {
			fmt.Printf("[!] Bootstrap peer info error for %s: %v\n", peerAddrRaw, err)
			continue
		}

		wg.Add(1)
		go func(info *peer.AddrInfo) {
			defer wg.Done()
			fmt.Printf("[*] Routing: Handshaking with bootstrap node: %s...\n", info.ID.ShortString())
			if err := h.Connect(ctx, *info); err != nil {
				atomic.AddInt32(&failCount, 1)
			} else {
				atomic.AddInt32(&successCount, 1)
				fmt.Printf("[+] Established connection to DHT bootstrap: %s!\n", info.ID.ShortString())
			}
		}(peerinfo)
	}

	// Print feedback and trigger DHT bootstrap routing table refresh
	go func() {
		wg.Wait()
		s := atomic.LoadInt32(&successCount)
		f := atomic.LoadInt32(&failCount)
		fmt.Printf("[*] DHT Bootstrap Result: %d connected, %d failed.\n", s, f)
		if s == 0 {
			fmt.Println("[!] WARNING: Initial bootstrap active connections: 0.")
			fmt.Println("    To test global peer discovery, at least one bootstrap must connect successfully.")
			fmt.Println("    Ensure you have an active internet connection and UDP/TCP ports allow outbound traffic.")
		} else {
			fmt.Printf("[+] Successfully attached to the global P2P Kad-DHT routing table (Connected to %d boots)!\n", s)
			
			// Refresh & populate routing table now that we have alive connections
			if err := kademliaDHT.Bootstrap(ctx); err != nil {
				fmt.Printf("[!] Warning: Failed to bootstrap Kademlia DHT routing table: %v\n", err)
			} else {
				fmt.Println("[*] Kademlia DHT routing table bootstrap query initiated successfully.")
			}
		}
		fmt.Print("> ")
	}()
}

// bootstrapConnectQuiet seamlessly and quietly attempts to dial DHT bootstrap nodes to restore routing health
func bootstrapConnectQuiet(ctx context.Context, h host.Host, bootstrapPeers []string) {
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
			_ = h.Connect(ctx, *info)
		}(peerinfo)
	}
}

// Extract own listening IP/port maps to prevent loopback and self-dials
func getOwnIPsAndPorts(h host.Host) (map[string]bool, map[string]bool) {
	ips := make(map[string]bool)
	ports := make(map[string]bool)
	
	ips["127.0.0.1"] = true
	ips["::1"] = true
	ips["0.0.0.0"] = true
	
	for _, maddr := range h.Addrs() {
		parts := strings.Split(maddr.String(), "/")
		for i, part := range parts {
			if part == "ip4" || part == "ip6" {
				if i+1 < len(parts) {
					ips[parts[i+1]] = true
				}
			}
			if part == "tcp" || part == "udp" {
				if i+1 < len(parts) {
					ports[parts[i+1]] = true
				}
			}
		}
	}
	return ips, ports
}

// Determines if a candidate address matches our own private IP/loopback combined with our active port
func isSelfAddress(addr multiaddr.Multiaddr, ownIPs map[string]bool, ownPorts map[string]bool) bool {
	parts := strings.Split(addr.String(), "/")
	hasOwnIP := false
	hasOwnPort := false
	
	for i, part := range parts {
		if part == "ip4" || part == "ip6" {
			if i+1 < len(parts) {
				ip := parts[i+1]
				if ownIPs[ip] {
					hasOwnIP = true
				}
			}
		}
		if part == "tcp" || part == "udp" {
			if i+1 < len(parts) {
				port := parts[i+1]
				if ownPorts[port] {
					hasOwnPort = true
				}
			}
		}
	}
	return hasOwnIP && hasOwnPort
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
		fmt.Println("[*] Standard mDNS local discovery is unsupported in this environment due to OS netlink restrictions. Custom UDP Broadcast Discovery is active to handle auto connections instead.")
	}
}

// Periodically search for new peers via the Rendezvous string
func discoveryLoop(ctx context.Context, h host.Host, kademliaDHT *dht.IpfsDHT, routingDiscovery *discoveryrouting.RoutingDiscovery, rendezvous string, nickname string, bootstrapPeers []string) {
	// Let bootstrapping start first for 3 seconds before querying DHT
	time.Sleep(3 * time.Second)

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	runSearch := func() {
		conns := len(h.Network().Conns())
		rtSize := kademliaDHT.RoutingTable().Size()

		if conns == 0 && rtSize == 0 {
			fmt.Printf("\n[Поиск: 📡 Ожидание / Search: 📡 Waiting] Комната / Room: \"%s\"\n", rendezvous)
			fmt.Printf("   📶 Подключение к DHT бутстрап-серверам: 0 %s\n", "🔴")
			fmt.Printf("   💡 [P2P Справка]: Первичное подключение к DHT-сети обычно занимает от 5 до 15 секунд.\n")
			fmt.Printf("      Убедитесь, что интернет активен (Wi-Fi или сотовая связь).\n")
			fmt.Printf("   💡 [P2P Info]: Initial DHT boot strap takes 5-15s. Checking internet...\n> ")
			bootstrapConnectQuiet(ctx, h, bootstrapPeers)
			return
		}

		if conns > 0 && rtSize == 0 {
			fmt.Printf("\n[Поиск: 📡 Сеть активна / Search: 📡 DHT Connected] Комната / Room: \"%s\"\n", rendezvous)
			fmt.Printf("   📶 Соединение с DHT: Установлено (%d бутстрапов) %s\n", conns, "🟢")
			fmt.Printf("   📊 Сборка таблицы маршрутизации Kademlia (Размер RT: 0) %s\n", "🔄")
			fmt.Printf("   💡 [P2P Справка]: Строим таблицы маршрутизации и скачиваем индексы комнаты. Это занимает ~10-25 секунд.\n")
			fmt.Printf("      На Android / Termux это может идти чуть дольше из-за ограничений ОС.\n")
			fmt.Printf("   💡 [P2P Info]: Building Kademlia routing tables. Downloading indexes (10-25s)...\n> ")
			_ = kademliaDHT.Bootstrap(ctx)
			return
		}

		fmt.Printf("\n[Поиск: 📡 Активный сканирование / Search: 📡 Crawling DHT] Комната / Room: \"%s\"\n", rendezvous)
		fmt.Printf("   📶 Активные узлы DHT / Routing links: %d | Размер таблицы / RT Size: %d %s\n", conns, rtSize, "🟢")
		fmt.Printf("   🔍 Сканируем глобальный DHT-индекс на наличие собеседников... / Looking for active candidates...\n> ")
		peerChan, err := routingDiscovery.FindPeers(ctx, rendezvous)
		if err != nil {
			fmt.Printf("\n[Search: ⚠️ Error] Failed to crawl DHT indexes: %v\n> ", err)
			return
		}

		foundAny := false
		ownIPs, ownPorts := getOwnIPsAndPorts(h)

		for peerInfo := range peerChan {
			if peerInfo.ID == h.ID() {
				continue
			}

			// Check if we are already connected to this peer
			if h.Network().Connectedness(peerInfo.ID) == network.Connected {
				continue
			}

			// Filter out our own active listening multiaddresses (combining IP & Port) to prevent self-dials
			var cleanAddrs []multiaddr.Multiaddr
			for _, addr := range peerInfo.Addrs {
				if isSelfAddress(addr, ownIPs, ownPorts) {
					continue
				}
				cleanAddrs = append(cleanAddrs, addr)
			}

			if len(cleanAddrs) == 0 {
				continue // Skip dialing if discovered IP addresses only loopback/point to ourselves on this active port
			}
			peerInfo.Addrs = cleanAddrs

			foundAny = true
			fmt.Printf("\n[Поиск: ✨ Пир обнаружен / Search: ✨ Peer Discovered] Ник/ID: \"%s\" (ID: %s) в комнате \"%s\"!\n", peerInfo.ID.ShortString(), peerInfo.ID.String()[:12]+"...", rendezvous)
			fmt.Printf("   🔗 [1/2] Начинаем установку защищенного соединения (Noise / Handshake)... / Starting handshake...\n> ")
			
			// Try to connect to peer
			err := h.Connect(ctx, peerInfo)
			if err != nil {
				shortErr := err.Error()
				if strings.Contains(shortErr, "all dials failed") {
					shortErr = "Препятствие NAT: Все попытки прямого подключения заблокированы роутером или оператором связи."
				} else if strings.Contains(shortErr, "connection refused") {
					shortErr = "Порт удаленной машины закрыт или отклонил входящее соединение."
				} else if strings.Contains(shortErr, "context deadline exceeded") {
					shortErr = "Таймаут ожидания рукопожатия (Handshake Dial Timeout)."
				}
				
				fmt.Printf("\n[Search: ⚠️ NAT Obstacle] Узел %s зарегистрирован в DHT, но прямое подключение отклонено: %s\n", peerInfo.ID.ShortString(), shortErr)
				fmt.Printf("   💡 [Почему это происходит? / NAT Explanation]:\n")
				fmt.Printf("      - На WINDOWS: Wi-Fi роутеры чаще всего Full Cone / Restricted NAT (порты легко пробиваются).\n")
				fmt.Printf("      - На ANDROID (Termux): Мобильный интернет (4G/5G) использует жесткий CGNAT (Carrier-Grade NAT) оператора.\n")
				fmt.Printf("      - Напрямую такие устройства соединиться не могут. Сеть libp2p сейчас автоматически пытается пробить NAT\n")
				fmt.Printf("        с помощью протокола Hole Punching (DCUtR) или перенаправляет трафик через публичные реле-ноды (Relay v2).\n")
				fmt.Printf("      💡 ПОЖАЛУЙСТА, НЕ ЗАКРЫВАЙТЕ приложение! Процесс децентрализованного пробития NAT и ретрансляции идет непрерывно.\n> ")
				continue
			}

			fmt.Printf("\n[Search: 🎉 CONNECTED] Успешное соединение! Полный рукопожатие завершено с пиром %s! Настройка чат-канала...\n> ", peerInfo.ID.ShortString())
			openChatStream(ctx, h, peerInfo.ID, nickname)
		}

		if !foundAny {
			fmt.Printf("\n[Поиск: 📡 Поиск завершен / Search: 📡 Crawl Done] 0 других собеседников найдено на текущем цикле в комнате \"%s\".\n", rendezvous)
			fmt.Printf("   💡 (Поиск повторяется каждые 15 сек. Держите приложение запущенным. Проверьте правильность названия комнаты у обоих пиров!)\n> ")
		}
	}

	// First direct run
	runSearch()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runSearch()
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
	fmt.Print("Type your message and press ENTER. Commands: /peers, /connect <addr>, /netinfo, /me, /exit\n> ")

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
				case "/connect":
					if len(cmdParts) < 2 {
						fmt.Println("[!] Usage: /connect <multiaddress>")
						fmt.Print("> ")
						continue
					}
					targetAddrRaw := cmdParts[1]
					addr, err := multiaddr.NewMultiaddr(targetAddrRaw)
					if err != nil {
						fmt.Printf("[!] Multiaddress format error: %v\n", err)
						fmt.Print("> ")
						continue
					}
					peerinfo, err := peer.AddrInfoFromP2pAddr(addr)
					if err != nil {
						fmt.Printf("[!] Peer ID extraction error: %v\n", err)
						fmt.Print("> ")
						continue
					}
					fmt.Printf("[*] Manually dialing %s...\n", peerinfo.ID.ShortString())
					if err := h.Connect(ctx, *peerinfo); err != nil {
						fmt.Printf("[!] Manual connection failed: %v\n", err)
					} else {
						fmt.Printf("[+] Manually connected to %s!\n", peerinfo.ID.ShortString())
						openChatStream(ctx, h, peerinfo.ID, nickname)
					}
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
				case "/netinfo":
					fmt.Println("\n======================================================================")
					fmt.Println("🌐 P2P NETWORK DIAGNOSTICS & STATUS")
					fmt.Println("======================================================================")
					fmt.Printf("● Nickname:            %s\n", nickname)
					fmt.Printf("● Peer ID:             %s\n", h.ID().String())
					
					fmt.Println("\n📡 Listen & Announced Multiaddresses:")
					addrs := h.Addrs()
					if len(addrs) == 0 {
						fmt.Println("  [!] Warning: Host is not listening on any address")
					} else {
						for _, addr := range addrs {
							fmt.Printf("  └─ %s/p2p/%s\n", addr.String(), h.ID().String())
						}
					}

					fmt.Println("\n🛡️ NAT & Sandbox Environment Analysis:")
					local := cachedLocalIP
					if local == "" {
						local = "127.0.0.1"
					}
					public := cachedPublicIP
					fmt.Printf("  └─ Local Interface IP: %s\n", local)
					if public != "" {
						fmt.Printf("  └─ Public WAN IP:      %s\n", public)
						if local == public {
							fmt.Println("  └─ NAT Type:           Public (No NAT / Direct Internet Interface)")
						} else {
							// Heuristic classification
							isCarrierGrade := strings.HasPrefix(local, "100.64.") || strings.HasPrefix(local, "198.18.")
							if isCarrierGrade {
								fmt.Println("  └─ NAT Type:           Symmetric NAT / Carrier-Grade NAT (CGNAT) (Likely)")
								fmt.Println("     💡 CGNAT is heavily restrictive (typical of mobile LTE/5G).")
								fmt.Println("        Direct peers will auto-connect via Hole Punching (DCUtR) or Relay.")
							} else {
								fmt.Println("  └─ NAT Type:           Restricted / Cone NAT (Likely)")
								fmt.Println("     💡 Standard home Wi-Fi NAT. Auto-traversal or UPnP should work easily.")
							}
						}
					} else {
						fmt.Println("  └─ Public WAN IP:      Unknown (Could not query WAN checker - Offline or no internet routing)")
						fmt.Println("  └─ NAT Type:           Unknown / Isolated Local Network")
					}
					
					fmt.Println("  └─ OS Sandbox Info:    Android/Termux detected. OS Netlink-route route discovery is restricted.")
					fmt.Println("  └─ Sync Discovery:     Custom-built UDP Broadcast synchronization is active on port 19999.")

					conns := h.Network().Conns()
					fmt.Printf("\n🔗 Connected Network Links (%d active connection(s)):\n", len(conns))
					if len(conns) == 0 {
						fmt.Println("  No active connections currently. Try connecting peers automatically or manually.")
					} else {
						for idx, c := range conns {
							remoteAddr := c.RemoteMultiaddr().String()
							remotePeer := c.RemotePeer().String()
							
							isRelayed := strings.Contains(remoteAddr, "/p2p-circuit")
							linkType := "DIRECT LINK"
							if isRelayed {
								linkType = "🔴 RELAYED CONNECTION (Circuit Relay v2)"
							} else {
								linkType = "🟢 DIRECT CONNECTION"
							}
							
							transport := "TCP"
							if strings.Contains(remoteAddr, "/udp") {
								if strings.Contains(remoteAddr, "/quic") {
									transport = "UDP-QUIC"
								} else {
									transport = "UDP"
								}
							}
							
							fmt.Printf("  [%d] Peer ID:   %s\n", idx+1, remotePeer)
							fmt.Printf("      Address:   %s\n", remoteAddr)
							fmt.Printf("      Type:      %s (%s transport)\n", linkType, transport)
						}
					}
					
					fmt.Println("\n🤝 Decentralized Auto-Traversal Technologies:")
					fmt.Println("  └─ UPnP/NAT-PMP Port Forwarding:  Active/Requested")
					fmt.Println("  └─ DCUtR Direct Hole Punching:     Enabled & Dynamic")
					fmt.Println("======================================================================\n")
				case "/exit":
					fmt.Println("[*] Exiting chat...")
					os.Exit(0)
				default:
					fmt.Println("[!] Unknown command. Use /peers, /netinfo, /me, or /exit")
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

// UDPDiscoveryPayload holds peer data exchanged over UDP broadcast
type UDPDiscoveryPayload struct {
	PeerID string   `json:"peer_id"`
	Addrs  []string `json:"addrs"`
	Nick   string   `json:"nick"`
}

// setupUDPDiscovery starts a custom UDP broadcast/multicast peer discovery
func setupUDPDiscovery(ctx context.Context, h host.Host, localIP string, listenPortInUse int, nickname string) {
	udpPort := 19999

	// 1. Create UDP broadcast listener config with SO_REUSEPORT & SO_REUSEADDR
	lc := net.ListenConfig{
		Control: func(network, address string, c syscall.RawConn) error {
			var opErr error
			err := c.Control(func(fd uintptr) {
				// Set socket options in a cross-platform manner
				setSocketOptions(fd)
			})
			if err != nil {
				return err
			}
			return opErr
		},
	}

	conn, err := lc.ListenPacket(ctx, "udp4", fmt.Sprintf("0.0.0.0:%d", udpPort))
	if err != nil {
		fmt.Printf("[!] Failed to setup custom UDP automatic-discovery listener: %v\n", err)
		return
	}
	defer conn.Close()

	udpConn, ok := conn.(*net.UDPConn)
	if !ok {
		return
	}

	// 2. Start Receiver Subroutine
	go func() {
		buf := make([]byte, 8192)
		for {
			select {
			case <-ctx.Done():
				return
			default:
				// Set short read deadlines to periodically wake up and evaluate context cancel
				udpConn.SetReadDeadline(time.Now().Add(1 * time.Second))
				n, _, rerr := udpConn.ReadFrom(buf)
				if rerr != nil {
					continue
				}

				var payload UDPDiscoveryPayload
				if jerr := json.Unmarshal(buf[:n], &payload); jerr != nil {
					continue
				}

				if payload.PeerID == h.ID().String() {
					continue // Ignore ourselves
				}

				peerID, perr := peer.Decode(payload.PeerID)
				if perr != nil {
					continue
				}

				// Only proceed if not already connected
				if h.Network().Connectedness(peerID) == network.Connected {
					continue
				}

				var maddrs []multiaddr.Multiaddr
				for _, addrStr := range payload.Addrs {
					maddr, merr := multiaddr.NewMultiaddr(addrStr)
					if merr == nil {
						maddrs = append(maddrs, maddr)
					}
				}

				if len(maddrs) == 0 {
					continue
				}

				peerInfo := peer.AddrInfo{
					ID:    peerID,
					Addrs: maddrs,
				}

				fmt.Printf("\n[UDP Discovery] Automatically discovered peer: %s (%s)\n> ", payload.Nick, peerID.ShortString())
				if connectErr := h.Connect(ctx, peerInfo); connectErr == nil {
					fmt.Printf("[UDP Discovery] Connected to %s!\n> ", payload.Nick)
					openChatStream(ctx, h, peerID, nickname)
				}
			}
		}
	}()

	// 3. Start Sender/Advertiser Loop
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	// Define destinations to broadcast to: universal, localhost, and dynamic subnet directed broadcast
	broadcastAddrs := []string{
		"127.0.0.1:19999",
		"255.255.255.255:19999",
	}

	if localIP != "127.0.0.1" && localIP != "" {
		parts := strings.Split(localIP, ".")
		if len(parts) == 4 {
			// Directed broadcast addresses for common networks
			broadcastAddrs = append(broadcastAddrs, fmt.Sprintf("%s.%s.%s.255:19999", parts[0], parts[1], parts[2]))
			broadcastAddrs = append(broadcastAddrs, fmt.Sprintf("%s.%s.255.255:19999", parts[0], parts[1]))
		}
	}

	var resolvedAddrs []*net.UDPAddr
	for _, addrStr := range broadcastAddrs {
		addr, rerr := net.ResolveUDPAddr("udp4", addrStr)
		if rerr == nil {
			resolvedAddrs = append(resolvedAddrs, addr)
		}
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var addrStrs []string
			for _, maddr := range h.Addrs() {
				// Publish all multiaddresses of this host to make sure peers on loopback, LAN or WAN run cleanly
				addrStrs = append(addrStrs, maddr.String())
			}

			if len(addrStrs) == 0 {
				continue
			}

			payload := UDPDiscoveryPayload{
				PeerID: h.ID().String(),
				Addrs:  addrStrs,
				Nick:   nickname,
			}

			data, merr := json.Marshal(payload)
			if merr != nil {
				continue
			}

			for _, dest := range resolvedAddrs {
				udpConn.WriteTo(data, dest)
			}
		}
	}
}
