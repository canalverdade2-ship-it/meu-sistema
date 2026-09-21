import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BadgeDollarSign, Calendar, Clock, Database, Eye, EyeOff, FileVideo, KeyRound, ListChecks, Loader2, Plus, RefreshCw, Server, Settings, ShieldCheck, Sparkles, Trash2, Tv2, Upload, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatDateTime } from '../../lib/utils';
import { getGsaTvCredentialStatus, updateGsaTvCredentials, type GsaTvCredentialStatus } from '../../lib/gsaTvCredentials';
import { uploadGsaTvMedia } from '../../lib/gsaTvMediaUpload';

interface GsaTvModuleProps { colaboradorId?: string; colaboradorNome?: string | null; adminType?: 'admin' | 'colaborador' }
export type TabType = 'status' | 'library' | 'advertising' | 'schedule' | 'jobs' | 'incidents' | 'settings';
export type QualityProfile = '720p30' | '1080p30' | '1080p60';
export const PROFILES: Record<QualityProfile, { label: string; resolution: string; fps: number; bitrateKbps: number }> = {
  '720p30': { label: '720p30 HD', resolution: '1280×720', fps: 30, bitrateKbps: 4000 },
  '1080p30': { label: '1080p30 Full HD', resolution: '1920×1080', fps: 30, bitrateKbps: 6000 },
  '1080p60': { label: '1080p60 Full HD', resolution: '1920×1080', fps: 60, bitrateKbps: 8500 },
};
type Snapshot = { channel: any | null; media: any[]; schedule: any[]; playlists: any[]; incidents: any[]; jobs: any[]; audit: any[]; server_time?: string };
const EMPTY: Snapshot = { channel: null, media: [], schedule: [], playlists: [], incidents: [], jobs: [], audit: [] };
const tabs: Array<{ id: TabType; label: string; icon: React.ElementType }> = [
  { id: 'status', label: 'Estado operacional', icon: Activity }, { id: 'library', label: 'Biblioteca', icon: FileVideo },
  { id: 'advertising', label: 'Publicidade', icon: BadgeDollarSign },
  { id: 'schedule', label: 'Programação', icon: Calendar }, { id: 'jobs', label: 'Tarefas', icon: ListChecks },
  { id: 'incidents', label: 'Incidentes', icon: AlertTriangle }, { id: 'settings', label: 'Configurações', icon: Settings },
];
const msg = (e: unknown) => e instanceof Error ? e.message : String((e as any)?.message || e || 'Erro inesperado.');

function Badge({ value }: { value?: string }) {
  const v = String(value || 'desconhecido').toLowerCase();
  const good = ['online', 'ready', 'completed', 'confirmed', 'resolved'].includes(v);
  const wait = ['pending', 'processing', 'running'].includes(v);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${good ? 'bg-emerald-50 text-emerald-700' : wait ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{value || 'Desconhecido'}</span>;
}

export function GsaTvModule(props: GsaTvModuleProps) {
  const [tab, setTab] = useState<TabType>('status');
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [media, setMedia] = useState({ title: '', filename: '', duration: '60', path: '', rights: false });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [advertising, setAdvertising] = useState({ title: '', advertiser: '', campaign: '', filename: '', duration: '30', path: '', origin: 'uploaded', rights: false });
  const [advertisingFile, setAdvertisingFile] = useState<File | null>(null);
  const [slot, setSlot] = useState({ mediaId: '', start: '', end: '', type: 'program' });
  const [channel, setChannel] = useState({ name: '', profile: '720p30' as QualityProfile, youtubeVideoId: '' });
  const isAdmin = props.adminType === 'admin';
  const [credentialStatus, setCredentialStatus] = useState<GsaTvCredentialStatus | null>(null);
  const [rtmpServer, setRtmpServer] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [streamKey, setStreamKey] = useState('');
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [credentialSaving, setCredentialSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const value = await callAdminRpc<Snapshot>('gsa_admin_gsa_tv_snapshot');
      setData({ ...EMPTY, ...value }); setError('');
      if (value.channel) setChannel({ name: value.channel.name || '', profile: (value.channel.quality_profile || '720p30') as QualityProfile, youtubeVideoId: value.channel.config?.youtube_video_id || '' });
    } catch (e) { setError(msg(e)); } finally { if (!quiet) setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(true), 15000); return () => window.clearInterval(timer); }, [load]);

  const loadCredentials = useCallback(async () => {
    if (!isAdmin) return;
    setCredentialLoading(true);
    try {
      const status = await getGsaTvCredentialStatus(data.channel?.id || 'ch-main');
      setCredentialStatus(status);
      setRtmpServer(status.rtmp_server || 'rtmp://a.rtmp.youtube.com/live2');
    } catch (e) { toast.error(msg(e)); } finally { setCredentialLoading(false); }
  }, [data.channel?.id, isAdmin]);
  useEffect(() => { if (tab === 'settings' && isAdmin) void loadCredentials(); }, [tab, isAdmin, loadCredentials]);

  const mutate = async (action: string, payload: Record<string, unknown>, success: string) => {
    setSaving(true);
    try { await callAdminRpc('gsa_admin_gsa_tv_mutate', { p_action: action, p_payload: payload }); toast.success(success); await load(true); return true; }
    catch (e) { toast.error(msg(e)); return false; } finally { setSaving(false); }
  };
  const saveCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin) { toast.error('Somente administradores podem alterar as credenciais.'); return; }
    const key = streamKey.trim();
    setCredentialSaving(true);
    try {
      const status = await updateGsaTvCredentials(data.channel?.id || 'ch-main', rtmpServer, key || undefined);
      setCredentialStatus(status);
      setRtmpServer(status.rtmp_server);
      setStreamKey('');
      setShowStreamKey(false);
      toast.success(key ? 'Credencial de transmissão atualizada.' : 'Servidor de transmissão atualizado.');
    } catch (e) { toast.error(msg(e)); } finally { setCredentialSaving(false); }
  };

  const heartbeatAge = data.channel?.last_heartbeat_at ? Date.now() - new Date(data.channel.last_heartbeat_at).getTime() : Infinity;
  const operational = heartbeatAge < 120000 && data.channel?.status === 'online';
  const readyMedia = useMemo(() => data.media.filter((x) => x.state === 'ready' && x.rights_ok), [data.media]);
  const advertisingMedia = useMemo(() => data.media.filter((x) => x.media_kind === 'advertising'), [data.media]);
  const enqueue = (jobType: string) => mutate('enqueue_job', { channel_id: data.channel?.id, job_type: jobType, payload: {} }, 'Tarefa registrada. A conclusão será confirmada pelo serviço.');
  const confirmCommand = (message: string, jobType: string) => { if (window.confirm(message)) void enqueue(jobType); };

  if (loading) return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>;
  return <section className="space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-xl bg-indigo-500/20 p-3"><Tv2 className="h-6 w-6 text-indigo-300" /></div><div><h1 className="text-xl font-black">GSA TV — Central operacional</h1><p className="mt-1 text-sm text-slate-300">Dados protegidos, programação validada e comandos rastreáveis.</p></div></div><button onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" />Atualizar</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Canal"><div className="flex items-center gap-2"><strong>{data.channel?.name || 'Não configurado'}</strong><Badge value={data.channel?.status} /></div></Metric><Metric label="Heartbeat"><strong className={operational ? 'text-emerald-300' : 'text-amber-300'}>{operational ? 'Serviço respondendo' : 'Sem confirmação recente'}</strong></Metric><Metric label="Incidentes abertos"><strong>{data.incidents.filter((x) => !x.resolved).length}</strong></Metric></div>
    </header>
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><XCircle className="h-5 w-5 shrink-0" /><div><strong>Falha ao carregar a GSA TV.</strong><p>{error}</p></div></div>}
    <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2" aria-label="Seções da GSA TV">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>

    {tab === 'status' && <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Estado confirmado" icon={Server}><dl className="space-y-3 text-sm"><Row label="Estado do canal" value={<Badge value={data.channel?.status} />} /><Row label="Último heartbeat" value={data.channel?.last_heartbeat_at ? formatDateTime(data.channel.last_heartbeat_at) : 'Nunca recebido'} /><Row label="Perfil" value={PROFILES[(data.channel?.quality_profile || '720p30') as QualityProfile]?.label} /><Row label="URL HLS" value={data.channel?.stream_url || 'Não configurada'} /></dl>{!operational && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">O painel não presume transmissão ativa sem heartbeat recente.</p>}</Panel>
      <Panel title="Ações operacionais seguras" icon={ShieldCheck}><div className="mb-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Programação</span><strong className="mt-1 block uppercase">{data.channel?.playout_state || 'fora do ar'}</strong></div><div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Sinal</span><strong className={`mt-1 block uppercase ${data.channel?.signal_state === 'sending' ? 'text-emerald-700' : 'text-amber-700'}`}>{data.channel?.signal_state || 'parado'}</strong></div></div><div className="grid gap-2 sm:grid-cols-2"><Action onClick={() => confirmCommand('Iniciar o envio do sinal da GSA TV para o YouTube?', 'stream_start')} disabled={saving || data.channel?.signal_state === 'sending'}>Iniciar transmissão</Action><Action onClick={() => confirmCommand('Pausar a programação e manter a tela institucional no ar?', 'stream_pause')} disabled={saving || data.channel?.signal_state !== 'sending'}>Pausar programação</Action><Action onClick={() => confirmCommand('Retomar a programação da GSA TV?', 'stream_resume')} disabled={saving || data.channel?.desired_state !== 'paused'}>Retomar programação</Action><Action onClick={() => confirmCommand('Encerrar completamente o envio ao YouTube? O canal ficará sem sinal.', 'stream_stop')} disabled={saving || data.channel?.signal_state === 'stopped'}>Encerrar transmissão</Action><Action onClick={() => void enqueue('health_check')} disabled={saving}>Verificar serviços</Action><Action onClick={() => void enqueue('validate_schedule')} disabled={saving}>Validar programação</Action><Action onClick={() => void enqueue('compile_playlist')} disabled={saving}>Compilar playlist</Action><Action onClick={() => void enqueue('playout_reload')} disabled={saving}>Recarregar playout</Action></div><p className="mt-3 text-xs text-slate-500">Pausar mantém o sinal com o conteúdo institucional. Encerrar interrompe o envio ao YouTube.</p></Panel>
      <Panel title="Auditoria recente" icon={Database} className="lg:col-span-2"><List empty="Nenhum evento registrado.">{data.audit.slice(0, 10).map((x) => <Item key={x.id} title={x.action} subtitle={`${x.actor} · ${formatDateTime(x.created_at)}`} trailing={x.resource_type} />)}</List></Panel>
    </div>}

    {tab === 'library' && <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel title="Enviar mídia para a VPS" icon={Upload}><form onSubmit={async (e) => { e.preventDefault(); if (!mediaFile) return toast.error('Selecione o arquivo.'); setSaving(true); setUploadProgress(0); try { await uploadGsaTvMedia({ file: mediaFile, title: media.title || mediaFile.name, rightsConfirmed: media.rights, onProgress: setUploadProgress }); toast.success('Arquivo recebido. A verificação técnica foi iniciada.'); setMedia({ title: '', filename: '', duration: '60', path: '', rights: false }); setMediaFile(null); await load(true); } catch (error) { toast.error(msg(error)); } finally { setSaving(false); } }} className="space-y-3"><Field label="Título"><input required value={media.title} onChange={(e) => setMedia({ ...media, title: e.target.value })} /></Field><Field label="Arquivo"><input required type="file" accept="video/*,audio/*,image/png,image/jpeg,image/webp" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} /></Field>{saving && uploadProgress > 0 && <div aria-label={`Envio ${uploadProgress}%`} className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${uploadProgress}%` }} /></div>}<label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={media.rights} onChange={(e) => setMedia({ ...media, rights: e.target.checked })} />Direitos de exibição verificados.</label><button disabled={saving || !media.rights || !mediaFile} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? `Enviando ${uploadProgress}%` : 'Enviar e verificar'}</button></form></Panel>
      <Panel title={`Biblioteca (${data.media.length})`} icon={FileVideo}><List empty="Nenhuma mídia registrada.">{data.media.map((x) => <Item key={x.id} title={x.title} subtitle={`${x.duration_s}s · ${x.drive_path || 'Sem arquivo'}`} trailing={<div className="flex items-center gap-2"><Badge value={x.state} /><button aria-label={`Excluir ${x.title}`} onClick={() => void mutate('delete_media', { id: x.id, channel_id: data.channel?.id }, 'Mídia excluída.')} className="p-1.5 text-rose-600"><Trash2 className="h-4 w-4" /></button></div>} />)}</List></Panel>
    </div>}

    {tab === 'advertising' && <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={BadgeDollarSign} label="Peças publicitárias" value={String(advertisingMedia.length)} />
        <MetricCard icon={Sparkles} label="Geradas pela IA" value={String(advertisingMedia.filter((x) => x.ai_generated).length)} />
        <MetricCard icon={ShieldCheck} label="Liberadas para exibição" value={String(advertisingMedia.filter((x) => x.state === 'ready' && x.rights_ok && x.approval_state === 'approved').length)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Panel title="Adicionar conteúdo publicitário" icon={Upload}><form onSubmit={async (e) => { e.preventDefault(); if (!advertisingFile) return toast.error('Selecione o arquivo publicitário.'); setSaving(true); setUploadProgress(0); try { await uploadGsaTvMedia({ file: advertisingFile, title: advertising.title, mediaKind: 'advertising', advertiserName: advertising.advertiser, campaignName: advertising.campaign, rightsConfirmed: advertising.rights, onProgress: setUploadProgress }); toast.success('Peça recebida e enviada para verificação.'); setAdvertising({ title: '', advertiser: '', campaign: '', filename: '', duration: '30', path: '', origin: 'uploaded', rights: false }); setAdvertisingFile(null); await load(true); } catch (error) { toast.error(msg(error)); } finally { setSaving(false); } }} className="space-y-3">
          <Field label="Nome da peça"><input required value={advertising.title} onChange={(e) => setAdvertising({ ...advertising, title: e.target.value })} /></Field>
          <Field label="Anunciante"><input required value={advertising.advertiser} onChange={(e) => setAdvertising({ ...advertising, advertiser: e.target.value })} /></Field>
          <Field label="Campanha"><input value={advertising.campaign} onChange={(e) => setAdvertising({ ...advertising, campaign: e.target.value })} placeholder="Ex.: Oferta relâmpago" /></Field>
          <Field label="Origem"><select value={advertising.origin} onChange={(e) => setAdvertising({ ...advertising, origin: e.target.value })}><option value="uploaded">Enviado pelo anunciante</option><option value="ai">Gerado pela IA</option><option value="marketplace">Marketplace GSA</option><option value="services">Serviços GSA</option></select></Field>
          <Field label="Arquivo"><input required type="file" accept="video/*,audio/*,image/png,image/jpeg,image/webp" onChange={(e) => setAdvertisingFile(e.target.files?.[0] || null)} /></Field>
          {saving && uploadProgress > 0 && <div aria-label={`Envio ${uploadProgress}%`} className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${uploadProgress}%` }} /></div>}
          <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={advertising.rights} onChange={(e) => setAdvertising({ ...advertising, rights: e.target.checked })} /><span>Confirmo que os materiais e direitos de uso foram anexados ou verificados.</span></label>
          <button disabled={saving || !advertising.rights || !advertisingFile} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? `Enviando ${uploadProgress}%` : 'Enviar para análise'}</button>
        </form></Panel>
        <Panel title="Acervo de publicidade" icon={BadgeDollarSign}><div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900"><strong>Fluxo protegido:</strong> toda peça enviada ou criada pela IA fica nesta área e somente entra na programação depois da validação técnica, dos direitos e da aprovação humana.</div><List empty="Nenhuma peça publicitária cadastrada.">{advertisingMedia.map((x) => <Item key={x.id} title={x.title} subtitle={`${x.advertiser_name || 'Anunciante não informado'}${x.campaign_name ? ` · ${x.campaign_name}` : ''} · ${x.duration_s}s`} trailing={<div className="flex items-center gap-2">{x.ai_generated && <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">IA</span>}<Badge value={x.approval_state || x.state} /></div>} />)}</List></Panel>
      </div>
    </div>}

    {tab === 'schedule' && <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Panel title="Nova programação" icon={Calendar}><form onSubmit={async (e) => { e.preventDefault(); try { const ok = await mutate('save_slot', { channel_id: data.channel?.id, media_item_id: slot.mediaId, scheduled_start: new Date(slot.start).toISOString(), scheduled_end: new Date(slot.end).toISOString(), slot_type: slot.type }, 'Programação salva e validada.'); if (ok) setSlot({ mediaId: '', start: '', end: '', type: 'program' }); } catch { toast.error('Datas inválidas.'); } }} className="space-y-3"><Field label="Mídia pronta"><select required value={slot.mediaId} onChange={(e) => setSlot({ ...slot, mediaId: e.target.value })}><option value="">Selecione</option>{readyMedia.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field><Field label="Início"><input required type="datetime-local" value={slot.start} onChange={(e) => setSlot({ ...slot, start: e.target.value })} /></Field><Field label="Fim"><input required type="datetime-local" value={slot.end} onChange={(e) => setSlot({ ...slot, end: e.target.value })} /></Field><Field label="Tipo"><select value={slot.type} onChange={(e) => setSlot({ ...slot, type: e.target.value })}><option value="program">Programa</option><option value="commercial">Comercial</option><option value="filler">Preenchimento</option><option value="live">Ao vivo</option></select></Field><button disabled={saving || !readyMedia.length} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Validar e salvar</button></form></Panel>
      <Panel title="Grade cronológica" icon={Clock}><List empty="Nenhuma programação futura.">{data.schedule.map((x) => <Item key={x.id} title={x.title_override || x.media_title || 'Conteúdo'} subtitle={`${formatDateTime(x.scheduled_start)} — ${formatDateTime(x.scheduled_end)}`} trailing={<div className="flex items-center gap-2"><Badge value={x.state} /><button aria-label="Excluir programação" onClick={() => void mutate('delete_slot', { id: x.id, channel_id: data.channel?.id }, 'Programação excluída.')} className="p-1.5 text-rose-600"><Trash2 className="h-4 w-4" /></button></div>} />)}</List></Panel>
    </div>}

    {tab === 'jobs' && <Panel title="Fila operacional" icon={ListChecks}><List empty="Nenhuma tarefa registrada.">{data.jobs.map((x) => <Item key={x.id} title={x.job_type} subtitle={`${formatDateTime(x.created_at)}${x.error_message ? ` · ${x.error_message}` : ''}`} trailing={<Badge value={x.status} />} />)}</List></Panel>}
    {tab === 'incidents' && <Panel title="Incidentes" icon={AlertTriangle}><List empty="Nenhum incidente registrado.">{data.incidents.map((x) => <Item key={x.id} title={x.message} subtitle={formatDateTime(x.created_at)} trailing={x.resolved ? <Badge value="resolved" /> : <button disabled={saving} onClick={() => void mutate('resolve_incident', { id: x.id, channel_id: data.channel?.id }, 'Incidente resolvido.')} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Resolver</button>} />)}</List></Panel>}
    {tab === 'settings' && <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Configuração do canal" icon={Settings}><form onSubmit={(e) => { e.preventDefault(); const p = PROFILES[channel.profile]; void mutate('update_channel', { channel_id: data.channel?.id, name: channel.name, quality_profile: channel.profile, config: { youtube_video_id: channel.youtubeVideoId, fps: p.fps, output_resolution: p.resolution.replace('×', 'x'), video_bitrate_kbps: p.bitrateKbps } }, 'Canal atualizado.'); }} className="space-y-3"><Field label="Nome"><input required value={channel.name} onChange={(e) => setChannel({ ...channel, name: e.target.value })} /></Field><Field label="Perfil"><select value={channel.profile} onChange={(e) => setChannel({ ...channel, profile: e.target.value as QualityProfile })}>{Object.entries(PROFILES).map(([id, p]) => <option key={id} value={id}>{p.label} · {p.resolution}</option>)}</select></Field><Field label="ID público do vídeo no YouTube"><input value={channel.youtubeVideoId} onChange={(e) => setChannel({ ...channel, youtubeVideoId: e.target.value.trim() })} placeholder="Opcional" /></Field><div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Esses dados não contêm a chave de transmissão.</div><button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Salvar canal</button></form></Panel>
      <Panel title="Credenciais da transmissão" icon={KeyRound}>
        {!isAdmin ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><ShieldCheck className="mr-2 inline h-4 w-4" />Somente o perfil Administrador pode gerenciar as credenciais de transmissão.</div> : credentialLoading ? <div className="flex min-h-[180px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div> : <form onSubmit={saveCredentials} className="space-y-3">
          <Field label="Servidor RTMP/RTMPS"><input required value={rtmpServer} onChange={(e) => setRtmpServer(e.target.value)} placeholder="rtmp://a.rtmp.youtube.com/live2" autoComplete="off" /></Field>
          <label className="block text-sm font-semibold text-slate-700"><span className="mb-1 block">Chave de transmissão</span><div className="relative"><input type={showStreamKey ? 'text' : 'password'} value={streamKey} onChange={(e) => setStreamKey(e.target.value)} placeholder={credentialStatus?.stream_key_configured ? '••••••••••••' : 'Cole a chave de transmissão'} autoComplete="new-password" spellCheck={false} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-11 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /><button type="button" disabled={!streamKey} onClick={() => setShowStreamKey((value) => !value)} aria-label={showStreamKey ? 'Ocultar chave digitada' : 'Mostrar chave digitada'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 disabled:opacity-30">{showStreamKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
          <div className={credentialStatus?.stream_key_configured ? 'flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800' : 'flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800'}><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>{credentialStatus?.stream_key_configured ? 'Credencial configurada' : 'Credencial ainda não configurada'}</strong><p className="mt-1 text-xs">{credentialStatus?.stream_key_configured ? 'A chave salva permanece no ambiente protegido e não é enviada de volta ao navegador.' : 'Informe a chave do YouTube para ativar a credencial protegida.'}</p></div></div>
          <p className="text-xs leading-5 text-slate-500">Se já existir uma chave e este campo ficar vazio, a chave atual será preservada. Para substituí-la, digite uma nova. O botão de olho mostra somente o valor que você está digitando agora.</p>
          <button disabled={credentialSaving || !rtmpServer.trim() || (!credentialStatus?.stream_key_configured && !streamKey.trim())} className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{credentialSaving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar credenciais</button>
        </form>}
      </Panel>
    </div>}
  </section>;
}

function Panel({ title, icon: Icon, children, className = '' }: { title: string; icon: React.ElementType; children: React.ReactNode; className?: string }) { return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}><h2 className="mb-4 flex items-center gap-2 text-base font-black"><Icon className="h-5 w-5 text-indigo-600" />{title}</h2>{children}</div>; }
function Metric({ label, children }: { label: string; children: React.ReactNode }) { return <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-400">{label}</p><div className="mt-1">{children}</div></div>; }
function MetricCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="rounded-xl bg-indigo-50 p-3"><Icon className="h-5 w-5 text-indigo-600" /></div><div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-black text-slate-900">{value}</p></div></div>; }
function Row({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3"><dt className="text-slate-500">{label}</dt><dd className="max-w-[65%] break-all text-right font-semibold">{value}</dd></div>; }
function Action(props: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold hover:bg-slate-50 disabled:opacity-50" />; }
function Field({ label, children }: { label: string; children: React.ReactElement }) { return <label className="block text-sm font-semibold text-slate-700"><span className="mb-1 block">{label}</span>{React.cloneElement(children as React.ReactElement<any>, { className: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100' })}</label>; }
function List({ children, empty }: { children: React.ReactNode; empty: string }) { const content = React.Children.toArray(children); return content.length ? <div className="divide-y divide-slate-100">{content}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{empty}</div>; }
function Item({ title, subtitle, trailing }: { title: string; subtitle: string; trailing?: React.ReactNode }) { return <div className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate font-semibold">{title}</p><p className="mt-0.5 break-all text-xs text-slate-500">{subtitle}</p></div><div className="shrink-0">{trailing}</div></div>; }
export default GsaTvModule;
