'use client';

import type { InputHTMLAttributes } from 'react';
import { useState } from 'react';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Accessible names for the eye button, in the page's language. */
  showLabel?: string;
  hideLabel?: string;
}

/** A password field with an eye button that shows or hides what was typed. */
export function PasswordInput({
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  className,
  ...input
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={`kz-password${className ? ` ${className}` : ''}`}>
      <input {...input} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="kz-password-toggle"
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        onClick={() => setVisible((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible ? null : <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}
