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

  useDialogAccessibility({ isOpen, containerRef: panelRef, onClose });

  if (typeof document === 'undefined') return null;

  return createPortal(
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
    </AnimatePresence>,
    document.body,
  );
}
