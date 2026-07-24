import type { ComponentProps } from 'react';
import { ProtectionAdminModule as DirectQuoteProtectionAdminModule } from './InsuranceProtectionAdminModule';

type ProtectionAdminModuleProps = ComponentProps<typeof DirectQuoteProtectionAdminModule>;

export function ProtectionAdminModule(props: ProtectionAdminModuleProps) {
  return <DirectQuoteProtectionAdminModule {...props} />;
}

export default ProtectionAdminModule;
