'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useLanguage } from './language';

export interface FormDialogControls {
  open: () => void;
  close: () => void;
}

export interface FormDialogProps {
  buttonLabel: string;
  title: string;
  description?: string;
  showTrigger?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpen?: () => void;
  children: (controls: FormDialogControls) => ReactNode;
}

/** The close button's spoken name, in the page language. */
const CLOSE: Record<string, string> = { en: 'Close', ur: 'بند کریں', ar: 'إغلاق' };

export function FormDialog({
  buttonLabel,
  title,
  description,
  showTrigger = true,
  isOpen: controlledOpen,
  onOpenChange,
  onOpen,
  children,
}: FormDialogProps) {
  const { locale } = useLanguage();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isOpen = controlledOpen ?? uncontrolledOpen;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function updateOpen(open: boolean): void {
    if (controlledOpen === undefined) setUncontrolledOpen(open);
    onOpenChange?.(open);
  }

  function open(): void {
    onOpen?.();
    updateOpen(true);
  }

  function close(): void {
    updateOpen(false);
  }

  return (
    <>
      {showTrigger ? (
        <button
          className="kz-button kz-form-dialog-trigger"
          type="button"
          aria-haspopup="dialog"
          onClick={open}
        >
          {buttonLabel}
        </button>
      ) : null}
      <dialog
        className="kz-form-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClose={close}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="kz-form-dialog-content">
          <div className="kz-form-dialog-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p id={descriptionId}>{description}</p> : null}
            </div>
            <button
              className="kz-button-quiet kz-form-dialog-close"
              type="button"
              aria-label={`${CLOSE[locale] ?? CLOSE.en} ${title}`}
              onClick={close}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="kz-form-dialog-body">{children({ open, close })}</div>
        </div>
      </dialog>
    </>
  );
}
