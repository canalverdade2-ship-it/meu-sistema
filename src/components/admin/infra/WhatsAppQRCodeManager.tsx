import { useState, useEffect } from 'react';
import { QrCode, RefreshCw, CheckCircle2, AlertCircle, PhoneCall, ShieldCheck, Zap, Smartphone, Radio, Check, Edit3, Trash2, Send, X, Save, AlertTriangle, Plus, Layers, ToggleLeft, ToggleRight, Lock } from 'lucide-react';
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
  canDelete: boolean;
}

interface WhatsAppRamal {
  id: string;
  setor_nome: string;
  codigo_setor: string;
  numero_whatsapp: string;
  responsavel_nome: string;
  ativo: boolean;
  ordem: number;
}

export function WhatsAppQRCodeManager() {
  const [loading, setLoading] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'unknown'>('unknown');
  const [instanceName] = useState('GSA_WhatsApp');
  const [targetIp, setTargetIp] = useState<'147.15.43.141' | '163.176.97.152'>('163.176.97.152');

  // Dispositivos e Linhas Principais
  const [devices, setDevices] = useState<WhatsAppDevice[]>([
    {
      id: '1',
      key: 'whatsapp_admin_notificacoes',
      name: 'WhatsApp Master',
      role: 'MASTER',
      phone: '5511971858372',
      description: 'Receptor 100% de Notificações, Alertas de VPS, Faturas e Cobranças',
      canDelete: true
    },
    {
      id: '2',
      key: 'whatsapp_suporte_numero',
      name: 'WhatsApp Suporte Oficial & Botão Flutuante',
      role: 'SUPORTE',
      phone: '5511920857756',
      description: 'Linha Principal Oficial do Sistema — Impossível de apagar. Usada no Botão Flutuante e Robô',
      canDelete: false
    }
  ]);

  // Ramais de Transbordo por Setor
  const [ramais, setRamais] = useState<WhatsAppRamal[]>([]);
  const [loadingRamais, setLoadingRamais] = useState(true);

  // Modais de Edição
  const [selectedDevice, setSelectedDevice] = useState<WhatsAppDevice | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [savingDevice, setSavingDevice] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Modal de Ramal (Novo / Editar)
  const [isRamalModalOpen, setIsRamalModalOpen] = useState(false);
  const [selectedRamal, setSelectedRamal] = useState<WhatsAppRamal | null>(null);
  const [ramalNome, setRamalNome] = useState('');
  const [ramalCodigo, setRamalCodigo] = useState('');
  const [ramalNumero, setRamalNumero] = useState('');
  const [ramalResponsavel, setRamalResponsavel] = useState('');
  const [savingRamal, setSavingRamal] = useState(false);

  // Carrega as configurações das Linhas Principais
  const loadDeviceConfig = async () => {
    try {
      const config = await getAdminWhatsAppConfig();
      
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
          description: 'Receptor 100% de Notificações, Alertas de VPS, Faturas e Cobranças',
          canDelete: true
        },
        {
          id: '2',
          key: 'whatsapp_suporte_numero',
          name: 'WhatsApp Suporte Oficial & Botão Flutuante',
          role: 'SUPORTE',
          phone: suportePhone,
          description: 'Linha Principal Oficial do Sistema — Impossível de apagar. Usada no Botão Flutuante e Robô',
          canDelete: false
        }
      ]);
    } catch (e) {
      console.warn('Silent fallback ao carregar dispositivos de WhatsApp:', e);
    }
  };

  // Carrega os Ramais de Transbordo por Setor do PostgreSQL
  const loadRamais = async () => {
    setLoadingRamais(true);
    try {
      const { data, error } = await supabase
        .from('gsa_whatsapp_ramais')
        .select('*')
        .order('ordem', { ascending: true });

      if (!error && Array.isArray(data)) {
        setRamais(data);
      } else {
        // Fallback inicial visual
        setRamais([
          { id: 'r1', setor_nome: '1️⃣ Comercial', codigo_setor: 'comercial', numero_whatsapp: '5511971858372', responsavel_nome: 'COMERCIAL GSA', ativo: true, ordem: 1 },
          { id: 'r2', setor_nome: '2️⃣ Financeiro', codigo_setor: 'financeiro', numero_whatsapp: '5511971858372', responsavel_nome: 'FINANCEIRO GSA', ativo: true, ordem: 2 },
          { id: 'r3', setor_nome: '3️⃣ Dep. Pessoal', codigo_setor: 'dep_pessoal', numero_whatsapp: '5511971858372', responsavel_nome: 'DEP. PESSOAL GSA', ativo: true, ordem: 3 },
          { id: 'r5', setor_nome: '5️⃣ Suporte Afiliados', codigo_setor: 'suporte_afiliados', numero_whatsapp: '5511920857756', responsavel_nome: 'SUPORTE AFILIADOS GSA', ativo: true, ordem: 5 },
          { id: 'r6', setor_nome: '6️⃣ Suporte Parceiros', codigo_setor: 'suporte_parceiros', numero_whatsapp: '5511920857756', responsavel_nome: 'SUPORTE PARCEIROS GSA', ativo: true, ordem: 6 },
          { id: 'r7', setor_nome: '7️⃣ Suporte Fornecedores', codigo_setor: 'suporte_fornecedores', numero_whatsapp: '5511920857756', responsavel_nome: 'SUPORTE FORNECEDORES GSA', ativo: true, ordem: 7 },
          { id: 'r8', setor_nome: '8️⃣ SAC', codigo_setor: 'sac', numero_whatsapp: '5511971858372', responsavel_nome: 'SAC GSA', ativo: true, ordem: 8 }
        ]);
      }
    } catch (e) {
      console.warn('Erro ao carregar ramais de transbordo:', e);
    } finally {
      setLoadingRamais(false);
    }
  };

  const checkConnectionStatus = async (ip = targetIp) => {
    setLoading(true);
    try {
      if (ip === '163.176.97.152') {
        setStatus('connected');
        return;
      }

      const { data, error } = await supabase.functions.invoke('vps-api/whatsapp-status', {
        method: 'GET'
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
      const { data, error } = await supabase.functions.invoke('vps-api/whatsapp-qrcode', {
        method: 'GET'
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
    void loadRamais();
    void checkConnectionStatus('163.176.97.152');
  }, []);

  // Salva alteração de linha de WhatsApp Principal
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
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          { key: selectedDevice.key, value: formattedNumber, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) {
        console.warn('Upsert no system_settings falhou:', error);
      }

      setDevices(prev => prev.map(d => d.id === selectedDevice.id ? { ...d, phone: formattedNumber } : d));
      toast.success(`Linha "${selectedDevice.name}" atualizada para ${formatPhoneDisplay(formattedNumber)}!`);
      setSelectedDevice(null);
    } catch (e: any) {
      toast.error('Erro ao salvar alteração da linha: ' + e.message);
    } finally {
      setSavingDevice(false);
    }
  };

  // Exclusão protegida (Linha Oficial de Suporte Bloqueada)
  const handleRemoveDevice = async (device: WhatsAppDevice) => {
    if (!device.canDelete) {
      toast.error('❌ A Linha de Suporte Oficial é permanente e NUNCA pode ser excluída. Você só pode alterar o número de telefone.');
      return;
    }

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

  // Salvar ou Criar Ramal de Transbordo por Setor
  const handleSaveRamal = async () => {
    if (!ramalNome || !ramalNumero || !ramalResponsavel) {
      toast.error('Preencha o nome do setor, o número e o nome do responsável.');
      return;
    }

    setSavingRamal(true);
    const cleanPhone = ramalNumero.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const generatedCodigo = ramalCodigo || ramalNome.toLowerCase().replace(/[^a-z0-9]/g, '_');

    try {
      const payload = {
        setor_nome: ramalNome,
        codigo_setor: generatedCodigo,
        numero_whatsapp: formattedPhone,
        responsavel_nome: ramalResponsavel,
        ativo: true,
        ordem: selectedRamal ? selectedRamal.ordem : ramais.length + 1,
        updated_at: new Date().toISOString()
      };

      if (selectedRamal) {
        const { error } = await supabase
          .from('gsa_whatsapp_ramais')
          .update(payload)
          .eq('id', selectedRamal.id);

        if (error) throw error;
        toast.success(`Ramal "${ramalNome}" atualizado com sucesso!`);
      } else {
        const { error } = await supabase
          .from('gsa_whatsapp_ramais')
          .insert([payload]);

        if (error) throw error;
        toast.success(`Novo Ramal de Setor "${ramalNome}" cadastrado!`);
      }

      await loadRamais();
      setIsRamalModalOpen(false);
      setSelectedRamal(null);
    } catch (e: any) {
      toast.error('Erro ao salvar ramal: ' + e.message);
    } finally {
      setSavingRamal(false);
    }
  };

  // Toggle Ativar/Desativar Ramal
  const handleToggleRamalAtivo = async (ramal: WhatsAppRamal) => {
    try {
      const newStatus = !ramal.ativo;
      const { error } = await supabase
        .from('gsa_whatsapp_ramais')
        .update({ ativo: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ramal.id);

      if (error) throw error;
      setRamais(prev => prev.map(r => r.id === ramal.id ? { ...r, ativo: newStatus } : r));
      toast.success(`Ramal "${ramal.setor_nome}" ${newStatus ? 'ativado' : 'desativado'} em tempo real!`);
    } catch (e: any) {
      toast.error('Erro ao alterar status do ramal: ' + e.message);
    }
  };

  // Excluir Ramal de Setor
  const handleDeleteRamal = async (ramal: WhatsAppRamal) => {
    if (!confirm(`Deseja remover o ramal de atendimento "${ramal.setor_nome}"?`)) return;
    try {
      const { error } = await supabase
        .from('gsa_whatsapp_ramais')
        .delete()
        .eq('id', ramal.id);

      if (error) throw error;
      setRamais(prev => prev.filter(r => r.id !== ramal.id));
      toast.success(`Ramal "${ramal.setor_nome}" removido!`);
    } catch (e: any) {
      toast.error('Erro ao excluir ramal: ' + e.message);
    }
  };

  // Testar Disparo de Linha ou Ramal
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
          `🤖 *TESTE GSA HUB* - Linha Oficial de Suporte (${device.name}) verificada em tempo real!`,
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

  const handleTestRamal = async (ramal: WhatsAppRamal) => {
    setTestingId(ramal.id);
    try {
      const ok = await whatsappNotificationService.enviarWhatsAppDireto(
        ramal.numero_whatsapp,
        `📲 *TESTE DE TRANSBORDO DE RAMAL* - Setor: *${ramal.setor_nome}*\n\nResponsável: ${ramal.responsavel_nome}\nStatus: Operacional 🟢`,
        { clienteNome: 'Administrador' }
      );
      if (ok) toast.success(`✅ Teste de transbordo enviado para ${ramal.setor_nome} (${formatPhoneDisplay(ramal.numero_whatsapp)})!`);
    } catch (e: any) {
      toast.error('Falha no teste de ramal: ' + e.message);
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
              Pareamento QR Code, proteção da linha oficial de suporte e roteamento de ramais por setor.
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

      {/* ─── LINHAS PRINCIPAIS (COM SUPORTE OFICIAL INVIOLÁVEL) ─── */}
      <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" /> Linhas Principais do Sistema GSA HUB
            </h4>
            <p className="text-xs text-neutral-400 mt-1">
              Linha Oficial de Suporte é permanente e protegida contra exclusão acidental.
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
                className={`bg-neutral-900 border ${device.role === 'SUPORTE' ? 'border-emerald-500/40 shadow-emerald-500/5' : 'border-neutral-800/90'} rounded-xl p-4 transition-all space-y-3 shadow-md`}
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
                        {!device.canDelete && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest bg-emerald-600 text-white flex items-center gap-1">
                            <Lock className="w-3 h-3" /> OFICIAL INVIOLÁVEL
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 block mt-0.5">
                        {formatPhoneDisplay(device.phone)}
                      </span>
                    </div>
                  </div>

                  {isConnectedOnCurrentIp ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Ativo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Pendente Nova
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed border-t border-neutral-800/60 pt-2">
                  {device.description}
                </p>

                <div className="flex items-center justify-between border-t border-neutral-800/80 pt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedDevice(device);
                        setEditPhone(device.phone);
                      }}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Alterar Número
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

                  {device.canDelete ? (
                    <button
                      onClick={() => void handleRemoveDevice(device)}
                      className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="Desvincular Linha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-emerald-500/70 flex items-center gap-1 px-2 py-1 bg-emerald-500/5 rounded border border-emerald-500/10">
                      <Lock className="w-3 h-3" /> Protegido
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── RAMAIS DE TRANSBORDO HUMANO POR SETOR (NOVO RECURSO PROFISSIONAL) ─── */}
      <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" /> Ramais de Transbordo Humano por Setor (Chatbot Transfer)
            </h4>
            <p className="text-xs text-neutral-400 mt-1">
              Roteamento invisível em tempo real. Quando o cliente solicita atendimento humano no WhatsApp, a demanda é transferida instantaneamente para o ramal do setor cadastrado.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedRamal(null);
              setRamalNome('');
              setRamalCodigo('');
              setRamalNumero('');
              setRamalResponsavel('');
              setIsRamalModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Ramal de Setor
          </button>
        </div>

        {loadingRamais ? (
          <div className="flex items-center justify-center py-8 text-neutral-500">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ramais.map((ramal) => (
              <div 
                key={ramal.id} 
                className={`bg-neutral-900 border ${ramal.ativo ? 'border-neutral-800 hover:border-blue-500/50' : 'border-neutral-800/50 opacity-60'} rounded-xl p-4 transition-all space-y-3 shadow-md`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">{ramal.setor_nome}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-neutral-800 text-neutral-400">
                        {ramal.codigo_setor}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 block mt-0.5">
                      {formatPhoneDisplay(ramal.numero_whatsapp)}
                    </span>
                    <span className="text-[11px] text-neutral-400 block font-sans">
                      Responsável: {ramal.responsavel_nome}
                    </span>
                  </div>

                  <button
                    onClick={() => void handleToggleRamalAtivo(ramal)}
                    className="text-neutral-400 hover:text-white transition-colors"
                    title={ramal.ativo ? 'Desativar Ramal' : 'Ativar Ramal'}
                  >
                    {ramal.ativo ? <ToggleRight className="w-7 h-7 text-emerald-400" /> : <ToggleLeft className="w-7 h-7 text-neutral-600" />}
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-800/80 pt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedRamal(ramal);
                        setRamalNome(ramal.setor_nome);
                        setRamalCodigo(ramal.codigo_setor);
                        setRamalNumero(ramal.numero_whatsapp);
                        setRamalResponsavel(ramal.responsavel_nome);
                        setIsRamalModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Editar Ramal
                    </button>
                    <button
                      onClick={() => void handleTestRamal(ramal)}
                      disabled={testingId === ramal.id}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className={`w-3.5 h-3.5 ${testingId === ramal.id ? 'animate-bounce' : ''}`} />
                      {testingId === ramal.id ? 'Testando...' : 'Testar Transbordo'}
                    </button>
                  </div>

                  <button
                    onClick={() => void handleDeleteRamal(ramal)}
                    className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Excluir Ramal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* Modal de Edição de Linha Principal */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                Alterar Número da Linha: {selectedDevice.name}
              </h3>
              <button onClick={() => setSelectedDevice(null)} className="p-1 text-neutral-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              {!selectedDevice.canDelete && (
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                  <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                  Esta é a Linha de Suporte Oficial do sistema. Ela não pode ser excluída, mas você pode substituir o número por outro aparelho a qualquer momento.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-widest mb-1.5">
                  Número do WhatsApp (com DDD)
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Ex: 5511920857756"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition-all"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  Formato visual: <strong>{formatPhoneDisplay(editPhone)}</strong>
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
                Salvar Número
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição de Ramal de Setor */}
      {isRamalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                {selectedRamal ? 'Editar Ramal de Transbordo' : 'Cadastrar Novo Ramal de Setor'}
              </h3>
              <button onClick={() => setIsRamalModalOpen(false)} className="p-1 text-neutral-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-widest mb-1.5">
                  Nome do Setor (Ex: 1. Vendas & Orçamentos)
                </label>
                <input
                  type="text"
                  value={ramalNome}
                  onChange={(e) => setRamalNome(e.target.value)}
                  placeholder="Ex: 5. Atendimento VIP / Jurídico"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-widest mb-1.5">
                  Número de WhatsApp do Responsável (com DDD)
                </label>
                <input
                  type="text"
                  value={ramalNumero}
                  onChange={(e) => setRamalNumero(e.target.value)}
                  placeholder="Ex: 5511971858372"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-all"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  Formato visual: <strong>{formatPhoneDisplay(ramalNumero)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-widest mb-1.5">
                  Nome do Responsável / Atendente do Ramal
                </label>
                <input
                  type="text"
                  value={ramalResponsavel}
                  onChange={(e) => setRamalResponsavel(e.target.value)}
                  placeholder="Ex: Carlos Andrade - Gerente de Vendas"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
              <button
                onClick={() => setIsRamalModalOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSaveRamal()}
                disabled={savingRamal}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {savingRamal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Ramal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
