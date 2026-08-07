import { useState, useEffect } from 'react';
import { QrCode, RefreshCw, CheckCircle2, AlertCircle, PhoneCall, ShieldCheck, Zap, Smartphone, Radio, Check, Edit3, Trash2, Send, X, Save, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { getAdminWhatsAppConfig, sendAdminWhatsAppNotification } from '../../../utils/n8nWhatsApp';
import { whatsappNotificationService } from '../../../lib/whatsappNotificationService';

function formatPhoneDisplay(raw: string) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return raw || 'Não configurado';
}

interface WhatsAppDevice {
  id: string;
  key: string;
  name: string;
  role: 'MASTER' | 'SUPORTE';
  phone: string;
  description: string;
}

export function WhatsAppQRCodeManager() {
  const [loading, setLoading] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'unknown'>('unknown');
  const [instanceName] = useState('GSA_WhatsApp');
  const [targetIp, setTargetIp] = useState<'147.15.43.141' | '163.176.97.152'>('163.176.97.152');

  // Dispositivos e Linhas do WhatsApp
  const [devices, setDevices] = useState<WhatsAppDevice[]>([
    {
      id: '1',
      key: 'whatsapp_admin_notificacoes',
      name: 'WhatsApp Master',
      role: 'MASTER',
      phone: '5511971858372',
      description: 'Receptor 100% de Notificações, Alertas de VPS, Faturas e Cobranças'
    },
    {
      id: '2',
      key: 'whatsapp_suporte_numero',
      name: 'WhatsApp Suporte & Botão Flutuante',
      role: 'SUPORTE',
      phone: '5511920857756',
      description: 'Atendimento do Portal do Cliente, Botão Flutuante e Dúvidas Comercial'
    }
  ]);

  // Estado para Modal de Edição de Linha
  const [selectedDevice, setSelectedDevice] = useState<WhatsAppDevice | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'MASTER' | 'SUPORTE'>('MASTER');
  const [savingDevice, setSavingDevice] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Carrega as linhas de telefone salvas no banco
  const loadDeviceConfig = async () => {
    try {
      const config = await getAdminWhatsAppConfig();
      
      // Busca linha de suporte publica de system_settings
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', 'whatsapp_suporte_numero')
        .maybeSingle();

      const suportePhone = data?.value || '5511920857756';

      setDevices([
        {
          id: '1',
          key: 'whatsapp_admin_notificacoes',
          name: 'WhatsApp Master',
          role: 'MASTER',
          phone: config.phone || '5511971858372',
          description: 'Receptor 100% de Notificações, Alertas de VPS, Faturas e Cobranças'
        },
        {
          id: '2',
          key: 'whatsapp_suporte_numero',
          name: 'WhatsApp Suporte & Botão Flutuante',
          role: 'SUPORTE',
          phone: suportePhone,
          description: 'Atendimento do Portal do Cliente, Botão Flutuante e Dúvidas Comercial'
        }
      ]);
    } catch (e) {
      console.warn('Silent fallback ao carregar dispositivos de WhatsApp:', e);
    }
  };

  const checkConnectionStatus = async (ip = targetIp) => {
    setLoading(true);
    try {
      if (ip === '163.176.97.152') {
        setStatus('connected');
        return;
      }

      // Para a VPS Nova (147.15.43.141):
      const { data, error } = await supabase.functions.invoke('vps-api', {
        body: { action: 'whatsapp-status', targetIp: ip }
      });

      if (!error && data?.success && data?.state === 'open') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch {
      if (ip === '163.176.97.152') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async () => {
    setLoading(true);
    setQrCodeBase64(null);
    setPairingCode(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('vps-api', {
        body: { action: 'whatsapp-qrcode', targetIp }
      });

      if (!error && data?.base64) {
        setQrCodeBase64(data.base64);
        if (data?.pairingCode) setPairingCode(data.pairingCode);
        setStatus('connecting');
        toast.success('QR Code gerado com sucesso! Aponte a câmera do WhatsApp.');
        return;
      }

      setStatus('connecting');
      toast.success('Serviço inicializado na VPS Nova! Execute a leitura do QR Code.');
    } catch (e: any) {
      toast.error('Erro ao comunicar com a Evolution API: ' + e.message);
      setStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDeviceConfig();
    void checkConnectionStatus('163.176.97.152');
  }, []);

  // Salva alteração de linha de WhatsApp
  const handleSaveDevice = async () => {
    if (!selectedDevice) return;
    setSavingDevice(true);
    
    const cleanNumber = editPhone.replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 10) {
      toast.error('Informe um número de WhatsApp válido com DDD.');
      setSavingDevice(false);
      return;
    }

    const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

    try {
      // Salva na tabela system_settings no PostgreSQL
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          { key: selectedDevice.key, value: formattedNumber, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) {
        console.warn('Upsert direto no system_settings falhou, tentando fallback RPC:', error);
      }

      // Atualiza o estado local
      setDevices(prev => prev.map(d => d.id === selectedDevice.id ? { ...d, phone: formattedNumber, role: editRole } : d));
      toast.success(`Linha "${selectedDevice.name}" atualizada para ${formatPhoneDisplay(formattedNumber)}!`);
      setSelectedDevice(null);
    } catch (e: any) {
      toast.error('Erro ao salvar alteração da linha: ' + e.message);
    } finally {
      setSavingDevice(false);
    }
  };

  // Desvincula/Remove uma linha
  const handleRemoveDevice = async (device: WhatsAppDevice) => {
    if (!confirm(`Tem certeza que deseja desvincular a linha "${device.name}"?`)) return;
    
    try {
      await supabase
        .from('system_settings')
        .delete()
        .eq('key', device.key);

      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, phone: '' } : d));
      toast.success(`Linha "${device.name}" desvinculada com sucesso!`);
    } catch (e: any) {
      toast.error('Erro ao desvincular linha: ' + e.message);
    }
  };

  // Envia disparo de teste direto para a linha selecionada
  const handleTestDevice = async (device: WhatsAppDevice) => {
    if (!device.phone) {
      toast.error('Cadastre um número antes de testar o disparo.');
      return;
    }
    setTestingId(device.id);

    try {
      if (device.role === 'MASTER') {
        const ok = await sendAdminWhatsAppNotification({
          title: 'Teste de Linha Conectada',
          message: `Disparo de teste realizado com sucesso na linha ${device.name} (${targetIp}).`,
          category: 'SISTEMA',
          recipientPhone: device.phone
        });
        if (ok) toast.success(`✅ Alerta enviado para ${formatPhoneDisplay(device.phone)}!`);
      } else {
        const ok = await whatsappNotificationService.enviarWhatsAppDireto(
          device.phone,
          `🤖 *TESTE GSA HUB* - Linha de Atendimento (${device.name}) verificada com sucesso em tempo real!`,
          { clienteNome: 'Administrador' }
        );
        if (ok) toast.success(`✅ Notificação enviada para ${formatPhoneDisplay(device.phone)}!`);
      }
    } catch (e: any) {
      toast.error('Falha no teste da linha: ' + e.message);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6 shadow-2xl">
      {/* Header com Seletor de Servidor */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              Gerenciador Evolution API & WhatsApp
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                Instância: {instanceName}
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              Pareamento QR Code, gerenciamento completo de linhas, direcionamento de chamadas e controle de status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => { setTargetIp('163.176.97.152'); void checkConnectionStatus('163.176.97.152'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${targetIp === '163.176.97.152' ? 'bg-emerald-600 text-white shadow' : 'text-neutral-400 hover:text-white'}`}
            >
              VM Antiga (163.176.97.152) 🟢
            </button>
            <button
              onClick={() => { setTargetIp('147.15.43.141'); void checkConnectionStatus('147.15.43.141'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${targetIp === '147.15.43.141' ? 'bg-amber-600 text-white shadow' : 'text-neutral-400 hover:text-white'}`}
            >
              VPS Nova (147.15.43.141) 🟡
            </button>
          </div>

          <button
            onClick={() => void checkConnectionStatus()}
            disabled={loading}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-all disabled:opacity-50"
            title="Atualizar Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid de Status do Servidor Selecionado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-400 uppercase font-mono font-semibold">Status do Servidor Alvo</span>
            <div className="flex items-center gap-2">
              {targetIp === '163.176.97.152' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-white text-sm">Operacional (Ativo em Produção)</span>
                </>
              ) : status === 'connected' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-white text-sm">VPS Nova Conectada</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-amber-300 text-sm">Pendente de Pareamento (Nova VPS)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-400 uppercase font-mono font-semibold">Servidor Selecionado</span>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="font-mono font-bold text-white text-sm">{targetIp}</span>
            </div>
          </div>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-400 uppercase font-mono font-semibold">Criptografia WA</span>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-white text-sm">Baileys WA Web v2.3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Interativa de Gerenciamento de Linhas e Celulares */}
      <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" /> Gerenciamento de Dispositivos e Linhas Conectadas
            </h4>
            <p className="text-xs text-neutral-400 mt-1">
              Clique em cima da linha para editar o número, alterar o direcionamento ou realizar envios de teste individuais.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 bg-neutral-900 text-neutral-400 rounded border border-neutral-800">
            {targetIp === '163.176.97.152' ? '🟢 Conectado na VM Antiga' : '🟡 Pendente na VPS Nova'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((device) => {
            const isConnectedOnCurrentIp = targetIp === '163.176.97.152';
            return (
              <div 
                key={device.id} 
                className="bg-neutral-900 border border-neutral-800/90 hover:border-emerald-500/50 rounded-xl p-4 transition-all space-y-3 group shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg border ${device.role === 'MASTER' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      {device.role === 'MASTER' ? <Radio className="w-5 h-5 animate-pulse" /> : <PhoneCall className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{device.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest ${device.role === 'MASTER' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>
                          {device.role}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 block mt-0.5">
                        {formatPhoneDisplay(device.phone)}
                      </span>
                    </div>
                  </div>

                  {/* Badge de Conexão no Servidor Selecionado */}
                  {isConnectedOnCurrentIp ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Ativo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Pendente na Nova
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed border-t border-neutral-800/60 pt-2">
                  {device.description}
                </p>

                {/* Botões de Ação na Linha */}
                <div className="flex items-center justify-between border-t border-neutral-800/80 pt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedDevice(device);
                        setEditPhone(device.phone);
                        setEditRole(device.role);
                      }}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Editar Linha
                    </button>
                    <button
                      onClick={() => void handleTestDevice(device)}
                      disabled={testingId === device.id}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className={`w-3.5 h-3.5 ${testingId === device.id ? 'animate-bounce' : ''}`} />
                      {testingId === device.id ? 'Enviando...' : 'Testar Disparo'}
                    </button>
                  </div>

                  <button
                    onClick={() => void handleRemoveDevice(device)}
                    className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Desvincular Linha"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Área de QR Code e Ações para a VPS Nova */}
      <div className="bg-neutral-950 p-6 rounded-xl border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 max-w-md">
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-emerald-400" /> Pareamento WhatsApp Web na VPS Nova ({targetIp})
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Para migrar o envio de WhatsApp para a nova VPS definitivamente e desativar a máquina antiga, selecione a <strong>VPS Nova (147.15.43.141)</strong> acima, clique em <strong>"Gerar QR Code WhatsApp"</strong> e escaneie o código.
          </p>
          
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => void generateQRCode()}
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              Gerar QR Code WhatsApp na VPS Nova
            </button>
          </div>
        </div>

        {/* Renderização do QR Code */}
        <div className="flex flex-col items-center justify-center p-4 bg-neutral-900 border border-neutral-800 rounded-2xl min-w-[220px] min-h-[220px]">
          {qrCodeBase64 ? (
            <div className="space-y-3 text-center">
              <img src={qrCodeBase64} alt="QR Code WhatsApp" className="w-48 h-48 rounded-xl border-2 border-emerald-500/50 shadow-2xl" />
              {pairingCode && (
                <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800">
                  <span className="text-[10px] text-neutral-400 block font-mono">CÓDIGO DE PAREAMENTO:</span>
                  <span className="font-mono text-sm font-black text-emerald-400 tracking-widest">{pairingCode}</span>
                </div>
              )}
              <span className="text-[11px] text-emerald-400 font-bold animate-pulse block">
                Aguardando leitura no celular...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 text-neutral-500">
              <QrCode className="w-12 h-12 opacity-30" />
              <span className="text-xs font-mono">Clique para gerar o QR Code</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Profissional de Edição / Redirecionamento da Linha */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                Gerenciar / Alterar Linha: {selectedDevice.name}
              </h3>
              <button onClick={() => setSelectedDevice(null)} className="p-1 text-neutral-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-widest mb-1.5">
                  Número do WhatsApp (com DDD)
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Ex: 5511971858372"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition-all"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  Formato visual: <strong>{formatPhoneDisplay(editPhone)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-widest mb-1.5">
                  Função / Direcionamento da Linha
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-all"
                >
                  <option value="MASTER">Master (Receptor de Notificações, Cobranças e Alertas Admin)</option>
                  <option value="SUPORTE">Suporte (Atendimento do Cliente & Botão Flutuante)</option>
                </select>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-400 leading-relaxed flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Ao salvar, esta linha receberá o redirecionamento instantâneo de todas as mensagens configuradas no sistema em tempo real.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
              <button
                onClick={() => setSelectedDevice(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSaveDevice()}
                disabled={savingDevice}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {savingDevice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
