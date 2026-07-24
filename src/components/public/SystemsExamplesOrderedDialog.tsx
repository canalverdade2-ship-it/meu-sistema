import type { ComponentProps } from 'react';
import { SystemsExamplesDialog as BaseSystemsExamplesDialog } from './SystemsExamplesDialog';

export type { SystemExampleCategory } from './SystemsExamplesDialog';

type SystemsExamplesDialogProps = ComponentProps<typeof BaseSystemsExamplesDialog>;

export function SystemsExamplesDialog(props: SystemsExamplesDialogProps) {
  return (
    <>
      <style>{`
        [role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          overflow-y: auto !important;
        }

        [role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child {
          order: 1;
        }

        [role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) {
          order: 2;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        [role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) {
          order: 3;
          border-top: 0 !important;
        }

        @media (min-width: 1024px) {
          [role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) {
            grid-template-columns: 250px minmax(0, 1fr) !important;
            grid-template-rows: auto minmax(430px, 1fr) !important;
            align-items: stretch;
          }

          [role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child {
            grid-column: 1;
            grid-row: 1 / span 2;
            order: 1;
          }

          [role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) {
            grid-column: 2;
            grid-row: 1;
            order: 2;
            border-left-width: 0 !important;
            border-top-width: 0 !important;
          }

          [role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) {
            grid-column: 2;
            grid-row: 2;
            order: 3;
          }
        }
      `}</style>
      <BaseSystemsExamplesDialog {...props} />
    </>
  );
}
