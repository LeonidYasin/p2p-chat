import React, { useMemo, useEffect, useState } from 'react';
import { P2PNode } from '../types';
import { Globe, Shield, RefreshCw, Radio, Zap } from 'lucide-react';

interface NetworkVisualizerProps {
  nodes: P2PNode[];
  onToggleNode: (id: string) => void;
  rendezvousRoom: string;
  activeMessageToSend?: { from: string; to: string; content: string } | null;
}

interface VisualNode {
  id: string;
  peerId: string;
  nickname: string;
  isOnline: boolean;
  port: number;
  x: number;
  y: number;
  pulse: boolean;
}

interface MovingPacket {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  color: string;
}

interface PeerState {
  tx: number; // kB/s
  rx: number; // kB/s
  packetsTx: number;
  packetsRx: number;
}

export default function NetworkVisualizer({
  nodes,
  onToggleNode,
  rendezvousRoom,
  activeMessageToSend,
}: NetworkVisualizerProps) {
  const [packets, setPackets] = useState<MovingPacket[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Live dynamic telemetry throughput stats
  const [peerStats, setPeerStats] = useState<Record<string, PeerState>>({
    'node-a': { tx: 0.4, rx: 0.2, packetsTx: 14, packetsRx: 12 },
    'node-b': { tx: 0.3, rx: 0.4, packetsTx: 15, packetsRx: 14 },
    'node-c': { tx: 0.0, rx: 0.0, packetsTx: 0, packetsRx: 0 },
  });

  // Compute fixed 2D positions of nodes arranged in a circle coordinates
  const visualNodes = useMemo(() => {
    const radius = 90; // radius of layout circle
    const centerX = 160;
    const centerY = 140;

    return nodes.map((node, index) => {
      const angle = (index * 2 * Math.PI) / nodes.length - Math.PI / 2;
      return {
        id: node.id,
        peerId: node.peerId,
        nickname: node.nickname,
        isOnline: node.isOnline,
        port: node.port,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        pulse: false,
      };
    });
  }, [nodes]);

  // Handle packet animations for transmissions
  useEffect(() => {
    if (!activeMessageToSend) return;

    const source = visualNodes.find((n) => n.id === activeMessageToSend.from);
    if (!source || !source.isOnline) return;

    const newPackets: MovingPacket[] = [];
    
    // Broadcast packet to other online peers
    visualNodes.forEach((dest) => {
      if (dest.id !== source.id && dest.isOnline) {
        newPackets.push({
          id: `${Date.now()}-${dest.id}-${Math.random()}`,
          fromX: source.x,
          fromY: source.y,
          toX: dest.x,
          toY: dest.y,
          progress: 0,
          color: '#00FF41', // green for chat
        });
      }
    });

    if (newPackets.length > 0) {
      setPackets((prev) => [...prev, ...newPackets]);
    }
  }, [activeMessageToSend, visualNodes]);

  // Telemetry loop - background noise and slow decay
  useEffect(() => {
    const timer = setInterval(() => {
      setPeerStats((prev) => {
        const next = { ...prev };
        nodes.forEach((node) => {
          if (!node.isOnline) {
            next[node.id] = { tx: 0, rx: 0, packetsTx: prev[node.id]?.packetsTx || 0, packetsRx: prev[node.id]?.packetsRx || 0 };
          } else {
            // Heartbeat idle noise: tiny TCP packets & DHT queries
            const baseTx = 0.1 + Math.random() * 0.25;
            const baseRx = 0.08 + Math.random() * 0.22;
            
            const current = prev[node.id] || { tx: 0.2, rx: 0.2, packetsTx: 3, packetsRx: 3 };
            
            // Randomly simulate periodic mDNS or Kademlia routing packet counters increment
            const packetTxInc = Math.random() > 0.85 ? 1 : 0;
            const packetRxInc = Math.random() > 0.85 ? 1 : 0;

            next[node.id] = {
              tx: Number((current.tx * 0.35 + baseTx * 0.65).toFixed(1)),
              rx: Number((current.rx * 0.35 + baseRx * 0.65).toFixed(1)),
              packetsTx: current.packetsTx + packetTxInc,
              packetsRx: current.packetsRx + packetRxInc,
            };
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [nodes]);

  // Immediately spike throughput on transmission events!
  useEffect(() => {
    if (!activeMessageToSend) return;
    const { from } = activeMessageToSend;

    setPeerStats((prev) => {
      const next = { ...prev };
      // Sender spikes transmission bandwidth
      if (next[from]) {
        next[from] = {
          ...next[from],
          tx: Number((11.8 + Math.random() * 3.5).toFixed(1)),
          packetsTx: next[from].packetsTx + 1,
        };
      }
      // All other online receivers spike receiving bandwidth
      nodes.forEach((n) => {
        if (n.id !== from && n.isOnline && next[n.id]) {
          next[n.id] = {
            ...next[n.id],
            rx: Number((8.4 + Math.random() * 2.8).toFixed(1)),
            packetsRx: next[n.id].packetsRx + 1,
          };
        }
      });
      return next;
    });
  }, [activeMessageToSend, nodes]);

  // Set up packet animation frame update loop
  useEffect(() => {
    const interval = setInterval(() => {
      setPackets((prev) => {
        return prev
          .map((packet) => ({
            ...packet,
            progress: packet.progress + 6, // step speed
          }))
          .filter((packet) => packet.progress < 100);
      });
    }, 40);

    return () => clearInterval(interval);
  }, []);

  // Determine highlight filter rules
  const isNodeHighlighted = (nodeId: string) => {
    if (!selectedNodeId) return true; // all normal when none selected
    if (selectedNodeId === nodeId) return true;
    
    // Is neighbor of selected node?
    const selNodeObj = nodes.find(n => n.id === selectedNodeId);
    if (selNodeObj && selNodeObj.isOnline) {
      return selNodeObj.peers.includes(nodeId);
    }
    return false;
  };

  const isLinkHighlighted = (sourceId: string, destId: string) => {
    if (!selectedNodeId) return true;
    return sourceId === selectedNodeId || destId === selectedNodeId;
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedStats = selectedNodeId ? peerStats[selectedNodeId] : null;

  return (
    <div className="flex flex-col h-full bg-[#12141C] border border-[#1E212B] rounded-lg overflow-hidden shadow-inner font-mono text-xs">
      {/* Topology Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0A0B10] border-b border-[#1E212B] text-[#9CA3AF]">
        <div className="flex items-center gap-1.5 font-sans font-bold text-white text-[11px] uppercase tracking-wider">
          <Globe className="w-4 h-4 text-[#00FF41] animate-pulse" />
          <span>LOCAL SUBNET MAP</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 font-bold uppercase">
            REGISTRY: {rendezvousRoom}
          </span>
        </div>
      </div>

      {/* Network SVG Viewport */}
      <div className="relative flex-1 bg-[#07080D] h-64 md:h-72 select-none overflow-hidden">
        {/* Decorative Grid Network Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1E212B_1px,transparent_1px),linear-gradient(to_bottom,#1E212B_1px,transparent_1px)] bg-[size:16px_16px] opacity-20 pointer-events-none" />

        <svg className="w-full h-full" viewBox="0 0 320 280">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#1E212B" />
            </marker>
          </defs>

          {/* Central Rendezvous / DHT Hub Virtual Anchor */}
          <g transform="translate(160, 140)" className={selectedNodeId ? 'opacity-30' : 'opacity-100'}>
            <circle r="36" className="fill-[#12141C]/80 stroke-[#1E212B] stroke-dashed" />
            <circle r="6" className="fill-[#00FF41]/30 stroke-[#00FF41] stroke-1 animate-pulse" />
            <text
              y="22"
              textAnchor="middle"
              className="fill-[#F27D26] text-[8px] font-sans font-black tracking-wider uppercase opacity-80"
            >
              DHT RENDEZVOUS
            </text>
          </g>

          {/* Peer connection links */}
          {visualNodes.map((source, i) => {
            if (!source.isOnline) return null;
            return visualNodes.slice(i + 1).map((dest) => {
              if (!dest.isOnline) return null;

              const isMuted = selectedNodeId && !isLinkHighlighted(source.id, dest.id);

              return (
                <g key={`link-${source.id}-${dest.id}`} className="transition-all duration-300">
                  {/* Outer glow pipe when messages travel or is highlighted */}
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={dest.x}
                    y2={dest.y}
                    className={`transition-all duration-300 ${
                      isMuted 
                        ? 'stroke-transparent opacity-0' 
                        : 'stroke-[#00FF41]/15 stroke-2'
                    }`}
                  />
                  {/* Stable green P2P tunnel line */}
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={dest.x}
                    y2={dest.y}
                    className={`transition-all duration-300 ${
                      isMuted
                        ? 'stroke-[#1E212B] stroke-[0.5] opacity-20'
                        : selectedNodeId 
                          ? 'stroke-[#00FF41] stroke-[2] opacity-100'
                          : 'stroke-[#00FF41]/35 stroke-[1.5] opacity-100'
                    }`}
                    strokeDasharray={selectedNodeId && isLinkHighlighted(source.id, dest.id) ? "5 2" : "4 3"}
                  />
                </g>
              );
            });
          })}

          {/* Signal connection lines to central DHT rendezvous node */}
          {visualNodes.map((node) => {
            if (!node.isOnline) return null;
            const isMuted = selectedNodeId && selectedNodeId !== node.id;
            return (
              <line
                key={`dht-link-${node.id}`}
                x1={node.x}
                y1={node.y}
                x2={160}
                y2={140}
                className={`transition-all duration-300 ${
                  isMuted ? 'stroke-[#1E212B]/5 stroke-[0.2]' : 'stroke-[#00FF41]/15 stroke-[0.5]'
                }`}
                strokeDasharray="2 4"
              />
            );
          })}

          {/* Particle Packets flying along active pipelines */}
          {packets.map((p) => {
            const currentX = p.fromX + (p.toX - p.fromX) * (p.progress / 100);
            const currentY = p.fromY + (p.toY - p.fromY) * (p.progress / 100);
            return (
              <circle
                key={p.id}
                cx={currentX}
                cy={currentY}
                r="4"
                fill="#00FF41"
                style={{ filter: 'url(#glow)' }}
                className="animate-pulse"
              />
            );
          })}

          {/* Interactive P2P Node Dots */}
          {visualNodes.map((node) => {
            const hlg = isNodeHighlighted(node.id);
            const isSel = selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                className={`cursor-pointer group transition-all duration-350 ${
                  hlg ? 'opacity-100' : 'opacity-30'
                }`}
                onClick={() => setSelectedNodeId(isSel ? null : node.id)}
              >
                {/* Outer animated selection ring */}
                {isSel && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="16"
                    className="fill-none stroke-[#00FF41] stroke-2 opacity-95 animate-pulse"
                  />
                )}

                {/* Pulse effect if online */}
                {node.isOnline && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="14"
                    className="fill-none stroke-[#00FF41]/40 stroke-1 animate-ping"
                    style={{ animationDuration: '3s' }}
                  />
                )}

                {/* Outside border ring */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="10"
                  className={`transition-colors duration-300 ${
                    node.isOnline
                      ? isSel
                        ? 'fill-[#07080D] stroke-[#00FF41] stroke-3'
                        : 'fill-[#07080D] stroke-[#00FF41] stroke-2'
                      : 'fill-[#07080D] stroke-[#1E212B] stroke-[1.5]'
                  }`}
                />

                {/* Smaller Inner dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="5"
                  className={`${node.isOnline ? 'fill-[#00FF41]' : 'fill-[#1E212B]'}`}
                />

                {/* Port & Name tags mapping */}
                <text
                  x={node.x}
                  y={node.y - (isSel ? 18 : 14)}
                  textAnchor="middle"
                  className={`text-[10px] font-mono font-bold transition-all ${
                    node.isOnline 
                      ? isSel 
                        ? 'fill-[#00FF41] underline' 
                        : 'fill-white' 
                      : 'fill-[#6B7280]'
                  }`}
                >
                  {node.nickname}
                </text>
                <text
                  x={node.x}
                  y={node.y + 18}
                  textAnchor="middle"
                  className="fill-[#F27D26] font-mono text-[9px] font-bold"
                >
                  :{node.port}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover info / Quick action helper */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-[#6B7280] font-sans pointer-events-none">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-[#9CA3AF]" /> Click peers to isolate & inspect stats
          </span>
          <span className="flex items-center gap-1 bg-[#12141C] px-1.5 py-0.5 rounded border border-[#1E212B] pointer-events-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse shadow-[0_0_4px_#00FF41]" /> DIAGNOSTICS ACTIVE
          </span>
        </div>
      </div>

      {/* Dynamic Diagnostic Console Panel */}
      <div className="bg-[#12141C] border-t border-[#1E212B] p-3 text-[11px] font-mono space-y-2">
        {!selectedNode ? (
          <>
            <h4 className="text-[#9CA3AF] font-bold px-1 flex items-center justify-between text-[11px] uppercase tracking-wider">
              <span>Active Subnet Monitor</span>
              <span className="text-[10px] font-mono text-[#00FF41] uppercase tracking-widest animate-pulse">LIBP2P_MESH_OK</span>
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono px-1">
              <div className="flex justify-between border-b border-[#1E212B]/60 pb-1 py-0.5">
                <span className="text-[#6B7280]">Multicast LAN</span>
                <span className="text-[#00FF41]">mDNS Live (224.0.0.251)</span>
              </div>
              <div className="flex justify-between border-b border-[#1E212B]/60 pb-1 py-0.5">
                <span className="text-[#6B7280]">DHT Service</span>
                <span className="text-[#F27D26]">KAD-DHT-ACTIVE</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-[#6B7280]">Security</span>
                <span className="text-white">NOISE_HANDSHAKE_100%</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-[#6B7280]">Muxer streams</span>
                <span className="text-[#00FF41]">Yamux Multiplex</span>
              </div>
            </div>
            <div className="text-[10px] text-center text-[#6B7280] pt-1">
              * Click a node circle in diagram to isolate connections & view real-time diagnostics
            </div>
          </>
        ) : (
          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between border-b border-[#1E212B] pb-1.5 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${selectedNode.isOnline ? 'bg-[#00FF41] shadow-[0_0_6px_#00FF41] animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[11px] text-white font-bold uppercase tracking-wider">
                  PEER DIAGNOSTICS: {selectedNode.nickname}
                </span>
                <span className="text-[9px] text-[#6B7280]">({selectedNode.peerId.slice(0, 10)}...)</span>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-[10px] text-[#00FF41] hover:underline font-bold transition-transform cursor-pointer"
              >
                [SHOW SUBNET MAP]
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-1 py-1">
              <div className="bg-[#07080D] p-2 border border-[#1E212B] rounded">
                <div className="text-[9px] text-[#6B7280] uppercase">Throughput Tx</div>
                <div className="text-sm font-bold text-[#00FF41] flex items-baseline gap-1 mt-0.5">
                  {(selectedStats?.tx ?? 0).toFixed(1)}
                  <span className="text-[9px] font-normal text-[#6B7280]">kB/s</span>
                </div>
                {/* Micro-meter bar */}
                <div className="w-full bg-[#12141C] h-1 mt-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#00FF41] h-full transition-all duration-350"
                    style={{ width: `${Math.min(100, ((selectedStats?.tx ?? 0) / 15) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-[#07080D] p-2 border border-[#1E212B] rounded">
                <div className="text-[9px] text-[#6B7280] uppercase">Throughput Rx</div>
                <div className="text-sm font-bold text-[#F27D26] flex items-baseline gap-1 mt-0.5">
                  {(selectedStats?.rx ?? 0).toFixed(1)}
                  <span className="text-[9px] font-normal text-[#6B7280]">kB/s</span>
                </div>
                {/* Micro-meter bar */}
                <div className="w-full bg-[#12141C] h-1 mt-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#F27D26] h-full transition-all duration-350"
                    style={{ width: `${Math.min(100, ((selectedStats?.rx ?? 0) / 15) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-[#07080D] p-2 border border-[#1E212B] rounded">
                <div className="text-[9px] text-[#6B7280] uppercase">Packets Sent</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {selectedStats?.packetsTx ?? 0}
                </div>
                <div className="text-[9px] text-[#4B5563] mt-1.5">Yamux Frame Tx</div>
              </div>

              <div className="bg-[#07080D] p-2 border border-[#1E212B] rounded">
                <div className="text-[9px] text-[#6B7280] uppercase">Packets Recv</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {selectedStats?.packetsRx ?? 0}
                </div>
                <div className="text-[9px] text-[#4B5563] mt-1.5">Yamux Frame Rx</div>
              </div>
            </div>

            {/* Peer specific settings and actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pt-1 text-[11px] bg-[#07080D] p-2 rounded border border-[#1E212B]">
              <div className="flex gap-4">
                <div>
                  <span className="text-[#6B7280]">Port:</span> <span className="text-[#F27D26] font-bold">:{selectedNode.port}</span>
                </div>
                <div>
                  <span className="text-[#6B7280]">Connections:</span>{' '}
                  <span className="text-white font-bold">
                    {selectedNode.isOnline
                      ? selectedNode.peers.filter((pId) => nodes.find((no) => no.id === pId)?.isOnline).length
                      : 0}{' '}
                    Active
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#6B7280] text-[10px]">Daemon Process:</span>
                <button
                  onClick={() => onToggleNode(selectedNode.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    selectedNode.isOnline
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                      : 'bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20 hover:bg-[#00FF41]/20'
                  }`}
                >
                  {selectedNode.isOnline ? 'STOP RUN' : 'START RUN'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
