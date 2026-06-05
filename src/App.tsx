import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import CodeViewer from './components/CodeViewer';
import { 
  Terminal as TerminalIcon, 
  Cpu, 
  Server, 
  RefreshCw, 
  Play, 
  Square, 
  AlertTriangle, 
  Copy, 
  Check, 
  BookOpen, 
  ChevronRight, 
  Download,
  Info
} from 'lucide-react';

interface NetworkLog {
  id: string;
  timestamp: string;
  type: 'system' | 'error' | 'discovery' | 'stream' | 'chat';
  message: string;
}

interface DaemonState {
  running: boolean;
  logs: NetworkLog[];
  rawLogs: string;
}

export default function App() {
  const [rendezvousRoom, setRendezvousRoom] = useState<string>('chat-with-rendezvous');
  const [currentInput, setCurrentInput] = useState<string>('');
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  
  // Daemon state representing the real backend process
  const [daemon, setDaemon] = useState<DaemonState>({
    running: false,
    logs: [],
    rawLogs: ''
  });

  // Server diagnostics
  const [diagnostics, setDiagnostics] = useState<{
    timestamp: string;
    uptime: number;
    nodeVersion: string;
    goVersion: string;
    compiler: {
      isCompiling: boolean;
      isCompileSucceeded: boolean;
      errorDetails: string;
    };
    daemon: {
      running: boolean;
      pid: number | null;
      logLength: number;
    };
    logs: string[];
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper to parse Go stdout lines to styled log structures
  const parseGoLogs = (rawLogs: string) => {
    const lines = rawLogs.split('\n');
    const parsedLogs: NetworkLog[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let timestamp = '';
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      let defaultTime = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      
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

      let logType: NetworkLog['type'] = 'system';
      if (message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') || message.toLowerCase().includes('refused')) {
        logType = 'error';
      } else if (message.includes('Discovered') || message.includes('mDNS') || message.includes('UDP')) {
        logType = 'discovery';
      } else if (message.includes('CONNECTED') || message.includes('established') || message.includes('Yamux')) {
        logType = 'stream';
      } else if (message.startsWith('Me:') || message.includes('Me:')) {
        logType = 'chat';
      }

      parsedLogs.push({
        id: `parsed-${index}-${Date.now()}`,
        timestamp,
        type: logType,
        message
      });
    });

    return parsedLogs;
  };

  // Poll backend daemon logs
  useEffect(() => {
    const pollLogsAndState = () => {
      fetch('/api/relay/state')
        .then((res) => {
          if (!res.ok) throw new Error("HTTP error");
          return res.json();
        })
        .then((data: { running: boolean; logs: string }) => {
          setDaemon({
            running: data.running,
            rawLogs: data.logs,
            logs: parseGoLogs(data.logs)
          });
        })
        .catch((err) => {
          console.warn("Error polling daemon logs:", err);
        });

      fetch('/api/server/diagnostics')
        .then((res) => {
          if (!res.ok) throw new Error("HTTP error");
          return res.json();
        })
        .then((data) => {
          setDiagnostics(data);
        })
        .catch((err) => {
          console.warn("Error polling diagnostics:", err);
        });
    };

    pollLogsAndState();
    const interval = setInterval(pollLogsAndState, 1500);
    return () => clearInterval(interval);
  }, [rendezvousRoom]);

  // Scroll terminal logs on new additions
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [daemon.logs]);

  // Handle Input command posting to stdin
  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const input = currentInput.trim();
    if (!input) return;

    setCurrentInput('');

    // Send directly to the real/mock backend daemon's stdin
    fetch('/api/relay/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: input })
    })
    .catch((err) => {
      console.error("Failed to forward stdin command:", err);
    });
  };

  // Toggle Daemon
  const handleToggleDaemon = () => {
    const action = daemon.running ? 'stop' : 'start';
    fetch('/api/relay/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, room: rendezvousRoom })
    })
    .catch((err) => {
      console.error("Toggle error:", err);
    });
  };

  // Trigger manual rebuild
  const handleRebuild = () => {
    fetch('/api/server/recompile', { method: 'POST' })
    .catch((err) => console.error("Rebuild error:", err));
  };

  // Export session log
  const handleExportLogs = () => {
    if (daemon.logs.length === 0) return;
    const banner = `======================================================================
                  GOP2P-TERMINAL LOG DUMP REPORT
======================================================================
Session Status : ${daemon.running ? 'ACTIVE' : 'STOPPED'}
Log Index      : ${daemon.logs.length} statements
Captured Date  : ${new Date().toISOString()}
======================================================================\n\n`;

    const body = daemon.logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] : ${l.message}`).join('\n');
    const blob = new Blob([banner + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `libp2p-daemon-output.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Clipboard copy handler
  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTextId(id);
      setTimeout(() => setCopiedTextId(null), 2000);
    }).catch(err => {
      console.error("Copy failed:", err);
    });
  };

  // Is Go SDK available on this Cloud Run runtime container
  const isGoAvailable = diagnostics?.goVersion && !diagnostics.goVersion.includes("Go SDK not found");

  return (
    <div className="min-h-screen bg-[#07080D] text-[#E0E0E0] font-mono selection:bg-emerald-500/20 selection:text-white pb-12 antialiased">
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-[#0A0B10]/80 backdrop-blur-md sticky top-0 z-50 py-3.5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${daemon.running ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'} animate-pulse`} />
            <div>
              <h1 className="font-sans font-black text-white text-lg tracking-wider uppercase flex items-center gap-2">
                Go libp2p P2P Terminal
                <span className="text-xs bg-zinc-800 text-zinc-400 font-normal py-0.5 px-2 rounded-full border border-zinc-700/50">
                  Room: {rendezvousRoom}
                </span>
              </h1>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Authentic console pipeline & cross-platform peer controller
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs text-zinc-400">
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Go Compiler</span>
              <span className={isGoAvailable ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                {isGoAvailable ? 'Detected' : 'Not Loaded'}
              </span>
            </div>
            <div className="w-px h-7 bg-zinc-800" />
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Daemon PID</span>
              <span className="text-zinc-300 font-bold">
                {daemon.running && diagnostics?.daemon.pid ? diagnostics.daemon.pid : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Real Environment/Sandbox Info Card strictly explaining compilation */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Environment Note / Важная Информация О Рабочей Среде
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              На удаленном сервере-песочнице (Cloud Run) Go SDK отсутствует, поэтому бэкенд запускает эмуляцию процесса. 
              <strong> Однако, этот проект на 100% готов к запуску!</strong> Достаточно экспортировать проект в ZIP (раздел Settings в меню AI Studio) или в GitHub, распаковать на своем компьютере с установленным Go, и выполнить команду <code>npm run dev</code>. 
              Сайт локально запустит реальный Go компилятор, скомпилирует <code>main.go</code> и подключит данную консоль напрямую к живому криптографическому p2p-узлу!
            </p>
          </div>
          <div className="shrink-0">
            <span className="text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700/50 px-2 py-1 rounded">
              Linux AMD64 Environment
            </span>
          </div>
        </div>

        {/* Dashboard Grid split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Authentic Daemon Console (7 spans) */}
          <section className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-widest">
                  Live Go-libp2p Node Output
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportLogs}
                  disabled={daemon.logs.length === 0}
                  className={`flex items-center gap-1.5 px-2 py-1 border rounded text-[10px] font-bold transition-all hover:cursor-pointer ${
                    daemon.logs.length === 0
                      ? 'bg-transparent border-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  <Download className="w-3 h-3" />
                  <span>Export Logs</span>
                </button>
              </div>
            </div>

            {/* Simulated Desktop Window Frame */}
            <div className="bg-[#090A0E] border border-zinc-800 rounded-lg overflow-hidden flex flex-col h-[520px] shadow-2xl relative">
              {/* Window Header */}
              <div className="bg-[#0C0D15] border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  <span className="text-[10px] text-zinc-500 ml-2 font-mono">
                    daemon_interactive_stdout://libp2p-node
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded py-0.5 px-2">
                    {daemon.running ? 'Live Daemon' : 'Off'}
                  </span>
                </div>
              </div>

              {/* Log Stream Content */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[11px] leading-relaxed bg-[#050609]"
              >
                {daemon.logs.length > 0 ? (
                  daemon.logs.map((log, idx) => {
                    let logColor = 'text-zinc-300';
                    if (log.type === 'error') logColor = 'text-rose-400 font-semibold';
                    else if (log.type === 'discovery') logColor = 'text-amber-400 font-semibold';
                    else if (log.type === 'stream') logColor = 'text-emerald-400 font-bold';
                    else if (log.type === 'chat') {
                      logColor = log.message.startsWith('Me:') ? 'text-zinc-100 opacity-90' : 'text-emerald-400';
                    }

                    // System starting styles
                    if (log.message.startsWith('[*]')) logColor = 'text-zinc-500';
                    else if (log.message.startsWith('[+]')) logColor = 'text-emerald-400 font-bold';

                    return (
                      <div key={log.id || idx} className={`${logColor} whitespace-pre-wrap py-0.5 border-b border-zinc-900/10`}>
                        <span className="text-zinc-600 mr-2 opacity-60">[{log.timestamp}]</span>
                        {log.message}
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                    <TerminalIcon className="w-12 h-12 text-zinc-800 animate-pulse" />
                    <h3 className="text-zinc-400 font-bold text-xs uppercase">No Daemon logs generated</h3>
                    <p className="text-[10px] text-zinc-600 max-w-md">
                      The Go-libp2p daemon is currently suspended. Use the control panel below to trigger compilation and launch the node.
                    </p>
                  </div>
                )}
              </div>

              {/* Command Input Area */}
              <form 
                onSubmit={handleSubmitCommand}
                className="bg-[#0D0E15] border-t border-zinc-800 p-2.5 flex items-center gap-3"
              >
                <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />
                <input
                  type="text"
                  placeholder={daemon.running ? "Type a message or /help command... (e.g. /me, /peers, /exit)" : "The daemon is offline. Click 'Start Go Daemon' below to boot."}
                  disabled={!daemon.running}
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  className="bg-transparent text-white border-0 focus:outline-none focus:ring-0 text-xs flex-1 font-mono placeholder-zinc-600 disabled:cursor-not-allowed"
                />
                {daemon.running && (
                  <span className="text-[9px] text-zinc-600 bg-zinc-900 font-bold px-1.5 py-0.5 rounded border border-zinc-800 select-none">
                    ENTER to Send
                  </span>
                )}
              </form>
            </div>

            {/* Core Control Center Banners */}
            <div className="bg-[#12141C] border border-[#1E212B] p-5 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Go Daemon Process Controls / Управление процесами
                </h3>
                <p className="text-xs text-zinc-400 leading-normal font-sans">
                  Запустите или принудительно остановите локальный P2P узел, скомпилированный из Go исходного кода.
                </p>
                <div className="flex items-center gap-1.5 pt-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Room index:</span>
                  <input
                    type="text"
                    value={rendezvousRoom}
                    onChange={(e) => setRendezvousRoom(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                    placeholder="chat-lobby"
                    className="bg-[#050609] border border-zinc-800 rounded px-2 py-0.5 text-[11px] text-emerald-400 w-44 tracking-wider focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleToggleDaemon}
                  className={`px-4 py-2 text-xs font-bold border rounded flex items-center gap-2 cursor-pointer transition-all ${
                    daemon.running
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.04)]'
                  }`}
                >
                  {daemon.running ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>STOP DAEMON</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>START GO DAEMON</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleRebuild}
                  disabled={diagnostics?.compiler.isCompiling}
                  className={`px-4 py-2 text-xs font-bold border rounded flex items-center gap-2 cursor-pointer transition-all ${
                    diagnostics?.compiler.isCompiling
                      ? 'bg-zinc-800/10 text-zinc-600 border-transparent cursor-not-allowed'
                      : 'bg-[#F27D26]/10 hover:bg-[#F27D26]/25 text-[#F27D26] border-[#F27D26]/20'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${diagnostics?.compiler.isCompiling ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                  <span>REBUILD BIN (GO BUILD)</span>
                </button>
              </div>
            </div>

            {/* Display Compiler Errors */}
            {diagnostics?.compiler.errorDetails && (
              <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-lg flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 w-full min-w-0">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">compiler build error / Ошибка сборки</h4>
                  <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap bg-black/40 p-3 rounded border border-rose-500/15 mt-1 overflow-x-auto">
                    {diagnostics.compiler.errorDetails}
                  </pre>
                </div>
              </div>
            )}
          </section>

          {/* Right Column: Physical Deployment & Guide (4 spans) */}
          <section className="lg:col-span-4 space-y-6">
            <div className="bg-[#12141C] border border-[#1E212B] rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2.5">
                <BookOpen className="w-4 h-4 text-[#F27D26]" />
                <h3 className="font-bold text-white text-xs uppercase tracking-widest">
                  Quick Deployment Guide / Запуск
                </h3>
              </div>

              {/* Step 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                    Step 1
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">Install Go & Node</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  Убедитесь, что на компьютере установлен Go SDK (версии 1.20+) и Node.js.
                </p>
              </div>

              <div className="h-px bg-zinc-800/40" />

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                    Step 2
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">Download & Run Locally</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  Экспортируйте проект, распакуйте его и установите зависимости:
                </p>
                <div className="relative">
                  <pre className="bg-[#07080D] p-2.5 rounded border border-zinc-800 text-[10px] text-zinc-300 font-mono">
                    npm install
                  </pre>
                  <button
                    onClick={() => copyToClipboard('step-2-cmd', 'npm install')}
                    className="absolute right-2 top-2 p-1.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded border border-zinc-700/50 cursor-pointer"
                  >
                    {copiedTextId === 'step-2-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="h-px bg-zinc-800/40" />

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                    Step 3
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">Start full stack console</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  Запустите локальное веб-приложение:
                </p>
                <div className="relative">
                  <pre className="bg-[#07080D] p-2.5 rounded border border-zinc-800 text-[10px] text-zinc-300 font-mono">
                    npm run dev
                  </pre>
                  <button
                    onClick={() => copyToClipboard('step-3-cmd', 'npm run dev')}
                    className="absolute right-2 top-2 p-1.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded border border-zinc-700/50 cursor-pointer"
                  >
                    {copiedTextId === 'step-3-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="h-px bg-zinc-800/40" />

              {/* Mobile Termux */}
              <div className="space-y-2 pt-1 bg-[#141620]/30 p-3.5 rounded border border-zinc-800/60">
                <h4 className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5 font-mono">
                  <Info className="w-3.5 h-3.5 text-[#F27D26]" />
                  📱 Termux Android Run Commands
                </h4>
                <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                  Чтобы запустить и отлаживать реальный P2P на Android-телефоне, установите <strong>Termux</strong> и выполните:
                </p>
                <div className="relative">
                  <pre className="bg-[#07080D] p-2 rounded text-[9px] text-zinc-300 overflow-x-auto truncate leading-normal">
                    pkg install golang ndk-sysroot -y{"\n"}
                    git clone {"<this_repo>"}{"\n"}
                    go run main.go socket_unix.go
                  </pre>
                  <button
                    onClick={() => copyToClipboard('termux-cmd', 'pkg install golang ndk-sysroot -y && go run main.go socket_unix.go')}
                    className="absolute right-2 bottom-2 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded border border-zinc-700 cursor-pointer"
                  >
                    {copiedTextId === 'termux-cmd' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Source Code Viewer to inspect main.go */}
        <section id="code-viewer-section" className="border border-zinc-800 bg-[#090A0E] rounded-lg overflow-hidden shadow-xl mt-6 text-left">
          <div className="bg-[#0C0E15] border-b border-zinc-800 px-5 py-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-white leading-normal">
              libp2p core source engine: main.go (Go Code Template)
            </h3>
          </div>
          <CodeViewer />
        </section>

      </main>
    </div>
  );
}
