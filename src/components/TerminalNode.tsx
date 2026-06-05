import React, { useRef, useEffect, useState } from 'react';
import { P2PNode } from '../types';
import { Terminal, Shield, Power, Wifi, HelpCircle, Download, Clock } from 'lucide-react';

interface TerminalNodeProps {
  node: P2PNode;
  onInputChange: (nodeId: string, value: string) => void;
  onSubmitCommand: (nodeId: string, input: string) => void;
  onTogglePower: (nodeId: string) => void;
  onPasteLogs?: (nodeId: string, text: string) => void;
  peerCount: number;
}

export default function TerminalNode({
  node,
  onInputChange,
  onSubmitCommand,
  onTogglePower,
  onPasteLogs,
  peerCount,
}: TerminalNodeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [pasteText, setPasteText] = useState('');

  const handleParseLogs = () => {
    if (onPasteLogs && pasteText.trim()) {
      onPasteLogs(node.id, pasteText);
      setPasteText('');
    }
  };

  const handleLoadSample = () => {
    let sample = '';
    if (node.id === 'node-a') {
      sample = `[*] Starting Peer-to-Peer node as "WinUser"...
[+] Created libp2p Host successfully on port 3001.
[+] Peer ID: 12D3KooWH91bNnPomJvaUs5vQSbsvG3PZNfRTWcy1XgtG6m7nqeS
[+] Listening Addresses:
    /ip4/127.0.0.1/tcp/3001/p2p/12D3KooWH91bNnPomJvaUs5vQSbsvG3PZNfRTWcy1XgtG6m7nqeS
    /ip4/192.168.1.15/tcp/3001/p2p/12D3KooWH91bNnPomJvaUs5vQSbsvG3PZNfRTWcy1XgtG6m7nqeS
[DHT: 📡 Advertising] Registering node in room "chat-with-rendezvous" on the global Kad-DHT...
[Поиск: 📡 Активный сканирование / Search: 📡 Crawling DHT] Комната / Room: "chat-with-rendezvous"
   📶 Активные узлы DHT / Routing links: 42 | Размер таблицы / RT Size: 120 🟢
   🔍 Сканируем глобальный DHT-индекс на наличие собеседников... / Looking for active candidates...
[Поиск: 📡 Поиск завершен / Search: 📡 Crawl Done] 0 других собеседников найдено на текущем цикле в комнате "chat-with-rendezvous".`;
    } else if (node.id === 'node-b') {
      sample = `[*] Starting Peer-to-Peer node as "PhoneUser"...
[+] Created libp2p Host successfully on port 3002.
[+] Peer ID: 12D3KooWMZkqQ4ZaKwHqkMTQF1NP4TwTen1fJZgrCUhKY3Ncsmzu
[+] Listening Addresses:
    /ip4/127.0.0.1/tcp/3002/p2p/12D3KooWMZkqQ4ZaKwHqkMTQF1NP4TwTen1fJZgrCUhKY3Ncsmzu
    /ip4/198.18.0.1/tcp/3002/p2p/12D3KooWMZkqQ4ZaKwHqkMTQF1NP4TwTen1fJZgrCUhKY3Ncsmzu
[DHT: 📡 Advertising] Registering node in room "chat-with-rendezvous" on the global Kad-DHT...
[Search: 📡 Querying DHT] Room: "chat-with-rendezvous" | Live network links: 72 | RT size: 156. Actively crawling Kad-DHT indices...
[Search: ✨ Discovered] Found candidate peer ID <peer.ID 12*bK43SJ> in room "chat-with-rendezvous"! Pitching secure link...
[Search: ⚠️ Handshake fail] Link to <peer.ID 12*bK43SJ> refused/timed out: failed to dial: failed to dial 12D3KooWNzeGc8bCdg5xDkkzPPFfHTfhayvz6dmVChWb9dbK43SJ: all dials failed
   * [/ip4/127.0.0.1/udp/3002/quic-v1] dial backoff
   * [/ip4/159.195.66.195/udp/3002/quic-v1] dial backoff
   * [/ip4/127.0.0.1/tcp/3002] dial backoff
   * [/ip4/198.18.0.1/udp/3002/quic-v1] dial backoff
   * [/ip4/159.195.66.195/tcp/3002] dial backoff
   * [/ip4/198.18.0.1/tcp/3002] dial backoff (DCUtR hole punching or Circuit Relay v2 will try again shortly)
[Search: ✨ Discovered] Found candidate peer ID <peer.ID 12*Ncsmzu> in room "chat-with-rendezvous"! Pitching secure link...
[Search: ⚠️ Handshake fail] Link to <peer.ID 12*Ncsmzu> refused/timed out: failed to dial: failed to dial 12D3KooWMZkqQ4ZaKwHqkMTQF1NP4TwTen1fJZgrCUhKY3Ncsmzu: all dials failed
   * [/ip4/127.0.0.1/udp/3002/quic-v1] CRYPTO_ERROR 0x12a (local): peer id mismatch: expected 12D3KooWMZkqQ4ZaKwHqkMTQF1NP4TwTen1fJZgrCUhKY3Ncsmzu, but remote key matches 12D3KooWH91bNnPomJvaUs5vQSbsvG3PZNfRTWcy1XgtG6m7nqeS
   * [/ip4/198.18.0.1/udp/3002/quic-v1] CRYPTO_ERROR 0x12a (local): peer id mismatch: expected 12D3KooWMZkqQ4ZaKwHqkMTQF1NP4TwTen1fJZgrCUhKY3Ncsmzu, but remote key matches 12D3KooWH91bNnPomJvaUs5vQSbsvG3PZNfRTWcy1XgtG6m7nqeS
   * [/ip4/127.0.0.1/tcp/3002] failed to negotiate security protocol: failed client selection; identical nonces
   * [/ip4/198.18.0.1/tcp/3002] failed to negotiate security protocol: peer id mismatch: expected 12D3KooWMZkqQ4ZaKwHqkMTQF1NP4TwTen1fJZgrCUhKY3Ncsmzu, but remote key matches 12D3KooWH91bNnPomJvaUs5vQSbsvG3PZNfRTWcy1XgtG6m7nqeS (DCUtR hole punching or Circuit Relay v2 will try again shortly)`;
    } else {
      sample = `[*] Starting Peer-to-Peer Bootstrap node...
[+] Host live on public port 4001.
[+] Peer ID: QmNnoJiY7Q3WknFpxtUB447fNGL97ytDGdzZoxeT38xCCC
[DHT] Kademlia active dht engine boot loaded. Waiting for peers...`;
    }
    if (onPasteLogs) {
      onPasteLogs(node.id, sample);
    }
  };

  useEffect(() => {
    if (!node.isOnline) {
      setActiveSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setActiveSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [node.isOnline]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

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

    const blob = new Blob([fullDump], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `libp2p-${node.nickname.toLowerCase()}-session.txt`;
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
            <>
              <span className="flex items-center gap-1 text-[9px] bg-[#00FF41]/10 text-[#00FF41] font-mono px-1.5 py-0.5 rounded border border-[#00FF41]/30">
                <span className="w-1 h-1 rounded-full bg-[#00FF41] animate-pulse" />
                ONLINE
              </span>
              <span 
                className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border select-none transition-all duration-300 ${
                  peerCount > 0
                    ? 'bg-[#00FF41]/5 text-[#00FF41]/80 border-[#00FF41]/15'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
                title={peerCount > 0 ? "Yamux stream active session duration" : "Time spent searching routing table and peers"}
                id={`node-timer-${node.id}`}
              >
                <Clock className={`w-2.5 h-2.5 ${peerCount === 0 ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
                <span>{peerCount > 0 ? 'ACTIVE' : 'SEARCHING'}: {formatDuration(activeSeconds)}</span>
              </span>
            </>
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
            title={node.logs.length === 0 ? "Terminal log is empty" : `Download ${node.nickname}'s session logs (.txt)`}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-all border ${
              node.logs.length === 0
                ? 'bg-[#1E212B]/20 text-[#6B7280]/50 border-transparent cursor-not-allowed'
                : 'bg-[#00FF41]/10 text-[#00FF41] hover:bg-[#00FF41]/25 border-[#00FF41]/20 hover:shadow-[0_0_8px_rgba(0,255,65,0.15)]'
            }`}
            id={`download-logs-btn-${node.id}`}
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download Logs</span>
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
        className="flex-1 mt-0.5 p-3.5 overflow-y-auto space-y-1 font-mono text-xs select-text leading-relaxed tracking-wider min-h-48 text-[#E0E0E0]"
      >
        {node.id === 'node-c' ? (
          !node.isOnline ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center select-none font-mono">
              <p className="text-[#FF4141] text-[10px] uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5 justify-center">
                <Power className="w-4 h-4 text-red-500 animate-pulse" />
                <span>Бэкенд-Демон Остановлен / Daemon Suspended</span>
              </p>
              <p className="text-[11px] text-[#9CA3AF] max-w-sm mb-4 leading-relaxed">
                Координационный bootstrap-узел (libp2p Relay v2 / Kademlia DHT Seed) выключен. Вы можете запустить его, кликнув по значку "Питание" на верхней панели, либо прямо здесь:
              </p>
              <button
                onClick={() => onTogglePower('node-c')}
                className="py-1.5 px-4 bg-[#00FF41]/10 border border-[#00FF41]/30 hover:bg-[#00FF41]/25 text-[#00FF41] font-bold font-mono rounded text-[10px] uppercase cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Запустить Go-узел на сервере</span>
              </button>
            </div>
          ) : node.logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center select-none font-mono text-[#6B7280]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00FF41] mb-2" />
              <p className="text-[10px] uppercase tracking-wider font-bold">Запуск процесса Go...</p>
              <p className="text-[9px] mt-1 text-slate-500">Чтение буфера stdout/stderr из контейнера Cloud Run...</p>
            </div>
          ) : (
            <>
              {node.logs.map((log) => (
                <div key={log.id} className="flex flex-col font-mono text-xs">
                  <div className="flex items-start gap-1 w-full flex-wrap whitespace-pre-wrap">
                    <span className="text-[#4B5563] shrink-0 text-[10px] select-none">{log.timestamp}</span>
                    <span className={`${getLogColorClass(log.type, log.message)}`}>
                      {log.message}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )
        ) : (
          !node.isOnline || node.logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center select-none font-mono">
              <p className="text-[#6B7280] text-[10px] uppercase tracking-wider mb-1.5 font-bold flex items-center gap-1.5 justify-center">
                <Shield className="w-4 h-4 text-slate-500" />
                <span>Импорт логов узла / Log Import ({node.id === 'node-a' ? 'Win' : 'Android'})</span>
              </p>
              <p className="text-[11px] text-[#9CA3AF] max-w-sm mb-3 leading-relaxed">
                Скопируйте вывод терминала `./p2pchat` и вставьте его ниже для автоматического разбора сетевого графа и выявления NAT-препятствий.
              </p>
              
              <textarea
                placeholder="Вставьте лог терминала (Paste go-libp2p console log line history here)..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full max-w-md h-24 bg-[#07080D] border border-[#1E212B] rounded p-2 text-[10px] text-[#00FF41] focus:outline-none focus:border-[#00FF41]/40 tracking-tight font-mono resize-none leading-snug placeholder:text-slate-600 mb-3 select-text"
              />
              
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                <button
                  onClick={handleParseLogs}
                  disabled={!pasteText.trim()}
                  className={`py-1 px-3 rounded text-[10px] uppercase cursor-pointer transition-all border font-bold font-mono ${
                    pasteText.trim()
                      ? 'bg-[#00FF41]/10 border-[#00FF41]/30 hover:bg-[#00FF41]/25 text-[#00FF41]'
                      : 'bg-slate-800/30 text-slate-600 border-transparent cursor-not-allowed'
                  }`}
                >
                  Разобрать логи / Parse Logs
                </button>
                <button
                  onClick={handleLoadSample}
                  className="py-1 px-3 bg-[#F27D26]/10 border border-[#F27D26]/30 hover:bg-[#F27D26]/25 text-[#F27D26] font-bold font-mono rounded text-[10px] uppercase cursor-pointer transition-all"
                >
                  Загрузить пример ({node.id === 'node-a' ? 'Windows' : 'Android'})
                </button>
              </div>
            </div>
          ) : (
            <>
              {node.logs.map((log) => (
                <div key={log.id} className="flex flex-col font-mono text-xs">
                  <div className="flex items-start gap-1 w-full flex-wrap whitespace-pre-wrap">
                    <span className="text-[#4B5563] shrink-0 text-[10px] select-none">{log.timestamp}</span>
                    <span className={`${getLogColorClass(log.type, log.message)}`}>
                      {log.message}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )
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
