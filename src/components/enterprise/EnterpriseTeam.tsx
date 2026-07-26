import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

export function EnterpriseTeam({ clientId }: { clientId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ nome: '', email: '', cargo: '', perfil: 'consulta' });
  const load = useCallback(async () => { const { data } = await supabase.from('enterprise_members').select('*').eq('cliente_id', clientId).order('is_primary', { ascending: false }).order('nome'); setMembers(data || []); }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim() || !form.email.includes('@')) return toast.error('Informe nome e e-mail válidos.');
    const { error } = await supabase.from('enterprise_members').insert({ cliente_id: clientId, nome: form.nome.trim(), email: form.email.trim().toLowerCase(), cargo: form.cargo.trim() || null, perfil: form.perfil, status: 'ativo' });
    if (error) return toast.error(error.message);
    setForm({ nome: '', email: '', cargo: '', perfil: 'consulta' }); toast.success('Responsável cadastrado.'); load();
  };

  const toggle = async (member: any) => {
    if (member.is_primary) return toast.error('O responsável principal não pode ser inativado.');
    const { error } = await supabase.from('enterprise_members').update({ status: member.status === 'ativo' ? 'inativo' : 'ativo' }).eq('id', member.id).eq('cliente_id', clientId);
    if (error) toast.error('Não foi possível atualizar o responsável.'); else load();
  };

  return <div className="space-y-6"><section className="border border-[#d8dee5] bg-white p-6 sm:p-8"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71808f]">Governança empresarial</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#0b1f33]">Equipe e responsáveis</h2><p className="mt-2 text-sm leading-6 text-[#687583]">Registre os responsáveis autorizados por cada frente da empresa.</p></section><form onSubmit={add} className="grid gap-4 border border-[#d8dee5] bg-white p-6 sm:grid-cols-2 lg:grid-cols-4"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" className="h-11 border border-[#cfd7df] px-4 text-sm" /><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail corporativo" type="email" className="h-11 border border-[#cfd7df] px-4 text-sm" /><input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Cargo ou setor" className="h-11 border border-[#cfd7df] px-4 text-sm" /><div className="flex gap-2"><select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })} className="min-w-0 flex-1 border border-[#cfd7df] px-2 text-sm"><option value="administrador">Administrador</option><option value="financeiro">Financeiro</option><option value="fiscal">Fiscal</option><option value="operacional">Operacional</option><option value="consulta">Consulta</option></select><button className="bg-[#0b1f33] px-4 text-sm font-semibold text-white">Adicionar</button></div></form><section className="overflow-hidden border border-[#d8dee5] bg-white">{members.length === 0 ? <p className="p-8 text-center text-sm text-[#6c7986]">Nenhum responsável adicional cadastrado.</p> : members.map((member) => <div key={member.id} className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-4 border-b border-[#edf0f3] px-6 py-4 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#0b1f33]">{member.nome}</p><p className="truncate text-xs text-[#71808f]">{member.email}</p></div><div><p className="text-sm text-[#445364]">{member.cargo || '—'}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#71808f]">{member.perfil}</p></div><button type="button" onClick={() => toggle(member)} className={`border px-3 py-1.5 text-[10px] font-semibold uppercase ${member.status === 'ativo' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 bg-neutral-50'}`}>{member.status}</button></div>)}</section></div>;
}
