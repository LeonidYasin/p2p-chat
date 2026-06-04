import React, { useRef, useEffect } from 'react';
import { P2PNode } from '../types';
import { Terminal, Shield, Power, Wifi, HelpCircle, Download } from 'lucide-react';

interface TerminalNodeProps {
  node: P2PNode;
  onInputChange: (nodeId: string, value: string) => void;
  onSubmitCommand: (nodeId: string, input: string) => void;
  onTogglePower: (nodeId: string) => void;
  peerCount: number;
}

export default function TerminalNode({
  node,
  onInputChange,
  onSubmitCommand,
  onTogglePower,
  peerCount,
}: TerminalNodeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the terminal inner console when logs grow
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [node.logs]);

  const COMMANDS = ['/peers', '/me', '/exit', '/help'];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSubmitCommand(node.id, node.currentInput);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const input = node.currentInput;
      if (input && input.startsWith('/')) {
        const matches = COMMANDS.filter(cmd => cmd.startsWith(input));
        if (matches.length > 0) {
          const exactIdx = matches.indexOf(input);
          if (exactIdx !== -1 && matches.length > 1) {
            const nextMatch = matches[(exactIdx + 1) % matches.length];
            onInputChange(node.id, nextMatch);
          } else {
            onInputChange(node.id, matches[0]);
          }
        }
      }
    }
  };

  // Dynamic autocomplete suggestion text for inline ghost display
  let suggestionText = '';
  if (node.currentInput && node.currentInput.startsWith('/')) {
    const matchingCmd = COMMANDS.find(cmd => cmd.startsWith(node.currentInput) && cmd !== node.currentInput);
    if (matchingCmd) {
      suggestionText = node.currentInput + matchingCmd.slice(node.currentInput.length);
    }
  }

  // Convert log category to specific color scheme
  const getLogColorClass = (type: string, message: string) => {
    if (type === 'error') return 'text-red-400 font-bold';
    if (type === 'discovery') return 'text-[#F27D26] font-bold';
    if (type === 'stream') return 'text-[#00FF41] font-semibold';
    if (type === 'chat') {
      // Differentiate self message from received message
      if (message.startsWith('Me:')) return 'text-white opacity-90';
      return 'text-[#00FF41]';
    }
    // Default color code for system logs
    if (message.startsWith('[+]') || message.includes('successfully') || message.includes('connected')) return 'text-[#00FF41] font-semibold';
    if (message.startsWith('[*]')) return 'text-[#6B7280]';
    return 'text-[#E0E0E0]';
  };

  const handleExportLogs = () => {
    if (node.logs.length === 0) return;

    // Build structured log report for educational inspection
    const headerBanner = `======================================================================
                  GOP2P-TERMINAL LOG DUMP REPORT
======================================================================
Target Daemon Identity : ${node.nickname}
Simulated Subnet Bind  : 127.0.0.1:${node.port}
Protocol Speciation    : Multicast DNS LAN Sync & Kademlia DHT
Status At Dump         : ${node.isOnline ? 'ACTIVE / RUNNING' : 'SUSPENDED'}
Session Message-count  : ${node.logs.length} entries
Export Date Timestamp  : ${new Date().toISOString()}
======================================================================

[LOG ENTRIES]
`;

    const logLines = node.logs.map(log => {
      const typeLabel = `[${log.type.toUpperCase()}]`.padEnd(11, ' ');
      return `${log.timestamp} ${typeLabel} : ${log.message}`;
    }).join('\n');

    const fullDump = headerBanner + '\n' + logLines + '\n\n========================= END OF LOG DUMP =========================';

    const blob = new Blob([fullDump], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `libp2p-${node.nickname.toLowerCase()}-session.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col h-full bg-[#12141C] border rounded-lg overflow-hidden transition-all duration-300 ${
      node.isOnline 
        ? 'border-[#1E212B] shadow-[0_0_12px_rgba(0,255,65,0.02)]' 
        : 'border-[#1E212B] opacity-50'
    }`}>
      {/* Top action header for Terminal instance */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0D0F16] border-b border-[#1E212B]">
        <div className="flex items-center gap-2">
          <Terminal className={`w-3.5 h-3.5 ${node.isOnline ? 'text-[#00FF41]' : 'text-[#6B7280]'}`} />
          <span className="font-mono font-bold text-white text-[11px] uppercase tracking-wide">
            {node.nickname} <span className="text-[#6B7280] font-normal">(:{node.port})</span>
          </span>
          {node.isOnline ? (
            <span className="flex items-center gap-1 text-[9px] bg-[#00FF41]/10 text-[#00FF41] font-mono px-1.5 py-0.5 rounded border border-[#00FF41]/30">
              <span className="w-1 h-1 rounded-full bg-[#00FF41] animate-pulse" />
              ONLINE
            </span>
          ) : (
            <span className="text-[9px] bg-[#1E212B] text-[#6B7280] font-mono px-1.5 py-0.5 rounded border border-transparent">
              SUSPENDED
            </span>
          )}
        </div>

        {/* Action Toggle buttons */}
        <div className="flex items-center gap-2">
          {node.isOnline && (
            <div className="flex items-center gap-1 text-[10px] text-[#9CA3AF] font-mono mr-2">
              <Wifi className="w-3 h-3 text-[#00FF41]" />
              <span>{peerCount} {peerCount === 1 ? 'peer' : 'peers'}</span>
            </div>
          )}
          <button
            onClick={handleExportLogs}
            disabled={node.logs.length === 0}
            title={node.logs.length === 0 ? "Terminal log is empty" : `Export ${node.nickname}'s session logs (.log)`}
            className={`p-1 rounded cursor-pointer transition-colors border ${
              node.logs.length === 0
                ? 'bg-[#1E212B]/20 text-[#6B7280]/50 border-transparent cursor-not-allowed'
                : 'bg-[#00FF41]/10 text-[#00FF41] hover:bg-[#00FF41]/25 border-[#00FF41]/20 hover:shadow-[0_0_8px_rgba(0,255,65,0.15)]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onTogglePower(node.id)}
            title={node.isOnline ? "Terminate p2p session (Ctrl+C)" : "Launch libp2p main.go"}
            className={`p-1 rounded cursor-pointer transition-colors ${
              node.isOnline 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/25 border border-red-500/20' 
                : 'bg-[#00FF41]/10 text-[#00FF41] hover:bg-[#00FF41]/25 border border-[#00FF41]/20'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 
        Step-by-step discovery state machine progress indicator
      */}
      {node.isOnline && (
        <div className="bg-[#0B0C12] border-b border-[#1E212B] px-3.5 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-[10px] font-mono select-none">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="text-[#6B7280] font-bold uppercase tracking-wider text-[9px] shrink-0">Status:</span>
            <span className={`text-xs tracking-tight font-semibold shrink-0 ${
              (node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'connected' ? 'text-[#00FF41]' : 'text-[#F27D26]'
            }`}>
              {(node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'bootstrapping' && '⚙️ Bootstrapping'}
              {(node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'querying_dht' && '🛰️ Querying DHT'}
              {(node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'searching_room' && '📡 Searching Room'}
              {(node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'connected' && '🎉 Connected'}
            </span>
            <span className="text-slate-700 hidden md:inline">|</span>
            <span className="text-[#9CA3AF] text-[9px] truncate hidden md:inline">
              {(node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'bootstrapping' && 'Syncing with global seed bootstrap nodes...'}
              {(node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'querying_dht' && 'Crawling Go-Kad-DHT routing tables...'}
              {(node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'searching_room' && `Broadcasting rendezvous search: "${node.rendezvous}"...`}
              {(node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room')) === 'connected' && 'Yamux peer stream upgraded!'}
            </span>
          </div>
          
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { key: 'bootstrapping', label: 'Bootstrap' },
              { key: 'querying_dht', label: 'Query DHT' },
              { key: 'searching_room', label: 'Seek Room' },
              { key: 'connected', label: 'Connected' }
            ].map((s, idx, arr) => {
              const state = node.discoveryState || (node.peers.length > 0 ? 'connected' : 'searching_room');
              const activeIndex = arr.findIndex(item => item.key === state);
              const isActive = s.key === state;
              const isPast = activeIndex > idx;
              
              return (
                <React.Fragment key={s.key}>
                  <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 border ${
                    isActive 
                      ? 'bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/30 animate-pulse' 
                      : isPast 
                      ? 'bg-[#00FF41]/5 text-[#00FF41]/80 border-[#00FF41]/10' 
                      : 'bg-transparent text-[#4B5563] border-transparent'
                  }`}>
                    {isPast ? (
                      <span className="text-[9px] font-bold">✓</span>
                    ) : isActive ? (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F27D26] animate-pulse" />
                    ) : (
                      <span className="text-[7px] opacity-45">■</span>
                    )}
                    <span className="tracking-tight uppercase text-[9px] font-semibold">{s.label}</span>
                  </div>
                  {idx < arr.length - 1 && (
                    <span className="text-[#202330] text-[8px] select-none">⟫</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Internal interactive terminal console */}
      <div 
        ref={scrollRef}
        className="flex-1 mt-0.5 p-3.5 overflow-y-auto space-y-1 font-mono text-xs select-text leading-relaxed tracking-wider min-h-48 max-h-72 text-[#E0E0E0]"
      >
        {!node.isOnline ? (
          <div className="flex flex-col items-center justify-center h-full py-4 space-y-2.5 text-center select-none font-mono">
            <p className="text-[#6B7280] text-[11px]">Go program process suspended</p>
            <button
              onClick={() => onTogglePower(node.id)}
              className="py-1.5 px-3 bg-[#12141C] border border-[#1E212B] hover:border-[#00FF41] hover:text-[#00FF41] text-[#9CA3AF] font-bold font-mono rounded text-[10px] uppercase cursor-pointer transition-all duration-150 shadow-[0_0_12px_rgba(0,0,0,0.2)]"
            >
              go run main.go -nick {node.nickname}
            </button>
          </div>
        ) : (
          <>
            {node.logs.map((log) => (
              <div key={log.id} className="flex flex-col">
                <div className="flex items-start gap-1 w-full flex-wrap whitespace-pre-wrap">
                  <span className="text-[#4B5563] shrink-0 text-[10px] select-none">{log.timestamp}</span>
                  <span className={`${getLogColorClass(log.type, log.message)}`}>
                    {log.message}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Terminal user command shell footer */}
      {node.isOnline && (
        <div className="border-t border-[#1E212B] bg-[#07080D] flex items-center p-2">
          <span className="text-[#00FF41] font-bold px-1 select-none font-mono">&gt;</span>
          <div className="relative flex-1 flex items-center">
            {suggestionText && (
              <span className="absolute left-0 pointer-events-none text-[#4B5563] font-mono text-xs select-none z-0 whitespace-pre ml-1">
                {suggestionText}
              </span>
            )}
            <input
              type="text"
              className="flex-1 bg-transparent border-0 outline-0 ring-0 focus:outline-none focus:ring-0 text-white font-mono text-xs ml-1 bg-transparent z-10"
              value={node.currentInput}
              onChange={(e) => onInputChange(node.id, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Type message or try /peers or /me...'
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <span className="text-[9px] text-[#6B7280] ml-1 select-none font-mono flex items-center gap-1 mr-1 md:mr-2" title="Tab-completion for commands">
            <HelpCircle className="w-3 h-3 text-[#6B7280]" />
            <span className="hidden sm:inline">TAB COMPLETE: {suggestionText ? 'Press Tab' : '/peers /me'}</span>
          </span>
        </div>
      )}
    </div>
  );
}
