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

export default function NetworkVisualizer({
  nodes,
  onToggleNode,
  rendezvousRoom,
  activeMessageToSend,
}: NetworkVisualizerProps) {
  const [packets, setPackets] = useState<MovingPacket[]>([]);

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

  // Handle active message animations
  useEffect(() => {
    if (!activeMessageToSend) return;

    const source = visualNodes.find((n) => n.id === activeMessageToSend.from);
    if (!source || !source.isOnline) return;

    const newPackets: MovingPacket[] = [];
    
    // Broadcast pack to other online peers
    visualNodes.forEach((dest) => {
      if (dest.id !== source.id && dest.isOnline) {
        newPackets.push({
          id: `${Date.now()}-${dest.id}-${Math.random()}`,
          fromX: source.x,
          fromY: source.y,
          toX: dest.x,
          toY: dest.y,
          progress: 0,
          color: '#10b981', // green for chat
        });
      }
    });

    if (newPackets.length > 0) {
      setPackets((prev) => [...prev, ...newPackets]);
    }
  }, [activeMessageToSend, visualNodes]);

  // Set up packet frame update loop
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
          <g transform="translate(160, 140)">
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

              // If both online, show connection pipe
              return (
                <g key={`link-${source.id}-${dest.id}`}>
                  {/* Outer glow pipe when messages are traveling */}
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={dest.x}
                    y2={dest.y}
                    className="stroke-[#00FF41]/20 stroke-2"
                  />
                  {/* Stable green P2P tunnel line */}
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={dest.x}
                    y2={dest.y}
                    className="stroke-[#00FF41]/30 stroke-[1.5]"
                    strokeDasharray="4 3"
                  />
                </g>
              );
            });
          })}

          {/* Signal connection lines to central DHT rendezvous node */}
          {visualNodes.map((node) => {
            if (!node.isOnline) return null;
            return (
              <line
                key={`dht-link-${node.id}`}
                x1={node.x}
                y1={node.y}
                x2={160}
                y2={140}
                className="stroke-[#00FF41]/15 stroke-[0.5]"
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
          {visualNodes.map((node) => (
            <g
              key={node.id}
              className="cursor-pointer group"
              onClick={() => onToggleNode(node.id)}
            >
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
                    ? 'fill-[#07080D] stroke-[#00FF41] stroke-2 shadow-[0_0_8px_#00FF41]'
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
                y={node.y - 14}
                textAnchor="middle"
                className={`text-[10px] font-mono font-bold transition-all ${
                  node.isOnline ? 'fill-white' : 'fill-[#6B7280]'
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
          ))}
        </svg>

        {/* Hover info / Quick action helper */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-[#6B7280] font-sans pointer-events-none">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-[#9CA3AF]" /> Tap nodes to toggle daemon thread
          </span>
          <span className="flex items-center gap-1 bg-[#12141C] px-1.5 py-0.5 rounded border border-[#1E212B] pointer-events-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse shadow-[0_0_4px_#00FF41]" /> MULTICAST ENG•ON
          </span>
        </div>
      </div>

      {/* Network control & protocol simulation debug console */}
      <div className="bg-[#12141C] border-t border-[#1E212B] p-3 text-[11px] font-mono space-y-1">
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
      </div>
    </div>
  );
}
