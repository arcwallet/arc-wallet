/**
 * OTP Input Component
 * 6-digit verification code input with auto-focus and paste support
 */

import React, { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: string | null;
}

const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  error = null,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Split value into array of digits
  const digits = value.split('').slice(0, length);
  while (digits.length < length) {
    digits.push('');
  }

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const focusInput = (index: number) => {
    if (index >= 0 && index < length && inputRefs.current[index]) {
      inputRefs.current[index]?.focus();
    }
  };

  const handleChange = (index: number, inputValue: string) => {
    // Only allow digits
    const digit = inputValue.replace(/\D/g, '').slice(-1);

    if (digit) {
      const newDigits = [...digits];
      newDigits[index] = digit;
      onChange(newDigits.join(''));

      // Move to next input
      if (index < length - 1) {
        focusInput(index + 1);
      }
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();

      if (digits[index]) {
        // Clear current digit
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
      } else if (index > 0) {
        // Move to previous input and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const pastedDigits = pastedData.replace(/\D/g, '').slice(0, length);

    if (pastedDigits) {
      onChange(pastedDigits);
      // Focus last filled input or last input
      const lastIndex = Math.min(pastedDigits.length, length) - 1;
      focusInput(lastIndex);
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    // Select the input content
    inputRefs.current[index]?.select();
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 sm:gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            onBlur={handleBlur}
            disabled={disabled}
            className={`
              w-11 h-14 sm:w-12 sm:h-16
              text-center text-2xl font-semibold
              bg-slate-900/60 border rounded-lg
              text-white placeholder-slate-500
              transition-all duration-200
              focus:outline-none focus:ring-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error
                ? 'border-red-500/50 focus:border-red-400 focus:ring-red-400/30'
                : focusedIndex === index
                  ? 'border-blue-400 ring-2 ring-blue-400/30'
                  : digit
                    ? 'border-slate-400/50'
                    : 'border-slate-600/50'
              }
            `}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center animate-shake">
          {error}
        </p>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default OtpInput;
