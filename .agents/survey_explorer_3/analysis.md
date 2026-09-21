# WhatsApp Health Monitor & Keep-Alive — Análise Técnica e Arquitetural (R4 & R5)

**Data da Investigação:** 2026-08-27  
**Agente:** Survey Explorer 3  
**Escopo:** Investigação da estrutura de UI do Painel Administrativo GSA OS, Design System, Rotina de Keep-Alive (R4) e Painel de Monitoramento `WhatsAppHealthMonitor.tsx` com Pause Dispatch (R5).

---

## 1. Mapeamento da Estrutura de UI e Design System do Painel Admin (GSA OS)

### 1.1 Arquitetura de Roteamento e Telas Administrativas
O painel administrativo do GSA HUB é estruturado em uma arquitetura modular moderna em React 19 + TypeScript + Tailwind CSS v4 + Framer Motion:

1. **Camada de Autenticação e Segurança:**
   - `src/pages/SecureAdminPanel.tsx`: Valida sessão administrativa, tokens e papéis RBAC (`admin` vs `colaborador`) via RPC segura `gsa_admin_get_context_secure`.
2. **Casca Principal do Painel (Cockpit Shell):**
   - `src/pages/AdminPanel.tsx`: Gerencia o layout unificado com `DashboardLayout` (`src/components/ui/DashboardLayout.tsx`), barra superior de telemetria, menu lateral expansível e alternador de Super-Domínios (`AdminSuperDomainSwitcher`).
3. **5 Super-Domínios Consolidados (`src/components/admin/super-domains/`):**
   - **SD1 - Operações & Orçamentos** (`operacoes/`): Demandas, Ordens de Serviço, Loja GSA Store, Viagens, Classificados, Anúncios, Automações Shopee.
   - **SD2 - Financeiro & Faturamento** (`financeiro/`): Faturamento, Cobrança, NF-e, Empréstimos, Crédito Loja.
   - **SD3 - Pessoas, RH & Prestadores** (`pessoas/`): Prestadores, Fornecedores, Trabalhe Conosco, Afiliados, Fidelidade.
   - **SD4 - Contratos, Clientes & Jurídico** (`contratos/`): CRM Clientes 360º, Contratos, Área VIP, GSA Saúde, GSA Seguros, SAC.
   - **SD5 - Governança & Configurações** (`governanca/`):
     - `GovernancaExecutiveDashboard.tsx`: Cockpit executivo, KPIs consolidados e feeds de atividade.
     - `GovernancaInfraView.tsx`: Telemetria da VPS Oracle, Cloudflare CDN, Banco de Dados PostgreSQL e WhatsApp / Evolution API (`WhatsAppQRCodeManager.tsx`).
     - `GovernancaConfiguracoesView.tsx`: Parâmetros globais de empresa, pagamentos, indicação e WhatsApp Master.
     - `GovernancaAcessosView.tsx` & `GovernancaAuditoriaView.tsx`: RBAC e logs de auditoria.

### 1.2 Design System e Componentes Reutilizáveis
- **Design Tokens & Cores:**
  - `Indigo` (`indigo-600`, `indigo-50`): Cor primária institucional e foco.
  - `Emerald` (`emerald-600`, `emerald-50`): Sucesso, status ativo e conectado.
  - `Amber` (`amber-600`, `amber-50`): Alertas, fila pausada e conexões transitórias.
  - `Rose/Red` (`rose-600`, `rose-50`): Desconectado, erros críticos e falhas.
  - `Slate/Neutral` (`neutral-900`, `slate-100`): Estrutura, cartões e tipografia neutra.
- **Componentes Base Existentes:**
  - `StatusBadge` (`src/components/admin/super-domains/shared/StatusBadge.tsx`): Suporta variantes `emerald`, `amber`, `rose`, `blue`, `indigo`, `slate`, tamanhos `xs`, `sm`, `md`, ponto indicador com animação de pulso (`pulse`).
  - `TacticalDataGrid` (`src/components/admin/super-domains/shared/TacticalDataGrid.tsx`): Tabelas táticas com ordenação, filtros e busca.
  - `CommandSlideOver` (`src/components/admin/super-domains/shared/CommandSlideOver.tsx`): Gaveta lateral para detalhes e inspeção.
  - `SystemStatusIndicator` (`src/components/admin/SystemStatusIndicator.tsx`): Widget de cabeçalho com indicador de pulso luminoso e popover de telemetria.
  - **Padrão de Toggle Switches:** Botões estilizados com Tailwind contendo transição suave de círculo deslizante (`h-6 w-11 rounded-full relative ... span translate-x-5`).

---

## 2. Investigação do Requisito R4 (Rotina de Manutenção Keep-Alive)

### 2.1 Diagnóstico do Problema de Conexão WebSocket
- A Evolution API utiliza a biblioteca **Baileys** para manter uma sessão de WebSocket aberta diretamente com os servidores do WhatsApp.
- Em ambientes de produção (VPS Oracle Cloud), períodos de inatividade prolongada (sem envio de mensagens) podem levar o WebSocket a entrar em estado dormente ("zombie state") ou ser desconectado silenciosamente por firewalls de rede/NAT sem disparo de evento de reconexão.
- Consequência: Tentativas de envio de mensagens falham por timeout ou sofrem atrasos excessivos de 10 a 30 segundos enquanto a sessão se restabelece.

### 2.2 Endpoints Disponíveis na Evolution API
Base URL em produção: `http://147.15.43.141:8080` (com apikey `gsa_hub_evolution_token_2026`) ou proxy via Edge Function `vps-api`.

1. **Endpoint de Estado de Conexão:**
   ```http
   GET /instance/connectionState/GSA_WhatsApp
   Headers:
     apikey: gsa_hub_evolution_token_2026
     Content-Type: application/json
   ```
   **Resposta Esperada:**
   ```json
   {
     "instance": {
       "instanceName": "GSA_WhatsApp",
       "state": "open"
     }
   }
   ```
   Valores de `state`: `"open"` (Conectado), `"connecting"` (Pareando/Conectando), `"close"` (Desconectado).

2. **Endpoint de Listagem Geral (`fetchInstances`):**
   ```http
   GET /instance/fetchInstances
   Headers:
     apikey: gsa_hub_evolution_token_2026
   ```
   Retorna o array com detalhes completos da instância (JID do proprietário, nome do perfil, status de pareamento).

3. **Proxy Seguro via Supabase Edge Function (`vps-api`):**
   ```typescript
   const { data, error } = await supabase.functions.invoke('vps-api', {
     body: { action: 'whatsapp-status', targetIp: '147.15.43.141' }
   });
   // data -> { success: true, state: "open" }
   ```

### 2.3 Arquitetura Recomendada para o Serviço de Keep-Alive
Para não onerar o servidor nem a aplicação do cliente, o serviço de Keep-Alive deve operar de forma centralizada e reativa:

- **Mecanismo Singleton (`whatsappHealthService.ts`):**
  - Mantém um único timer de verificação em background enquanto o painel administrativo estiver ativo.
  - **Frequência Dinâmica:**
    - Em primeiro plano (aba ativa): Consulta a cada **30 segundos** com micro-jitter de ±2 segundos.
    - Em segundo plano (`document.hidden === true` via Page Visibility API): Intervalo desacelera para **120 segundos**, economizando CPU e tráfego.
    - **Reconexão Imediata:** Dispara checagem instantânea assim que o evento `visibilitychange` detecta retorno à aba ou quando o evento `online` da janela é disparado.
  - **Resiliência e Backoff:**
    - Em caso de falha de requisição (timeout ou erro de rede), aplica backoff exponencial (5s, 10s, 20s) até restabelecer a conexão.
    - Mantém contador de erros consecutivos: se exceder 3 falhas seguidas, atualiza o status para `error` e notifica os ouvintes.
  - **Medição de Latência:** Mede o tempo de resposta da requisição (`performance.now()`) em milissegundos para diagnóstico em tempo real.

---

## 3. Investigação do Requisito R5 (Painel de Monitoramento `WhatsAppHealthMonitor.tsx`)

### 3.1 Onde Montar o Componente no GSA OS

Recomendamos uma abordagem de **dois níveis complementares**:

1. **Nível 1: Widget Global no Topbar do `AdminPanel.tsx`:**
   - Posicionado no cabeçalho administrativo ao lado de `SystemStatusIndicator` e `UniversalNotificationBell`.
   - Exibe um botão compacto com ícone do WhatsApp e pulso luminoso (`bg-emerald-500` / `bg-amber-500` / `bg-rose-500`).
   - Ao clicar, abre um popover elegante com status rápido, latência, última checagem e o switch rápido de **"Pausar Envios"**.
2. **Nível 2: Painel Dedicado Completo em `GovernancaInfraView.tsx`:**
   - Na aba `whatsapp` ("WhatsApp & Evolution API") de `GovernancaInfraView.tsx`, posicionado no topo, logo acima do `WhatsAppQRCodeManager.tsx`.
   - Oferece a visão completa de saúde: cards de métricas (estado da instância, latência, total de mensagens processadas hoje, fila retida), status detalhado da conexão, botão de verificação forçada, toggle de "Pausa de Disparos" e botão para gerenciar/inspecionar mensagens retidas na fila.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GSA OS TOPBAR: [Buscar ⌘K]  [SystemStatus]  [WhatsAppHealthDot]  [Clock]   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼ (Ao clicar)
┌─────────────────────────────────────────────────────────────────────────────┐
│  POPOVER RÁPIDO DO WHATSAPP HEALTH                                          │
│  ● Evolution API: CONECTADO (42ms)                                          │
│  Última verificação: 15:34:12                                               │
│  [==============================]                                            │
│  ⏸️ Pausar Disparos (Fila Local)          [ (Switch ON/OFF) ]              │
│  Mensagens na Fila: 0                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Estados Visuais de Conexão

| Estado | Cor / Variante | Ícone | Descrição |
|---|---|---|---|
| **Conectado (Open)** | `emerald` (`bg-emerald-500` glow) | `CheckCircle2` / `Wifi` | Sessão ativa e pronta para envio. |
| **Conectando** | `amber` (`bg-amber-500` pulse) | `RefreshCw animate-spin` | Instância restabelecendo sessão ou lendo QR. |
| **Desconectado (Close)** | `rose` (`bg-rose-500` glow) | `AlertCircle` / `WifiOff` | Sessão Baileys desconectada na Evolution API. |
| **Erro de Rede / Timeout** | `rose/red` (`bg-red-600`) | `XCircle` / `ShieldAlert` | Servidor Evolution inacessível ou porta bloqueada. |
| **Envios Pausados (Queue Active)** | `indigo/amber` | `PauseCircle` | Fila em retenção local; mensagens seguras. |

### 3.3 Gestão de Estado e Fila de Retenção ("Pause Dispatch")

O mecanismo de pausa de disparos é crucial para operações de manutenção, testes de carga ou quando o operador deseja inspecionar mensagens antes que sejam enviadas aos clientes:

1. **Armazenamento do Estado de Pausa:**
   - **Memória Reativa:** Flag no `whatsappHealthService` (`isPaused: boolean`).
   - **Persistência Local:** Gravado no `localStorage` (`gsa_whatsapp_dispatch_paused = 'true' | 'false'`) para sobreviver a recarregamentos de página.
   - **Sincronização em Tempo Real (Opcional):** Sincronizado via Supabase Realtime na tabela `system_settings` (`key: 'whatsapp_dispatch_paused'`), permitindo que a pausa acionada por um administrador seja refletida instantaneamente para todos os demais administradores logados.
2. **Comportamento da Fila de Notificações (`WhatsAppNotificationQueue`):**
   - Quando `whatsappNotificationService.enviarWhatsAppDireto()` é acionado:
     - **Se Despausado (`isPaused === false`):** Processamento normal com humanização de delays (R1), variação de conteúdo (R2) e controle de concorrência (R3).
     - **Se Pausado (`isPaused === true`):**
       - A mensagem não é enviada à Evolution API nem descartada.
       - Ela é empacotada em um objeto de fila:
         ```typescript
         interface QueuedWhatsAppNotification {
           id: string;
           recipient: string;
           message: string;
           options?: SendDirectOptions;
           contextType?: string;
           createdAt: string;
           status: 'queued' | 'processing' | 'failed';
         }
         ```
       - Armazenada em memória e espelhada em `localStorage` (`gsa_whatsapp_pending_queue`).
       - O serviço emite um evento `gsa_whatsapp_queue_updated`.
       - Uma notificação informativa (toast sutil) pode ser exibida: *"Notificação retida na fila (Envios Pausados)"*.
3. **Retomada de Disparos (Unpause & Flush):**
   - Ao desativar o toggle de pausa ("Retomar Envios"):
     - O serviço inicia a drenagem sequencial da fila FIFO.
     - Aplica os delays humanizados (R1/R3: micro-jitter entre números distintos e agrupamento para o mesmo número).
     - A fila é limpa progressivamente conforme as confirmações de envio ocorrem.
   - Recursos adicionais na UI:
     - Botão **"Limpar Fila"** (com `ConfirmDialog` de segurança).
     - Modal de **"Inspecionar Mensagens Retidas"** para visualizar conteúdo, destinatário e hora de criação.

---

## 4. Blueprint de Implementação Técnica

### 4.1 Serviço de Saúde e Fila (`src/lib/whatsappHealthService.ts`)

```typescript
export interface WhatsAppHealthState {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  rawState: string;
  lastChecked: Date | null;
  latencyMs: number;
  isPaused: boolean;
  queuedCount: number;
  consecutiveErrors: number;
}

export type HealthSubscriber = (state: WhatsAppHealthState) => void;

class WhatsAppHealthService {
  private state: WhatsAppHealthState = {
    status: 'connected',
    rawState: 'open',
    lastChecked: null,
    latencyMs: 0,
    isPaused: false,
    queuedCount: 0,
    consecutiveErrors: 0
  };

  private subscribers: Set<HealthSubscriber> = new Set();
  private timer: number | null = null;
  private queue: Array<any> = [];

  constructor() {
    this.loadPersistedState();
    this.initVisibilityListener();
  }

  // Inicialização e listeners
  private loadPersistedState() {
    try {
      const paused = localStorage.getItem('gsa_whatsapp_dispatch_paused');
      this.state.isPaused = paused === 'true';
      const savedQueue = localStorage.getItem('gsa_whatsapp_pending_queue');
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue);
        this.state.queuedCount = this.queue.length;
      }
    } catch {}
  }

  public subscribe(cb: HealthSubscriber): () => void {
    this.subscribers.add(cb);
    cb({ ...this.state });
    if (!this.timer) this.startKeepAlive();
    return () => {
      this.subscribers.delete(cb);
      if (this.subscribers.size === 0) this.stopKeepAlive();
    };
  }

  public async checkHealth(): Promise<WhatsAppHealthState> {
    const start = performance.now();
    try {
      // 1. Tenta direto na porta 8080 da VPS
      const res = await fetch('http://147.15.43.141:8080/instance/connectionState/GSA_WhatsApp', {
        headers: { 'apikey': 'gsa_hub_evolution_token_2026' },
        signal: AbortSignal.timeout(4000)
      });

      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        const rawState = data?.instance?.state || data?.state || 'open';
        this.updateState({
          status: rawState === 'open' ? 'connected' : rawState === 'connecting' ? 'connecting' : 'disconnected',
          rawState,
          lastChecked: new Date(),
          latencyMs: latency,
          consecutiveErrors: 0
        });
        return this.state;
      }
    } catch {
      // Fallback via Edge Function
    }
    return this.state;
  }

  public setPaused(paused: boolean) {
    this.state.isPaused = paused;
    try {
      localStorage.setItem('gsa_whatsapp_dispatch_paused', String(paused));
    } catch {}
    this.notify();
    if (!paused && this.queue.length > 0) {
      void this.flushQueue();
    }
  }

  public enqueueMessage(item: any) {
    this.queue.push(item);
    this.state.queuedCount = this.queue.length;
    try {
      localStorage.setItem('gsa_whatsapp_pending_queue', JSON.stringify(this.queue));
    } catch {}
    this.notify();
  }

  private async flushQueue() {
    // Processamento sequencial da fila ao despausar
  }

  private updateState(partial: Partial<WhatsAppHealthState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify() {
    this.subscribers.forEach(cb => cb({ ...this.state }));
  }

  private startKeepAlive() {
    this.checkHealth();
    this.timer = window.setInterval(() => {
      const interval = document.hidden ? 120000 : 35000;
      this.checkHealth();
    }, 35000);
  }

  private stopKeepAlive() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private initVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void this.checkHealth();
      });
    }
  }
}

export const whatsappHealthService = new WhatsAppHealthService();
```

### 4.2 Hook Reativo (`src/hooks/useWhatsAppHealth.ts`)

```typescript
import { useEffect, useState } from 'react';
import { whatsappHealthService, type WhatsAppHealthState } from '../lib/whatsappHealthService';

export function useWhatsAppHealth() {
  const [health, setHealth] = useState<WhatsAppHealthState>(() => ({
    status: 'connected',
    rawState: 'open',
    lastChecked: null,
    latencyMs: 0,
    isPaused: false,
    queuedCount: 0,
    consecutiveErrors: 0
  }));

  useEffect(() => {
    return whatsappHealthService.subscribe(setHealth);
  }, []);

  return {
    ...health,
    checkNow: () => whatsappHealthService.checkHealth(),
    setPaused: (p: boolean) => whatsappHealthService.setPaused(p),
    togglePause: () => whatsappHealthService.setPaused(!health.isPaused)
  };
}
```

### 4.3 Componente `WhatsAppHealthMonitor.tsx` (`src/components/admin/WhatsAppHealthMonitor.tsx`)

```tsx
import React, { useState } from 'react';
import { 
  CheckCircle2, RefreshCw, AlertCircle, XCircle, 
  Wifi, PauseCircle, Play, Trash2, Layers, Clock, ShieldCheck, Activity 
} from 'lucide-react';
import { useWhatsAppHealth } from '../../hooks/useWhatsAppHealth';
import { StatusBadge } from './super-domains/shared/StatusBadge';
import { toast } from 'react-hot-toast';

interface WhatsAppHealthMonitorProps {
  variant?: 'card' | 'compact' | 'header-popover';
  className?: string;
}

export function WhatsAppHealthMonitor({ variant = 'card', className = '' }: WhatsAppHealthMonitorProps) {
  const { status, rawState, lastChecked, latencyMs, isPaused, queuedCount, checkNow, togglePause } = useWhatsAppHealth();
  const [checking, setChecking] = useState(false);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      await checkNow();
      toast.success('Status da Evolution API atualizado!');
    } catch {
      toast.error('Erro ao verificar status.');
    } finally {
      setChecking(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs ${className}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
        <span className="text-xs font-bold text-slate-700">Evolution: {status === 'connected' ? 'Online' : 'Offline'}</span>
        {latencyMs > 0 && <span className="text-[10px] text-slate-400 font-mono">({latencyMs}ms)</span>}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 ${className}`}>
      {/* Header com Status e Ações */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${status === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              Monitor de Saúde Evolution API (WhatsApp)
              {isPaused && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <PauseCircle className="h-3 w-3" /> Fila Pausada
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">Keep-Alive automático via WebSocket & Gestão de Fila Local</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={checking}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs"
            title="Verificar Conexão Agora"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid de Telemetria */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black uppercase text-slate-400">Estado da Sessão</p>
          <div className="mt-1 flex items-center gap-1.5">
            <StatusBadge status={status === 'connected' ? 'ativo' : status === 'connecting' ? 'pendente' : 'cancelado'}>
              {status === 'connected' ? 'Conectado (Open)' : status === 'connecting' ? 'Conectando...' : 'Desconectado'}
            </StatusBadge>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black uppercase text-slate-400">Latência do Ping</p>
          <p className="mt-1 text-base font-black text-slate-900 font-mono">
            {latencyMs > 0 ? `${latencyMs} ms` : '—'}
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black uppercase text-slate-400">Última Checagem</p>
          <p className="mt-1 text-xs font-bold text-slate-700">
            {lastChecked ? lastChecked.toLocaleTimeString('pt-BR') : 'Iniciando...'}
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black uppercase text-slate-400">Mensagens na Fila</p>
          <p className={`mt-1 text-base font-black font-mono ${queuedCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {queuedCount} retida{queuedCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Seção de Controle: Pause Dispatch */}
      <div className="flex items-center justify-between p-3.5 bg-neutral-900 text-white rounded-xl border border-neutral-800">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isPaused ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {isPaused ? <PauseCircle className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-xs font-black">
              {isPaused ? 'Pausa de Disparos Ativada' : 'Disparos Contínuos Ativos'}
            </p>
            <p className="text-[11px] text-neutral-400">
              {isPaused 
                ? 'Novas mensagens ficam retidas na fila local sem serem descartadas.' 
                : 'Notificações são enviadas em tempo real com coreografia de presença.'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={togglePause}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isPaused ? 'bg-amber-500' : 'bg-emerald-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              isPaused ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
```

---

## 5. Checklist de Verificação e Próximos Passos para os Agentes de Implementação

1. **R4 (Keep-Alive):**
   - [ ] Implementar `src/lib/whatsappHealthService.ts` com ciclo keep-alive resiliente a visibilidade de aba (`visibilitychange`).
   - [ ] Criar hook `src/hooks/useWhatsAppHealth.ts`.
2. **R5 (Monitor & Pause Dispatch):**
   - [ ] Criar `src/components/admin/WhatsAppHealthMonitor.tsx`.
   - [ ] Integrar no Topbar do `src/pages/AdminPanel.tsx` (ao lado de `SystemStatusIndicator`).
   - [ ] Integrar na aba WhatsApp de `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx`.
   - [ ] Adaptar `src/lib/whatsappNotificationService.ts` para checar `whatsappHealthService.isPaused()` antes de disparar, retendo na fila local caso ativo.
3. **Build e Testes de Integridade:**
   - [ ] Executar `npm run typecheck:strict` para validação de tipos TypeScript.
   - [ ] Rodar testes unitários em `src/tests/whatsapp-notification-engine.test.ts`.
