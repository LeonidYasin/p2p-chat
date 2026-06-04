export interface PeerID {
  id: string; // Peer ID (e.g., QmXoypizjW3WknFixtUB487fNGL97ytDGdzZoxeT38xA4v)
  shortId: string; // Short version (e.g., QmXoypi...)
}

export interface NetworkLog {
  id: string;
  timestamp: string;
  type: 'system' | 'discovery' | 'stream' | 'chat' | 'error';
  direction?: 'in' | 'out';
  message: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderNick: string;
  content: string;
  timestamp: number;
}

export interface P2PNode {
  id: string;             // Node ID (local simulator id)
  peerId: string;         // Unique p2p Peer ID
  nickname: string;       // User's name in chat
  port: number;           // Bind port
  bootstrapMode: boolean; // Is it a bootstrap node?
  isOnline: boolean;      // Running state
  rendezvous: string;     // Rendezvous string subscribed to
  peers: string[];        // PeerIDs of connected nodes
  logs: NetworkLog[];     // Console and system logs
  chatHistory: DirectMessage[]; // Direct chat messages
  currentInput: string;   // Active input in terminal screen
  discoveryState?: 'offline' | 'bootstrapping' | 'querying_dht' | 'searching_room' | 'connected';
}

export interface RendezvousRoom {
  name: string;
  nodes: string[];        // Node IDs inside room
}

export interface GlobalNetworkConfig {
  rendezvousString: string;
  useMDNS: boolean;
  latencyMs: number; // Simulated connection delay
  packetLossPercent: number; // Simulated packet loss
}
