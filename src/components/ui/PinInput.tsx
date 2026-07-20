import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  label?: string;
  onEnter?: () => void;
}

export function PinInput({ value, onChange, disabled = false, error = false, autoFocus = true, label, onEnter }: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const digits = value.padEnd(4, '').split('').slice(0, 4);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [autoFocus]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) return;

    const char = val.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const newValue = newDigits.join('').replace(/ /g, '');
    onChange(newValue);

    // Auto-focus next
    if (index < 3 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onEnter) onEnter();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (newDigits[index] && newDigits[index] !== ' ') {
        newDigits[index] = ' ';
        onChange(newDigits.join('').trimEnd());
      } else if (index > 0) {
        newDigits[index - 1] = ' ';
        onChange(newDigits.join('').trimEnd());
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pastedData) {
      onChange(pastedData);
      const focusIndex = Math.min(pastedData.length, 3);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    inputRefs.current[index]?.select();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <label className="text-sm font-medium text-[#1a1a1a]/60">{label}</label>
      )}
      <div className="flex items-center gap-3" onPaste={handlePaste}>
        {[0, 1, 2, 3].map((index) => (
          <motion.div
            key={index}
            animate={{
              scale: focusedIndex === index ? 1.05 : 1,
              borderColor: error
                ? 'rgba(239, 68, 68, 0.7)'
                : focusedIndex === index
                ? 'rgba(0, 0, 0, 0.4)'
                : digits[index]?.trim()
                ? 'rgba(0, 0, 0, 0.2)'
                : 'rgba(0, 0, 0, 0.08)',
            }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            <input
              ref={(el) => { inputRefs.current[index] = el; }}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digits[index]?.trim() || ''}
              onChange={(e) => handleChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => handleFocus(index)}
              onBlur={() => setFocusedIndex(null)}
              disabled={disabled}
              className={`
                w-14 h-16 sm:w-16 sm:h-18 text-center text-2xl font-bold rounded-2xl
                border-2 bg-white outline-none transition-all duration-200
                focus:shadow-lg focus:shadow-black/5
                disabled:opacity-50 disabled:cursor-not-allowed
                ${error
                  ? 'border-red-400 bg-red-50/50 text-red-600 animate-shake'
                  : 'border-black/8 text-[#1a1a1a] focus:border-black/40'
                }
              `}
              style={{ caretColor: 'transparent' }}
              autoComplete="off"
            />
            {/* Dot indicator */}
            {!digits[index]?.trim() && focusedIndex !== index && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-2.5 h-2.5 rounded-full ${error ? 'bg-red-300' : 'bg-black/10'}`} />
              </div>
            )}
            {/* Cursor blink when focused and empty */}
            {focusedIndex === index && !digits[index]?.trim() && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                  className="w-0.5 h-7 bg-black/60 rounded-full"
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
