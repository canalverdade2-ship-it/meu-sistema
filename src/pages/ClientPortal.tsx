import { useEffect, useState, type ComponentProps } from 'react';
import { Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { callClientRpc } from '../lib/clientRpc';
import { replace } from '../routing/navigationService';
import { useAppLocation } from '../routing/useAppLocation';
import { ClientPortal as ClientPortalLegacy } from './ClientPortalLegacy';
import { EnterprisePortal } from './EnterprisePortal';

type ClientPortalProps = ComponentProps<typeof ClientPortalLegacy>;

type ClientKind = 'pf' | 'pj' | null;

export const CLIENT_PORTAL_RESTRICTED_STATUSES = ['bloqueado', 'inativo', 'excluido'] as const;
export const restrictedModules = new Set(['servicos', 'financeiro', 'documentos', 'marketplace', 'empresa', 'equipe']);

export function processScheduledCreditReleaseForClientPortal() {
  return callClientRpc<{ released?: number }>('gsa_client_process_scheduled_credit_release');
}

function navigateClientCompatibility(path: string, replaceFlag = false) {
  if (replaceFlag) replace(path);
  else window.location.assign(path);
}

export function ClientPortal(props: ClientPortalProps) {
  const route = useAppLocation();
  const [clientKind, setClientKind] = useState<ClientKind>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setClientKind(null);
    setError(null);

    supabase
      .from('clientes')
      .select('tipo_pessoa')
      .eq('id', props.clientId)
      .single()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError || !data?.tipo_pessoa) {
          setError('Não foi possível identificar o tipo de cadastro desta conta.');
          return;
        }
        setClientKind(data.tipo_pessoa as ClientKind);
      });

    return () => { active = false; };
  }, [props.clientId]);

  useEffect(() => {
    if (!clientKind) return;
    const pathname = route.pathname.replace(/\/+$/, '') || '/';

    if (clientKind === 'pj' && (pathname === '/cliente' || pathname.startsWith('/cliente/'))) {
      const suffix = pathname === '/cliente' ? '/dashboard' : pathname.slice('/cliente'.length);
      navigateClientCompatibility(`/hempresa${suffix}${route.search}${route.hash}`, true);
      return;
    }

    if (clientKind === 'pf' && (pathname === '/empresa' || pathname.startsWith('/empresa/'))) {
      navigateClientCompatibility('/cliente/dashboard', true);
    }
  }, [clientKind, route.hash, route.pathname, route.search]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] p-6">
        <div className="max-w-md border border-red-200 bg-white p-8 text-center shadow-[0_20px_50px_rgba(11,31,51,0.08)]">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 h-11 bg-[#0b1f33] px-6 text-sm font-semibold text-white">Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!clientKind) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f6f8] text-[#0b1f33]">
        <div className="flex h-12 w-12 items-center justify-center bg-[#0b1f33] text-white"><Building2 className="h-5 w-5" /></div>
        <p className="mt-4 text-sm font-semibold">Identificando ambiente da conta...</p>
      </div>
    );
  }

  if (clientKind === 'pj') {
    return (
      <EnterprisePortal
        clientId={props.clientId}
        onLogout={props.onLogout}
        initialModule={String(props.initialModule || 'dashboard')}
        initialStoreTab={props.initialStoreTab}
        initialStoreItemId={props.initialStoreItemId}
      />
    );
  }

  return <ClientPortalLegacy {...props} />;
}
