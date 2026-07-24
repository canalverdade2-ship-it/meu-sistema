import type { ComponentProps } from 'react';
import { BrandExamplesDialog as BrandPortfolioInteractiveDialog } from './BrandPortfolioInteractiveDialog';

export type { BrandExampleCategory } from './BrandPortfolioInteractiveDialog';

type BrandExamplesDialogProps = ComponentProps<typeof BrandPortfolioInteractiveDialog>;

export function BrandExamplesDialog(props: BrandExamplesDialogProps) {
  return (
    <>
      <style>{`
        [role="dialog"][aria-label^="Galeria de referências"] > div > div:nth-child(2) > div:first-child {
          display: flex;
          flex-direction: column;
        }

        [role="dialog"][aria-label^="Galeria de referências"] > div > div:nth-child(2) > div:first-child > div:first-child {
          order: 2;
          margin-top: 1.5rem;
        }

        [role="dialog"][aria-label^="Galeria de referências"] > div > div:nth-child(2) > div:first-child > div:nth-child(2) {
          order: 1;
          margin-top: 0 !important;
          padding-top: 0 !important;
          border-top-width: 0 !important;
        }
      `}</style>
      <BrandPortfolioInteractiveDialog {...props} />
    </>
  );
}
