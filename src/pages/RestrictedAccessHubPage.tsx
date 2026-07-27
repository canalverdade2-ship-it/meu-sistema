import { useEffect, useState, type FormEvent } from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  InstitutionalAccessHero,
  InstitutionalAccessLayout,
} from '../components/public/InstitutionalAccessLayout';
import { logService } from '../lib/logService';
import { sessionService } from '../lib/sessionService';

export type RestrictedAccessRole = 'colaborador' | 'gestao';

interface RestrictedAccessHubPageProps {
  initialRole?: RestrictedAccessRole;
  onBack: () => void;
  onLoginAdmin: (details: {
    type: 'admin' | 'colaborador';
    id?: string;
    nome?: string;
    modulos?: string[];
  }) => void;
}

const roleContent = {
  colaborador: {
    eyebrow: 'Equipe interna',
    title: 'Colaborador GSA',
    description: 'Acesse somente os módulos administrativos autorizados para sua função.',
    label: 'Credencial de colaborador',
    button: 'Entrar como colaborador',
    icon: UsersRound,
  },
  gestao: {
    eyebrow: 'Administração',
    title: 'Gestão GSA',
    description: 'Acesso Master ao ambiente de gestão, supervisão e administração do ecossistema.',
    label: 'Código Master',
    button: 'Entrar na gestão',
    icon: UserCog,
  },
} as const;

export function RestrictedAccessHubPage({
  initialRole = 'colaborador',
  onBack,
  onLoginAdmin,
}: RestrictedAccessHubPageProps) {
  const reduceMotion = useReducedMotion();
  const [role, setRole] = useState<RestrictedAccessRole>(initialRole);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    setRole(initialRole);
    setCode('');
    setShowCode(false);
  }, [initialRole]);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;

    document.title = 'Área Restrita | GSA HUB';
    if (description) {
      description.content = 'Acesso institucional exclusivo para Gestão e Colaboradores autorizados da GSA HUB.';
    }

    return () => {
      document.title = previousTitle;
      if (description && previousDescription) description.content = previousDescription;
    };
  }, []);

  const selectRole = (nextRole: RestrictedAccessRole) => {
    setRole(nextRole);
    setCode('');
    setShowCode(false);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim() || loading) {
      toast.error('Informe sua credencial de acesso.');
      return;
    }

    setLoading(true);
    try {
      if (role === 'gestao') {
        const data = await sessionService.loginAdmin(code.trim());
        if (!data?.valid) throw new Error('Código Master inválido.');
        await logService.logAction({
          ator_tipo: 'admin',
          acao: 'LOGIN',
          detalhes: 'Acesso Master pela página exclusiva da Área Restrita',
        });
        toast.success('Acesso à Gestão autorizado.');
        onLoginAdmin({ type: 'admin' });
        return;
      }

      const data = await sessionService.loginColaborador(code.trim());
      if (!data?.valid) throw new Error('Credencial inválida ou colaborador inativo.');
      await logService.logAction({
        ator_tipo: 'colaborador',
        ator_id: data.id,
        ator_nome: data.nome,
        acao: 'LOGIN',
        detalhes: 'Acesso de colaborador pela página exclusiva da Área Restrita',
      });
      toast.success('Acesso de colaborador autorizado.');
      onLoginAdmin({
        type: 'colaborador',
        id: data.id,
        nome: data.nome,
        modulos: data.modulos || [],
      });
    } catch (error: any) {
      setCode('');
      toast.error(error?.message || 'Não foi possível autorizar o acesso.');
    } finally {
      setLoading(false);
    }
  };

  const selected = roleContent[role];
  const SelectedIcon = selected.icon;

  return (
    <InstitutionalAccessLayout
      onBack={onBack}
      backLabel="Voltar aos acessos"
      skipTarget="restricted-login"
      footerNote="Uso exclusivo da estrutura interna"
    >
      <InstitutionalAccessHero
        eyebrow="GSA HUB · Equipe interna"
        title="Área Restrita GSA"
        description="Ambiente exclusivo para profissionais da estrutura interna. Selecione o seu perfil e informe a credencial fornecida pela administração."
        aside={(
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#d5b86b]" />
            <p>
              <strong className="font-semibold text-white">Acesso protegido.</strong>{' '}
              O perfil e os módulos autorizados são validados antes da abertura do painel.
            </p>
          </div>
        )}
      />

      <section id="restricted-login" className="px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid gap-5 border-b border-[#cbc2b2] pb-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#806329]">Identificação de acesso</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#0b1825] sm:text-4xl">
                Selecione o seu perfil
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[#60666b] lg:justify-self-end">
              Utilize somente a credencial vinculada à sua função. Prestadores e fornecedores possuem portais próprios.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:gap-12">
            <div>
              <div className="grid border-l border-t border-[#cfc6b7] sm:grid-cols-2 lg:grid-cols-1">
                {([
                  ['colaborador', roleContent.colaborador],
                  ['gestao', roleContent.gestao],
                ] as const).map(([roleId, content]) => {
                  const Icon = content.icon;
                  const isActive = role === roleId;

                  return (
                    <button
                      key={roleId}
                      type="button"
                      aria-pressed={isActive}
                      aria-controls="restricted-credential-form"
                      onClick={() => selectRole(roleId)}
                      className={`group min-h-[154px] border-b border-r border-[#cfc6b7] p-5 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#806329] sm:p-6 ${
                        isActive
                          ? 'bg-[#0c1c2b] text-white'
                          : 'bg-[#f8f6f1] text-[#0b1825] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-5">
                        <span className={`flex h-10 w-10 items-center justify-center border ${
                          isActive
                            ? 'border-[#d5b86b]/60 text-[#d5b86b]'
                            : 'border-[#ad9256]/55 text-[#806329]'
                        }`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                          isActive ? 'text-[#d5b86b]' : 'text-[#806329]'
                        }`}>
                          {isActive ? 'Selecionado' : content.eyebrow}
                        </span>
                      </div>
                      <h3 className="mt-5 text-xl font-semibold">{content.title}</h3>
                      <p className={`mt-2 text-xs leading-5 ${isActive ? 'text-white/62' : 'text-[#666b70]'}`}>
                        {content.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-start gap-3 border-l-2 border-[#a9873c] pl-4 text-xs leading-6 text-[#60666b]">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#806329]" />
                <span>A credencial é pessoal e não deve ser compartilhada.</span>
              </div>
            </div>

            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="border border-[#cfc6b7] bg-[#f8f6f1]"
            >
              <div className="border-b border-[#cfc6b7] px-6 py-6 sm:px-8">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#ad9256]/55 text-[#806329]">
                    <SelectedIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#806329]">{selected.eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#0b1825]">{selected.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#687078]">{selected.description}</p>
                  </div>
                </div>
              </div>

              <form id="restricted-credential-form" onSubmit={handleLogin}>
                <div className="px-6 py-7 sm:px-8 sm:py-8">
                  <label htmlFor={`restricted-code-${role}`} className="block text-sm font-semibold text-[#28343e]">
                    {selected.label}
                  </label>
                  <p className="mt-2 text-xs leading-5 text-[#687078]">
                    Digite a credencial individual recebida da administração da GSA.
                  </p>

                  <div className="relative mt-4">
                    <input
                      key={role}
                      id={`restricted-code-${role}`}
                      name="access-code"
                      type={showCode ? 'text' : 'password'}
                      autoComplete="current-password"
                      inputMode="numeric"
                      required
                      autoFocus
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="Digite sua credencial"
                      className="min-h-14 w-full border border-[#bcb7ac] bg-white px-4 pr-14 text-center font-mono text-lg tracking-[0.24em] text-[#0b1825] outline-none transition placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-[#8a8f92] focus:border-[#806329] focus:ring-2 focus:ring-[#806329]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode((current) => !current)}
                      aria-label={showCode ? 'Ocultar credencial' : 'Mostrar credencial'}
                      className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[#687078] transition hover:bg-[#eee9de] hover:text-[#0b1825] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#806329]"
                    >
                      {showCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 bg-[#0b1825] px-5 text-sm font-semibold text-white transition hover:bg-[#142a3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#806329] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 text-[#d5b86b]" />}
                    {loading ? 'Autorizando acesso...' : selected.button}
                  </button>
                </div>

                <div className="flex items-start gap-3 border-t border-[#cfc6b7] bg-[#eee9de] px-6 py-4 text-xs leading-5 text-[#5f5748] sm:px-8">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#806329]" />
                  <span>Nenhuma informação administrativa é exibida antes da autenticação.</span>
                </div>
              </form>
            </motion.section>
          </div>
        </div>
      </section>
    </InstitutionalAccessLayout>
  );
}
