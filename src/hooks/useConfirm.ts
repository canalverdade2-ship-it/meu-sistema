import { useState, useCallback, useRef } from 'react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  /** Se definido, exibe um campo de texto e torna a confirmação obrigatória */
  promptLabel?: string;
  promptPlaceholder?: string;
  promptRequired?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  promptValue: string;
  resolve: ((value: string | boolean | null) => void) | null;
}

const DEFAULT_STATE: ConfirmState = {
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  variant: 'danger',
  promptLabel: undefined,
  promptPlaceholder: undefined,
  promptRequired: false,
  promptValue: '',
  resolve: null,
};

/**
 * Hook que fornece uma função `confirm` assíncrona para substituir
 * `window.confirm` e `window.prompt` com um modal React acessível.
 *
 * Para simples confirmação (sem prompt): retorna `true` ou `false`.
 * Com `promptLabel`: retorna a string digitada ou `null` se cancelado.
 *
 * @example
 * const { confirm, ConfirmDialog } = useConfirm();
 *
 * // Uso simples (substitui window.confirm):
 * if (!await confirm({ title: 'Excluir?', message: 'Isso não pode ser desfeito.' })) return;
 *
 * // Com campo de texto (substitui window.prompt):
 * const motivo = await confirm({
 *   title: 'Motivo da rejeição',
 *   message: 'Informe o motivo:',
 *   promptLabel: 'Motivo',
 *   promptRequired: true,
 * });
 * if (!motivo) return;
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(DEFAULT_STATE);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<string | boolean | null> => {
    return new Promise((resolve) => {
      setState({
        ...DEFAULT_STATE,
        ...options,
        isOpen: true,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!state.resolve) return;
    if (state.promptLabel !== undefined) {
      if (state.promptRequired && !state.promptValue.trim()) return;
      state.resolve(state.promptValue.trim() || null);
    } else {
      state.resolve(true);
    }
    setState(DEFAULT_STATE);
  }, [state]);

  const handleCancel = useCallback(() => {
    if (!state.resolve) return;
    state.resolve(state.promptLabel !== undefined ? null : false);
    setState(DEFAULT_STATE);
  }, [state]);

  const handlePromptChange = useCallback((value: string) => {
    setState((prev) => ({ ...prev, promptValue: value }));
  }, []);

  return { confirm, confirmState: state, handleConfirm, handleCancel, handlePromptChange, promptInputRef };
}
