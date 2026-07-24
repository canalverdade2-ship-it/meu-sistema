import type { ComponentProps } from 'react';
import { ProtectionMarketplace as DirectQuoteMarketplace } from './InsuranceDirectQuoteMarketplace';

export type ProtectionDomain = 'saude' | 'seguros';

type ProtectionMarketplaceProps = ComponentProps<typeof DirectQuoteMarketplace>;

export function ProtectionMarketplace(props: ProtectionMarketplaceProps) {
  return <DirectQuoteMarketplace {...props} />;
}

export default ProtectionMarketplace;
