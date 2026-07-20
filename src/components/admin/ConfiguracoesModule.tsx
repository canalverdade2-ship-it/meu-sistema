import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, Building2, Wallet, Shield, Save, RefreshCw, MessageSquare, Key, Edit2, Plus, Globe, CreditCard, Users, Star, Tag, ArrowRight, Monitor, ExternalLink, Eye, EyeOff, Layout } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { handleError } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { callAdminRpc } from '../../lib/adminRpc';

export function ConfiguracoesModule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);
  const [settings, setSettings] = useState<any[]>([]);
  const [metodos, setMetodos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'empresa' | 'financeiro' | 'indicacao' | 'seguranca' | 'whatsapp' | 'portal'>('empresa');
  const [isMetodoModalOpen, setIsMetodoModalOpen] = useState(false);
  const [selectedMetodo, setSelectedMetodo] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: empresaData } = await supabase.from('empresa').select('*').maybeSingle();
      const { data: settingsData } = await supabase.from('system_settings').select('*');
      const { data: metodosData } = await supabase.from('formas_pagamento').select('*').order('nome');
      
      if (empresaData) setEmpresa(empresaData);
      if (settingsData) setSettings(settingsData);
      if (metodosData) setMetodos(metodosData);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('admin-settings-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSaveEmpresa = async () => {
    if (!empresa) return;
    setSaving(true);
    try {
      let error;
      const payload = {
        razao_social: empresa.razao_social,
        cnpj: empresa.cnpj,
        telefone: empresa.telefone,
        responsavel: empresa.responsavel
      };

      if (empresa.id) {
        const { error: updateError } = await supabase
          .from('empresa')
          .update(payload)
          .eq('id', empresa.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('empresa')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      toast.success('Dados da empresa salvos com sucesso!');
      fetchData();
    } catch (error) {
      toast.error(handleError(error, 'Erro ao salvar dados da empresa'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMetodo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nome: selectedMetodo.nome,
        slug: selectedMetodo.slug || selectedMetodo.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-'),
        tipo: selectedMetodo.tipo,
        instrucoes: selectedMetodo.instrucoes,
        ativo: selectedMetodo.ativo ?? true
      };

      let error;
      if (selectedMetodo.id) {
        const { error: updateError } = await supabase
          .from('formas_pagamento')
          .update(payload)
          .eq('id', selectedMetodo.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('formas_pagamento')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      toast.success('Forma de pagamento salva!');
      setIsMetodoModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(handleError(error, 'Erro ao salvar forma de pagamento'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMetodo = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('formas_pagamento')
        .update({ ativo: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleSaveSetting = async (key: string, value: string) => {
    setSaving(true);
    try {
      const success = await callAdminRpc<boolean>('gsa_admin_upsert_settings', {
        p_settings: [{ key, value }]
      });

      if (!success) throw new Error('Acesso negado ou erro ao salvar');
      toast.success('Configuração salva com sucesso!');
      fetchData();
    } catch (error) {
      toast.error(handleError(error, 'Erro ao salvar configuração'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFinanceSettings = async () => {
    setSaving(true);
    try {
      const newSettings = [
        { key: 'valor_minimo_saque', value: getSetting('valor_minimo_saque', '50') },
        { key: 'vencimento_padrao_servicos', value: getSetting('vencimento_padrao_servicos', '10') },
        { key: 'vencimento_padrao_produtos', value: getSetting('vencimento_padrao_produtos', '10') },
        { key: 'loja_taxa_entrega_padrao', value: getSetting('loja_taxa_entrega_padrao', '0') }
      ];

      const success = await callAdminRpc<boolean>('gsa_admin_upsert_settings', {
        p_settings: newSettings
      });

      if (!success) throw new Error('Acesso negado ou erro ao salvar');
      toast.success('Configurações financeiras salvas com sucesso!');
      fetchData();
    } catch (error) {
      toast.error(handleError(error, 'Erro ao salvar configurações financeiras'));
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const getSetting = (key: string, defaultValue: string = '') => {
    return settings.find(s => s.key === key)?.value || defaultValue;
  };

  const updateSettingLocal = (key: string, value: string) => {
    const newSettings = [...settings];
    const s = newSettings.find(x => x.key === key);
    if (s) {
      s.value = value;
    } else {
      newSettings.push({ key, value });
    }
    setSettings(newSettings);
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in slide-in-from-bottom-4">
      {/* Module Header */}
      <div className="bg-[#1a1a1a] p-3 md:p-4 rounded-[2rem] md:rounded-[2.5rem] text-white relative shadow-2xl mb-3">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col gap-3 md:gap-3">
          <div className="flex flex-row items-center justify-between gap-6 border-b border-white/5 pb-3">
            <div className="flex items-center gap-4">
              <div className="h-6 w-1 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]"></div>
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-100 to-neutral-400 whitespace-nowrap overflow-hidden">
                Configurações Globais
              </h1>
            </div>
            <Settings className="hidden md:block h-8 w-8 text-white/5" />
          </div>

          <div className="flex flex-wrap justify-center md:justify-start gap-1.5">
            {[
              { id: 'empresa', label: 'Empresa', icon: Building2 },
              { id: 'financeiro', label: 'Financeiro', icon: Wallet },
              { id: 'indicacao', label: 'Indicação', icon: RefreshCw },
              { id: 'seguranca', label: 'Segurança', icon: Shield },
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
              { id: 'portal', label: 'Portal Cliente', icon: Monitor }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-1 md:flex-none items-center justify-center gap-2 py-2.5 px-3 md:px-4 rounded-xl transition-all text-[9px] md:text-[10px] uppercase tracking-widest border
                    ${isActive 
                      ? 'bg-white text-indigo-600 shadow-lg border-white border-b-4 border-b-indigo-500' 
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/5'}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'empresa' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Dados da Empresa */}
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
              <div className="mb-6 flex items-center gap-3">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-neutral-900">Dados da Empresa</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Razão Social</label>
                  <input
                    type="text"
                    value={empresa?.razao_social || ''}
                    onChange={e => setEmpresa({ ...empresa, razao_social: e.target.value })}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">CNPJ</label>
                  <input
                    type="text"
                    value={empresa?.cnpj || ''}
                    onChange={e => setEmpresa({ ...empresa, cnpj: e.target.value })}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Telefone</label>
                  <input
                    type="text"
                    value={empresa?.telefone || ''}
                    onChange={e => setEmpresa({ ...empresa, telefone: e.target.value })}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Responsável</label>
                  <input
                    type="text"
                    value={empresa?.responsavel || ''}
                    onChange={e => setEmpresa({ ...empresa, responsavel: e.target.value })}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={handleSaveEmpresa}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 disabled:opacity-50 md:w-auto"
                >
                  <Save className="h-4 w-4" />
                  Salvar Dados da Empresa
                </button>
              </div>
            </div>

            {/* Código de Cadastro Padrão */}
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
              <div className="mb-6 flex items-center gap-3">
                <Key className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-neutral-900">Código de Cadastro Padrão</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Status do Código</label>
                  <div className="flex gap-2">
                    <select
                      value={getSetting('codigo_cadastro_padrao_ativo', 'false')}
                      onChange={e => updateSettingLocal('codigo_cadastro_padrao_ativo', e.target.value)}
                      className="flex-1 rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Desativado</option>
                    </select>
                    <button
                      onClick={() => handleSaveSetting('codigo_cadastro_padrao_ativo', getSetting('codigo_cadastro_padrao_ativo'))}
                      disabled={saving}
                      className="rounded-xl bg-neutral-100 px-4 py-3 text-neutral-600 hover:bg-neutral-200"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Código</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getSetting('codigo_cadastro_padrao', 'BEMVINDO')}
                      onChange={e => updateSettingLocal('codigo_cadastro_padrao', e.target.value.toUpperCase())}
                      className="flex-1 rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 uppercase font-mono"
                    />
                    <button
                      onClick={() => handleSaveSetting('codigo_cadastro_padrao', getSetting('codigo_cadastro_padrao'))}
                      disabled={saving}
                      className="rounded-xl bg-neutral-100 px-4 py-3 text-neutral-600 hover:bg-neutral-200"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Tipo de Bônus</label>
                  <div className="flex gap-2">
                    <select
                      value={getSetting('bonus_cadastro_tipo', 'pontos')}
                      onChange={e => updateSettingLocal('bonus_cadastro_tipo', e.target.value)}
                      className="flex-1 rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="pontos">Pontos</option>
                      <option value="carteira">Valor em Carteira</option>
                    </select>
                    <button
                      onClick={() => handleSaveSetting('bonus_cadastro_tipo', getSetting('bonus_cadastro_tipo'))}
                      disabled={saving}
                      className="rounded-xl bg-neutral-100 px-4 py-3 text-neutral-600 hover:bg-neutral-200"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Valor do Bônus</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={getSetting('bonus_cadastro_valor', '100')}
                      onChange={e => updateSettingLocal('bonus_cadastro_valor', e.target.value)}
                      className="flex-1 rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => handleSaveSetting('bonus_cadastro_valor', getSetting('bonus_cadastro_valor'))}
                      disabled={saving}
                      className="rounded-xl bg-neutral-100 px-4 py-3 text-neutral-600 hover:bg-neutral-200"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
              <div className="mb-6 flex items-center gap-3">
                <Wallet className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-neutral-900">Financeiro</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Valor Mínimo para Saque (R$)</label>
                  <input
                    type="number"
                    value={getSetting('valor_minimo_saque', '50')}
                    onChange={e => updateSettingLocal('valor_minimo_saque', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 font-black"
                  />
                  <p className="mt-2 text-[10px] text-neutral-400">Valor mínimo permitido para saque.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Vencimento Padrão (Serviços)</label>
                  <input
                    type="number"
                    value={getSetting('vencimento_padrao_servicos', '10')}
                    onChange={e => updateSettingLocal('vencimento_padrao_servicos', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 font-black"
                    min="1"
                  />
                  <p className="mt-2 text-[10px] text-neutral-400">Dias após o faturamento para vencimento de serviços.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Vencimento Padrão (Produtos)</label>
                  <input
                    type="number"
                    value={getSetting('vencimento_padrao_produtos', '10')}
                    onChange={e => updateSettingLocal('vencimento_padrao_produtos', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 font-black"
                    min="1"
                  />
                  <p className="mt-2 text-[10px] text-neutral-400">Dias após o faturamento para vencimento de produtos.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Taxa de Entrega Fixa (GSA Store)</label>
                  <input
                    type="number"
                    value={getSetting('loja_taxa_entrega_padrao', '0')}
                    onChange={e => updateSettingLocal('loja_taxa_entrega_padrao', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 font-black"
                    min="0"
                    step="0.01"
                  />
                  <p className="mt-2 text-[10px] text-neutral-400">Valor fixo de frete aplicado a produtos físicos na loja.</p>
                </div>
              </div>

              <div className="mt-6 border-t border-neutral-100 pt-6">
                <button
                  onClick={handleSaveFinanceSettings}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-black disabled:opacity-50 md:w-auto"
                >
                  <Save className="h-4 w-4" />
                  Salvar Configurações Financeiras
                </button>
              </div>
            </div>

            {/* Formas de Pagamento */}
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-neutral-900">Formas de Pagamento</h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedMetodo({ nome: '', tipo: 'manual', instrucoes: '', ativo: true });
                    setIsMetodoModalOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Nova Forma
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {metodos.map((metodo) => (
                  <div key={metodo.id} className="group relative rounded-2xl bg-neutral-50 p-5 ring-1 ring-neutral-200 transition-all hover:ring-indigo-500/30">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-bold text-neutral-900">{metodo.nome}</h4>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{metodo.tipo}</span>
                      </div>
                      <button
                        onClick={() => handleToggleMetodo(metodo.id, metodo.ativo)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${metodo.ativo ? 'bg-indigo-600' : 'bg-neutral-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${metodo.ativo ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <p className="text-xs text-neutral-500 line-clamp-2 mb-4 h-8">
                      {metodo.instrucoes || 'Nenhuma instrução cadastrada.'}
                    </p>

                    <div className="flex items-center gap-2 pt-4 border-t border-neutral-200/50">
                      <button
                        onClick={() => {
                          setSelectedMetodo(metodo);
                          setIsMetodoModalOpen(true);
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-neutral-600 shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-50 transition-all"
                      >
                        <Edit2 className="h-3 w-3" />
                        Configurar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'indicacao' && (() => {
          // Leitura local dos tipos para controle de visibilidade dos campos
          const indicadorTipo = getSetting('indicador_recompensa_tipo', getSetting('bonus_indicador', '20') !== '0' ? 'carteira' : 'carteira');
          const indicadoTipo = getSetting('indicado_recompensa_tipo', 'desconto');

          const handleSaveAllIndicacao = async () => {
            setSaving(true);
            try {
              const newSettings = [
                { key: 'indicador_recompensa_tipo', value: getSetting('indicador_recompensa_tipo', 'carteira') },
                { key: 'indicador_limite_carteira', value: getSetting('indicador_limite_carteira', getSetting('bonus_indicador', '20')) },
                { key: 'indicador_valor_pontos', value: getSetting('indicador_valor_pontos', '50') },
                { key: 'indicado_recompensa_tipo', value: getSetting('indicado_recompensa_tipo', 'desconto') },
                { key: 'indicado_desconto_porcentagem', value: getSetting('indicado_desconto_porcentagem', getSetting('desconto_indicado_porcentagem', '10')) },
                { key: 'indicado_valor_pontos', value: getSetting('indicado_valor_pontos', '50') },
                { key: 'template_mensagem_indicacao', value: getSetting('template_mensagem_indicacao', '') },
                // Manter chaves legadas em sync
                { key: 'bonus_indicador', value: getSetting('indicador_limite_carteira', getSetting('bonus_indicador', '20')) },
                { key: 'desconto_indicado_porcentagem', value: getSetting('indicado_desconto_porcentagem', getSetting('desconto_indicado_porcentagem', '10')) },
              ];
              const success = await callAdminRpc<boolean>('gsa_admin_upsert_settings', {
                p_settings: newSettings
              });
              if (!success) throw new Error('Erro ao salvar');
              toast.success('Configurações de indicação salvas com sucesso!');
              fetchData();
            } catch (error) {
              toast.error(handleError(error, 'Erro ao salvar configurações de indicação'));
            } finally {
              setSaving(false);
            }
          };

          // Preview dinâmico
          const previewIndicador = (() => {
            const parts: string[] = [];
            if (indicadorTipo === 'carteira' || indicadorTipo === 'ambos')
              parts.push(`Até R$ ${parseFloat(getSetting('indicador_limite_carteira', getSetting('bonus_indicador', '20'))).toFixed(2).replace('.', ',')}`);
            if (indicadorTipo === 'pontos' || indicadorTipo === 'ambos')
              parts.push(`${getSetting('indicador_valor_pontos', '50')} pontos`);
            return parts.join(' + ') || '—';
          })();

          const previewIndicado = (() => {
            const parts: string[] = [];
            if (indicadoTipo === 'desconto' || indicadoTipo === 'ambos')
              parts.push(`${getSetting('indicado_desconto_porcentagem', getSetting('desconto_indicado_porcentagem', '10'))}% de desconto`);
            if (indicadoTipo === 'pontos' || indicadoTipo === 'ambos')
              parts.push(`${getSetting('indicado_valor_pontos', '50')} pontos`);
            return parts.join(' + ') || '—';
          })();

          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

              {/* ── INDICADOR ── */}
              <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50">
                    <Users className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">Quem Indica — Recompensa do Indicador</h3>
                    <p className="text-xs text-neutral-400">Liberada após o pagamento da 1ª fatura do indicado.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Tipo */}
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Tipo de Recompensa</label>
                    <select
                      value={getSetting('indicador_recompensa_tipo', 'carteira')}
                      onChange={e => updateSettingLocal('indicador_recompensa_tipo', e.target.value)}
                      className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="carteira">💰 Valor na Carteira (R$)</option>
                      <option value="pontos">⭐ Pontos</option>
                      <option value="ambos">💰⭐ Ambos (Carteira + Pontos)</option>
                    </select>
                  </div>

                  {/* Limite Carteira */}
                  {(indicadorTipo === 'carteira' || indicadorTipo === 'ambos') && (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Limite Máximo em Carteira (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={getSetting('indicador_limite_carteira', getSetting('bonus_indicador', '20'))}
                        onChange={e => {
                          updateSettingLocal('indicador_limite_carteira', e.target.value);
                          updateSettingLocal('bonus_indicador', e.target.value);
                        }}
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1.5 text-[10px] text-neutral-400">O indicador recebe 10% do valor bruto da 1ª fatura do indicado, limitado a este valor.</p>
                    </div>
                  )}

                  {/* Valor Pontos */}
                  {(indicadorTipo === 'pontos' || indicadorTipo === 'ambos') && (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Pontos Creditados</label>
                      <input
                        type="number"
                        min="0"
                        value={getSetting('indicador_valor_pontos', '50')}
                        onChange={e => updateSettingLocal('indicador_valor_pontos', e.target.value)}
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1.5 text-[10px] text-neutral-400">Pontos creditados ao indicador após o pagamento da 1ª fatura do indicado.</p>
                    </div>
                  )}
                </div>

                {/* Preview */}
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-emerald-50 px-5 py-4 ring-1 ring-emerald-100">
                  <ArrowRight className="h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-sm text-emerald-800">
                    <span className="font-bold">Preview:</span> O indicador ganhará <span className="font-bold">{previewIndicador}</span> após o pagamento da 1ª fatura.
                  </p>
                </div>
              </div>

              {/* ── INDICADO ── */}
              <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50">
                    <Star className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">Quem é Indicado — Recompensa do Indicado</h3>
                    <p className="text-xs text-neutral-400">Desconto: aplicado no 1º orçamento. Pontos: creditados no cadastro.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Tipo */}
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Tipo de Recompensa</label>
                    <select
                      value={getSetting('indicado_recompensa_tipo', 'desconto')}
                      onChange={e => updateSettingLocal('indicado_recompensa_tipo', e.target.value)}
                      className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="desconto">🏷️ Desconto na Fatura (%)</option>
                      <option value="pontos">⭐ Pontos</option>
                      <option value="ambos">🏷️⭐ Ambos (Desconto + Pontos)</option>
                    </select>
                  </div>

                  {/* Desconto % */}
                  {(indicadoTipo === 'desconto' || indicadoTipo === 'ambos') && (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Porcentagem de Desconto (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={getSetting('indicado_desconto_porcentagem', getSetting('desconto_indicado_porcentagem', '10'))}
                        onChange={e => {
                          updateSettingLocal('indicado_desconto_porcentagem', e.target.value);
                          updateSettingLocal('desconto_indicado_porcentagem', e.target.value);
                        }}
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1.5 text-[10px] text-neutral-400">Desconto aplicado automaticamente ao gerar o 1º orçamento do indicado.</p>
                    </div>
                  )}

                  {/* Pontos do indicado */}
                  {(indicadoTipo === 'pontos' || indicadoTipo === 'ambos') && (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Pontos Creditados no Cadastro</label>
                      <input
                        type="number"
                        min="0"
                        value={getSetting('indicado_valor_pontos', '50')}
                        onChange={e => updateSettingLocal('indicado_valor_pontos', e.target.value)}
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1.5 text-[10px] text-neutral-400">Pontos creditados automaticamente ao indicado no momento do cadastro.</p>
                    </div>
                  )}
                </div>

                {/* Preview */}
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-indigo-50 px-5 py-4 ring-1 ring-indigo-100">
                  <ArrowRight className="h-4 w-4 shrink-0 text-indigo-600" />
                  <p className="text-sm text-indigo-800">
                    <span className="font-bold">Preview:</span> O indicado ganhará <span className="font-bold">{previewIndicado}</span>.
                  </p>
                </div>
              </div>

              {/* ── TEMPLATE WHATSAPP ── */}
              <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
                <div className="mb-6 flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-neutral-900">Modelo de Mensagem (WhatsApp)</h3>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Mensagem de Indicação</label>
                  <textarea
                    rows={5}
                    value={getSetting('template_mensagem_indicacao', '')}
                    onChange={e => updateSettingLocal('template_mensagem_indicacao', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="mt-2 text-[10px] text-neutral-400 leading-relaxed">
                    Variáveis: <code className="bg-neutral-100 px-1 rounded">{'{nome_indicador}'}</code> <code className="bg-neutral-100 px-1 rounded">{'{nome_indicado}'}</code> <code className="bg-neutral-100 px-1 rounded">{'{codigo}'}</code> <code className="bg-neutral-100 px-1 rounded">{'{desconto}'}</code> <code className="bg-neutral-100 px-1 rounded">{'{recompensa_indicado}'}</code> <code className="bg-neutral-100 px-1 rounded">{'{recompensa_indicador}'}</code>
                  </p>
                </div>
              </div>

              {/* ── BOTÃO SALVAR TUDO ── */}
              <button
                onClick={handleSaveAllIndicacao}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                {saving ? 'Salvando...' : 'Salvar Todas as Configurações de Indicação'}
              </button>
            </div>
          );
        })()}

        {activeTab === 'whatsapp' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-[#25D366]" />
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">Botão Flutuante (WhatsApp)</h3>
                    <p className="text-xs text-neutral-500">Configurações globais do botão de ajuda exibido para os clientes.</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const newSettings = [
                        { key: 'whatsapp_float_ativo', value: String(getSetting('whatsapp_float_ativo', 'true')) },
                        { key: 'whatsapp_float_telefone', value: String(getSetting('whatsapp_float_telefone', '11920857756')) },
                        { key: 'whatsapp_float_mensagem', value: String(getSetting('whatsapp_float_mensagem', 'Olá, preciso de ajuda com a plataforma!')) },
                        { key: 'whatsapp_float_tamanho', value: String(getSetting('whatsapp_float_tamanho', 'M')) },
                        { key: 'whatsapp_float_posicao', value: String(getSetting('whatsapp_float_posicao', 'direita')) },
                        { key: 'whatsapp_float_tooltip', value: String(getSetting('whatsapp_float_tooltip', 'Falar no WhatsApp')) }
                      ];

                      console.log('Enviando configurações:', newSettings);

                      const success = await callAdminRpc<boolean>('gsa_admin_upsert_settings', {
                        p_settings: newSettings
                      });

                      if (success === false) throw new Error('Permissão negada ou erro no banco de dados.');
                      
                      toast.success('Configurações do WhatsApp salvas!');
                      fetchData();
                    } catch (error) {
                      console.error("Erro ao salvar WhatsApp config:", error);
                      toast.error(handleError(error, 'Erro ao salvar WhatsApp'));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition"
                >
                  <Save className="h-4 w-4" />
                  Salvar Configurações
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition">
                    <input
                      type="checkbox"
                      checked={getSetting('whatsapp_float_ativo', 'true') === 'true'}
                      onChange={e => updateSettingLocal('whatsapp_float_ativo', e.target.checked ? 'true' : 'false')}
                      className="h-5 w-5 rounded border-neutral-300 text-[#25D366] focus:ring-[#25D366]"
                    />
                    <div>
                      <p className="font-bold text-neutral-800">Ativar Botão do WhatsApp</p>
                      <p className="text-xs text-neutral-500">Se desmarcado, o botão ficará oculto em todo o sistema.</p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Telefone de Suporte</label>
                  <input
                    type="text"
                    value={getSetting('whatsapp_float_telefone', '11920857756')}
                    onChange={e => updateSettingLocal('whatsapp_float_telefone', e.target.value)}
                    placeholder="Ex: 11999999999"
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-[10px] text-neutral-400">Insira apenas números (DDD + Telefone).</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Tooltip do Botão</label>
                  <input
                    type="text"
                    value={getSetting('whatsapp_float_tooltip', 'Falar no WhatsApp')}
                    onChange={e => updateSettingLocal('whatsapp_float_tooltip', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-[10px] text-neutral-400">Texto exibido quando o mouse passa sobre o ícone.</p>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Mensagem Inicial</label>
                  <textarea
                    rows={2}
                    value={getSetting('whatsapp_float_mensagem', 'Olá, preciso de ajuda com a plataforma!')}
                    onChange={e => updateSettingLocal('whatsapp_float_mensagem', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-[10px] text-neutral-400">A mensagem já virá preenchida no celular do cliente ao clicar.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Tamanho do Ícone</label>
                  <select
                    value={getSetting('whatsapp_float_tamanho', 'M')}
                    onChange={e => updateSettingLocal('whatsapp_float_tamanho', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="P">Pequeno (Discreto)</option>
                    <option value="M">Médio (Padrão)</option>
                    <option value="G">Grande (Destaque)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Posição na Tela</label>
                  <select
                    value={getSetting('whatsapp_float_posicao', 'direita')}
                    onChange={e => updateSettingLocal('whatsapp_float_posicao', e.target.value)}
                    className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="direita">Canto Inferior Direito</option>
                    <option value="esquerda">Canto Inferior Esquerdo</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'seguranca' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
              <div className="mb-6 flex items-center gap-3">
                <Shield className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-neutral-900">Segurança e Acesso</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Alterar Código de Acesso Administrativo</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Novo código (mín. 8 caracteres)"
                      value={getSetting('admin_access_code_new')}
                      onChange={e => updateSettingLocal('admin_access_code_new', e.target.value)}
                      className="flex-1 rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-mono tracking-widest focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <button
                      onClick={async () => {
                        const newCode = getSetting('admin_access_code_new');
                        if (!newCode || newCode.length < 8) return toast.error('O código deve ter pelo menos 8 caracteres.');
                        const success = await callAdminRpc<boolean>('gsa_admin_upsert_settings', {
                          p_settings: [{ key: 'admin_access_code', value: newCode }]
                        });
                        
                        if (!success) toast.error('Erro ao salvar. Verifique permissões.');
                        else {
                          toast.success('Código alterado com sucesso!');
                          updateSettingLocal('admin_access_code_new', '');
                        }
                      }}
                      disabled={saving}
                      className="rounded-xl bg-neutral-100 px-4 py-3 text-neutral-600 hover:bg-neutral-200"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-neutral-400">Por segurança, o código atual não é exibido. Insira um novo código para sobrescrever.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'portal' && (() => {
          const handleSavePortalSettings = async () => {
            setSaving(true);
            try {
              const newSettings = [
                { key: 'modal_indicacao_ativo', value: getSetting('modal_indicacao_ativo', 'true') },
                { key: 'modal_indicacao_titulo', value: getSetting('modal_indicacao_titulo', 'Você foi indicado!') },
                { key: 'modal_indicacao_descricao', value: getSetting('modal_indicacao_descricao', 'Para validar a segunda etapa da sua indicação e garantir seu bônus, solicite um serviço e aplique seu voucher.') },
                { key: 'modal_indicacao_url_botao', value: getSetting('modal_indicacao_url_botao', 'https://getsemani-gsa.netlify.app/') },
                { key: 'modal_indicacao_acao_botao', value: getSetting('modal_indicacao_acao_botao', 'url') },
                { key: 'modal_indicacao_modulo_destino', value: getSetting('modal_indicacao_modulo_destino', 'orcamentos') },
                { key: 'modal_indicacao_texto_botao', value: getSetting('modal_indicacao_texto_botao', 'Solicitar Serviços') },
                { key: 'modal_indicacao_tamanho', value: getSetting('modal_indicacao_tamanho', 'md') },
              ];
              const success = await callAdminRpc<boolean>('gsa_admin_upsert_settings', {
                p_settings: newSettings
              });
              if (!success) throw new Error('Erro ao salvar');
              toast.success('Configurações do portal salvas!');
              fetchData();
            } catch (error) {
              toast.error(handleError(error, 'Erro ao salvar configurações do portal'));
            } finally {
              setSaving(false);
            }
          };

          const isModalAtivo = getSetting('modal_indicacao_ativo', 'true') === 'true';

          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              {/* Modal de Indicação */}
              <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50">
                      <Layout className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900">Modal de Indicação (1º Login)</h3>
                      <p className="text-xs text-neutral-400">Controla o popup exibido ao cliente indicado no primeiro acesso.</p>
                    </div>
                  </div>
                  {/* Toggle rápido ativo/inativo */}
                  <label className="flex cursor-pointer items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      {isModalAtivo ? 'Ativo' : 'Inativo'}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateSettingLocal('modal_indicacao_ativo', isModalAtivo ? 'false' : 'true')}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        isModalAtivo ? 'bg-indigo-600' : 'bg-neutral-300'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        isModalAtivo ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </label>
                </div>

                <div className={`space-y-6 transition-opacity ${isModalAtivo ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Título */}
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Título do Modal</label>
                      <input
                        type="text"
                        value={getSetting('modal_indicacao_titulo', 'Você foi indicado!')}
                        onChange={e => updateSettingLocal('modal_indicacao_titulo', e.target.value)}
                        placeholder="Ex: Você foi indicado!"
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Descrição */}
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Descrição / Corpo do Modal</label>
                      <textarea
                        rows={3}
                        value={getSetting('modal_indicacao_descricao', 'Para validar a segunda etapa da sua indicação e garantir seu bônus, solicite um serviço e aplique seu voucher.')}
                        onChange={e => updateSettingLocal('modal_indicacao_descricao', e.target.value)}
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-[10px] text-neutral-400">Este texto aparece como parágrafo introdutório dentro do modal.</p>
                    </div>

                    {/* Ação do Botão */}
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Ação do Botão Principal</label>
                      <select
                        value={getSetting('modal_indicacao_acao_botao', 'url')}
                        onChange={e => updateSettingLocal('modal_indicacao_acao_botao', e.target.value)}
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="url">Abrir URL Externa</option>
                        <option value="modulo">Ir para Módulo do Sistema</option>
                      </select>
                    </div>

                    {/* URL ou Módulo */}
                    {getSetting('modal_indicacao_acao_botao', 'url') === 'url' ? (
                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">URL do Botão Principal</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            value={getSetting('modal_indicacao_url_botao', 'https://getsemani-gsa.netlify.app/')}
                            onChange={e => updateSettingLocal('modal_indicacao_url_botao', e.target.value)}
                            placeholder="https://..."
                            className="flex-1 rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                          />
                          <a
                            href={getSetting('modal_indicacao_url_botao', 'https://getsemani-gsa.netlify.app/')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 hover:bg-indigo-50 hover:text-indigo-600 transition"
                            title="Testar URL"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="mt-1 text-[10px] text-neutral-400">O cliente será redirecionado para esta URL ao clicar no botão principal.</p>
                      </div>
                    ) : (
                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Módulo de Destino</label>
                        <select
                          value={getSetting('modal_indicacao_modulo_destino', 'orcamentos')}
                          onChange={e => updateSettingLocal('modal_indicacao_modulo_destino', e.target.value)}
                          className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        >
                          <option value="dashboard">Dashboard</option>
                          <option value="gsa_store">GSA Store Hub</option>
                          <option value="credito_loja">Meu Crédito</option>
                          <option value="orcamentos">Meus Orçamentos</option>
                          <option value="servicos">Meus Serviços</option>
                          <option value="produtos">Meus Produtos</option>
                          <option value="assinaturas">Minhas Assinaturas</option>
                          <option value="emprestimos">Meus Empréstimos</option>
                          <option value="transferencias">Transferências</option>
                          <option value="financeiro">Financeiro</option>
                          <option value="promocoes">Promoções</option>
                          <option value="premios">Meus Prêmios</option>
                          <option value="vouchers">Vouchers</option>
                          <option value="indique-ganhe">Indique e Ganhe</option>
                          <option value="pontos">Meus Pontos</option>
                          <option value="area_vip">Área VIP</option>
                          <option value="perfil">Meu Perfil</option>
                          <option value="suporte">Suporte</option>
                        </select>
                        <p className="mt-1 text-[10px] text-neutral-400">O cliente será redirecionado para este módulo internamente sem abrir nova janela.</p>
                      </div>
                    )}

                    {/* Texto do botão */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Texto do Botão</label>
                      <input
                        type="text"
                        value={getSetting('modal_indicacao_texto_botao', 'Solicitar Serviços')}
                        onChange={e => updateSettingLocal('modal_indicacao_texto_botao', e.target.value)}
                        placeholder="Ex: Solicitar Serviços"
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Tamanho */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Tamanho do Modal</label>
                      <select
                        value={getSetting('modal_indicacao_tamanho', 'md')}
                        onChange={e => updateSettingLocal('modal_indicacao_tamanho', e.target.value)}
                        className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="sm">Pequeno</option>
                        <option value="md">Médio (Padrão)</option>
                        <option value="lg">Grande</option>
                        <option value="xl">Extra Grande</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="rounded-2xl bg-indigo-50 p-5 ring-1 ring-indigo-100">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">Prévia do Modal</p>
                    <div className={`mx-auto rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 ${
                      getSetting('modal_indicacao_tamanho', 'md') === 'sm' ? 'max-w-xs' :
                      getSetting('modal_indicacao_tamanho', 'md') === 'md' ? 'max-w-sm' :
                      getSetting('modal_indicacao_tamanho', 'md') === 'lg' ? 'max-w-md' : 'max-w-lg'
                    }`}>
                      <h4 className="text-lg font-bold text-neutral-900 tracking-tight">
                        {getSetting('modal_indicacao_titulo', 'Você foi indicado!') || 'Título do Modal'}
                      </h4>
                      <p className="mt-2 text-sm text-neutral-500 leading-relaxed">
                        {getSetting('modal_indicacao_descricao', 'Descrição...') || 'Descrição do modal...'}
                      </p>
                      <button className="mt-4 w-full rounded-xl bg-[#1a1a1a] py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2">
                        {getSetting('modal_indicacao_texto_botao', 'Solicitar Serviços') || 'Botão'}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {!isModalAtivo && (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-100">
                    <EyeOff className="h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-800">O modal está <strong>desativado</strong>. Os clientes indicados não verão este popup ao fazer login.</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleSavePortalSettings}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                {saving ? 'Salvando...' : 'Salvar Configurações do Portal'}
              </button>
            </div>
          );
        })()}
      </div>

      <Modal
        isOpen={isMetodoModalOpen}
        onClose={() => setIsMetodoModalOpen(false)}
        title={selectedMetodo?.id ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
      >
        {selectedMetodo && (
          <form onSubmit={handleSaveMetodo} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Nome Exibido</label>
                <input
                  type="text"
                  required
                  value={selectedMetodo.nome}
                  onChange={e => setSelectedMetodo({ ...selectedMetodo, nome: e.target.value })}
                  placeholder="Ex: PIX (Cópia e Cola)"
                  className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Tipo de Integração</label>
                <select
                  value={selectedMetodo.tipo}
                  onChange={e => setSelectedMetodo({ ...selectedMetodo, tipo: e.target.value })}
                  className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao">Cartão</option>
                  <option value="manual">Manual / Outros</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">Instruções para o Cliente</label>
                <textarea
                  rows={4}
                  value={selectedMetodo.instrucoes}
                  onChange={e => setSelectedMetodo({ ...selectedMetodo, instrucoes: e.target.value })}
                  placeholder="Ex: Pague o QR Code abaixo e nos envie o comprovante."
                  className="w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <p className="mt-2 text-[10px] text-neutral-400">Estas instruções aparecerão na tela final de pagamento do cliente.</p>
              </div>

              <div className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-100 flex items-center gap-3">
                <Globe className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-xs font-bold text-indigo-900">Integração com API</p>
                  <p className="text-[10px] text-indigo-700">Em breve, você poderá configurar as chaves da API do seu banco aqui para automação total.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsMetodoModalOpen(false)}
                className="flex-1 rounded-xl bg-neutral-100 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
