import fs from 'node:fs';

const lorenaB64 = fs.readFileSync('C:/Users/Adriano Farias/.gemini/antigravity/brain/3c05473f-6f8c-4544-b39a-7f5f15c39664/chef_lorena_flow_frame.jpg').toString('base64');
const tagB64 = fs.readFileSync('C:/Users/Adriano Farias/.gemini/antigravity/brain/3c05473f-6f8c-4544-b39a-7f5f15c39664/tag_salmao_verified.jpg').toString('base64');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GSA TV · Painel de Produção e Controle MCR</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    @keyframes pulse-live {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.95); }
    }
    .pulse-live { animation: pulse-live 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes vu-bounce {
      0%, 100% { height: 65%; }
      50% { height: 88%; }
      75% { height: 45%; }
    }
    .vu-bar { animation: vu-bounce 0.8s ease-in-out infinite alternate; }
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-3 font-sans">
  <div class="bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-2xl p-4 shadow-xl max-w-4xl mx-auto space-y-4">
    
    <!-- Header MCR -->
    <div class="flex flex-wrap items-center justify-between border-b border-[var(--border)] pb-3 gap-2">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2 bg-red-600/20 text-red-500 border border-red-500/30 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          <span class="w-2 h-2 rounded-full bg-red-500 pulse-live"></span>
          <span>NO AR AGORA</span>
        </div>
        <div>
          <h1 class="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            GSA TV · Estúdio MCR &amp; Playout
            <span class="text-xs font-normal px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">YouTube 1080p30</span>
          </h1>
          <p class="text-xs text-[var(--muted-foreground)]">Transmissão contínua: Nova Vinheta Oficial do Canal (0 buffering, áudio -17.7 dBFS)</p>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <div class="bg-[var(--content)] border border-[var(--border)] px-3 py-1 rounded-lg text-right">
          <span class="text-[var(--muted-foreground)] block text-[10px]">Taxa de Bits</span>
          <span class="font-mono font-bold text-amber-400">4.120 kbps</span>
        </div>
        <div class="bg-[var(--content)] border border-[var(--border)] px-3 py-1 rounded-lg text-right">
          <span class="text-[var(--muted-foreground)] block text-[10px]">Áudio Playout</span>
          <span class="font-mono font-bold text-emerald-400">-17.7 dB</span>
        </div>
      </div>
    </div>

    <!-- Grid de Monitoramento Visual: Apresentadora vs GC Tag -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      
      <!-- Card 1: Apresentadora Google Flow -->
      <div class="bg-[var(--content)] border border-[var(--border)] rounded-xl p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z"/></svg>
            Apresentadora: Chef Lorena Prado
          </span>
          <span class="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">Google Flow Veo 3.1 Pro</span>
        </div>
        <div class="relative rounded-lg overflow-hidden border border-[var(--border)] aspect-video bg-black flex items-center justify-center">
          <img src="data:image/jpeg;base64,${lorenaB64}" alt="Chef Lorena Prado Flow" class="w-full h-full object-cover">
          <div class="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Abertura Oficial · 14.5s
          </div>
        </div>
        <p class="text-[11px] text-[var(--muted-foreground)] mt-2">
          Vídeo renderizado no estúdio gourmet com uniforme profissional e fala de boas-vindas com voz Fish Audio masterizada.
        </p>
      </div>

      <!-- Card 2: Tag GC e Receita sem erros -->
      <div class="bg-[var(--content)] border border-[var(--border)] rounded-xl p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Tag Superior Esquerda (GC Oficial)
          </span>
          <span class="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">Acentuação Corrigida</span>
        </div>
        <div class="relative rounded-lg overflow-hidden border border-[var(--border)] aspect-video bg-black flex items-center justify-center">
          <img src="data:image/jpeg;base64,${tagB64}" alt="Tag Receita Salmão" class="w-full h-full object-cover">
          <div class="absolute top-2 left-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-mono">
            Salmão &amp; Limão Siciliano OK
          </div>
          <div class="absolute top-2 right-2 bg-blue-950/80 border border-blue-500/40 text-blue-300 px-2 py-0.5 rounded text-[10px] font-mono">
            Sem marca d'água redundante
          </div>
        </div>
        <p class="text-[11px] text-[var(--muted-foreground)] mt-2">
          Tag mantida visível durante todo o preparo do prato com grafia impecável e canto superior direito reservado para a mosca do playout.
        </p>
      </div>
    </div>

    <!-- Pipeline de Renderização dos 4 Blocos -->
    <div class="bg-[var(--content)] border border-[var(--border)] rounded-xl p-3 space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-bold text-[var(--foreground)] uppercase tracking-wider text-[11px]">Progresso da Grade GSA Sabor (60 Minutos)</span>
        <span class="text-amber-400 font-mono font-semibold">Renderização em Andamento</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 space-y-1">
          <div class="flex justify-between items-center text-[10px]">
            <span class="font-bold text-amber-400">BLOCO 1 (15m)</span>
            <span class="text-emerald-400">Pronto</span>
          </div>
          <div class="text-[11px] truncate font-medium">Entrada Canastra</div>
          <div class="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
            <div class="bg-emerald-500 h-full w-full"></div>
          </div>
          <span class="text-[9px] text-[var(--muted-foreground)] block">Apresentadora + Bruschetta</span>
        </div>

        <div class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 space-y-1">
          <div class="flex justify-between items-center text-[10px]">
            <span class="font-bold text-amber-400">BLOCO 2 (15m)</span>
            <span class="text-emerald-400">Pronto</span>
          </div>
          <div class="text-[11px] truncate font-medium">Risoto Mineiro</div>
          <div class="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
            <div class="bg-emerald-500 h-full w-full"></div>
          </div>
          <span class="text-[9px] text-[var(--muted-foreground)] block">Frango Caipira &amp; Açafrão</span>
        </div>

        <div class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 space-y-1">
          <div class="flex justify-between items-center text-[10px]">
            <span class="font-bold text-amber-400">BLOCO 3 (15m)</span>
            <span class="text-emerald-400">Pronto</span>
          </div>
          <div class="text-[11px] truncate font-medium">Salmão em Ervas</div>
          <div class="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
            <div class="bg-emerald-500 h-full w-full"></div>
          </div>
          <span class="text-[9px] text-[var(--muted-foreground)] block">Limão Siciliano &amp; Bossa</span>
        </div>

        <div class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 space-y-1">
          <div class="flex justify-between items-center text-[10px]">
            <span class="font-bold text-amber-400">BLOCO 4 (15m)</span>
            <span class="text-blue-400">Processando</span>
          </div>
          <div class="text-[11px] truncate font-medium">Cheesecake NY</div>
          <div class="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
            <div class="bg-blue-500 h-full w-4/5 animate-pulse"></div>
          </div>
          <span class="text-[9px] text-[var(--muted-foreground)] block">Sobremesa &amp; Encerramento</span>
        </div>
      </div>
    </div>

    <!-- Status Bar & Audio Meter -->
    <div class="flex flex-wrap items-center justify-between text-xs bg-[var(--content)] border border-[var(--border)] rounded-xl px-3 py-2 gap-3">
      <div class="flex items-center space-x-3">
        <span class="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold">Trilha Sonora:</span>
        <span class="text-[11px] text-[var(--foreground)] font-mono">Bossa Antigua / Jazz Brunch (-18 dBFS)</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-[10px] text-[var(--muted-foreground)]">VU Master L/R:</span>
        <div class="flex items-end space-x-0.5 h-4 w-12 bg-black/40 p-0.5 rounded border border-[var(--border)]">
          <div class="w-2 bg-emerald-500 rounded-sm vu-bar" style="animation-delay: 0.1s;"></div>
          <div class="w-2 bg-emerald-400 rounded-sm vu-bar" style="animation-delay: 0.3s;"></div>
          <div class="w-2 bg-amber-400 rounded-sm vu-bar" style="animation-delay: 0.2s;"></div>
          <div class="w-2 bg-emerald-500 rounded-sm vu-bar" style="animation-delay: 0.4s;"></div>
        </div>
        <span class="text-[10px] text-emerald-400 font-mono font-bold">NORMALIZADO</span>
      </div>
    </div>

  </div>
</body>
</html>`;

fs.writeFileSync('C:/Users/Adriano Farias/.gemini/antigravity/brain/3c05473f-6f8c-4544-b39a-7f5f15c39664/painel_producao_ao_vivo.html', html, 'utf8');
console.log('Successfully created painel_producao_ao_vivo.html!');
