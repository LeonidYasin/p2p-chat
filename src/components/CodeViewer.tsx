import React, { useState } from 'react';
import { GO_CODE_MAIN, GO_CODE_MOD, GO_CODE_README } from '../goCodeTemplate';
import { Copy, Check, Download, Code2, Cpu, FileText } from 'lucide-react';

export default function CodeViewer() {
  const [activeTab, setActiveTab] = useState<'main' | 'mod' | 'readme'>('main');
  const [copied, setCopied] = useState(false);

  const getActiveCode = () => {
    if (activeTab === 'main') return GO_CODE_MAIN;
    if (activeTab === 'mod') return GO_CODE_MOD;
    return GO_CODE_README;
  };

  const getActiveFileName = () => {
    if (activeTab === 'main') return 'main.go';
    if (activeTab === 'mod') return 'go.mod';
    return 'README.md';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = getActiveCode();
    const filename = getActiveFileName();
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#12141C] border border-[#1E212B] rounded-lg overflow-hidden text-[#E0E0E0] font-mono">
      {/* Tab Select Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1E212B] bg-[#0A0B10] px-4 py-2 gap-2">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-[#00FF41]" />
          <span className="font-bold text-white text-[11px] uppercase tracking-wider">P2P Go Source Files</span>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-3 py-1 text-xs rounded transition-colors font-mono cursor-pointer ${
              activeTab === 'main'
                ? 'bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20 font-bold'
                : 'text-[#6B7280] hover:text-white hover:bg-[#1E212B]'
            }`}
          >
            main.go
          </button>
          <button
            onClick={() => setActiveTab('mod')}
            className={`px-3 py-1 text-xs rounded transition-colors font-mono cursor-pointer ${
              activeTab === 'mod'
                ? 'bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20 font-bold'
                : 'text-[#6B7280] hover:text-white hover:bg-[#1E212B]'
            }`}
          >
            go.mod
          </button>
          <button
            onClick={() => setActiveTab('readme')}
            className={`px-3 py-1 text-xs rounded transition-colors font-mono cursor-pointer ${
              activeTab === 'readme'
                ? 'bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20 font-bold'
                : 'text-[#6B7280] hover:text-white hover:bg-[#1E212B]'
            }`}
          >
            README.md
          </button>
        </div>
      </div>

      {/* Code Area Wrapper */}
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-[11px] font-mono leading-relaxed bg-[#07080D] text-slate-200 h-80 overflow-y-auto select-text border-b border-[#1E212B]">
          <code>{getActiveCode()}</code>
        </pre>

        {/* Action toolbox absolute hovering inside code */}
        <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5 bg-[#12141C] p-1 rounded-md border border-[#1E212B]">
          <button
            onClick={handleCopy}
            className="p-1 px-2 rounded text-xs text-[#9CA3AF] hover:text-white hover:bg-[#1E212B] font-mono cursor-pointer transition-colors flex items-center gap-1"
            title="Copy script to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#00FF41]" />
                <span className="text-[10px] text-[#00FF41] font-bold">COPIED</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[10px]">COPY</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 px-2 rounded text-xs text-[#9CA3AF] hover:text-white hover:bg-[#1E212B] font-mono cursor-pointer transition-colors flex items-center gap-1"
            title={`Download ${getActiveFileName()}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[10px]">SAVE</span>
          </button>
        </div>
      </div>

      {/* Quick guide of the active code modules */}
      <div className="p-3.5 bg-[#12141C] text-[11px] text-[#9CA3AF] leading-relaxed flex items-start gap-2.5 border-t border-[#1E212B]/40">
        <Cpu className="w-4 h-4 text-[#00FF41] shrink-0 mt-0.5" />
        {activeTab === 'main' && (
          <p>
            <strong>main.go</strong> configures the libp2p host utilizing <code>libp2p.New()</code>. It activates the <strong>Noise</strong> security protocol, registers the <code>/libp2p/chat/1.0.0</code> stream handler, and deploys both mDNS LAN service and Kademlia DHT namespaces dynamically.
          </p>
        )}
        {activeTab === 'mod' && (
          <p>
            <strong>go.mod</strong> defines modules and versions. It pulls the standard <code>go-libp2p</code> framework, core decentralized key-value Kademlia DHT, and binary multiaddress libraries.
          </p>
        )}
        {activeTab === 'readme' && (
          <p>
            <strong>README.md</strong> lists explicit dependencies, terminal launch routines, and port-forwarding guidelines for running multiple local nodes.
          </p>
        )}
      </div>
    </div>
  );
}
