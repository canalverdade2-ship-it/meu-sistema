import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AdminPanel } from './AdminPanel';
import { supabase } from '../lib/supabase';
import { sessionService } from '../lib/sessionService';
import { useAppLocation } from '../routing/useAppLocation';
import { navigate } from '../routing/navigationService';
import {
  defaultAdminPath,
  hasAdminModuleAccess,
  normalizeCollaboratorModules,
} from '../security/collaboratorAccess';

interface SecureAdminPanelProps {
  onLogout: () => void;
  adminType: 'admin' | 'colaborador';
  colaboradorId?: string;
  colaboradorNome?: string;
  colaboradorModulos: string[];
}

export function SecureAdminPanel(props: SecureAdminPanelProps) {
  const route = useAppLocation();
  const logoutRef = useRef(props.onLogout);
  const [name, setName] = useState(props.colaboradorNome);
  const [modules, setModules] = useState(() => normalizeCollaboratorModules(props.colaboradorModulos));
  const [checking, setChecking] = useState(props.adminType === 'colaborador');
  const revokingRef = useRef(false);

  useEffect(() => { logoutRef.current = props.onLogout; }, [props.onLogout]);
  useEffect(() => { setName(props.colaboradorNome); }, [props.colaboradorNome]);
  useEffect(() => { setModules(normalizeCollaboratorModules(props.colaboradorModulos)); }, [props.colaboradorModulos]);

  const persistIdentity = useCallback((nextName: string | undefined, nextModules: string[]) => {
    localStorage.setItem('adminType', props.adminType);
    if (props.colaboradorId) localStorage.setItem('colaboradorId', props.colaboradorId);
    if (nextName) localStorage.setItem('colaboradorNome', nextName);
    localStorage.setItem('colaboradorModulos', JSON.stringify(nextModules));
  }, [props.adminType, props.colaboradorId]);

  const revoke = useCallback(async (message: string) => {
    if (revokingRef.current) return;
    revokingRef.current = true;
    toast.error(message, { duration: 8000 });
    await sessionService.endSession();
    logoutRef.current();
  }, []);

  const refreshAccess = useCallback(async () => {
    if (props.adminType !== 'colaborador') {
      persistIdentity(props.colaboradorNome, normalizeCollaboratorModules(props.colaboradorModulos));
      setChecking(false);
      return;
    }
    if (!props.colaboradorId) {
      await revoke('Sessão de colaborador inválida. Entre novamente.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('id, nome, status, colaborador_modulos(modulo_id)')
        .eq('id', props.colaboradorId)
        .single();

      if (error || !data) throw error || new Error('Colaborador não encontrado.');
      if (data.status !== 'ativo') {
        await revoke('Seu acesso foi suspenso ou encerrado pelo administrador.');
        return;
      }

      const nextModules = normalizeCollaboratorModules(
        (data.colaborador_modulos || []).map((entry: { modulo_id: string }) => entry.modulo_id),
      );
      setName(data.nome || props.colaboradorNome);
      setModules(nextModules);
      persistIdentity(data.nome || props.colaboradorNome, nextModules);
    } catch (error) {
      console.error('Falha ao atualizar permissões do colaborador:', error);
      const current = sessionService.getCurrentSession();
      if (!current) await revoke('Sua sessão não pôde ser validada. Entre novamente.');
    } finally {
      setChecking(false);
    }
  }, [persistIdentity, props.adminType, props.colaboradorId, props.colaboradorModulos, props.colaboradorNome, revoke]);

  useEffect(() => {
    refreshAccess();
    if (props.adminType !== 'colaborador' || !props.colaboradorId) return;

    const refresh = () => { void refreshAccess(); };
    const channel = supabase
      .channel(`collaborator-access-${props.colaboradorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores', filter: `id=eq.${props.colaboradorId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colaborador_modulos', filter: `colaborador_id=eq.${props.colaboradorId}` }, refresh)
      .subscribe();

    const interval = window.setInterval(refresh, 30_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onRevoked = () => { void revoke('Sua sessão administrativa foi encerrada.'); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('gsa-session-revoked', onRevoked);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('gsa-session-revoked', onRevoked);
      void supabase.removeChannel(channel);
    };
  }, [props.adminType, props.colaboradorId, refreshAccess, revoke]);

  useEffect(() => {
    if (checking || route.area !== 'admin') return;
    if (!hasAdminModuleAccess(route.module, props.adminType, modules, route.submodule)) {
      toast.error('Você não possui permissão para acessar este módulo.');
      navigate(defaultAdminPath(props.adminType, modules));
    }
  }, [checking, modules, props.adminType, route.area, route.module, route.submodule]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-sm font-semibold text-neutral-500">Validando permissões...</div>;
  }

  return (
    <AdminPanel
      onLogout={props.onLogout}
      adminType={props.adminType}
      colaboradorId={props.colaboradorId}
      colaboradorNomeInicial={name}
      colaboradorModulos={modules}
    />
  );
}
