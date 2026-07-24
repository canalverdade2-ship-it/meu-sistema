import {
  ClientAccessModal,
  type ClientAccessMode,
} from './ClientAccessModal';
import {
  buildFreeToolsProLoginReturnUrl,
  consumeFreeToolsProLoginReturn,
} from '../../lib/freeToolsProLoginReturn';

export type { ClientAccessMode };

interface ClientAccessModalWithReturnProps {
  isOpen: boolean;
  initialMode?: ClientAccessMode;
  onClose: () => void;
  onLoginClient: (id: string, isRecovery?: boolean) => void;
}

export function ClientAccessModalWithReturn({
  isOpen,
  initialMode,
  onClose,
  onLoginClient,
}: ClientAccessModalWithReturnProps) {
  const handleLoginClient = (id: string, isRecovery = false) => {
    const pendingTool = isRecovery ? null : consumeFreeToolsProLoginReturn();

    onLoginClient(id, isRecovery);

    if (pendingTool) {
      window.location.replace(buildFreeToolsProLoginReturnUrl(pendingTool));
    }
  };

  return (
    <ClientAccessModal
      isOpen={isOpen}
      initialMode={initialMode}
      onClose={onClose}
      onLoginClient={handleLoginClient}
    />
  );
}
