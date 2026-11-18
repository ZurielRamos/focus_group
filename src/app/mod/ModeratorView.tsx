"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { newSession, nextQuestion, resetSession, saveQuestions, startSession } from "../actions";
import type { ModState, Question, QuestionResult, QuestionType } from "@/lib/quest";
import { usePolling } from "@/lib/usePolling";

const card = "rounded-2xl border-2 border-[#f3c9a3] bg-white/70 p-5";
const btn = "rounded-2xl bg-[#5a2210] px-6 py-3 font-bold text-white transition active:scale-[.98] disabled:opacity-40";
const btn2 = "rounded-xl border-2 border-[#f3c9a3] bg-white px-3 py-1.5 text-sm font-bold text-[#5a2210] transition active:scale-95 disabled:opacity-40";
const input = "rounded-xl border-2 border-[#f3c9a3] bg-white px-3 py-2 text-[#5a2210] outline-none focus:border-[#ee8b43]";

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-[#fdf5ea] text-[#5a2210]">
      <div aria-hidden className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-[#faead7]" />
      <div aria-hidden className="pointer-events-none absolute -left-40 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[#faead7]" />
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">{children}</main>
    </div>
  );
}

const WARN_ANSWERS = "Se borrarán todas las respuestas y la sesión volverá al inicio. ¿Continuar?";

export function ModeratorView() {
  const { data, failed, refresh } = usePolling<ModState>("/api/mod/state");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{ message: string; label: string; onConfirm: () => void } | null>(null);

  if (!data) {
    return (
      <Page>
        {failed ? <p className="text-sm font-semibold text-red-700">No se pudo cargar el estado. Reintentando…</p> : <p className="text-[#8a5a3c]">Cargando…</p>}
      </Page>
    );
  }

  const joinUrl = window.location.origin;
  const modUrl = `${window.location.origin}/mod`;
  const isLast = data.index + 1 >= data.questions.length;
  const hasProgress = data.status === "live" || data.results.some((r) => r.answered > 0);

  const ask = (message: string, label: string, onConfirm: () => void) => setConfirm({ message, label, onConfirm });

  function run(fn: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      refresh();
    });
  }

  return (
    <Page>
      <header className={`flex flex-col gap-2 ${card}`}>
        <h1 className="text-3xl font-extrabold">{data.title}</h1>
        <CopyField label="Enlace para encuestados" url={joinUrl} hint="Compártelo con los participantes." />
        <CopyField
          label="Enlace de moderador"
          url={modUrl}
          hint="Panel para configurar y controlar la sesión."
        />
        <p className="text-sm">
          Participantes ({data.participants.length}):{" "}
          {data.participants.length ? data.participants.join(", ") : "ninguno todavía"}
        </p>
      </header>

      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

      {data.status !== "draft" && (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending}
            className={btn2}
            onClick={() => {
              const go = () => run(() => resetSession("draft"));
              if (hasProgress) ask(WARN_ANSWERS, "Editar sesión", go);
              else go();
            }}
          >
            Editar sesión
          </button>
          {data.status !== "ready" && (
            <button
              disabled={pending}
              className={btn2}
              onClick={() => {
                ask(WARN_ANSWERS, "Reiniciar sesión", () => run(() => resetSession("ready")));
              }}
            >
              Reiniciar sesión
            </button>
          )}
          <button
            disabled={pending}
            className={btn2}
            onClick={() => {
              ask("Se descartará esta sesión, sus participantes y respuestas. ¿Crear una nueva?", "Crear nueva", () => run(newSession));
            }}
          >
            Nueva sesión
          </button>
        </div>
      )}

      {data.status === "ready" && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-[#8a5a3c]">
            La sesión está lista con {data.questions.length} pregunta{data.questions.length === 1 ? "" : "s"}. Los encuestados esperan el inicio.
          </p>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            {data.questions.map((q) => (
              <li key={q.id} className="whitespace-pre-wrap">{q.text}</li>
            ))}
          </ol>
          <button disabled={pending} className={`${btn} self-start`} onClick={() => run(startSession)}>
            Iniciar sesión
          </button>
        </section>
      )}

      {data.status === "draft" && (
        <Editor
          initialTitle={data.title}
          initial={data.questions}
          onStart={(save) =>
            run(async () => {
              const saved = await save();
              return saved.error ? saved : startSession();
            })
          }
          onError={setError}
          busy={pending}
        />
      )}

      {data.status === "live" && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f6dcc0]">
              <div
                className="h-full rounded-full bg-[#2e9e6e] transition-all duration-500"
                style={{ width: `${((data.index + 1) / data.questions.length) * 100}%` }}
              />
            </div>
            <p className="text-sm font-bold">
              <span className="text-[#2e9e6e]">{data.index + 1}</span>
              <span className="text-[#c9a487]">/{data.questions.length}</span>
            </p>
          </div>
          <QuestionBlock
            q={data.questions[data.index]}
            result={data.results[data.index]}
            participants={data.participants.length}
          />
          <button
            disabled={pending}
            onClick={() => run(() => nextQuestion(data.index))}
            className={`${btn} self-start`}
          >
            {isLast ? "Finalizar sesión" : "Siguiente pregunta"}
          </button>
        </section>
      )}

      {data.status === "finished" && (
        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-extrabold">Sesión finalizada · Resultados</h2>
          {data.questions.map((q, i) => (
            <QuestionBlock key={q.id} q={q} result={data.results[i]} participants={data.participants.length} />
          ))}
        </section>
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          label={confirm.label}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const action = confirm.onConfirm;
            setConfirm(null);
            action();
          }}
        />
      )}
    </Page>
  );
}

function ConfirmDialog({
  message,
  label,
  onCancel,
  onConfirm,
}: {
  message: string;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
        <div className="flex justify-end gap-3">
          <button type="button" autoFocus className={btn2} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={`${btn} py-2 text-sm`} onClick={onConfirm}>
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyField({ label, url, hint }: { label: string; url: string; hint: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // sin permiso de portapapeles: el usuario puede seleccionar el texto
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${input} flex-1 text-sm`} />
        <button type="button" onClick={copy} className={btn2}>
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <span className="text-xs text-[#8a5a3c]">{hint}</span>
    </div>
  );
}

function QuestionBlock({ q, result, participants }: { q: Question; result: QuestionResult; participants: number }) {
  const max = Math.max(1, ...result.counts);
  const fmt = (n: number | null) => (n === null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(2));

  return (
    <div className={`flex flex-col gap-3 ${card}`}>
      <h3 className="whitespace-pre-wrap text-xl font-extrabold leading-snug">{q.text}</h3>
      <p className="text-sm text-[#8a5a3c]">
        {TYPE_LABEL[q.type]} · Respondieron {result.answered} de {participants}
      </p>

      {(q.type === "text" || q.type === "number") && (
        <>
          {q.type === "number" && result.answered > 0 && (
            <p className="text-sm">
              Promedio: <strong>{fmt(result.average)}</strong> · Mínimo: <strong>{fmt(result.min)}</strong> · Máximo:{" "}
              <strong>{fmt(result.max)}</strong>
            </p>
          )}
          {result.texts.length === 0 ? (
            <p className="text-sm text-[#8a5a3c]">Sin respuestas todavía.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {result.texts.map((t, i) => (
                <li key={i} className="whitespace-pre-wrap rounded-xl bg-[#faead7] p-3 text-sm">
                  <strong>{t.nickname}:</strong> {t.text}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {q.type === "ranking" && (
        <>
          <p className="text-xs text-[#8a5a3c]">Ordenado por posición promedio (1 = la más importante).</p>
          <ol className="flex flex-col gap-2">
            {q.options
              .map((opt, i) => ({ opt, rank: result.ranks[i] }))
              .sort((x, y) => (result.answered ? x.rank - y.rank : 0))
              .map(({ opt, rank }, k) => (
                <li key={opt + k} className="flex justify-between rounded-xl bg-[#faead7] p-3 text-sm">
                  <span>
                    <strong>{k + 1}.</strong> {opt}
                  </span>
                  <span className="text-[#8a5a3c]">{result.answered ? `pos. ${rank.toFixed(2)}` : "–"}</span>
                </li>
              ))}
          </ol>
        </>
      )}

      {(q.type === "single" || q.type === "multiple" || q.type === "rating") && (
        <>
          {q.type === "rating" && result.answered > 0 && (
            <p className="text-sm">
              Promedio: <strong>{fmt(result.average)}</strong>
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {q.options.map((opt, i) => (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{opt}</span>
                  <span>{result.counts[i]}</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#f6dcc0]">
                  <div className="h-2.5 rounded-full bg-[#2e9e6e] transition-all duration-500" style={{ width: `${(result.counts[i] / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Draft = { text: string; type: QuestionType; options: string[] };

const TYPE_LABEL: Record<QuestionType, string> = {
  single: "Selección simple",
  multiple: "Selección múltiple",
  rating: "Clasificación (escala numérica)",
  ranking: "Ranking (ordenar opciones)",
  number: "Número",
  text: "Texto libre",
};

const scale = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, k) => String(min + k));

function Editor({
  initialTitle,
  initial,
  onStart,
  onError,
  busy,
}: {
  initialTitle: string;
  initial: Question[];
  onStart: (save: () => Promise<{ error?: string }>) => void;
  onError: (msg: string | undefined) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState<Draft[]>(
    initial.length
      ? initial.map(({ text, type, options }) => ({ text, type, options }))
      : [{ text: "", type: "single", options: ["", ""] }],
  );
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const update = (i: number, patch: Partial<Draft>) => {
    setSaved(false);
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };
  const setOption = (qi: number, oi: number, v: string) =>
    update(qi, { options: questions[qi].options.map((o, k) => (k === oi ? v : o)) });
  const move = (i: number, d: -1 | 1) => {
    setSaved(false);
    setQuestions((qs) => {
      const j = i + d;
      if (j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };
  const changeType = (i: number, type: QuestionType) => {
    const prev = questions[i];
    let options: string[];
    if (type === "text" || type === "number") options = [];
    else if (type === "rating") options = scale(1, 7);
    else options = prev.type === "rating" || prev.options.length < 2 ? ["", ""] : prev.options;
    update(i, { type, options });
  };

  const save = () => saveQuestions(title, questions);

  function onSave() {
    onError(undefined);
    startSaving(async () => {
      const res = await save();
      if (res.error) onError(res.error);
      else setSaved(true);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-[#8a5a3c]">
        Título
        <input value={title} onChange={(e) => { setSaved(false); setTitle(e.target.value); }} maxLength={100} className={`${input} text-base`} />
      </label>

      {questions.map((q, i) => (
        <div key={i} className={`flex flex-col gap-3 ${card}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold">#{i + 1}</span>
            <select value={q.type} onChange={(e) => changeType(i, e.target.value as QuestionType)} className={`${input} py-1`}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <span className="flex-1" />
            <button type="button" className={btn2} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className={btn2} disabled={i === questions.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button
              type="button"
              className={btn2}
              disabled={questions.length === 1}
              onClick={() => { setSaved(false); setQuestions((qs) => qs.filter((_, k) => k !== i)); }}
            >
              Eliminar
            </button>
          </div>

          <textarea value={q.text} onChange={(e) => update(i, { text: e.target.value })} rows={3} placeholder="Enunciado de la pregunta" className={`${input} resize-y`} />

          {q.type === "rating" && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                Desde
                <select
                  value={q.options[0]}
                  onChange={(e) => update(i, { options: scale(Number(e.target.value), Number(q.options.at(-1))) })}
                  className={`${input} py-1`}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                Hasta
                <select
                  value={q.options.at(-1)}
                  onChange={(e) => update(i, { options: scale(Number(q.options[0]), Number(e.target.value)) })}
                  className={`${input} py-1`}
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <span className="text-[#8a5a3c]">Los encuestados eligen un número: {q.options.join(", ")}</span>
            </div>
          )}

          {q.type === "ranking" && (
            <p className="text-xs text-[#8a5a3c]">Los encuestados ordenarán estas opciones de la primera a la última.</p>
          )}

          {(q.type === "single" || q.type === "multiple" || q.type === "ranking") && (
            <div className="flex flex-col gap-2">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex gap-2">
                  <input value={o} onChange={(e) => setOption(i, oi, e.target.value)} maxLength={150} placeholder={`Opción ${oi + 1}`} className={`${input} flex-1`} />
                  <button
                    type="button"
                    className={btn2}
                    disabled={q.options.length <= 2}
                    onClick={() => update(i, { options: q.options.filter((_, k) => k !== oi) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={`${btn2} self-start`}
                disabled={q.options.length >= 10}
                onClick={() => update(i, { options: [...q.options, ""] })}
              >
                + Opción
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        className={`${btn2} self-start`}
        disabled={questions.length >= 50}
        onClick={() => { setSaved(false); setQuestions((qs) => [...qs, { text: "", type: "single", options: ["", ""] }]); }}
      >
        + Agregar pregunta
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn2} disabled={saving || busy} onClick={onSave}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {saved && <span className="text-sm font-bold text-[#2e9e6e]">Guardado</span>}
        <span className="flex-1" />
        <button type="button" className={btn} disabled={saving || busy} onClick={() => onStart(save)}>
          Iniciar sesión
        </button>
      </div>
    </section>
  );
}
