import { useState } from 'react';
import { ArrowLeft, Building2, KeyRound, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sessionService } from '../lib/sessionService';
import { logService } from '../lib/logService';
import { supabase } from '../lib/supabase';
import { maskCNPJ } from '../lib/utils';

interface Props {
  onLoginClient: (clientId: string, isRecovery?: boolean) => void | Promise<void>;
  onBack: () => void;
}

const digits = (value: string) => value.replace(/\D/g, '');

export function EnterpriseAccessPage({ onLoginClient, onBack }: Props) {
  const [cnpj, setCnpj] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (digits(cnpj).length !== 14 || pin.length !== 4 || loading) {
      toast.error('Informe o CNPJ e a senha de quatro dígitos.');
      return;
    }

    setLoading(true);
    try {
      const result = await sessionService.loginWithPin(digits(cnpj), pin, 'cliente');
      if (!result?.valid || !result?.id) throw new Error('CNPJ ou senha inválidos.');

      const { data, error } = await supabase
        .from('clientes')
        .select('id,nome,nome_razao,tipo_pessoa')
        .eq('id', result.id)
        .single();
      if (error || !data) throw new Error('Não foi possível confirmar o cadastro da empresa.');
      if (data.tipo_pessoa !== 'pj') {
        await sessionService.endSession();
        throw new Error('Este ambiente é exclusivo para empresas cadastradas com CNPJ.');
      }

      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: data.id,
        ator_nome: data.nome_razao || data.nome,
        acao: 'LOGIN_PORTAL_EMPRESARIAL',
        detalhes: 'Acesso autenticado ao Portal Empresarial GSA',
      });
      await onLoginClient(data.id);
    } catch (error: any) {
      setPin('');
      toast.error(error?.message || 'Não foi possível acessar o Portal Empresarial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07111d] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 p-14 lg:flex lg:flex-col lg:justify-between xl:p-20">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,39,65,0.94),rgba(6,15,26,0.99))]" />
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center border border-[#c7a55b]/50 bg-[#c7a55b]/10"><Building2 className="h-6 w-6 text-[#dfc27d]" /></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#dfc27d]">GSA HUB</p><p className="mt-1 text-sm text-white/55">Portal Empresarial</p></div>
            </div>
            <div className="mt-24 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dfc27d]">Ambiente corporativo protegido</p>
              <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-6xl">Gestão empresarial com clareza, controle e responsabilidade.</h1>
              <p className="mt-7 max-w-lg text-base leading-8 text-white/58">Serviços, documentos, financeiro e atendimentos da sua empresa em um ambiente exclusivo e rastreável.</p>
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-3 border-t border-white/15 pt-6 text-xs text-white/55"><ShieldCheck className="h-4 w-4 text-[#dfc27d]" /> Acesso autenticado e operações registradas</div>
        </section>

        <section className="flex items-center justify-center bg-[#f4f6f8] px-5 py-10 text-[#18212b] sm:px-10">
          <div className="w-full max-w-md">
            <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#536170] hover:text-[#0b1f33]"><ArrowLeft className="h-4 w-4" /> Voltar ao acesso geral</button>
            <div className="border border-[#d8dee5] bg-white p-8 shadow-[0_24px_70px_rgba(11,31,51,0.10)] sm:p-10">
              <div className="flex h-12 w-12 items-center justify-center bg-[#eef3f8] text-[#0b1f33]"><LockKeyhole className="h-5 w-5" /></div>
              <h2 className="mt-6 text-2xl font-semibold tracking-[-0.025em] text-[#0b1f33]">Acesso da empresa</h2>
              <p className="mt-2 text-sm leading-6 text-[#667482]">Identifique a organização pelo CNPJ e confirme a senha cadastrada.</p>

              <form onSubmit={login} className="mt-8 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#536170]">CNPJ</span>
                  <div className="flex h-12 items-center border border-[#cfd7df] px-4 focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/15">
                    <Building2 className="mr-3 h-4 w-4 text-[#748190]" />
                    <input value={cnpj} onChange={(event) => setCnpj(maskCNPJ(event.target.value))} inputMode="numeric" autoComplete="username" placeholder="00.000.000/0000-00" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#536170]">Senha de quatro dígitos</span>
                  <div className="flex h-12 items-center border border-[#cfd7df] px-4 focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/15">
                    <KeyRound className="mr-3 h-4 w-4 text-[#748190]" />
                    <input value={pin} onChange={(event) => setPin(digits(event.target.value).slice(0, 4))} type="password" inputMode="numeric" autoComplete="current-password" placeholder="••••" className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-[0.4em] outline-none" />
                  </div>
                </label>
                <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 bg-[#0b1f33] text-sm font-semibold text-white hover:bg-[#102b47] disabled:opacity-50">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Acessar Portal Empresarial</button>
                <button type="button" onClick={() => window.location.assign('/login?mode=login')} className="w-full text-center text-sm font-semibold text-[#31506f] hover:underline">Primeiro acesso ou recuperar senha</button>
              </form>
              <div className="mt-7 flex items-start gap-3 border-t border-[#e1e6eb] pt-5 text-xs leading-5 text-[#667482]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2f6b50]" /> O acesso é individual e protegido. Não compartilhe a senha da empresa.</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
