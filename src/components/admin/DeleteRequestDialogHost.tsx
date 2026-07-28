import { useEffect } from 'react';
import { useConfirm } from '../../hooks/useConfirm';
import {
  DELETE_REASON_REQUEST_EVENT,
  type DeleteReasonRequestDetail,
} from '../../lib/deleteRequest';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function DeleteRequestDialogHost() {
  const confirmHook = useConfirm();
  const { confirm } = confirmHook;

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<DeleteReasonRequestDetail>).detail;
      if (!detail || detail.handled) return;
      detail.handled = true;

      void confirm({
        title: 'Solicitar exclusão para aprovação',
        message: 'Como colaborador, você não pode excluir diretamente. Informe o motivo; a solicitação será registrada e enviada à administração.',
        confirmLabel: 'Enviar solicitação',
        cancelLabel: 'Cancelar',
        variant: 'warning',
        promptLabel: 'Motivo da exclusão',
        promptPlaceholder: 'Descreva por que este registro precisa ser excluído...',
        promptRequired: true,
      }).then((result) => {
        detail.resolve(typeof result === 'string' ? result.trim() || null : null);
      }).catch(() => detail.resolve(null));
    };

    window.addEventListener(DELETE_REASON_REQUEST_EVENT, handleRequest as EventListener);
    return () => window.removeEventListener(DELETE_REASON_REQUEST_EVENT, handleRequest as EventListener);
  }, [confirm]);

  return <ConfirmDialog {...confirmHook} />;
}
