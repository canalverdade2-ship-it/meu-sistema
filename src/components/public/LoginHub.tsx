import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, KeyRound, PackageSearch, ShieldCheck, UserRound } from 'lucide-react';
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
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_top,#fff9ee_0%,#f8f6f0_42%,#eeeae0_100%)] text-[#142030] flex flex-col justify-between">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1360px] flex-col px-4 py-5 sm:px-7 lg:px-10">
        
        {/* Institutional Header */}
        <header className="flex items-center justify-between gap-4 border-b border-[#142030]/10 pb-5">
          <LogoGSA size="sm" variant="dark" showText />
          
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#142030]/15 bg-white/80 px-4 text-sm font-bold text-[#142030] shadow-sm transition hover:border-[#d8bd73] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-1 items-center py-8 lg:py-12">
          <div className="grid w-full overflow-hidden rounded-[2rem] border border-[#d8bd73]/35 bg-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
            
            {/* Left Panel: Institutional Dark Hero */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0f1722] via-[#142030] to-[#090d13] p-8 text-white sm:p-12 lg:p-14 flex flex-col justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#edcf83]">Acesso GSA</p>
                <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                  Qual é o seu ambiente?
                </h1>
                <p className="mt-5 text-sm leading-relaxed text-white/70 sm:text-base">
                  Pessoa Física e Empresa agora contam com experiências próprias. Escolha o acesso correspondente ao seu cadastro para continuar.
                </p>
              </div>

              <div className="mt-10">
                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-relaxed text-white/65 sm:text-sm">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#edcf83]" />
                  <span>Nenhuma informação da conta é exibida antes da autenticação segura.</span>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#a87c2b] via-[#fff4d0] to-[#c19a43]" />
            </div>

            {/* Right Panel: Central Login Options (PF & PJ Only in Main Grid) */}
            <div className="bg-[#fbfaf7] p-6 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="mb-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8a651f]">Área Central de Login</p>
                  <h2 className="mt-1 text-2xl font-black text-[#142030]">Selecione o seu Portal de Cliente</h2>
                </div>

                {/* Main Client Options: PF and PJ Only */}
                <div className="grid gap-5 sm:grid-cols-2">
                  {/* PF Option */}
                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.05 }}
                    type="button"
                    onClick={onPersonalAccess}
                    className="group relative flex flex-col justify-between min-h-[200px] rounded-[1.5rem] border border-[#d8bd73]/55 bg-white p-6 text-left shadow-md transition duration-200 hover:-translate-y-0.5 hover:border-[#c19a43] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
                  >
                    <div>
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#142030] text-[#edcf83]">
                        <UserRound className="h-6 w-6" />
                      </span>
                      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a651f]">
                        Pessoa Física · PF
                      </p>
                      <h3 className="mt-1.5 text-lg font-black leading-tight text-[#142030]">
                        Área do Cliente Pessoa Física — PF
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                        Acesse com seu CPF e senha.
                      </p>
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between text-xs font-bold text-[#8a651f]">
                      <span>Acessar</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </motion.button>

                  {/* PJ Option */}
                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.12 }}
                    type="button"
                    onClick={onBusinessAccess}
                    className="group relative flex flex-col justify-between min-h-[200px] rounded-[1.5rem] border border-[#142030] bg-[#0d1b2a] p-6 text-left shadow-lg transition duration-200 hover:-translate-y-0.5 hover:border-[#d8bd73] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
                  >
                    <div>
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d8bd73]/30 bg-[#d8bd73]/10 text-[#edcf83]">
                        <Building2 className="h-6 w-6" />
                      </span>
                      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[#edcf83]">
                        Empresa · PJ
                      </p>
                      <h3 className="mt-1.5 text-lg font-black leading-tight text-white">
                        Área do Cliente Empresa — PJ
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/60">
                        Acesse o GSA HUB Empresas com seu CNPJ.
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between text-xs font-bold text-[#edcf83]">
                      <span>Acessar</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Secondary Accesses (Prestadores, Suprimentos, Restrito) */}
              {(onProviderAccess || onSupplierAccess || onRestrictedAccess) && (
                <div className="mt-8 border-t border-neutral-200/80 pt-6">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                    Outros portais de acesso
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {onProviderAccess && (
                      <motion.button
                        {...cardAnimation}
                        transition={{ delay: 0.18 }}
                        type="button"
                        onClick={onProviderAccess}
                        className="group flex flex-col justify-between rounded-[1.25rem] border border-[#b9d2e2] bg-[#edf5fa] p-4 text-left transition hover:border-[#5687a7] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5a86]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#123d5d] text-[#9bd8bb]">
                            <BriefcaseBusiness className="h-4 w-4" />
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#267153]">Prestadores GSA</span>
                        </div>
                        <div className="mt-3">
                          <span className="block text-sm font-black text-[#123d5d]">Área do Prestador</span>
                        </div>
                        <div className="mt-3 flex items-center justify-end">
                          <ArrowRight className="h-4 w-4 text-[#267153] transition-transform group-hover:translate-x-1" />
                        </div>
                      </motion.button>
                    )}

                    {onSupplierAccess && (
                      <motion.button
                        {...cardAnimation}
                        transition={{ delay: 0.22 }}
                        type="button"
                        onClick={onSupplierAccess}
                        className="group flex flex-col justify-between rounded-[1.25rem] border border-[#dacabc] bg-[#f8f3ed] p-4 text-left transition hover:border-[#a66d3f] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a572f]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#142336] text-[#e5b98f]">
                            <PackageSearch className="h-4 w-4" />
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a572f]">Suprimentos GSA</span>
                        </div>
                        <div className="mt-3">
                          <span className="block text-sm font-black text-[#142336]">Portal do Fornecedor</span>
                        </div>
                        <div className="mt-3 flex items-center justify-end">
                          <ArrowRight className="h-4 w-4 text-[#8a572f] transition-transform group-hover:translate-x-1" />
                        </div>
                      </motion.button>
                    )}

                    {onRestrictedAccess && (
                      <motion.button
                        {...cardAnimation}
                        transition={{ delay: 0.26 }}
                        type="button"
                        onClick={onRestrictedAccess}
                        className="group flex flex-col justify-between rounded-[1.25rem] border border-[#cfd6dd] bg-[#f3f5f7] p-4 text-left transition hover:border-[#8fa0b0] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a651f]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#142030] text-[#edcf83]">
                            <KeyRound className="h-4 w-4" />
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a651f]">Equipe interna</span>
                        </div>
                        <div className="mt-3">
                          <span className="block text-sm font-black text-[#142030]">Acesso Restrito</span>
                          <span className="block text-[10px] text-neutral-500 mt-0.5">Exclusivo para Gestão e Colaborador GSA</span>
                        </div>
                        <div className="mt-3 flex items-center justify-end">
                          <ArrowRight className="h-4 w-4 text-[#8a651f] transition-transform group-hover:translate-x-1" />
                        </div>
                      </motion.button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Institutional Footer */}
        <footer className="flex flex-col items-center justify-between gap-3 border-t border-[#142030]/10 pt-4 text-center text-xs text-neutral-500 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} Grupo GSA — Gestão de Serviços Avançados. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4 text-xs font-medium text-neutral-600">
            <span>Ambiente Institucional Seguro</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

