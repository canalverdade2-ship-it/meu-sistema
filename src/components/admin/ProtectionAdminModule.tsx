import type { ComponentProps } from 'react';
import { ProtectionAdminModule as LegacyProtectionAdminModule } from './ProtectionAdminModuleLegacy';
import { ProtectionAdminModule as InsuranceProtectionAdminModule } from './InsuranceProtectionAdminModule';

type ProtectionAdminModuleProps = ComponentProps<typeof LegacyProtectionAdminModule>;

export function ProtectionAdminModule(props: ProtectionAdminModuleProps) {
  if (props.domain === 'seguros') {
    return <InsuranceProtectionAdminModule {...props} domain="seguros" />;
  }

  return <LegacyProtectionAdminModule {...props} domain="saude" />;
}

export default ProtectionAdminModule;
