import type { ComponentProps } from 'react';

export type { AdvertisingPlacementCode } from './AdvertisingSlotLegacy';
export { AdvertisingSlot as AdvertisingSlotLegacy } from './AdvertisingSlotLegacy';

import { AdvertisingSlot as LegacyAdvertisingSlot } from './AdvertisingSlotLegacy';

type Props = ComponentProps<typeof LegacyAdvertisingSlot>;

export function AdvertisingSlot(props: Props) {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    if (pathname === '/empresa' || pathname.startsWith('/empresa/')) return null;
  }

  return <LegacyAdvertisingSlot {...props} />;
}
