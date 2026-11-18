"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { setNickname, submitAnswer, type ActionResult } from "./actions";
import type { PlayState } from "@/lib/quest";
import { usePolling } from "@/lib/usePolling";

// Paleta fija (no cambia con el modo oscuro del sistema).
const INK = "text-[#5a2210]";
const orangeBtn = "bg-[#ee8b43] text-white";
const greenBtn = "bg-[#2e9e6e] text-white";
const primaryBtn = `w-full rounded-2xl bg-[#5a2210] px-5 py-4 text-lg font-bold text-white transition active:scale-[.98] disabled:opacity-40`;
const field = `w-full rounded-2xl border-2 border-[#f3c9a3] bg-white px-4 py-3 text-lg ${INK} outline-none focus:border-[#ee8b43]`;

export function PlayerView() {
  const { data, failed, refresh } = usePolling<PlayState>("/api/play/state");

  if (!data) {
    return (
      <Shell>
        <Message>{failed ? "No se pudo cargar. Reintentando…" : "Cargando…"}</Message>
      </Shell>
    );
  }

  if (data.status === "none") {
    return (
      <Shell>
        <Message title="Quest">Esperando a que el moderador cree una sesión…</Message>
      </Shell>
    );
  }

  if (!data.me) {
    if (data.status === "finished") {
      return (
        <Shell title={data.title}>
          <Message>Esta sesión ya terminó.</Message>
        </Shell>
      );
    }
    return (
      <Shell title={data.title}>
        <NicknameForm onDone={refresh} />
      </Shell>
    );
  }

  const progress = data.status === "live" && data.total > 0 ? { current: data.index + 1, total: data.total } : undefined;

  return (
    <Shell title={data.title} progress={progress}>
      {(data.status === "draft" || data.status === "ready") && (
        <Message title={`Hola, ${data.me}`}>Esperando a que el moderador inicie la sesión…</Message>
      )}

      {data.status === "finished" && (
        <Message title="¡Gracias por participar!" done>
          La sesión ha terminado.
        </Message>
      )}

      {data.status === "live" && data.question && (
        <>
          {data.answered ? (
            <Message title="¡Respuesta enviada!" done>
              Esperando la siguiente pregunta…
            </Message>
          ) : (
            <AnswerForm key={data.question.id} question={data.question} onDone={refresh} />
          )}
        </>
      )}
    </Shell>
  );
}

// Marco tipo teléfono: pantalla completa en móvil, columna de ancho móvil en escritorio.
function Shell({
  title,
  progress,
  children,
}: {
  title?: string;
  progress?: { current: number; total: number };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-[#f7e4cf] sm:p-6">
      <div className="relative flex min-h-dvh w-full max-w-[420px] flex-col overflow-hidden bg-[#fdf5ea] sm:min-h-0 sm:h-[800px] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2.5rem] sm:border-[10px] sm:border-white sm:shadow-xl">
        {/* formas decorativas */}
        <div aria-hidden className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-[#faead7]" />
        <div aria-hidden className="pointer-events-none absolute -left-28 bottom-10 h-80 w-80 rounded-full bg-[#faead7]" />

        <header className="relative z-10 flex flex-col gap-3 px-6 pb-2 pt-8">
          <h1 className={`truncate text-center text-xl font-extrabold ${INK}`}>{title ?? "Quest"}</h1>
          {progress && (
            <div className="flex flex-col gap-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f6dcc0]">
                <div
                  className="h-full rounded-full bg-[#2e9e6e] transition-all duration-500"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm font-bold">
                <span className="text-[#2e9e6e]">{progress.current}</span>
                <span className="text-[#c9a487]">/{progress.total}</span>
              </p>
            </div>
          )}
        </header>

        <main className="relative z-10 flex flex-1 flex-col overflow-y-auto px-6 pb-8 pt-4">{children}</main>
      </div>
    </div>
  );
}

function Message({ title, done, children }: { title?: string; done?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      {done && (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e9e6e] text-white">
          <CheckIcon className="h-8 w-8" />
        </span>
      )}
      {title && <h2 className={`text-2xl font-extrabold ${INK}`}>{title}</h2>}
      <p className="text-lg text-[#8a5a3c]">{children}</p>
    </div>
  );
}

function NicknameForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(setNickname, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-1 flex-col justify-center gap-4">
      <h2 className={`text-3xl font-extrabold leading-tight ${INK}`}>¿Cómo quieres que te llamemos?</h2>
      <label htmlFor="nickname" className="text-[#8a5a3c]">
        Elige un nickname para comenzar
      </label>
      <input id="nickname" name="nickname" required minLength={2} maxLength={20} autoFocus autoComplete="off" className={field} />
      <button disabled={pending} className={primaryBtn}>
        {pending ? "Entrando…" : "Comenzar"}
      </button>
      {state.error && <p className="text-sm font-semibold text-red-700">{state.error}</p>}
    </form>
  );
}

function AnswerForm({
  question,
  onDone,
}: {
  question: NonNullable<PlayState["question"]>;
  onDone: () => void;
}) {
  const [picks, setPicks] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>(() => question.options.map((_, i) => i));
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { type } = question;

  function toggle(i: number) {
    if (type === "single" || type === "rating") setPicks([i]);
    else setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  }

  function moveItem(pos: number, d: -1 | 1) {
    setOrder((o) => {
      const j = pos + d;
      if (j < 0 || j >= o.length) return o;
      const copy = [...o];
      [copy[pos], copy[j]] = [copy[j], copy[pos]];
      return copy;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const value = type === "text" || type === "number" ? text : type === "ranking" ? order : picks;
    startTransition(async () => {
      const res = await submitAnswer(question.id, value);
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  const ready =
    type === "text" ? text.trim().length > 0 : type === "number" ? text.trim() !== "" : type === "ranking" ? true : picks.length > 0;

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
      <h2 className={`whitespace-pre-wrap text-2xl font-extrabold leading-snug ${INK}`}>{question.text}</h2>

      {type === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={6}
          placeholder="Escribe tu respuesta"
          className={`${field} resize-none`}
        />
      )}

      {type === "number" && (
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un número"
          className={field}
        />
      )}

      {type === "rating" && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-3">
          {question.options.map((opt, i) => {
            const selected = picks.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(i)}
                className={`flex aspect-square items-center justify-center rounded-2xl text-2xl font-extrabold shadow-sm transition active:scale-95 ${
                  selected ? greenBtn : orangeBtn
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {type === "ranking" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-[#8a5a3c]">Ordena de la primera a la última con las flechas</p>
          {order.map((optionIndex, pos) => (
            <div key={optionIndex} className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ${orangeBtn}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 font-extrabold">
                {pos + 1}
              </span>
              <span className="flex-1 whitespace-pre-wrap text-lg font-bold">{question.options[optionIndex]}</span>
              <button
                type="button"
                aria-label="Subir"
                disabled={pos === 0}
                onClick={() => moveItem(pos, -1)}
                className="rounded-lg bg-white/25 p-2 disabled:opacity-30"
              >
                <ChevronIcon className="h-4 w-4 -rotate-90" />
              </button>
              <button
                type="button"
                aria-label="Bajar"
                disabled={pos === order.length - 1}
                onClick={() => moveItem(pos, 1)}
                className="rounded-lg bg-white/25 p-2 disabled:opacity-30"
              >
                <ChevronIcon className="h-4 w-4 rotate-90" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(type === "single" || type === "multiple") && (
        <div className="flex flex-col gap-3">
          {type === "multiple" && <p className="text-sm font-semibold text-[#8a5a3c]">Puedes elegir varias opciones</p>}
          {question.options.map((opt, i) => {
            const selected = picks.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(i)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left text-lg font-bold shadow-sm transition active:scale-[.98] ${
                  selected ? greenBtn : orangeBtn
                }`}
              >
                <span className="whitespace-pre-wrap">{opt}</span>
                {selected ? <CheckIcon className="h-6 w-6 shrink-0" /> : <ChevronIcon className="h-5 w-5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-2">
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
        <button disabled={pending || !ready} className={primaryBtn}>
          {pending ? "Enviando…" : "Enviar respuesta"}
        </button>
      </div>
    </form>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
