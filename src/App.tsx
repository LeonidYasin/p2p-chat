import React, { useState, useEffect } from 'react';
import { P2PNode, NetworkLog, DirectMessage } from './types';
import TerminalNode from './components/TerminalNode';
import NetworkVisualizer from './components/NetworkVisualizer';
import CodeViewer from './components/CodeViewer';
import ArchitectureGuide from './components/ArchitectureGuide';
import { Radio, RefreshCw, Zap, Laptop, Network, HelpCircle, Code2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

export default function App() {
  const [rendezvousRoom, setRendezvousRoom] = useState<string>('chat-with-rendezvous');
  const [latencyMs, setLatencyMs] = useState<number>(45);
  const [activeMessage, setActiveMessage] = useState<{ from: string; to: string; content: string } | null>(null);

  // Initialize simulated peers
  const [nodes, setNodes] = useState<P2PNode[]>([
    {
      id: 'node-a',
      peerId: 'QmYy6Zbt9W37knFixtUB487fNGL97ytDGdzZoxeT38xA4A',
      nickname: 'Alice',
      port: 3001,
      bootstrapMode: false,
      isOnline: true,
      rendezvous: 'chat-with-rendezvous',
      peers: ['node-b'],
      logs: [
        { id: 'a1', timestamp: '10:48:10', type: 'system', message: '[*] Starting Peer-to-Peer node as "Alice"...' },
        { id: 'a2', timestamp: '10:48:11', type: 'system', message: '[+] Created libp2p Host successfully on port 3001.' },
        { id: 'a3', timestamp: '10:48:11', type: 'system', message: '[+] Peer ID: QmYy6Zbt9W37knFixtUB487fNGL97ytDGdzZoxeT38xA4A' },
        { id: 'a4', timestamp: '10:48:11', type: 'system', message: '[+] Multiaddress: /ip4/127.0.0.1/tcp/3001/p2p/QmYy6Zbt...' },
        { id: 'a5', timestamp: '10:48:12', type: 'discovery', message: '[mDNS] Discovered local peer Bob (:3002). Attempting secure handshake...' },
        { id: 'a6', timestamp: '10:48:12', type: 'stream', message: '[Stream] Yamux protocol stream established on /libp2p/chat/1.0.0' },
        { id: 'a7', timestamp: '10:48:12', type: 'system', message: '[+] Connected! Use command shell below to test streaming.' }
      ],
      chatHistory: [],
      currentInput: '',
      discoveryState: 'connected'
    },
    {
      id: 'node-b',
      peerId: 'QmXz9Yae7R3WknFpxtUB999fNGL11ytDGdzZoxeT32xZ2B',
      nickname: 'Bob',
      port: 3002,
      bootstrapMode: false,
      isOnline: true,
      rendezvous: 'chat-with-rendezvous',
      peers: ['node-a'],
      logs: [
        { id: 'b1', timestamp: '10:48:11', type: 'system', message: '[*] Starting Peer-to-Peer node as "Bob"...' },
        { id: 'b2', timestamp: '10:48:11', type: 'system', message: '[+] Created libp2p Host successfully on port 3002.' },
        { id: 'b3', timestamp: '10:48:11', type: 'system', message: '[+] Peer ID: QmXz9Yae7R3WknFpxtUB999fNGL11ytDGdzZoxeT32xZ2B' },
        { id: 'b4', timestamp: '10:48:11', type: 'system', message: '[+] Multiaddress: /ip4/127.0.0.1/tcp/3002/p2p/QmXz9Ya...' },
        { id: 'b5', timestamp: '10:48:12', type: 'discovery', message: '[mDNS] Discovered local peer Alice (:3001). Handshaking Noise credentials...' },
        { id: 'b6', timestamp: '10:48:12', type: 'stream', message: '[Stream] Opened incoming stream /libp2p/chat/1.0.0' },
        { id: 'b7', timestamp: '10:48:12', type: 'system', message: '[+] Peer link verified. Shell is active!' }
      ],
      chatHistory: [],
      currentInput: '',
      discoveryState: 'connected'
    },
    {
      id: 'node-c',
      peerId: 'QmW88Pqr2W37knFixtUB487fNGL97ytDGdzZoxeT38xCCC',
      nickname: 'Charlie',
      port: 3003,
      bootstrapMode: false,
      isOnline: false, // Charlie starts offline so users can power him up!
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

  // Turn node on/off simulated engine
  const handleTogglePower = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const nextState = !n.isOnline;
          if (nextState) {
            // Turning online logs initialization steps
            return {
              ...n,
              isOnline: true,
              peers: [],
              discoveryState: 'bootstrapping',
              logs: [
                { id: `sys-1-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `[*] Starting Peer-to-Peer node as "${n.nickname}"...` },
                { id: `sys-2-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `[+] Created libp2p Host successfully on port ${n.port}.` },
                { id: `sys-3-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `[+] Peer ID: ${n.peerId}` },
                { id: `sys-4-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `[+] Multiaddress: /ip4/127.0.0.1/tcp/${n.port}/p2p/${n.peerId.slice(0, 10)}...` },
                { id: `sys-5-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `\n[Поиск: 📡 Ожидание / Search: 📡 Waiting] Комната / Room: "${rendezvousRoom}"` },
                { id: `sys-6-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `   📶 Подключение к DHT бутстрап-серверам: 0 🔴` },
                { id: `sys-7-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `   💡 [P2P Справка]: Первичное подключение к DHT-сети обычно занимает от 5 до 15 секунд.` },
                { id: `sys-8-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `      Убедитесь, что интернет активен (Wi-Fi или сотовая связь).` },
                { id: `sys-9-${Date.now()}`, timestamp: getTimestamp(), type: 'system', message: `   💡 [P2P Info]: Initial DHT boot strap takes 5-15s. Checking internet...\n` }
              ]
            };
          } else {
            // Leaving logs offline
            return {
              ...n,
              isOnline: false,
              peers: [],
              discoveryState: 'offline',
              logs: []
            };
          }
        }
        return n;
      })
    );

    // If turned online, queue dynamic step transitions representing real-world timing
    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (sourceNode && !sourceNode.isOnline) {
      setTimeout(() => {
        setNodes((curr) =>
          curr.map((cn) =>
            cn.id === nodeId && cn.isOnline && cn.peers.length === 0
              ? { ...cn, discoveryState: 'querying_dht' }
              : cn
          )
        );
        appendNodeLog(nodeId, 'system', `[Поиск: 📡 Сеть активна / Search: 📡 DHT Connected] Комната / Room: "${rendezvousRoom}"`);
        appendNodeLog(nodeId, 'system', `   📶 Соединение с DHT: Установлено (1 бутстрапов) 🟢`);
        appendNodeLog(nodeId, 'system', `   📊 Сборка таблицы маршрутизации Kademlia (Размер RT: 0) 🔄`);
        appendNodeLog(nodeId, 'system', `   💡 [P2P Справка]: Строим таблицы маршрутизации и скачиваем индексы комнаты. Это занимает ~10-25 секунд.`);
        appendNodeLog(nodeId, 'system', `      На Android / Termux это может идти чуть дольше из-за ограничений ОС.`);
        appendNodeLog(nodeId, 'system', `   💡 [P2P Info]: Building Kademlia routing tables. Downloading indexes (10-25s)...\n`);
      }, 1500);

      setTimeout(() => {
        setNodes((curr) =>
          curr.map((cn) =>
            cn.id === nodeId && cn.isOnline && cn.peers.length === 0
              ? { ...cn, discoveryState: 'searching_room' }
              : cn
          )
        );
        appendNodeLog(nodeId, 'system', `[Поиск: 📡 Активный сканирование / Search: 📡 Crawling DHT] Комната / Room: "${rendezvousRoom}"`);
        appendNodeLog(nodeId, 'system', `   📶 Активные узлы DHT / Routing links: 2 | Размер таблицы / RT Size: 3 🟢`);
        appendNodeLog(nodeId, 'system', `   🔍 Сканируем глобальный DHT-индекс на наличие собеседников... / Looking for active candidates...\n`);
      }, 3500);

      // Simulate a realistic Peer Discovered + NAT CGNAT warning + eventual Relay Hole punch fallback
      setTimeout(() => {
        setNodes((curr) => {
          const onlinePeers = curr.filter((oth) => oth.id !== nodeId && oth.isOnline);
          if (onlinePeers.length === 0) {
            appendNodeLog(nodeId, 'system', `[Поиск: 📡 Поиск завершен / Search: 📡 Crawl Done] 0 других собеседников найдено на текущем цикле в комнате "${rendezvousRoom}".`);
            appendNodeLog(nodeId, 'system', `   💡 (Поиск повторяется каждые 15 сек. Держите приложение запущенным. Проверьте правильность названия комнаты у обоих пиров!)\n`);
            return curr;
          }

          const targetPeer = onlinePeers[0];
          appendNodeLog(nodeId, 'discovery', `[Поиск: ✨ Пир обнаружен / Search: ✨ Peer Discovered] Ник/ID: "${targetPeer.nickname}" (ID: Qm${targetPeer.peerId.slice(0, 8)}...) в комнате "${rendezvousRoom}"!`);
          appendNodeLog(nodeId, 'system', `   🔗 [1/2] Начинаем установку защищенного соединения (Noise / Handshake)... / Starting handshake...`);

          setTimeout(() => {
            appendNodeLog(nodeId, 'error', `[Search: ⚠️ NAT Obstacle] Узел ${targetPeer.nickname} зарегистрирован в DHT, но прямое подключение отклонено: Препятствие NAT`);
            appendNodeLog(nodeId, 'system', `   💡 [Почему это происходит? / NAT Explanation]:`);
            appendNodeLog(nodeId, 'system', `      - На WINDOWS: Wi-Fi роутеры чаще всего Full Cone / Restricted NAT (порты легко пробиваются).`);
            appendNodeLog(nodeId, 'system', `      - На ANDROID (Termux): Мобильный интернет (4G/5G) использует жесткий CGNAT (Carrier-Grade NAT) оператора.`);
            appendNodeLog(nodeId, 'system', `      - Напрямую такие устройства соединиться не могут. Сеть libp2p сейчас автоматически пытается пробить NAT`);
            appendNodeLog(nodeId, 'system', `        с помощью протокола Hole Punching (DCUtR) или перенаправляет трафик через публичные реле-ноды (Relay v2).`);
            appendNodeLog(nodeId, 'system', `      💡 ПОЖАЛУЙСТА, НЕ ЗАКРЫВАЙТЕ приложение! Процесс децентрализованного пробития NAT и ретрансляции идет непрерывно.\n`);

            setTimeout(() => {
              appendNodeLog(nodeId, 'stream', `[Search: 🎉 CONNECTED] Успешное соединение! Полный рукопожатие завершено с пиром ${targetPeer.nickname}! Прямой чат-канал настроен.\n`);
              
              // Transition both into connected status
              setNodes((nowNodes) =>
                nowNodes.map((nowN) => {
                  if (nowN.id === nodeId && !nowN.peers.includes(targetPeer.id)) {
                    return { ...nowN, peers: [...nowN.peers, targetPeer.id], discoveryState: 'connected' };
                  }
                  if (nowN.id === targetPeer.id && !nowN.peers.includes(nodeId)) {
                    return { ...nowN, peers: [...nowN.peers, nodeId], discoveryState: 'connected' };
                  }
                  return nowN;
                })
              );
            }, 3000);
          }, 1500);

          return curr;
        });
      }, 5000);
    }
  };

  // Discovery engine: checks who is online and coordinates links based on Room value
  const triggerPeerDiscovery = () => {
    setNodes((prev) => {
      const onlineNodes = prev.filter((n) => n.isOnline);
      if (onlineNodes.length <= 1) return prev;

      return prev.map((n) => {
        if (!n.isOnline) return n;

        // Find matches which: are online, share same Room, excluding self
        const peerIdsMatched = onlineNodes
          .filter((oth) => oth.id !== n.id && oth.rendezvous === rendezvousRoom)
          .map((oth) => oth.id);

        // Figure out new peers that were not in old list
        const newlyDiscovered = peerIdsMatched.filter((pId) => !n.peers.includes(pId));

        if (newlyDiscovered.length > 0) {
          const addedLogs: NetworkLog[] = newlyDiscovered.flatMap((pId) => {
            const peerObj = onlineNodes.find((on) => on.id === pId);
            const shortPeerId = peerObj ? peerObj.peerId.slice(0, 8) : '';
            return [
              {
                id: `disc-${Date.now()}-${pId}`,
                timestamp: getTimestamp(),
                type: 'discovery' as const,
                message: `[Search: ✨ Discovered] Found candidate peer ID Qm${shortPeerId}... in room "${rendezvousRoom}"! Pitching secure link...`
              },
              {
                id: `upg-${Date.now()}-${pId}`,
                timestamp: getTimestamp(),
                type: 'stream' as const,
                message: `[Search: 🎉 CONNECTED] Fully connected to peer ${peerObj?.nickname}! Upgrading libp2p stream...`
              }
            ];
          });

          return {
            ...n,
            peers: [...n.peers, ...newlyDiscovered],
            discoveryState: 'connected',
            logs: [...n.logs, ...addedLogs]
          };
        }

        return n;
      });
    });
  };

  // Periodic mDNS/DHT discovery checker
  useEffect(() => {
    const discTicker = setInterval(() => {
      triggerPeerDiscovery();
    }, 4000);

    return () => clearInterval(discTicker);
  }, [rendezvousRoom]);

  // Monitor room changes
  useEffect(() => {
    // Notify all online nodes that they are joining a new room
    nodes.forEach((n) => {
      if (n.isOnline) {
        appendNodeLog(n.id, 'system', `[*] Leaving previous rendezvous room...`);
        appendNodeLog(n.id, 'system', `[*] Advertised and searching rendezvous: "${rendezvousRoom}"...`);
      }
    });

    // Reset peer connections matching old room
    setNodes((prev) =>
      prev.map((n) => {
        if (!n.isOnline) return n;

        // Schedule change of discoveryState to 'searching_room' shortly
        setTimeout(() => {
          setNodes((curr) =>
            curr.map((cn) =>
              cn.id === n.id && cn.isOnline && cn.peers.length === 0
                ? { ...cn, discoveryState: 'searching_room' }
                : cn
            )
          );
        }, 1500);

        return {
          ...n,
          rendezvous: rendezvousRoom,
          peers: [], // clears peers to trigger fresh rendezvous handshakes
          discoveryState: 'querying_dht'
        };
      })
    );

    setTimeout(() => {
      triggerPeerDiscovery();
    }, 1000);
  }, [rendezvousRoom]);

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
        nickname: 'Alice',
        port: 3001,
        bootstrapMode: false,
        isOnline: true,
        rendezvous: 'chat-with-rendezvous',
        peers: ['node-b'],
        logs: [
          { id: 'r1', timestamp: getTimestamp(), type: 'system', message: '[*] Node context reset. Starting Alice daemon...' },
          { id: 'r2', timestamp: getTimestamp(), type: 'system', message: '[+] Host live on port 3001.' },
          { id: 'r3', timestamp: getTimestamp(), type: 'discovery', message: '[mDNS] Multicast search active...' },
          { id: 'r4', timestamp: getTimestamp(), type: 'system', message: '[+] Successfully connected to Bob!' }
        ],
        chatHistory: [],
        currentInput: '',
        discoveryState: 'connected'
      },
      {
        id: 'node-b',
        peerId: 'QmXz9Yae7R3WknFpxtUB999fNGL11ytDGdzZoxeT32xZ2B',
        nickname: 'Bob',
        port: 3002,
        bootstrapMode: false,
        isOnline: true,
        rendezvous: 'chat-with-rendezvous',
        peers: ['node-a'],
        logs: [
          { id: 'rb1', timestamp: getTimestamp(), type: 'system', message: '[*] Node context reset. Starting Bob daemon...' },
          { id: 'rb2', timestamp: getTimestamp(), type: 'system', message: '[+] Host live on port 3002.' },
          { id: 'rb3', timestamp: getTimestamp(), type: 'discovery', message: '[mDNS] Multicast search active...' },
          { id: 'rb4', timestamp: getTimestamp(), type: 'system', message: '[+] Successfully connected to Alice!' }
        ],
        chatHistory: [],
        currentInput: '',
        discoveryState: 'connected'
      },
      {
        id: 'node-c',
        peerId: 'QmW88Pqr2W37knFixtUB487fNGL97ytDGdzZoxeT38xCCC',
        nickname: 'Charlie',
        port: 3003,
        bootstrapMode: false,
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

            {/* Config controls card */}
            <div className="bg-[#12141C] border border-[#1E212B] rounded-lg p-5 space-y-4">
              <h3 className="font-bold text-[#6B7280] text-[10px] tracking-widest uppercase border-b border-[#1E212B] pb-2">
                Discovery configuration parameters
              </h3>

              {/* Rendezvous name input */}
              <div className="space-y-1.5">
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
                <span className="text-[10px] text-[#6B7280] block leading-normal">
                  Changing this key forces libp2p DHT advertiser loops to search a different namespace instantly.
                </span>
              </div>

              {/* Latency dialer range slider */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px]">
                  <label className="text-[#9CA3AF] uppercase font-bold">
                    Synthetic Substream Latency
                  </label>
                  <span className="font-mono text-[#F27D26] font-bold">{latencyMs} ms</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="400"
                  value={latencyMs}
                  onChange={(e) => setLatencyMs(Number(e.target.value))}
                  className="w-full h-1 bg-[#1E212B] rounded-lg appearance-none cursor-pointer accent-[#00FF41] focus:outline-none"
                />
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

            {/* Primary Alice Console - large layout */}
            <div className="h-72">
              <TerminalNode
                node={nodes[0]}
                onInputChange={handleInputChange}
                onSubmitCommand={handleSubmitCommand}
                onTogglePower={handleTogglePower}
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
                  peerCount={nodes[1].peers.filter(pId => nodes.find(no => no.id === pId)?.isOnline).length}
                />
              </div>
              <div className="h-68">
                <TerminalNode
                  node={nodes[2]}
                  onInputChange={handleInputChange}
                  onSubmitCommand={handleSubmitCommand}
                  onTogglePower={handleTogglePower}
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
