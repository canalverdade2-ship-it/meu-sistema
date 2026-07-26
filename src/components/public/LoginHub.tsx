import { ArrowRight, BriefcaseBusiness, Building2, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { LogoGSA } from '../ui/LogoGSA';

interface LoginHubProps {
  onBack?: () => void;
  onPersonalAccess: () => void;
  onBusinessAccess: () => void;
  onSupplierAccess?: () => void;
  onProviderAccess?: () => void;
  onRestrictedAccess?: () => void;
}

export function LoginHub({
  onBack,
  onPersonalAccess,
  onBusinessAccess,
  onProviderAccess,
  onRestrictedAccess,
}: LoginHubProps) {
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
              <h1 className="mt-4 text-4xl font-black">Qual é o seu ambiente?</h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/65">Pessoa Física e Empresa agora contam com experiências próprias. Escolha o acesso correspondente ao seu cadastro.</p>
              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-5 text-white/55">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#edcf83]" />
                Nenhuma informação da conta é exibida antes da autenticação segura.
              </div>
            </div>

            <div className="bg-[#fbfaf7] p-5 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <motion.button {...cardAnimation} transition={{ delay: 0.05 }} type="button" onClick={onPersonalAccess} className="group relative min-h-[190px] rounded-[1.5rem] border border-[#d8bd73]/55 bg-white p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-[#c19a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#142030] text-[#edcf83]">
                    <UserRound className="h-6 w-6" />
                  </span>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a651f]">Pessoa Física · PF</p>
                  <h2 className="mt-2 text-lg font-black leading-tight text-[#142030]">Área do Cliente Pessoa Física — PF</h2>
                  <p className="mt-2 pr-7 text-xs leading-5 text-neutral-600">Acesse com seu CPF e senha.</p>
                  <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 text-[#8a651f] transition-transform group-hover:translate-x-1" />
                </motion.button>

                <motion.button {...cardAnimation} transition={{ delay: 0.12 }} type="button" onClick={onBusinessAccess} className="group relative min-h-[190px] rounded-[1.5rem] border border-[#142030] bg-[#0d1b2a] p-5 text-left shadow-xl transition hover:-translate-y-0.5 hover:border-[#d8bd73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d8bd73]/30 bg-[#d8bd73]/10 text-[#edcf83]">
                    <Building2 className="h-6 w-6" />
                  </span>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[#edcf83]">Empresa · PJ</p>
                  <h2 className="mt-2 text-lg font-black leading-tight text-white">Área do Cliente Empresa — PJ</h2>
                  <p className="mt-2 pr-7 text-xs leading-5 text-white/55">Acesse o GSA HUB Empresas com seu CNPJ.</p>
                  <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 text-[#8a651f] transition-transform group-hover:translate-x-1" />
                </motion.button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {onProviderAccess && (
                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.18 }}
                    type="button"
                    onClick={onProviderAccess}
                    className="group flex min-h-[128px] w-full items-center gap-4 rounded-[1.35rem] border border-[#b9d2e2] bg-[#edf5fa] p-5 text-left transition hover:border-[#5687a7] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5a86]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#123d5d] text-[#9bd8bb]">
                      <BriefcaseBusiness className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#267153]">Prestadores GSA</span>
                      <span className="mt-1 block text-base font-black text-[#123d5d]">Área do Prestador</span>
                      <span className="mt-1 block text-xs leading-5 text-neutral-600">Login e cadastro para profissionais e empresas prestadoras.</span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#267153] transition-transform group-hover:translate-x-1" />
                  </motion.button>
                )}

                {onRestrictedAccess && (
                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.24 }}
                    type="button"
                    onClick={onRestrictedAccess}
                    className="group flex min-h-[128px] w-full items-center gap-4 rounded-[1.35rem] border border-[#cfd6dd] bg-[#f3f5f7] p-5 text-left transition hover:border-[#8fa0b0] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#142030] text-[#edcf83]">
                      <KeyRound className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#8a651f]">Equipe interna</span>
                      <span className="mt-1 block text-base font-black text-[#142030]">Acesso Restrito</span>
                      <span className="mt-1 block text-xs leading-5 text-neutral-600">Exclusivo para Gestão e Colaborador GSA.</span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#8a651f] transition-transform group-hover:translate-x-1" />
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
