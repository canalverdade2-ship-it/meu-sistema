import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  panelClassName?: string;
  overlayClassName?: string;
  zIndexClassName?: string;
  closeOnBackdrop?: boolean;
}

export function AccessibleDialog({
  isOpen,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  panelClassName = 'max-w-4xl rounded-2xl bg-white p-6 shadow-2xl',
  overlayClassName = 'items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm',
  zIndexClassName = 'z-[110]',
  closeOnBackdrop = true,
}: AccessibleDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const isSystemsDemo = ariaLabel?.startsWith('Laboratório de demonstração') ?? false;

  useDialogAccessibility({ isOpen, containerRef: panelRef, onClose });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {isSystemsDemo && (
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
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
            className={`fixed inset-0 flex ${zIndexClassName} ${overlayClassName}`}
            onMouseDown={(event) => {
              if (closeOnBackdrop && event.target === event.currentTarget) onClose();
            }}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabelledBy ? undefined : ariaLabel}
              aria-labelledby={ariaLabelledBy}
              tabIndex={-1}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.32, bounce: 0.08 }}
              className={`w-full outline-none ${panelClassName}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
