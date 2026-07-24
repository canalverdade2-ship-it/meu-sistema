import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { sessionService } from '../../lib/sessionService';
import { SiteCampaignAdminModule } from './SiteCampaignAdminModule';

type Collaborator = {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  status: string;
  funcao_id?: string | null;
  modulos?: string[];
};

type AccessSnapshot = {
  collaborators?: Collaborator[];
};

const MODULE_ID = 'avisos-campanhas';

export function SiteCampaignAdminPage() {
  const isAdmin = sessionService.getCurrentSession()?.atorTipo === 'admin';
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const snapshot = await callAdminRpc<AccessSnapshot>('gsa_admin_access_snapshot', { p_limit: 1000 });
      setCollaborators(Array.isArray(snapshot?.collaborators) ? snapshot.collaborators : []);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar as permissões dos colaboradores.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const ordered = useMemo(
    () => [...collaborators].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [collaborators],
  );

  const toggle = async (collaborator: Collaborator) => {
    const currentModules = Array.isArray(collaborator.modulos) ? collaborator.modulos : [];
    const hasAccess = currentModules.includes(MODULE_ID);
    const nextModules = hasAccess
      ? currentModules.filter((module) => module !== MODULE_ID)
      : [...new Set([...currentModules, MODULE_ID])];

    setSavingId(collaborator.id);
    try {
      await callAdminRpc('gsa_admin_save_collaborator', {
        p_id: collaborator.id,
        p_payload: {
          nome: collaborator.nome,
          email: collaborator.email || null,
          telefone: collaborator.telefone || null,
          funcao_id: collaborator.funcao_id || null,
        },
        p_modules: nextModules,
      });
      setCollaborators((items) => items.map((item) => item.id === collaborator.id ? { ...item, modulos: nextModules } : item));
      toast.success(hasAccess ? 'Acesso à Central revogado.' : 'Acesso à Central concedido.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível alterar a permissão.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SiteCampaignAdminModule />

      {isAdmin && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                <ShieldCheck className="h-4 w-4" /> Segurança e autorização
              </p>
              <h2 className="mt-2 text-xl font-black text-neutral-950">Permissões de colaboradores</h2>
              <p className="mt-1 text-sm text-neutral-500">Conceda acesso somente a quem poderá criar, publicar e consultar campanhas.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-black text-neutral-600">
              <Users className="h-4 w-4" /> {ordered.length} colaboradores
            </span>
          </div>

          {loading ? (
            <p className="mt-5 rounded-xl bg-neutral-50 p-5 text-sm font-bold text-neutral-500">Carregando permissões...</p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ordered.map((collaborator) => {
                const hasAccess = collaborator.modulos?.includes(MODULE_ID) || false;
                const inactive = collaborator.status !== 'ativo';
                return (
                  <article key={collaborator.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-black text-neutral-900">{collaborator.nome}</p>
                      <p className="truncate text-xs text-neutral-500">{collaborator.email || 'Sem e-mail'} · {collaborator.status}</p>
                    </div>
                    <button
                      type="button"
                      disabled={savingId === collaborator.id || inactive}
                      onClick={() => void toggle(collaborator)}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${hasAccess ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {savingId === collaborator.id ? 'Salvando...' : hasAccess ? 'Revogar' : 'Conceder'}
                    </button>
                  </article>
                );
              })}
              {!ordered.length && <p className="text-sm text-neutral-400">Nenhum colaborador cadastrado.</p>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
