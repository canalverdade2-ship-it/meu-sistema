import { ArrowRight, Sparkles, Users } from 'lucide-react';
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
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff7e6_0%,#f8f7f5_40%,#f2efe8_100%)] px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button type="button" onClick={onBack} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-700 shadow-sm hover:border-[#d8bd73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]">Voltar</button>
          <LogoGSA size="md" variant="dark" />
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-[#d8bd73]/35 bg-white shadow-[0_28px_70px_rgba(20,32,48,0.16)]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0f1722] via-[#142030] to-[#090d13] p-8 text-white sm:p-12">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#a87c2b] via-[#fff4d0] to-[#c19a43]" />
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#edcf83]">Acesso GSA</p>
              <h1 className="mt-4 text-4xl font-black">Entre no seu ambiente</h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/65">Escolha o caminho correto. Nenhuma informação da conta é exibida antes da autenticação.</p>
            </div>

            <div className="bg-[#fbfaf7] p-5 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <motion.button {...cardAnimation} transition={{ delay: 0.05 }} type="button" onClick={onClientLogin} className="group relative min-h-[150px] rounded-[1.5rem] border border-[#d8bd73]/55 bg-white p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-[#c19a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]">
                  <Users className="h-10 w-10 text-[#8a651f]" />
                  <h2 className="mt-5 text-xl font-black text-[#142030]">Área do Cliente</h2>
                  <p className="mt-2 text-sm text-neutral-600">Entrar com CPF/CNPJ e senha.</p>
                  <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 text-[#8a651f] transition-transform group-hover:translate-x-1" />
                </motion.button>

                <motion.button {...cardAnimation} transition={{ delay: 0.12 }} type="button" onClick={onClientRegister} className="group relative min-h-[150px] rounded-[1.5rem] border border-[#d8bd73]/55 bg-white p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-[#c19a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]">
                  <Sparkles className="h-10 w-10 text-[#8a651f]" />
                  <h2 className="mt-5 text-xl font-black text-[#142030]">Novo cadastro</h2>
                  <p className="mt-2 text-sm text-neutral-600">Validar indicação e criar conta.</p>
                  <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 text-[#8a651f] transition-transform group-hover:translate-x-1" />
                </motion.button>
              </div>

              {onSupplierAccess && (
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <button type="button" onClick={onSupplierAccess} className="w-full text-center text-xs font-bold text-neutral-600 hover:text-neutral-900 underline">
                    Portal do Fornecedor (Acesso Exclusivo)
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
