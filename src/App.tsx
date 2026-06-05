import React, { useState, useEffect } from 'react';
import { P2PNode, NetworkLog, DirectMessage } from './types';
import TerminalNode from './components/TerminalNode';
import NetworkVisualizer from './components/NetworkVisualizer';
import CodeViewer from './components/CodeViewer';
import ArchitectureGuide from './components/ArchitectureGuide';
import { Radio, RefreshCw, Zap, Laptop, Network, HelpCircle, Code2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

function defaultIdSeed(nickname: string) {
  if (nickname.toLowerCase().includes('win')) return 'Yy6Zbt9W37knFixtUB487fNGL97ytDGdzZoxeT38xA4A';
  if (nickname.toLowerCase().includes('phone') || nickname.toLowerCase().includes('android')) return 'Xz9Yae7R3WknFpxtUB999fNGL11ytDGdzZoxeT32xZ2B';
  return 'W88Pqr2W37knFixtUB487fNGL97ytDGdzZoxeT38xCCC';
}

function parseGoLogs(rawLogs: string, nodeId: string, currentNick: string, currentPort: number) {
  const lines = rawLogs.split('\n');
  let nickname = currentNick;
  let peerId = '';
  let port = currentPort;
  let isOnline = false;
  let rendezvous = 'chat-with-rendezvous';
  const parsedLogs: NetworkLog[] = [];
  let discoveryState: 'offline' | 'bootstrapping' | 'querying_dht' | 'searching_room' | 'connected' = 'offline';

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    isOnline = true;

    // Get time or make one
    let timestamp = '';
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    let defaultTime = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // Check if the line has a standard log prefix or timestamp like 10:48:10
    const logTimeMatch = trimmed.match(/^\[?(\d{2}:\d{2}:\d{2})\]?/);
    if (logTimeMatch) {
      timestamp = logTimeMatch[1];
    } else {
      timestamp = defaultTime;
    }

    let message = trimmed;
    if (logTimeMatch) {
      message = trimmed.slice(logTimeMatch[0].length).trim();
    }

    // Determine type
    let logType: NetworkLog['type'] = 'system';
    if (message.includes('fail') || message.includes('mismatch') || message.includes('refused') || message.includes('timed out') || message.includes('Error') || message.includes('dials failed') || message.includes('dial backoff')) {
      logType = 'error';
    } else if (message.includes('Discovered') || message.includes('local peer') || message.includes('mDNS') || message.includes('UDP')) {
      logType = 'discovery';
    } else if (message.includes('CONNECTED') || message.includes('established') || message.includes('stream') || message.includes('shook hands') || message.includes('Success')) {
      logType = 'stream';
    } else if (message.includes('Me:') || (message.match(/^[a-zA-Z0-9_\-]+:\s.+/) && !message.includes('[') && !message.includes(']'))) {
      logType = 'chat';
    }

    // Matches
    const nickMatch = message.match(/Starting Peer-to-Peer node as "([^"]+)"|Starting.*as "([^"]+)"/i);
    if (nickMatch) {
      nickname = nickMatch[1] || nickMatch[2];
    }

    const peerIdMatch = message.match(/Peer ID\s*[:=]?\s*([a-zA-Z0-9]{30,60})|failed to dial\s+([a-zA-Z0-9]{30,60})|expected\s+([a-zA-Z0-9]{30,60})|remote key matches\s+([a-zA-Z0-9]{30,60})/);
    if (peerIdMatch) {
      peerId = peerIdMatch[1] || peerIdMatch[2] || peerIdMatch[3] || peerIdMatch[4];
    }

    const portMatch = message.match(/port\s+(\d+)|tcp\/(\d+)|udp\/(\d+)/i);
    if (portMatch) {
      port = parseInt(portMatch[1] || portMatch[2] || portMatch[3], 10);
    }

    const roomMatch = message.match(/Room:\s*"([^"]+)"|rendezvous room:\s*"([^"]+)"|searching.*: "([^"]+)"|room "([^"]+)"/i);
    if (roomMatch) {
      rendezvous = roomMatch[1] || roomMatch[2] || roomMatch[3] || roomMatch[4];
    }

    // State machine updates based on log milestones
    if (message.match(/Starting|setting up|Waiting/i)) {
      discoveryState = 'bootstrapping';
    } else if (message.match(/DHT Connected|Routing|RT Size/i)) {
      discoveryState = 'querying_dht';
    } else if (message.match(/Crawling|crawling|searching|looking for/i)) {
      discoveryState = 'searching_room';
    } else if (message.match(/CONNECTED|established|Upgraded/i)) {
      discoveryState = 'connected';
    }

    parsedLogs.push({
      id: `${nodeId}-parsed-${index}-${Date.now()}`,
      timestamp,
      type: logType,
      message
    });
  });

  return {
    nickname,
    peerId: peerId || `Qm${defaultIdSeed(nickname)}`,
    port,
    isOnline,
    rendezvous,
    logs: parsedLogs,
    discoveryState: isOnline ? (discoveryState === 'offline' ? 'searching_room' : discoveryState) : 'offline'
  };
}

export default function App() {
  const [rendezvousRoom, setRendezvousRoom] = useState<string>('chat-with-rendezvous');
  const [latencyMs, setLatencyMs] = useState<number>(45);
  const [activeMessage, setActiveMessage] = useState<{ from: string; to: string; content: string } | null>(null);

  // Initialize nodes to waiting/offline state - real physical nodes
  const [nodes, setNodes] = useState<P2PNode[]>([
    {
      id: 'node-a',
      peerId: 'QmYy6Zbt9W37knFixtUB487fNGL97ytDGdzZoxeT38xA4A',
      nickname: 'Device #1 (Windows PC)',
      port: 3001,
      bootstrapMode: false,
      isOnline: false,
      rendezvous: 'chat-with-rendezvous',
      peers: [],
      logs: [],
      chatHistory: [],
      currentInput: '',
      discoveryState: 'offline'
    },
    {
      id: 'node-b',
      peerId: 'QmXz9Yae7R3WknFpxtUB999fNGL11ytDGdzZoxeT32xZ2B',
      nickname: 'Device #2 (Android/Phone)',
      port: 3002,
      bootstrapMode: false,
      isOnline: false,
      rendezvous: 'chat-with-rendezvous',
      peers: [],
      logs: [],
      chatHistory: [],
      currentInput: '',
      discoveryState: 'offline'
    },
    {
      id: 'node-c',
      peerId: 'QmW88Pqr2W37knFixtUB487fNGL97ytDGdzZoxeT38xCCC',
      nickname: 'Device #3 (Bootstrap Relay)',
      port: 4001,
      bootstrapMode: true,
      isOnline: false,
      rendezvous: 'chat-with-rendezvous',
      peers: [],
      logs: [],
      chatHistory: [],
      currentInput: '',
      discoveryState: 'offline'
    }
  ]);

  // Helper to add timestamp to logs
  const getTimestamp = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Helper to append log item to individual node
  const appendNodeLog = (nodeId: string, type: NetworkLog['type'], message: string) => {
    const newLog: NetworkLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: getTimestamp(),
      type,
      message
    };
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, logs: [...n.logs, newLog] } : n
      )
    );
  };

  // Log Paste Handler - processes and parses the uploaded/pasted lines
  const handlePasteLogs = (nodeId: string, rawText: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const defaultNick = n.id === 'node-a' ? 'WinUser' : n.id === 'node-b' ? 'PhoneUser' : 'BootstrapNode';
          const defaultPort = n.port;
          const parsed = parseGoLogs(rawText, nodeId, defaultNick, defaultPort);
          return {
            ...n,
            isOnline: true,
            nickname: parsed.nickname,
            peerId: parsed.peerId,
            port: parsed.port,
            rendezvous: parsed.rendezvous,
            logs: parsed.logs,
            discoveryState: parsed.discoveryState,
            peers: [] // will be dynamically linked reactively
          };
        }
        return n;
      })
    );
  };

  // Toggle node power physically
  const handleTogglePower = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const nextState = !n.isOnline;
          return {
            ...n,
            isOnline: nextState,
            logs: [],
            peers: [],
            discoveryState: 'offline'
          };
        }
        return n;
      })
    );
  };

  // Dynamically resolve links and connections between nodes by scanning parsed log texts
  useEffect(() => {
    setNodes((currNodes) => {
      let changed = false;

      const nextNodes = currNodes.map((node) => {
        if (!node.isOnline) {
          if (node.peers.length > 0) {
            changed = true;
            return { ...node, peers: [] };
          }
          return node;
        }

        const discoveredPeersSet = new Set<string>();
        node.logs.forEach((log) => {
          const msg = log.message;

          currNodes.forEach((otherNode) => {
            if (otherNode.id === node.id || !otherNode.isOnline) return;

            const otherId = otherNode.peerId;
            const otherShort = otherId.length > 10 ? otherId.slice(0, 10) : otherId;
            const otherTail = otherId.length > 8 ? otherId.slice(otherId.length - 8) : otherId;
            const nicknameLower = otherNode.nickname?.toLowerCase() || '';

            const matchesOther = (otherId && msg.includes(otherId)) ||
                                 (otherShort && msg.includes(otherShort)) ||
                                 (otherTail && msg.includes(otherTail)) ||
                                 (nicknameLower && msg.toLowerCase().includes(nicknameLower));

            if (matchesOther) {
              const hasConnectedMark = msg.includes('CONNECTED') || 
                                       msg.includes('Established') ||
                                       msg.includes('Yamux protocol stream established') || 
                                       msg.includes('Opened incoming stream') || 
                                       msg.includes('Fully connected') || 
                                       msg.includes('Handshake successful') || 
                                       msg.includes('shook hands');
              if (hasConnectedMark) {
                discoveredPeersSet.add(otherNode.id);
              }
            }
          });
        });

        const peersList = Array.from(discoveredPeersSet);
        const listsEqual = node.peers.length === peersList.length && node.peers.every(p => peersList.includes(p));
        
        let calculatedState = node.discoveryState;
        if (peersList.length > 0 && node.discoveryState !== 'connected') {
          calculatedState = 'connected';
        }

        if (!listsEqual || node.discoveryState !== calculatedState) {
          changed = true;
          return {
            ...node,
            peers: peersList,
            discoveryState: calculatedState
          };
        }

        return node;
      });

      return changed ? nextNodes : currNodes;
    });
  }, [JSON.stringify(nodes.map(n => ({ id: n.id, isOnline: n.isOnline, logsCount: n.logs.length, peerId: n.peerId, nickname: n.nickname })))] );

  // Update input string in buffer
  const handleInputChange = (nodeId: string, value: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, currentInput: value } : n))
    );
  };

  // Submit Shell/Cli commands
  const handleSubmitCommand = (nodeId: string, rawInput: string) => {
    const input = rawInput.trim();
    if (!input) return;

    // Reset input buffer
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, currentInput: '' } : n))
    );

    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (!sourceNode || !sourceNode.isOnline) return;

    // Append standard prompt echo
    appendNodeLog(nodeId, 'system', `> ${input}`);

    // Command Parser
    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmd = parts[0].toLowerCase();

      switch (cmd) {
        case '/help':
          appendNodeLog(nodeId, 'system', 'Available subcommands:');
          appendNodeLog(nodeId, 'system', '  /peers         - List all cryptographic connected multihash peers');
          appendNodeLog(nodeId, 'system', '  /connect <maddr> - Manually dial a node using its multiaddress');
          appendNodeLog(nodeId, 'system', '  /me            - Display current client configuration metadata');
          appendNodeLog(nodeId, 'system', '  /exit          - Shut down this libp2p daemon process gracefully');
          break;

        case '/connect': {
          if (parts.length < 2) {
            appendNodeLog(nodeId, 'system', '[!] Usage: /connect <multiaddress>');
            break;
          }
          const targetAddr = parts[1];
          const portMatch = targetAddr.match(/\/tcp\/(\d+)/);
          const portVal = portMatch ? parseInt(portMatch[1], 10) : null;
          
          let targetNode = nodes.find(n => n.isOnline && portVal !== null && n.port === portVal);
          if (!targetNode) {
            targetNode = nodes.find(n => n.isOnline && n.id !== nodeId && (targetAddr.includes(n.peerId) || targetAddr.includes(n.id)));
          }

          if (targetNode) {
            if (sourceNode.peers.includes(targetNode.id)) {
              appendNodeLog(nodeId, 'system', `[!] Already connected to ${targetNode.nickname}.`);
              break;
            }
            
            appendNodeLog(nodeId, 'system', `[*] Manually dialing ${targetNode.nickname} via ${targetAddr}...`);
            const targetId = targetNode.id;
            
            setTimeout(() => {
              setNodes((prev) =>
                prev.map((n) => {
                  if (n.id === nodeId) {
                    return {
                      ...n,
                      peers: [...n.peers, targetId],
                      logs: [...n.logs, { id: `manual-1-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `[+] Manually connected to ${targetNode!.nickname}!` }]
                    };
                  }
                  if (n.id === targetId) {
                    return {
                      ...n,
                      peers: [...n.peers, nodeId],
                      logs: [...n.logs, { id: `manual-2-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `[+] Incoming manual link from ${sourceNode.nickname}!` }]
                    };
                  }
                  return n;
                })
              );
            }, 600);
          } else {
            appendNodeLog(nodeId, 'error', `[!] Dial failed: Could not find online peer with address "${targetAddr}".`);
          }
          break;
        }

        case '/peers':
          appendNodeLog(nodeId, 'system', '--- Active P2P Connections ---');
          if (sourceNode.peers.length === 0) {
            appendNodeLog(nodeId, 'system', 'No active peers matching rendezvous. Waiting for DHT/mDNS ticks...');
          } else {
            sourceNode.peers.forEach((pId, idx) => {
              const connectedPeer = nodes.find((no) => no.id === pId);
              if (connectedPeer && connectedPeer.isOnline) {
                appendNodeLog(
                  nodeId,
                  'system',
                  `[${idx + 1}] Qm${connectedPeer.peerId.slice(0, 10)}... (Port:${connectedPeer.port}, IP:127.0.0.1, State:ESTABLISHED)`
                );
              }
            });
          }
          break;

        case '/me':
          appendNodeLog(nodeId, 'system', `Nickname: ${sourceNode.nickname}`);
          appendNodeLog(nodeId, 'system', `Port Bind: ${sourceNode.port}`);
          appendNodeLog(nodeId, 'system', `Identity PeerID: ${sourceNode.peerId}`);
          appendNodeLog(nodeId, 'system', `Local multiaddress: /ip4/127.0.0.1/tcp/${sourceNode.port}/p2p/${sourceNode.peerId.slice(0, 8)}`);
          appendNodeLog(nodeId, 'system', `Listen protocol: /libp2p/chat/1.0.0`);
          appendNodeLog(nodeId, 'system', `Rendezvous room tag: "${rendezvousRoom}"`);
          break;

        case '/exit':
          appendNodeLog(nodeId, 'system', '[*] Executing exit sequence, closing network Yamux muxer...');
          setTimeout(() => {
            handleTogglePower(nodeId);
          }, 400);
          break;

        default:
          appendNodeLog(nodeId, 'error', `[!] Unknown command "${cmd}". Try /help to view list.`);
      }
      return;
    }

    // Standard broadcast message logic
    appendNodeLog(nodeId, 'chat', `Me: ${input}`);

    // Select online destination peers mapping
    const targets = sourceNode.peers.filter((pId) => {
      const pObj = nodes.find((n) => n.id === pId);
      return pObj && pObj.isOnline;
    });

    if (targets.length === 0) {
      appendNodeLog(nodeId, 'system', '[*] Message buffered (0 connected peers running stream currently)');
      return;
    }

    // Deliver with simulated delay
    targets.forEach((destId) => {
      // Trigger packet animation trigger
      setActiveMessage({ from: nodeId, to: destId, content: input });
      
      setTimeout(() => {
        appendNodeLog(
          destId,
          'chat',
          `${sourceNode.nickname}: ${input}`
        );
        // Clear message packet animation state after completion
        setActiveMessage(null);
      }, latencyMs);
    });
  };

  // Restore everything to default matching alpha-lobby room
  const handleResetSimulation = () => {
    setRendezvousRoom('chat-with-rendezvous');
    setLatencyMs(45);
    setNodes([
      {
        id: 'node-a',
        peerId: 'QmYy6Zbt9W37knFixtUB487fNGL97ytDGdzZoxeT38xA4A',
        nickname: 'Device #1 (Windows PC)',
        port: 3001,
        bootstrapMode: false,
        isOnline: false,
        rendezvous: 'chat-with-rendezvous',
        peers: [],
        logs: [],
        chatHistory: [],
        currentInput: '',
        discoveryState: 'offline'
      },
      {
        id: 'node-b',
        peerId: 'QmXz9Yae7R3WknFpxtUB999fNGL11ytDGdzZoxeT32xZ2B',
        nickname: 'Device #2 (Android/Phone)',
        port: 3002,
        bootstrapMode: false,
        isOnline: false,
        rendezvous: 'chat-with-rendezvous',
        peers: [],
        logs: [],
        chatHistory: [],
        currentInput: '',
        discoveryState: 'offline'
      },
      {
        id: 'node-c',
        peerId: 'QmW88Pqr2W37knFixtUB487fNGL97ytDGdzZoxeT38xCCC',
        nickname: 'Device #3 (Bootstrap Relay)',
        port: 4001,
        bootstrapMode: true,
        isOnline: false,
        rendezvous: 'chat-with-rendezvous',
        peers: [],
        logs: [],
        chatHistory: [],
        currentInput: '',
        discoveryState: 'offline'
      }
    ]);
  };

  // Dynamically analyze logs and generate real troubleshooting action sheets
  const diagnostics = React.useMemo(() => {
    let hasMismatch = false;
    let mismatchExpected = '';
    let mismatchActual = '';
    let hasNatObstacle = false;
    let hasBootstrapConnection_a = false;
    let hasBootstrapConnection_b = false;
    let hasDialsFailed = false;

    nodes.forEach(node => {
      node.logs.forEach(log => {
        const msg = log.message;
        if (msg.includes('peer id mismatch')) {
          hasMismatch = true;
          const exp = msg.match(/expected\s+([a-zA-Z0-9]+)/);
          const act = msg.match(/matches\s+([a-zA-Z0-9]+)/);
          if (exp) mismatchExpected = exp[1];
          if (act) mismatchActual = act[1];
        }
        if (msg.includes('NAT Obstacle') || msg.includes('dial backoff') || msg.includes('failed to dial') || msg.includes('CGNAT')) {
          hasNatObstacle = true;
        }
        if (msg.includes('dials failed') || msg.includes('all dials failed') || msg.includes('refused/timed out')) {
          hasDialsFailed = true;
        }
        if (msg.includes('Successfully connected') || msg.includes('Yamux protocol stream established') || msg.includes('shook hands')) {
          if (node.id === 'node-a') hasBootstrapConnection_a = true;
          if (node.id === 'node-b') hasBootstrapConnection_b = true;
        }
      });
    });

    const report: string[] = [];
    const recommendations: { title: string; why: string; action: string }[] = [];

    if (hasMismatch) {
      report.push('⚠️ КРИТИЧЕСКАЯ ОШИБКА: Peer ID Mismatch');
      recommendations.push({
        title: '🔑 Несоответствие Peer ID (Критика)',
        why: 'Узел Android ожидал конкретный Peer ID, но Windows-клиент сгенерировал другие ключи. Это блокирует Noise-шифрование.',
        action: 'Сохраняйте закрытый ключ в файл при запуске, чтобы он не менялся. (Запуск: go run main.go -key peer.key)'
      });
    }

    if (hasNatObstacle) {
      report.push('⚠️ ПРЕПЯТСТВИЕ СЕТИ: Блокировка CGNAT');
      recommendations.push({
        title: '📡 CGNAT Изоляция (Android / 4G)',
        why: 'Мобильный интернет (4G / Termux) находится под Carrier-Grade NAT. Входящие порты полностью заблокированы вашим оператором связи.',
        action: 'Для их связи необходимы публичные ретрансляторы (Circuit Relay v2) или включение Hole Punching на обоих узлах.'
      });
    }

    if (!hasMismatch && !hasNatObstacle && hasDialsFailed) {
      report.push('⚠️ ОШИБКА СВЯЗИ: Все попытки дозвона завершились неудачей (All dials failed)');
      recommendations.push({
        title: '🧱 Сетевая Негосиация Отклонена',
        why: 'Локальные брандмауэры или правила маршрутизатора Wi-Fi блокируют входящий порт 3002.',
        action: 'Откройте порты в фаерволе, или поднимите VPN-туннель (WireGuard / Tailscale) между устройствами.'
      });
    }

    if (nodes.every(n => n.logs.length === 0)) {
      recommendations.push({
        title: '📋 Ожидание логов...',
        why: 'Сетевой анализатор готов к диагностике подсистемы.',
        action: 'Запустите терминал в Termux/Windows и вставьте сырой вывод (console logs) в карточки справа.'
      });
    } else if (recommendations.length === 0) {
      recommendations.push({
        title: '✅ Анализ успешного соединения',
        why: 'Логи не содержат известных сетевых ошибок или взаимных блокировок.',
        action: 'Узлы работают в штатном децентрализованном режиме!'
      });
    }

    const state_a = nodes[0].isOnline ? '🟢 Разобран' : '⚪ Нет логов';
    const state_b = nodes[1].isOnline ? '🟢 Разобран' : '⚪ Нет логов';

    return {
      hasMismatch,
      hasNatObstacle,
      hasDialsFailed,
      state_a,
      state_b,
      report,
      recommendations
    };
  }, [nodes]);

  return (
    <div className="min-h-screen bg-[#0A0B10] text-[#E0E0E0] flex flex-col font-mono selection:bg-[#00FF41]/20 selection:text-white pb-12 antialiased">
      {/* Top Header Section with Bento Grid Theme */}
      <header className="border-b border-[#1E212B] bg-[#0A0B10] px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#00FF41] rounded-full shadow-[0_0_8px_#00FF41] animate-pulse"></div>
            <div>
              <h1 className="font-display font-black text-xl tracking-wide text-white uppercase flex flex-wrap items-center gap-2">
                GOP2P-TERMINAL
                <span className="text-xs text-[#6B7280] font-mono font-light italic normal-case underline decoration-[#00FF41]/40 decoration-2">
                  {rendezvousRoom}
                </span>
              </h1>
              <p className="text-[11px] text-[#9CA3AF] font-mono leading-tight">
                libp2p Multicast DNS LAN discovery & Kademlia routing
              </p>
            </div>
          </div>

          {/* Bento Stats Display */}
          <div className="flex flex-wrap items-center gap-6 text-[11px] text-[#9CA3AF] font-mono">
            <div className="flex flex-col items-end">
              <span className="opacity-50 uppercase text-[9px] text-slate-500 font-bold">Mesh Sync</span>
              <span className="text-[#00FF41] font-bold">
                {nodes.filter((n) => n.isOnline).length} / {nodes.length} LIVE
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="opacity-50 uppercase text-[9px] text-slate-500 font-bold">Protocols</span>
              <span className="text-white">libp2p v0.31.0</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="opacity-50 uppercase text-[9px] text-slate-500 font-bold">Host Port Range</span>
              <span className="text-[#F27D26] font-semibold">:3001 - :3003</span>
            </div>
            <div className="h-8 w-px bg-[#1E212B] hidden md:block" />
            <button
              onClick={handleResetSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#12141C] hover:bg-[#1A1D27] text-xs font-mono font-bold rounded transition-all text-[#9CA3AF] hover:text-[#00FF41] border border-[#1E212B] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>RESET SUB_NET</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Sandbox Area */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">
        
        {/* Custom Bento Alert Bar */}
        <div className="bg-[#12141C] border border-[#1E212B] p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F27D26] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">P2P SIMULATOR ENG•LIVE WORKSPACE</h4>
              <p className="text-xs text-[#9CA3AF] max-w-2xl leading-normal">
                Trigger messaging over virtual streams! Broadcast commands from <strong>Alice</strong> to <strong>Bob</strong>, or toggle power on <strong>Charlie</strong> to witness the automatic mDNS multicast and Kad-DHT finder mechanism run in real time.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <a 
              href="#code-viewer-section"
              className="px-4 py-2 bg-[#12141C] hover:bg-[#1E212B] border border-[#1E212B] text-[#00FF41] font-bold text-xs rounded transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_12px_rgba(0,255,65,0.05)]"
            >
              <Code2 className="w-4 h-4" />
              <span>MAIN.GO SOURCE CODE</span>
            </a>
          </div>
        </div>

        {/* Dashboard split content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Topology graph & parameters (span 5) */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Visual graph */}
            <NetworkVisualizer
              nodes={nodes}
              onToggleNode={handleTogglePower}
              rendezvousRoom={rendezvousRoom}
              activeMessageToSend={activeMessage}
            />

            {/* Config controls and Real diagnostics report */}
            <div className="bg-[#12141C] border border-[#1E212B] rounded-lg p-5 space-y-4">
              <h3 className="font-bold text-[#6B7280] text-[10px] tracking-widest uppercase border-b border-[#1E212B] pb-2">
                Сетевая Диагностика и Рекомендации
              </h3>

              {/* Status board */}
              <div className="grid grid-cols-2 gap-3 pb-1">
                <div className="bg-[#07080D] p-2 border border-[#1E212B] rounded">
                  <span className="text-[9px] text-[#6B7280] block uppercase font-bold">Device #1 Windows</span>
                  <span className="font-mono text-[11px] font-bold text-white">{diagnostics.state_a}</span>
                </div>
                <div className="bg-[#07080D] p-2 border border-[#1E212B] rounded">
                  <span className="text-[9px] text-[#6B7280] block uppercase font-bold">Device #2 Android</span>
                  <span className="font-mono text-[11px] font-bold text-white">{diagnostics.state_b}</span>
                </div>
              </div>

              {/* Warnings / Action sheet lists */}
              <div className="space-y-3.5 pt-1">
                {diagnostics.recommendations.map((rec, idx) => (
                  <div key={idx} className="bg-[#07080D]/50 border-l-2 border-[#F27D26] p-2.5 space-y-1 rounded-r">
                    <h4 className="text-[11px] font-bold text-white font-mono">{rec.title}</h4>
                    <p className="text-[10px] text-[#9CA3AF] leading-relaxed">{rec.why}</p>
                    <p className="text-[10px] text-[#00FF41] font-semibold leading-relaxed border-t border-[#1E212B]/40 pt-1.5 mt-1">
                      👉 {rec.action}
                    </p>
                  </div>
                ))}
              </div>

              {/* Rendezvous name input */}
              <div className="space-y-1.5 pt-2 border-t border-[#1E212B]">
                <label className="text-[10px] text-[#9CA3AF] uppercase font-bold block">
                  Rendezvous Namespace (DHT REGISTRY KEY)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={rendezvousRoom}
                    onChange={(e) => setRendezvousRoom(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                    className="w-full bg-[#07080D] border border-[#1E212B] rounded px-3 py-2 text-xs font-mono text-[#00FF41] focus:outline-none focus:border-[#00FF41]/60 tracking-wider"
                    placeholder="e.g. chat-lobby"
                  />
                  <span className="absolute right-3.5 top-3 w-2 h-2 rounded-full bg-[#00FF41] shadow-[0_0_6px_#00FF41]" />
                </div>
                <span className="text-[9px] text-[#6B7280] block leading-normal pt-1">
                  Изменение этой комнаты заставляет Kad-DHT сканировать другой глобальный индекс пространства имен.
                </span>
              </div>
            </div>

          </section>

          {/* Right panel: Console Terminals split (span 7) */}
          <section className="lg:col-span-7 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs tracking-wider text-[#6B7280] uppercase">
                Concurrent Go main processes
              </h3>
              <span className="text-[10px] font-mono text-[#6B7280] uppercase">
                libp2p dynamic stream instances
              </span>
            </div>

            {/* Primary Windows Console - large layout */}
            <div className="h-72">
              <TerminalNode
                node={nodes[0]}
                onInputChange={handleInputChange}
                onSubmitCommand={handleSubmitCommand}
                onTogglePower={handleTogglePower}
                onPasteLogs={handlePasteLogs}
                peerCount={nodes[0].peers.filter(pId => nodes.find(no => no.id === pId)?.isOnline).length}
              />
            </div>

            {/* Split grid for Bob and Charlie below */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-68">
                <TerminalNode
                  node={nodes[1]}
                  onInputChange={handleInputChange}
                  onSubmitCommand={handleSubmitCommand}
                  onTogglePower={handleTogglePower}
                  onPasteLogs={handlePasteLogs}
                  peerCount={nodes[1].peers.filter(pId => nodes.find(no => no.id === pId)?.isOnline).length}
                />
              </div>
              <div className="h-68">
                <TerminalNode
                  node={nodes[2]}
                  onInputChange={handleInputChange}
                  onSubmitCommand={handleSubmitCommand}
                  onTogglePower={handleTogglePower}
                  onPasteLogs={handlePasteLogs}
                  peerCount={nodes[2].peers.filter(pId => nodes.find(no => no.id === pId)?.isOnline).length}
                />
              </div>
            </div>
          </section>

        </div>

        {/* Source Code Section anchor */}
        <section id="code-viewer-section" className="pt-2">
          <div className="flex items-center gap-3 mb-3.5">
            <h2 className="font-bold text-sm text-[#9CA3AF] uppercase tracking-wider">Production Code Assembly</h2>
            <div className="h-px flex-1 bg-[#1E212B]" />
            <span className="text-[10px] text-[#6B7280] font-mono">Go module templates</span>
          </div>
          <CodeViewer />
        </section>

        {/* Architecture deep dive */}
        <section className="pt-2">
          <ArchitectureGuide />
        </section>

      </main>
    </div>
  );
}
