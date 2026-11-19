"use client";

import { useEffect, useState } from "react";

const btn = "rounded-2xl bg-[#5a2210] px-6 py-2 text-sm font-bold text-white transition active:scale-[.98] disabled:opacity-40";
const btn2 = "rounded-xl border-2 border-[#f3c9a3] bg-white px-3 py-1.5 text-sm font-bold text-[#5a2210] transition active:scale-95 disabled:opacity-40";

export function ConfirmDialog({
  message,
  label,
  onCancel,
  onConfirm,
  requireText,
  askText,
}: {
  message: string;
  label: string;
  onCancel: () => void;
  onConfirm: (text: string) => void;
  // Para confirmar hay que escribir exactamente este texto.
  requireText?: string;
  // Pide un texto libre (no vacío) con este valor inicial.
  askText?: { label: string; initial: string };
}) {
  const [text, setText] = useState(askText?.initial ?? "");
  const needsInput = requireText !== undefined || askText !== undefined;
  const valid = requireText !== undefined ? text.trim() === requireText.trim() : askText ? text.trim().length > 0 : true;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#5a2210]/40 p-6" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border-2 border-[#f3c9a3] bg-[#fdf5ea] p-6 text-[#5a2210] shadow-xl"
      >
        <p id="confirm-message" className="text-lg font-extrabold leading-snug">
          {message}
        </p>
        {needsInput && (
          <label className="flex flex-col gap-2 text-sm text-[#8a5a3c]">
            {requireText !== undefined ? (
              <span>
                Para confirmar, escribe <strong className="text-[#5a2210]">{requireText}</strong>
              </span>
            ) : (
              askText!.label
            )}
            <input
              autoFocus
              value={text}
              maxLength={100}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid) onConfirm(text);
              }}
              className="rounded-xl border-2 border-[#f3c9a3] bg-white px-3 py-2 text-base text-[#5a2210] outline-none focus:border-[#ee8b43]"
            />
          </label>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" autoFocus={!needsInput} className={btn2} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" disabled={!valid} className={btn} onClick={() => onConfirm(text)}>
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

