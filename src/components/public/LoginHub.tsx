import { ArrowRight, BriefcaseBusiness, Building2, KeyRound, PackageSearch, ShieldCheck, UserRound } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { InstitutionalAccessHero, InstitutionalAccessLayout } from './InstitutionalAccessLayout';

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
    <InstitutionalAccessLayout
      onBack={onBack}
      backLabel="Voltar ao site"
      skipTarget="login-options"
      footerNote="Ambiente institucional seguro"
    >
      <InstitutionalAccessHero
        eyebrow="GSA HUB · Acessos"
        title="Área Central de Login"
        description="Selecione o portal correspondente ao seu cadastro ou à sua relação com a GSA para continuar."
        aside={(
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#d5b86b]" />
            <p>
              Cada ambiente possui autenticação e permissões próprias. Nenhuma informação da conta é exibida antes da validação de acesso.
            </p>
          </div>
        )}
      />

      <section
        id="login-options"
        tabIndex={-1}
        className="px-5 py-12 focus:outline-none sm:px-8 lg:px-10 lg:py-16"
      >
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid gap-5 border-b border-[#cbc2b2] pb-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#806329]">Clientes GSA</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#0b1825] sm:text-4xl">
                Acessos para pessoas e empresas
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[#60666b] lg:justify-self-end">
              Use o mesmo tipo de cadastro informado na contratação dos serviços: CPF para pessoa física ou CNPJ para empresa.
            </p>
          </div>

          <div className="mt-8 grid border-l border-t border-[#cfc6b7] sm:grid-cols-2">
            <motion.button
              {...cardAnimation}
              transition={{ delay: 0.05 }}
              type="button"
              onClick={onPersonalAccess}
              className="group min-h-[230px] border-b border-r border-[#cfc6b7] bg-[#f8f6f1] p-6 text-left transition duration-300 hover:bg-[#0c1c2b] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#806329] sm:p-8"
            >
              <div className="flex items-start justify-between gap-5">
                <span className="flex h-11 w-11 items-center justify-center border border-[#ad9256]/55 text-[#806329] transition group-hover:border-[#d5b86b]/60 group-hover:text-[#d5b86b]">
                  <UserRound className="h-5 w-5" />
                </span>
                <ArrowRight className="h-5 w-5 text-[#806329] transition group-hover:translate-x-1 group-hover:text-[#d5b86b]" />
              </div>
              <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-[#806329] group-hover:text-[#d5b86b]">
                Pessoa Física · PF
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-[#101c27] transition group-hover:text-white">
                Área do Cliente Pessoa Física — PF
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#666b70] transition group-hover:text-white/65">
                Acesse com seu CPF e senha.
              </p>
            </motion.button>

            <motion.button
              {...cardAnimation}
              transition={{ delay: 0.1 }}
              type="button"
              onClick={onBusinessAccess}
              className="group min-h-[230px] border-b border-r border-[#cfc6b7] bg-[#f8f6f1] p-6 text-left transition duration-300 hover:bg-[#0c1c2b] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#806329] sm:p-8"
            >
              <div className="flex items-start justify-between gap-5">
                <span className="flex h-11 w-11 items-center justify-center border border-[#ad9256]/55 text-[#806329] transition group-hover:border-[#d5b86b]/60 group-hover:text-[#d5b86b]">
                  <Building2 className="h-5 w-5" />
                </span>
                <ArrowRight className="h-5 w-5 text-[#806329] transition group-hover:translate-x-1 group-hover:text-[#d5b86b]" />
              </div>
              <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-[#806329] group-hover:text-[#d5b86b]">
                Empresa · PJ
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-[#101c27] transition group-hover:text-white">
                Área do Cliente Empresa — PJ
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#666b70] transition group-hover:text-white/65">
                Acesse o GSA HUB Empresas com seu CNPJ.
              </p>
            </motion.button>
          </div>

          {(onProviderAccess || onSupplierAccess || onRestrictedAccess) && (
            <div className="mt-12">
              <div className="flex flex-col gap-3 border-b border-[#cbc2b2] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#806329]">Outros ambientes</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#0b1825]">
                    Portais operacionais
                  </h2>
                </div>
                <p className="text-sm text-[#666b70]">Selecione o vínculo correspondente.</p>
              </div>

              <div className="mt-6 grid border-l border-t border-[#cfc6b7] md:grid-cols-3">
                {onProviderAccess && (
                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.15 }}
                    type="button"
                    onClick={onProviderAccess}
                    className="group min-h-[170px] border-b border-r border-[#cfc6b7] bg-[#f8f6f1] p-5 text-left transition hover:bg-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#806329] sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <BriefcaseBusiness className="h-6 w-6 text-[#806329]" />
                      <ArrowRight className="h-4 w-4 text-[#806329] transition group-hover:translate-x-1" />
                    </div>
                    <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-[#806329]">Prestadores GSA</p>
                    <span className="mt-2 block text-lg font-semibold text-[#0b1825]">Área do Prestador</span>
                  </motion.button>
                )}

                {onSupplierAccess && (
                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.2 }}
                    type="button"
                    onClick={onSupplierAccess}
                    className="group min-h-[170px] border-b border-r border-[#cfc6b7] bg-[#f8f6f1] p-5 text-left transition hover:bg-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#806329] sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <PackageSearch className="h-6 w-6 text-[#806329]" />
                      <ArrowRight className="h-4 w-4 text-[#806329] transition group-hover:translate-x-1" />
                    </div>
                    <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-[#806329]">Suprimentos GSA</p>
                    <span className="mt-2 block text-lg font-semibold text-[#0b1825]">Portal do Fornecedor</span>
                  </motion.button>
                )}

                {onRestrictedAccess && (
                  <motion.button
                    {...cardAnimation}
                    transition={{ delay: 0.25 }}
                    type="button"
                    onClick={onRestrictedAccess}
                    className="group min-h-[170px] border-b border-r border-[#cfc6b7] bg-[#f8f6f1] p-5 text-left transition hover:bg-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#806329] sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <KeyRound className="h-6 w-6 text-[#806329]" />
                      <ArrowRight className="h-4 w-4 text-[#806329] transition group-hover:translate-x-1" />
                    </div>
                    <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-[#806329]">Equipe interna</p>
                    <span className="mt-2 block text-lg font-semibold text-[#0b1825]">Acesso Restrito</span>
                    <span className="mt-1 block text-xs leading-5 text-[#666b70]">Exclusivo para Gestão e Colaborador GSA</span>
                  </motion.button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </InstitutionalAccessLayout>
  );
}
