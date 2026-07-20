import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'wide' | 'auto';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const reduceMotion = useReducedMotion();
  const titleId = `modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl md:max-w-2xl',
    '2xl': 'max-w-2xl md:max-w-3xl',
    '3xl': 'max-w-3xl md:max-w-4xl',
    '4xl': 'max-w-4xl md:max-w-5xl',
    '5xl': 'max-w-5xl md:max-w-6xl',
    '6xl': 'max-w-6xl md:max-w-7xl',
    '7xl': 'max-w-7xl md:max-w-[90vw]',
    full: 'max-w-[98vw]',
    wide: 'max-w-[95vw] md:max-w-[90vw]',
    auto: 'w-full md:w-auto md:min-w-[600px] max-w-[95vw]',
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('whatsapp-modal-state', { detail: { open: isOpen } }));
    return () => {
      if (isOpen) window.dispatchEvent(new CustomEvent('whatsapp-modal-state', { detail: { open: false } }));
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 24 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.4, bounce: 0.1 }}
            className={`w-full ${sizes[size]} max-h-[95vh] overflow-y-auto rounded-t-[1.5rem] bg-white p-4 shadow-2xl ring-1 ring-black/5 sm:max-h-[90vh] sm:rounded-[2rem] sm:p-6 custom-scrollbar`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="sticky top-0 z-10 mb-5 flex items-center justify-between border-b border-neutral-100 bg-white pb-4">
              <h2 id={titleId} className="text-lg font-black uppercase tracking-tight text-neutral-900 sm:text-xl">{title}</h2>
              <button type="button" onClick={onClose} className="rounded-xl p-2 text-neutral-400 transition-all hover:bg-neutral-100 hover:text-neutral-700 active:scale-95" aria-label="Fechar janela">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="pb-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
