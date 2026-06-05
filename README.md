# P2P Multi-Device Chat (Go & libp2p)

This is a fully decentralized, serverless Peer-to-Peer (P2P) chat application built in **Go** using the **libp2p** framework. It uses **Kademlia DHT (Distributed Hash Table)** for global peer discovery and routing, enabling automatic node discovery and handshaking across different devices and NAT networks without requiring a central database or server.

---

## 🛠 Why did discovery fail when running two nodes on the same Termux environment?

If you try to run multiple nodes inside the **same Termux console environment or the same device loopback**, you will encounter connection errors like:
* `CRYPTO_ERROR 0x12a: peer id mismatch`
* `failed client selection: identical nonces`
* `all dials failed: context deadline exceeded`

### The technical explanation:
1. **Loopback & local IP bindings**: When two instances run in the same Termux environment, both register listening addresses pointing to identical local interfaces (`127.0.0.1` and `198.18.0.1`). 
2. **Socket Conflict**: When Node B tries to connect to Node A's advertised multiaddress, the OS networking stack loops the connection back onto the *same* active port/environment. The cryptographic handshake fails because the incoming connection is intercepted by Node B's own socket or results in security negotiation key crossovers (identical nonces).
3. **NAT Isolation**: Since both nodes appear on the exact same public and private network namespace, the libp2p Transport security layer detects a loopback collision and closes the connection to prevent self-dialing bugs.

**To test the actual decentralized DHT orchestration, the nodes must be run on separate physical devices (e.g., one on Windows, one on Android in Termux).**

---

## 🖥 Step 1: Running the Chat on Windows

### Prerequisites
1. Download and install **Go (Golang)** for Windows: [golang.org/dl/](https://golang.org/dl/)
2. Open **Command Prompt (cmd)** or **PowerShell** and verify Go is installed:
   ```bash
   go version
   ```

### Option A: Check out the code and Build on Windows
If you have Git and Go installed on your Windows machine:
1. Clone your repository:
   ```bash
   git clone https://github.com/LeonidYasin/p2p-chat.git
   cd p2p-chat
   ```
2. Download and synchronize the dependencies (creates the `go.sum` file):
   ```bash
   go mod tidy
   ```
3. Build the executable binary:
   ```bash
   go build -o p2pchat.exe main.go
   ```
4. Run the node (e.g. on port `3001` with nickname `WinUser`):
   ```bash
   .\p2pchat.exe -port 3001 -nick WinUser -udp=false -mdns=false
   ```

### Option B: Cross-compile on Android/Termux for Windows
You can compile the Windows `.exe` binary directly from your Termux (or any other machine) using Golang’s built-in cross-compilation, then send the `.exe` to your PC:
1. In Termux, run:
   ```bash
   GOOS=windows GOARCH=amd64 go build -o p2pchat.exe main.go
   ```
2. Transfer `p2pchat.exe` to your Windows PC (via Telegram, cloud, or USB).
3. Open Windows PowerShell in the folder where the file is saved and launch it:
   ```bash
   .\p2pchat.exe -port 3001 -nick WinUser -udp=false -mdns=false
   ```

> 🛡️ **Windows Defender/Firewall Notice:**
> When you first launch `p2pchat.exe`, Windows Firewall will display a pop-up. You **must click "Allow Access"** for both Public and Private networks. Otherwise, inbound connection packets from your phone will be blocked!

---

## 📱 Step 2: Running the Chat on Android (Termux)

Termux provides a fully functional Linux terminal environment inside Android, allowing you to run native Go binaries with full network access.

### 1. Install & Update Termux
Download Termux (preferably from [F-Droid](https://f-droid.org/en/packages/com.termux/) for the latest package streams, as the Google Play Store version is deprecated).

### 2. Install Dependencies inside Termux
Open Termux and run the following setup commands:
```bash
# Update package repositories
pkg update -y && pkg upgrade -y

# Install Git and Golang
pkg install git golang -y
```

### 3. Clone and Build the Application
```bash
# Clone your repository
git clone https://github.com/LeonidYasin/p2p-chat.git
cd p2p-chat

# Ensure Go download modules are synchronized
go mod tidy

# Build the executable
go build -o p2pchat main.go
```

### 4. Run the Node
Launch your Android peer on a different port (e.g. `3002`) with a distinct nickname:
```bash
./p2pchat -port 3002 -nick PhoneUser -udp=false -mdns=false
```

---

## 🌐 Step 3: Experiencing Automatic DHT Rendezvous Discovery

Once both peers are running on separate devices, they will automatically find and connect to each other over the global internet!

1. **Bootstrap Phase**: Both Windows and Android nodes will independently connect to the official, public libp2p DHT bootstrap nodes.
2. **Rendezvous Peer Registration**: Both nodes pitch their cryptographic multiaddresses to the global Kad-DHT indexing space under the uniform namespace `"chat-with-rendezvous"`.
3. **Handshake Action**:
   - The nodes periodically query the DHT for this room name.
   - When the Android node discovers the Windows node's peer ID, it signals connection requests.
   - Using built-in **AutoNAT** and **DCUtR** (Direct Connection Utility with Relay), the peers negotiate firewalls and establish a fully encrypted, point-to-point chat link.
4. **Chatting**: Once connected, you can type your message in either terminal and press **ENTER**. The message is pushed privately over the secure, cryptographic stream!

### Interaction Commands
Inside either terminal, you can interact with the P2P engine using these console commands:
* `/peers` — Lists details of all cryptographically-paired peers.
* `/netinfo` — Displays internal routing tables and listener addresses.
* `/connect <multiaddress>` — Manually connects to a target peer if automatic discovery suffers high NAT packet loss.
* `/me` — Displays your current node's active listening addresses and cryptographic Peer ID.
* `/exit` — Shuts down the daemon safely.
