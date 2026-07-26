import { ArrowRight, Building2, UserRound, UserRoundPlus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { LogoGSA } from '../ui/LogoGSA';

interface LoginHubProps {
  onBack?: () => void;
  onClientLogin: () => void;
  onClientRegister: () => void;
  onSupplierAccess?: () => void;
  onRestrictedAccess?: () => void;
}

export function LoginHub({ onBack, onClientLogin, onClientRegister, onSupplierAccess }: LoginHubProps) {
  const reduceMotion = useReducedMotion();
  const cardAnimation = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf1f4] px-4 py-8">
      <div className="w-full max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button type="button" onClick={onBack} className="border border-[#cfd7df] bg-white px-4 py-2 text-sm font-semibold text-[#405062] shadow-sm hover:border-[#9aa8b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]">Voltar</button>
          <LogoGSA size="md" variant="dark" />
        </div>

        <section className="overflow-hidden border border-[#cfd7df] bg-white shadow-[0_30px_80px_rgba(11,31,51,0.14)]">
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <div className="relative overflow-hidden bg-[#0b1f33] p-8 text-white sm:p-12 lg:p-14">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-[#c6a45a]" />
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#dfc27d]">Acesso GSA HUB</p>
              <h1 className="mt-5 max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em]">Escolha o ambiente correto para sua operação.</h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/60">Pessoas físicas e empresas possuem experiências próprias, com informações, responsabilidades e recursos adequados a cada tipo de cadastro.</p>
              <div className="mt-12 border-t border-white/15 pt-6">
                <p className="flex items-center gap-2 text-xs font-semibold text-white/65"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Autenticação protegida e operações registradas</p>
              </div>
            </div>

            <div className="bg-[#f7f9fa] p-5 sm:p-8 lg:p-10">
              <div className="grid gap-4 md:grid-cols-3">
                <motion.button {...cardAnimation} transition={{ delay: 0.04 }} type="button" onClick={onClientLogin} className="group relative min-h-[190px] border border-[#d5dce3] bg-white p-6 text-left transition hover:border-[#8999aa] hover:shadow-[0_18px_40px_rgba(11,31,51,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]">
                  <div className="flex h-11 w-11 items-center justify-center bg-[#edf2f6] text-[#0b1f33]"><UserRound className="h-5 w-5" /></div>
                  <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71808f]">Pessoa Física</p>
                  <h2 className="mt-2 text-xl font-semibold text-[#0b1f33]">Área do Cliente</h2>
                  <p className="mt-2 text-sm leading-6 text-[#697684]">Acesse com CPF e senha.</p>
                  <ArrowRight className="absolute bottom-6 right-6 h-5 w-5 text-[#8795a4] transition-transform group-hover:translate-x-1 group-hover:text-[#0b1f33]" />
                </motion.button>

                <motion.button {...cardAnimation} transition={{ delay: 0.1 }} type="button" onClick={() => window.location.assign('/login/empresa')} className="group relative min-h-[190px] border border-[#b89a55]/55 bg-[#0b1f33] p-6 text-left text-white transition hover:bg-[#102b47] hover:shadow-[0_18px_45px_rgba(11,31,51,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7a55b]">
                  <div className="flex h-11 w-11 items-center justify-center border border-[#dfc27d]/40 bg-[#dfc27d]/10 text-[#dfc27d]"><Building2 className="h-5 w-5" /></div>
                  <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#dfc27d]">Pessoa Jurídica</p>
                  <h2 className="mt-2 text-xl font-semibold">Portal Empresarial</h2>
                  <p className="mt-2 text-sm leading-6 text-white/58">Acesse com CNPJ e senha.</p>
                  <ArrowRight className="absolute bottom-6 right-6 h-5 w-5 text-[#dfc27d] transition-transform group-hover:translate-x-1" />
                </motion.button>

                <motion.button {...cardAnimation} transition={{ delay: 0.16 }} type="button" onClick={onClientRegister} className="group relative min-h-[190px] border border-[#d5dce3] bg-white p-6 text-left transition hover:border-[#8999aa] hover:shadow-[0_18px_40px_rgba(11,31,51,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]">
                  <div className="flex h-11 w-11 items-center justify-center bg-[#edf2f6] text-[#0b1f33]"><UserRoundPlus className="h-5 w-5" /></div>
                  <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71808f]">Novo relacionamento</p>
                  <h2 className="mt-2 text-xl font-semibold text-[#0b1f33]">Criar cadastro</h2>
                  <p className="mt-2 text-sm leading-6 text-[#697684]">Cadastre CPF ou CNPJ.</p>
                  <ArrowRight className="absolute bottom-6 right-6 h-5 w-5 text-[#8795a4] transition-transform group-hover:translate-x-1 group-hover:text-[#0b1f33]" />
                </motion.button>
              </div>

              {onSupplierAccess && (
                <div className="mt-5 border-t border-[#dce2e8] pt-5">
                  <button type="button" onClick={onSupplierAccess} className="w-full text-center text-xs font-semibold text-[#596878] hover:text-[#0b1f33] hover:underline">Portal do Fornecedor — acesso exclusivo</button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
