import React from 'react';
import { Shield, Radio, Key, Share2, Compass, Cpu, Cable } from 'lucide-react';

export default function ArchitectureGuide() {
  return (
    <div className="bg-[#12141C] border border-[#1E212B] rounded-lg p-5 text-[#E0E0E0] space-y-6 font-mono">
      {/* Visual layout intro  */}
      <div className="space-y-1.5 border-b border-[#1E212B] pb-3">
        <h3 className="font-bold text-[#6B7280] text-[10px] tracking-widest uppercase flex items-center gap-2">
          <Share2 className="w-4 h-4 text-[#00FF41]" />
          <span>libp2p Architecture & Specifications</span>
        </h3>
        <p className="text-xs text-[#9CA3AF] leading-relaxed">
          The Go application is built using <code>libp2p</code>, the modular peer-to-peer networking stack powering Ethereum 2.0, IPFS, and Filecoin. Below is how its logical layers align.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Multiaddress & Transports */}
        <div className="bg-[#07080D] p-4 rounded-lg border border-[#1E212B] space-y-2.5 hover:border-[#00FF41]/30 transition-colors">
          <div className="flex items-center gap-2">
            <div className="p-1 px-1.5 bg-[#00FF41]/10 rounded border border-[#00FF41]/10">
              <Compass className="w-3.5 h-3.5 text-[#00FF41]" />
            </div>
            <h4 className="font-bold text-white text-xs font-mono uppercase tracking-wider">1. Multiaddresses (/p2p/...)</h4>
          </div>
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
            libp2p bypasses hardcoded IPs. It defines communication addresses dynamically:
            <code className="block mt-1.5 p-2 bg-[#12141C] text-[10px] text-[#F27D26] font-mono rounded overflow-x-auto whitespace-nowrap border border-[#1E212B]">
              /ip4/192.168.1.15/tcp/3001/p2p/QmReceiveAddress...
            </code>
            This path tells the node to connect via IPv4 over TCP port 3001, verifying peer cryptographic integrity with its public key.
          </p>
        </div>

        {/* Card 2: Transport Security */}
        <div className="bg-[#07080D] p-4 rounded-lg border border-[#1E212B] space-y-2.5 hover:border-[#00FF41]/30 transition-colors">
          <div className="flex items-center gap-2">
            <div className="p-1 px-1.5 bg-[#F27D26]/10 rounded border border-[#F27D26]/10">
              <Shield className="w-3.5 h-3.5 text-[#F27D26]" />
            </div>
            <h4 className="font-bold text-white text-xs font-mono uppercase tracking-wider">2. Cryptographic Security</h4>
          </div>
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
            Sessions are secured out-of-the-box. The modern standard transport security layer is <strong>Noise</strong> (or <strong>TLS</strong>), matching ECDSA/ED25519 node keys. Every byte sent along sub-streams is encrypted symmetrically.
          </p>
        </div>

        {/* Card 3: Stream Multiplexing */}
        <div className="bg-[#07080D] p-4 rounded-lg border border-[#1E212B] space-y-2.5 hover:border-[#00FF41]/30 transition-colors">
          <div className="flex items-center gap-2">
            <div className="p-1 px-1.5 bg-[#00FF41]/10 rounded border border-[#00FF41]/10">
              <Cable className="w-3.5 h-3.5 text-[#00FF41]" />
            </div>
            <h4 className="font-bold text-white text-xs font-mono uppercase tracking-wider">3. Multiplexing (Yamux / Mplex)</h4>
          </div>
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
            Connecting nodes split a single TCP context into hundreds of logical streams.
            The chat protocol mounts on its own sub-stream <code>/libp2p/chat/1.0.0</code>, totally isolating system controls, routing tables, and keep-alives dynamically on the same socket port.
          </p>
        </div>

        {/* Card 4: Peer Connections */}
        <div className="bg-[#07080D] p-4 rounded-lg border border-[#1E212B] space-y-2.5 hover:border-[#00FF41]/30 transition-colors">
          <div className="flex items-center gap-2">
            <div className="p-1 px-1.5 bg-[#F27D26]/10 rounded border border-[#F27D26]/10">
              <Radio className="w-3.5 h-3.5 text-[#F27D26]" />
            </div>
            <h4 className="font-bold text-white text-xs font-mono uppercase tracking-wider">4. Hybrid Discovery</h4>
          </div>
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
            The daemon merges:
            <br />
            1. <strong>Local mDNS multicast (LAN)</strong>: Transmit packet queries to locate nodes automatically inside the same local environment.
            <br />
            2. <strong>DHT Rendezvous Lookup</strong>: Announce node peer addresses in-memory on Kademlia routing registry key-value pairs.
          </p>
        </div>
      </div>

      {/* NEW: FAQ & Troubleshooter for Android vs Windows */}
      <div className="border-t border-[#1E212B] pt-5 space-y-4">
        <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#F27D26] rounded-full animate-ping" />
          <span>Справка по подключению: Android (Termux) vs Windows</span>
        </h4>

        <div className="space-y-3 font-mono text-[11px] text-[#9CA3AF] leading-relaxed">
          <div className="bg-[#07080D] p-3.5 rounded border border-[#1E212B] space-y-1.5">
            <span className="text-[#00FF41] font-bold">Q: Почему на Android соединение не устанавливается сразу, в отличие от локальной симуляции?</span>
            <p>
              <strong>A:</strong> На Windows в домашних/офисных сетях Wi-Fi роутеры разрешают свободные входящие TCP/UDP-пакеты и поддерживают автоматический проброс портов (UPnP/NAT-PMP). 
              <br />
              В отличие от этого, мобильные сети на смартфонах (4G LTE/5G) работают за жестким <strong>CGNAT (Carrier-Grade NAT)</strong> оператора связи. Ваше устройство не имеет публичного IP, а все входящие порты закрыты. Прямое соединение двух мобильных телефонов невозможно без сложного обхода.
            </p>
          </div>

          <div className="bg-[#07080D] p-3.5 rounded border border-[#1E212B] space-y-1.5">
            <span className="text-[#00FF41] font-bold">Q: Сколько времени нужно ждать для успешного пиринга?</span>
            <p>
              <strong>A:</strong> Подключение и децентрализованный поиск разделяются на следующие этапы:
              <br />
              1. <strong>Подключение к DHT (5–15 сек)</strong>: Узел ищет и подключается к глобальным серверам-ориентирам (Bootstraps).
              <br />
              2. <strong>Поиск участников (10–25 сек)</strong>: Скачиваются списки адресов (индексы) для выбранного имени комнаты.
              <br />
              3. <strong>Пробитие NAT (до 45 сек)</strong>: Если оба устройства за NAT, протокол <strong>DCUtR (Hole Punching)</strong> пытается согласованно "пробить" роутеры, либо перенаправляет трафик через бесплатные публичные прокси (Circuit Relay v2).
              <br />
              <span className="text-[#F27D26] font-bold">Резюме: Оставьте терминал запущенным на 1–2 минуты. Соединение установится автоматически!</span>
            </p>
          </div>

          <div className="bg-[#07080D] p-3.5 rounded border border-[#1E212B] space-y-1.5">
            <span className="text-[#00FF41] font-bold">Q: Как гарантировать мгновенное соединение?</span>
            <p>
              <strong>A:</strong> Если устройства находятся в одной локальной Wi-Fi сети (или раздаче точки доступа):
              <br />
              • Убедитесь, что в терминале включен Custom UDP Broadcast Discovery. Он свяжет узлы в обход роутера за 1-3 секунды.
              <br />
              • Для интернета: используйте полностью идентичные имена комнат (например, <code>secret-room-123</code>). Не используйте слишком простые имена, чтобы не ловить чужие отключенные пиры общего пула.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
