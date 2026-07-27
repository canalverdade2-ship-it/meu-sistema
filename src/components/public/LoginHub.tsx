import { ArrowRight, BriefcaseBusiness, Building2, KeyRound, PackageSearch, ShieldCheck, UserRound, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { LogoGSA } from '../ui/LogoGSA';

interface LoginHubProps {
  onBack?: () => void;
  onPersonalAccess: () => void;
  onBusinessAccess: () => void;
  onProviderAccess?: () => void;
  onSupplierAccess?: () => void;
  onRestrictedAccess?: () => void;
}

export function LoginHub({
  onBack,
  onPersonalAccess,
  onBusinessAccess,
  onProviderAccess,
  onSupplierAccess,
  onRestrictedAccess,
}: LoginHubProps) {
  const reduceMotion = useReducedMotion();
  const cardAnimation = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#fffcf5_0%,#f8f6f0_45%,#f0ece1_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="group flex items-center gap-2 rounded-full border border-[#d8bd73]/40 bg-white/80 px-4 py-2 text-sm font-bold text-neutral-700 shadow-sm backdrop-blur-md transition-all hover:border-[#c19a43] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
          >
            <span className="transition-transform group-hover:-translate-x-0.5">←</span> Voltar
          </button>
          <LogoGSA size="md" variant="dark" />
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-[#d8bd73]/35 bg-white shadow-[0_32px_80px_rgba(20,32,48,0.14)]">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
            <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b121b] via-[#142030] to-[#090d13] p-8 text-white sm:p-12">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#d8bd73]/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#1e3450]/40 blur-3xl" />
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#edcf83]/30 bg-[#edcf83]/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-[#edcf83]">
                  <Sparkles className="h-3.5 w-3.5 text-[#edcf83]" />
                  Acesso GSA
                </div>
                <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Qual é o seu ambiente?</h1>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  Pessoa Física e Empresa agora contam com experiências próprias e dedicadas. Escolha o acesso correspondente ao seu cadastro para iniciar.
                </p>
              </div>

              <div className="relative z-10 mt-8">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-xs leading-relaxed text-white/70 backdrop-blur-sm">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#edcf83]" />
                  <span>Nenhuma informação da conta é exibida antes da autenticação segura.</span>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-[#a87c2b] via-[#fff4d0] to-[#c19a43]" />
            </div>

            <div className="flex flex-col justify-between bg-[#fcfbf9] p-6 sm:p-10">
              <div>
                <div className="mb-6">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8a651f]">Área Central de Login</span>
                  <h2 className="mt-1 text-2xl font-black text-[#142030]">Selecione o seu Portal de Cliente</h2>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.05 }}
                    type="button"
                    onClick={onPersonalAccess}
                    className="group relative flex flex-col justify-between rounded-[1.75rem] border-2 border-[#d8bd73]/40 bg-white p-6 text-left shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-[#c19a43] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#142030] text-[#edcf83] shadow-md transition-transform group-hover:scale-105">
                          <UserRound className="h-6 w-6" />
                        </span>
                        <span className="rounded-full bg-[#f6f2e8] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#8a651f]">
                          Pessoa Física
                        </span>
                      </div>

                      <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-[#8a651f]">Pessoa Física · PF</p>
                      <h3 className="mt-1 text-xl font-black leading-snug text-[#142030]">Área do Cliente Pessoa Física — PF</h3>
                      <p className="mt-2 text-xs leading-relaxed text-neutral-600">Acesse com seu CPF e senha.</p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4 text-xs font-bold text-[#8a651f]">
                      <span>Acessar Portal PF</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f6f2e8] transition-colors group-hover:bg-[#8a651f] group-hover:text-white">
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.12 }}
                    type="button"
                    onClick={onBusinessAccess}
                    className="group relative flex flex-col justify-between rounded-[1.75rem] border-2 border-[#142030] bg-gradient-to-b from-[#142030] to-[#0d1520] p-6 text-left shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#edcf83] hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d8bd73]/30 bg-[#d8bd73]/15 text-[#edcf83] shadow-md transition-transform group-hover:scale-105">
                          <Building2 className="h-6 w-6" />
                        </span>
                        <span className="rounded-full border border-[#edcf83]/30 bg-[#edcf83]/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#edcf83]">
                          Empresa · PJ
                        </span>
                      </div>

                      <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-[#edcf83]">Empresa · PJ</p>
                      <h3 className="mt-1 text-xl font-black leading-snug text-white">Área do Cliente Empresa — PJ</h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/65">Acesse o GSA HUB Empresas com seu CNPJ.</p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-bold text-[#edcf83]">
                      <span>Acessar GSA HUB Empresas</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#edcf83]/30 bg-[#edcf83]/10 transition-colors group-hover:bg-[#edcf83] group-hover:text-[#142030]">
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </motion.button>
                </div>
              </div>

              {(onProviderAccess || onSupplierAccess || onRestrictedAccess) && (
                <div className="mt-8 border-t border-neutral-200/75 pt-5">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Outros portais de acesso
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {onProviderAccess && (
                      <motion.button
                        {...cardAnimation}
                        transition={{ delay: 0.18 }}
                        type="button"
                        onClick={onProviderAccess}
                        className="group inline-flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-left shadow-sm transition hover:border-[#123d5d] hover:bg-[#edf5fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5a86]"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#123d5d] text-[#9bd8bb]">
                          <BriefcaseBusiness className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="block text-[11px] font-bold text-[#123d5d]">Área do Prestador</span>
                          <span className="block text-[9px] font-medium text-neutral-500">Prestadores GSA</span>
                        </div>
                        <ArrowRight className="ml-1 h-3.5 w-3.5 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#123d5d]" />
                      </motion.button>
                    )}

                    {onSupplierAccess && (
                      <motion.button
                        {...cardAnimation}
                        transition={{ delay: 0.22 }}
                        type="button"
                        onClick={onSupplierAccess}
                        className="group inline-flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-left shadow-sm transition hover:border-[#8a572f] hover:bg-[#f8f3ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a572f]"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#142336] text-[#e5b98f]">
                          <PackageSearch className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="block text-[11px] font-bold text-[#142336]">Portal do Fornecedor</span>
                          <span className="block text-[9px] font-medium text-neutral-500">Suprimentos GSA</span>
                        </div>
                        <ArrowRight className="ml-1 h-3.5 w-3.5 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#142336]" />
                      </motion.button>
                    )}

                    {onRestrictedAccess && (
                      <motion.button
                        {...cardAnimation}
                        transition={{ delay: 0.26 }}
                        type="button"
                        onClick={onRestrictedAccess}
                        className="group inline-flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-left shadow-sm transition hover:border-[#8a651f] hover:bg-[#fcf9f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#142030] text-[#edcf83]">
                          <KeyRound className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="block text-[11px] font-bold text-[#142030]">Acesso Restrito</span>
                          <span className="block text-[9px] font-medium text-neutral-500">Exclusivo para Gestão e Colaborador GSA</span>
                        </div>
                        <ArrowRight className="ml-1 h-3.5 w-3.5 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#8a651f]" />
                      </motion.button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
