import type { ComponentProps } from 'react';
import { ProtectionMarketplace as LegacyProtectionMarketplace } from './ProtectionMarketplaceLegacy';
import { ProtectionMarketplace as InsuranceDirectQuoteMarketplace } from './InsuranceDirectQuoteMarketplace';

export type ProtectionDomain = 'saude' | 'seguros';

type ProtectionMarketplaceProps = ComponentProps<typeof LegacyProtectionMarketplace>;

export function ProtectionMarketplace(props: ProtectionMarketplaceProps) {
  if (props.domain === 'seguros') {
    return <InsuranceDirectQuoteMarketplace {...props} domain="seguros" />;
  }

  return <LegacyProtectionMarketplace {...props} domain="saude" />;
}

export default ProtectionMarketplace;
