import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Cliente } from '../../types';

export function EnterpriseCompanyProfile({ cliente, onUpdated }: { cliente: Cliente; onUpdated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ razao_social: cliente.nome_razao || cliente.nome || '', nome_fantasia: cliente.nome || '', email_corporativo: cliente.email || '', telefone_corporativo: cliente.telefone || '', responsavel_principal: '', segmento: '', porte: '', website: '' });

  useEffect(() => {
    supabase.from('enterprise_portal_profiles').select('*').eq('cliente_id', cliente.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setForm((current) => ({ ...current, ...Object.fromEntries(Object.keys(current).map((key) => [key, data[key] || current[key as keyof typeof current]])) } as typeof current));
    });
  }, [cliente.id]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.razao_social.trim()) return toast.error('Informe a razão social.');
    setSaving(true);
    const { error } = await supabase.from('enterprise_portal_profiles').upsert({ cliente_id: cliente.id, cnpj: cliente.cnpj || '', ...form }, { onConflict: 'cliente_id' });
    setSaving(false);
    if (error) return toast.error('Não foi possível salvar os dados empresariais.');
    toast.success('Dados empresariais atualizados.');
    onUpdated();
  };

  const fields = [['razao_social', 'Razão social'], ['nome_fantasia', 'Nome fantasia'], ['responsavel_principal', 'Responsável principal'], ['email_corporativo', 'E-mail corporativo'], ['telefone_corporativo', 'Telefone corporativo'], ['segmento', 'Segmento de atuação'], ['porte', 'Porte da empresa'], ['website', 'Site institucional']] as const;
  return <form onSubmit={save} className="border border-[#d8dee5] bg-white"><div className="border-b border-[#e1e6eb] p-6 sm:p-8"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71808f]">Cadastro institucional</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#0b1f33]">Dados da organização</h2><p className="mt-2 text-sm text-[#687583]">Informações utilizadas nos serviços, documentos e atendimentos empresariais.</p></div><div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8"><label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold text-[#445364]">CNPJ</span><input value={cliente.cnpj || ''} disabled className="h-11 w-full border border-[#d8dee5] bg-[#f3f5f7] px-4 text-sm font-semibold text-[#647180]" /></label>{fields.map(([key, label]) => <label key={key} className={key === 'razao_social' ? 'sm:col-span-2' : ''}><span className="mb-2 block text-xs font-semibold text-[#445364]">{label}</span><input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="h-11 w-full border border-[#cfd7df] px-4 text-sm outline-none focus:border-[#1d4ed8]" /></label>)}</div><div className="flex justify-end border-t border-[#e1e6eb] bg-[#f8fafb] px-6 py-5 sm:px-8"><button disabled={saving} className="h-11 bg-[#0b1f33] px-6 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar alterações'}</button></div></form>;
}
