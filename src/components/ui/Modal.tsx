import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AccessibleDialog } from './AccessibleDialog';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'wide' | 'auto';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const generatedId = useId().replace(/:/g, '');
  const titleId = `modal-title-${generatedId}`;
  const sizes = {
    sm: 'w-full max-w-[95vw] sm:max-w-sm',
    md: 'w-full max-w-[95vw] sm:max-w-md',
    lg: 'w-full max-w-[95vw] sm:max-w-lg md:max-w-xl',
    xl: 'w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl',
    '2xl': 'w-full max-w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl',
    '3xl': 'w-full max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl',
    '4xl': 'w-full max-w-[95vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl',
    '5xl': 'w-full max-w-[95vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl',
    '6xl': 'w-full max-w-[95vw] sm:max-w-6xl md:max-w-7xl',
    '7xl': 'w-full max-w-[95vw] md:max-w-[90vw]',
    full: 'w-full max-w-[98vw]',
    wide: 'w-full max-w-[95vw] md:max-w-[90vw]',
    auto: 'w-full md:w-auto md:min-w-[500px] max-w-[95vw]',
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('whatsapp-modal-state', { detail: { open: isOpen } }));
    return () => {
      if (isOpen) window.dispatchEvent(new CustomEvent('whatsapp-modal-state', { detail: { open: false } }));
    };
  }, [isOpen]);

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy={titleId}
      zIndexClassName="z-[100]"
      overlayClassName="items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      panelClassName={`${sizes[size]} max-h-[95vh] overflow-y-auto rounded-t-[1.5rem] bg-white p-4 shadow-2xl ring-1 ring-black/5 sm:max-h-[90vh] sm:rounded-[2rem] sm:p-6 custom-scrollbar`}
    >
      <div className="sticky top-0 z-10 mb-5 flex items-center justify-between border-b border-neutral-100 bg-white pb-4">
        <h2 id={titleId} className="text-lg font-black uppercase tracking-tight text-neutral-900 sm:text-xl">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          data-dialog-autofocus
          className="rounded-xl p-2 text-neutral-400 transition-all hover:bg-neutral-100 hover:text-neutral-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"
          aria-label="Fechar janela"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="pb-2">{children}</div>
    </AccessibleDialog>
  );
}
