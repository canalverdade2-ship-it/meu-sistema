import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { Building2, Calculator, CreditCard, Layout, LockKeyhole, MessageSquare, Plus, RefreshCw, Save, Settings, Users, Wallet, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { CalculatorProAdminPanel } from './CalculatorProAdminPanel';

type Tab = 'empresa' | 'financeiro' | 'calculadoras' | 'indicacao' | 'whatsapp' | 'portal' | 'seguranca';

type SettingsSnapshot = {
  company?: any | null;
  payment_methods?: any[];
  settings?: Record<string, string>;
};

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">{children}</div></div>;
}

export function ConfiguracoesModule() {
  const [activeTab, setActiveTab] = useState<Tab>('empresa');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<any>({ razao_social: '', cnpj: '', telefone: '', responsavel: '' });
  const [methods, setMethods] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [methodForm, setMethodForm] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminRpc<SettingsSnapshot>('gsa_admin_settings_snapshot');
      setCompany(data?.company || { razao_social: '', cnpj: '', telefone: '', responsavel: '' });
      setMethods(Array.isArray(data?.payment_methods) ? data.payment_methods : []);
      setSettings(data?.settings || {});
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar as configurações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const value = (key: string, fallback = '') => settings[key] ?? fallback;
  const setValue = (key: string, next: string) => setSettings((current) => ({ ...current, [key]: next }));

  const saveSettings = async (keys: string[], successMessage: string) => {
    setSaving(true);
    try {
      await callAdminRpc('gsa_admin_update_settings_secure', { p_settings: keys.map((key) => ({ key, value: value(key) })) });
      toast.success(successMessage);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const saveCompany = async () => {
    setSaving(true);
    try {
      await callAdminRpc('gsa_admin_save_company', { p_payload: company });
      toast.success('Dados da empresa salvos e auditados.');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar a empresa.');
    } finally {
      setSaving(false);
    }
  };

  const saveMethod = async () => {
    if (!methodForm?.nome?.trim()) return toast.error('Informe o nome da forma de pagamento.');
    setSaving(true);
    try {
      await callAdminRpc('gsa_admin_save_payment_method', { p_id: methodForm.id || null, p_payload: methodForm });
      toast.success('Forma de pagamento salva e auditada.');
      setMethodForm(null);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar a forma de pagamento.');
    } finally {
      setSaving(false);
    }
  };

  const toggleMethod = async (method: any) => {
    try {
      await callAdminRpc('gsa_admin_save_payment_method', { p_id: method.id, p_payload: { ...method, ativo: !method.ativo } });
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível alterar a forma de pagamento.');
    }
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'empresa', label: 'Empresa', icon: Building2 },
    { id: 'financeiro', label: 'Financeiro', icon: Wallet },
    { id: 'calculadoras', label: 'Calculadoras Pro', icon: Calculator },
    { id: 'indicacao', label: 'Indicação', icon: Users },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'portal', label: 'Portal', icon: Layout },
    { id: 'seguranca', label: 'Segurança', icon: LockKeyhole },
  ];

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><RefreshCw className="h-9 w-9 animate-spin text-indigo-600" /></div>;

  return <div className="space-y-6 pb-10">
    <header className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Allowlist administrativa</p><h1 className="mt-2 flex items-center gap-3 text-2xl font-black"><Settings className="h-6 w-6 text-indigo-400" /> Configurações Globais</h1><p className="mt-2 text-sm text-white/55">Somente chaves e produtos conhecidos podem ser lidos ou alterados por este painel.</p></div><button type="button" onClick={() => void load()} className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-neutral-900"><RefreshCw className="h-4 w-4" /> Atualizar</button></div></header>

    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-white p-2 sm:grid-cols-3 lg:grid-cols-7">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${activeTab === id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>

    {activeTab === 'empresa' && <section className="space-y-6"><Card title="Dados da empresa" icon={Building2}><div className="grid gap-4 sm:grid-cols-2"><TextField label="Razão social" value={company.razao_social || ''} onChange={(next) => setCompany({ ...company, razao_social: next })} /><TextField label="CNPJ" value={company.cnpj || ''} onChange={(next) => setCompany({ ...company, cnpj: next })} /><TextField label="Telefone" value={company.telefone || ''} onChange={(next) => setCompany({ ...company, telefone: next })} /><TextField label="Responsável" value={company.responsavel || ''} onChange={(next) => setCompany({ ...company, responsavel: next })} /></div><SaveButton saving={saving} onClick={() => void saveCompany()} label="Salvar dados da empresa" /></Card><Card title="Cadastro padrão" icon={Users}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SelectField label="Status do código" value={value('codigo_cadastro_padrao_ativo', 'false')} onChange={(next) => setValue('codigo_cadastro_padrao_ativo', next)} options={[['true', 'Ativo'], ['false', 'Desativado']]} /><TextField label="Código" value={value('codigo_cadastro_padrao', 'BEMVINDO')} onChange={(next) => setValue('codigo_cadastro_padrao', next.toUpperCase())} /><SelectField label="Tipo de bônus" value={value('bonus_cadastro_tipo', 'pontos')} onChange={(next) => setValue('bonus_cadastro_tipo', next)} options={[['pontos', 'Pontos'], ['carteira', 'Carteira']]} /><NumberField label="Valor do bônus" value={value('bonus_cadastro_valor', '100')} onChange={(next) => setValue('bonus_cadastro_valor', next)} /></div><SaveButton saving={saving} onClick={() => void saveSettings(['codigo_cadastro_padrao_ativo', 'codigo_cadastro_padrao', 'bonus_cadastro_tipo', 'bonus_cadastro_valor'], 'Configurações de cadastro salvas.')} /></Card></section>}

    {activeTab === 'financeiro' && <section className="space-y-6"><Card title="Parâmetros financeiros" icon={Wallet}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><NumberField label="Valor mínimo para saque" value={value('valor_minimo_saque', '50')} onChange={(next) => setValue('valor_minimo_saque', next)} /><NumberField label="Vencimento de serviços" value={value('vencimento_padrao_servicos', '10')} onChange={(next) => setValue('vencimento_padrao_servicos', next)} /><NumberField label="Vencimento de produtos" value={value('vencimento_padrao_produtos', '10')} onChange={(next) => setValue('vencimento_padrao_produtos', next)} /><NumberField label="Taxa de entrega" value={value('loja_taxa_entrega_padrao', '0')} onChange={(next) => setValue('loja_taxa_entrega_padrao', next)} /></div><SaveButton saving={saving} onClick={() => void saveSettings(['valor_minimo_saque', 'vencimento_padrao_servicos', 'vencimento_padrao_produtos', 'loja_taxa_entrega_padrao'], 'Parâmetros financeiros salvos.')} /></Card><Card title="Formas de pagamento" icon={CreditCard}><div className="flex justify-end"><button type="button" onClick={() => setMethodForm({ nome: '', slug: '', tipo: 'manual', instrucoes: '', ativo: true })} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white"><Plus className="h-4 w-4" /> Nova forma</button></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{methods.map((method) => <article key={method.id} className="rounded-2xl border border-neutral-200 p-4"><div className="flex items-start justify-between"><div><h3 className="font-black">{method.nome}</h3><p className="mt-1 text-xs uppercase text-neutral-400">{method.tipo}</p></div><button type="button" onClick={() => void toggleMethod(method)} className={`relative h-6 w-11 rounded-full ${method.ativo ? 'bg-indigo-600' : 'bg-neutral-300'}`}><span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${method.ativo ? 'translate-x-5' : ''}`} /></button></div><p className="mt-3 line-clamp-3 text-sm text-neutral-500">{method.instrucoes || 'Sem instruções.'}</p><button type="button" onClick={() => setMethodForm({ ...method })} className="mt-4 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-black">Editar</button></article>)}</div></Card></section>}

    {activeTab === 'calculadoras' && <CalculatorProAdminPanel />}

    {activeTab === 'indicacao' && <Card title="Programa de indicação" icon={Users}><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Recompensa do indicador" value={value('indicador_recompensa_tipo', 'carteira')} onChange={(next) => setValue('indicador_recompensa_tipo', next)} options={[['carteira', 'Carteira'], ['pontos', 'Pontos'], ['ambos', 'Ambos']]} /><SelectField label="Recompensa do indicado" value={value('indicado_recompensa_tipo', 'desconto')} onChange={(next) => setValue('indicado_recompensa_tipo', next)} options={[['desconto', 'Desconto'], ['pontos', 'Pontos'], ['ambos', 'Ambos']]} /><NumberField label="Limite na carteira" value={value('indicador_limite_carteira', value('bonus_indicador', '20'))} onChange={(next) => { setValue('indicador_limite_carteira', next); setValue('bonus_indicador', next); }} /><NumberField label="Pontos do indicador" value={value('indicador_valor_pontos', '50')} onChange={(next) => setValue('indicador_valor_pontos', next)} /><NumberField label="Desconto do indicado (%)" value={value('indicado_desconto_porcentagem', value('desconto_indicado_porcentagem', '10'))} onChange={(next) => { setValue('indicado_desconto_porcentagem', next); setValue('desconto_indicado_porcentagem', next); }} /><NumberField label="Pontos do indicado" value={value('indicado_valor_pontos', '50')} onChange={(next) => setValue('indicado_valor_pontos', next)} /><label className="block text-sm font-bold sm:col-span-2">Mensagem de indicação<textarea rows={5} value={value('template_mensagem_indicacao', '')} onChange={(event) => setValue('template_mensagem_indicacao', event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label></div><SaveButton saving={saving} onClick={() => void saveSettings(['indicador_recompensa_tipo', 'indicador_limite_carteira', 'indicador_valor_pontos', 'indicado_recompensa_tipo', 'indicado_desconto_porcentagem', 'indicado_valor_pontos', 'template_mensagem_indicacao', 'bonus_indicador', 'desconto_indicado_porcentagem'], 'Programa de indicação salvo.')} /></Card>}

    {activeTab === 'whatsapp' && <Card title="Botão flutuante do WhatsApp" icon={MessageSquare}><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Ativo" value={value('whatsapp_float_ativo', 'true')} onChange={(next) => setValue('whatsapp_float_ativo', next)} options={[['true', 'Ativo'], ['false', 'Desativado']]} /><TextField label="Telefone" value={value('whatsapp_float_telefone', '')} onChange={(next) => setValue('whatsapp_float_telefone', next.replace(/\D/g, ''))} /><TextField label="Tooltip" value={value('whatsapp_float_tooltip', 'Falar no WhatsApp')} onChange={(next) => setValue('whatsapp_float_tooltip', next)} /><SelectField label="Tamanho" value={value('whatsapp_float_tamanho', 'M')} onChange={(next) => setValue('whatsapp_float_tamanho', next)} options={[['P', 'Pequeno'], ['M', 'Médio'], ['G', 'Grande']]} /><SelectField label="Posição" value={value('whatsapp_float_posicao', 'direita')} onChange={(next) => setValue('whatsapp_float_posicao', next)} options={[['direita', 'Direita'], ['esquerda', 'Esquerda']]} /><label className="block text-sm font-bold sm:col-span-2">Mensagem inicial<textarea rows={3} value={value('whatsapp_float_mensagem', '')} onChange={(event) => setValue('whatsapp_float_mensagem', event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label></div><SaveButton saving={saving} onClick={() => void saveSettings(['whatsapp_float_ativo', 'whatsapp_float_telefone', 'whatsapp_float_mensagem', 'whatsapp_float_tamanho', 'whatsapp_float_posicao', 'whatsapp_float_tooltip'], 'Configurações do WhatsApp salvas.')} /></Card>}

    {activeTab === 'portal' && <Card title="Modal de indicação no portal" icon={Layout}><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Ativo" value={value('modal_indicacao_ativo', 'true')} onChange={(next) => setValue('modal_indicacao_ativo', next)} options={[['true', 'Ativo'], ['false', 'Desativado']]} /><SelectField label="Tamanho" value={value('modal_indicacao_tamanho', 'md')} onChange={(next) => setValue('modal_indicacao_tamanho', next)} options={[['sm', 'Pequeno'], ['md', 'Médio'], ['lg', 'Grande']]} /><TextField label="Título" value={value('modal_indicacao_titulo', 'Você foi indicado!')} onChange={(next) => setValue('modal_indicacao_titulo', next)} /><TextField label="Texto do botão" value={value('modal_indicacao_texto_botao', 'Solicitar Serviços')} onChange={(next) => setValue('modal_indicacao_texto_botao', next)} /><TextField label="URL do botão" value={value('modal_indicacao_url_botao', '')} onChange={(next) => setValue('modal_indicacao_url_botao', next)} /><TextField label="Módulo de destino" value={value('modal_indicacao_modulo_destino', 'orcamentos')} onChange={(next) => setValue('modal_indicacao_modulo_destino', next)} /><label className="block text-sm font-bold sm:col-span-2">Descrição<textarea rows={4} value={value('modal_indicacao_descricao', '')} onChange={(event) => setValue('modal_indicacao_descricao', event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label></div><SaveButton saving={saving} onClick={() => void saveSettings(['modal_indicacao_ativo', 'modal_indicacao_titulo', 'modal_indicacao_descricao', 'modal_indicacao_url_botao', 'modal_indicacao_acao_botao', 'modal_indicacao_modulo_destino', 'modal_indicacao_texto_botao', 'modal_indicacao_tamanho'], 'Configurações do portal salvas.')} /></Card>}

    {activeTab === 'seguranca' && <Card title="Segurança de credenciais" icon={LockKeyhole}><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><p className="font-black">Alteração de credencial administrativa removida deste formulário.</p><p className="mt-2">Segredos de autenticação não são mais lidos ou gravados em <code>system_settings</code> por uma RPC genérica. A rotação deve ocorrer por um fluxo dedicado, com hash, revogação de sessões e registro de auditoria.</p></div></Card>}

    {methodForm && <Overlay onClose={() => setMethodForm(null)}><div className="flex items-center justify-between"><h2 className="text-2xl font-black">{methodForm.id ? 'Editar' : 'Nova'} forma de pagamento</h2><button type="button" onClick={() => setMethodForm(null)}><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4"><TextField label="Nome" value={methodForm.nome || ''} onChange={(next) => setMethodForm({ ...methodForm, nome: next })} /><TextField label="Slug" value={methodForm.slug || ''} onChange={(next) => setMethodForm({ ...methodForm, slug: next })} /><TextField label="Tipo" value={methodForm.tipo || 'manual'} onChange={(next) => setMethodForm({ ...methodForm, tipo: next })} /><label className="block text-sm font-bold">Instruções<textarea rows={4} value={methodForm.instrucoes || ''} onChange={(event) => setMethodForm({ ...methodForm, instrucoes: event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label></div><div className="mt-8 flex justify-end gap-3"><button type="button" onClick={() => setMethodForm(null)} className="rounded-xl border border-neutral-200 px-5 py-3 font-bold">Cancelar</button><button type="button" disabled={saving} onClick={() => void saveMethod()} className="rounded-xl bg-indigo-600 px-6 py-3 font-black text-white disabled:opacity-50">Salvar</button></div></Overlay>}
  </div>;
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="mb-6 flex items-center gap-3 text-lg font-black"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></span>{title}</h2>{children}</section>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-bold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-bold">{label}<input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="block text-sm font-bold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function SaveButton({ saving, onClick, label = 'Salvar configurações' }: { saving: boolean; onClick: () => void; label?: string }) {
  return <button type="button" disabled={saving} onClick={onClick} className="mt-6 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Salvando...' : label}</button>;
}
