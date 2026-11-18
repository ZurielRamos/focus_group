"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { nextQuestion, resetSession, saveQuestions, startSession } from "../actions";
import type { ModState, Question, QuestionResult, QuestionType } from "@/lib/quest";
import { usePolling } from "@/lib/usePolling";
import { ConfirmDialog } from "./ConfirmDialog";
import { GUIDE_QUESTIONS, GUIDE_TITLE, type Draft } from "@/lib/guide";

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

// Pregunta y resultado con los que se compara la pregunta i (si están enlazadas).
function beforeOf(data: ModState, i: number) {
  const c = data.questions[i]?.compareTo;
  return c === null || c === undefined || !data.questions[c] ? undefined : { q: data.questions[c], result: data.results[c] };
}

const WARN_ANSWERS = "Se borrarán todas las respuestas y la sesión volverá al inicio. ¿Continuar?";

export function ModeratorView({ code }: { code: string }) {
  const { data, notFound, failed, refresh } = usePolling<ModState>(`/api/mod/${code}/state`);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{ message: string; label: string; onConfirm: () => void } | null>(null);

  if (notFound) {
    return (
      <Page>
        <p className="font-bold">Este quest no existe.</p>
        <Link href="/mod" className={`${btn2} self-start`}>← Todos los quests</Link>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page>
        {failed ? <p className="text-sm font-semibold text-red-700">No se pudo cargar el estado. Reintentando…</p> : <p className="text-[#8a5a3c]">Cargando…</p>}
      </Page>
    );
  }

  const joinUrl = `${window.location.origin}/q/${code}`;
  const modUrl = `${window.location.origin}/mod/${code}`;
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
      <Link href="/mod" className="self-start text-sm font-bold text-[#8a5a3c] hover:underline">
        ← Todos los quests
      </Link>

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
          <a href={`/api/mod/${code}/export`} download className={`${btn2} inline-block`}>
            Descargar CSV
          </a>
          <button
            disabled={pending}
            className={btn2}
            onClick={() => {
              const go = () => run(() => resetSession(code, "draft"));
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
                ask(WARN_ANSWERS, "Reiniciar sesión", () => run(() => resetSession(code, "ready")));
              }}
            >
              Reiniciar sesión
            </button>
          )}
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
          <button disabled={pending} className={`${btn} self-start`} onClick={() => run(() => startSession(code))}>
            Iniciar sesión
          </button>
        </section>
      )}

      {data.status === "draft" && (
        <Editor
          code={code}
          initialTitle={data.title}
          initial={data.questions}
          onStart={(save) =>
            run(async () => {
              const saved = await save();
              return saved.error ? saved : startSession(code);
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
            before={beforeOf(data, data.index)}
          />
          <button
            disabled={pending}
            onClick={() => run(() => nextQuestion(code, data.index))}
            className={`${btn} self-start`}
          >
            {isLast ? "Finalizar sesión" : "Siguiente pregunta"}
          </button>
        </section>
      )}

      {data.status === "finished" && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">Sesión finalizada · Resultados</h2>
            <a href={`/api/mod/${code}/export`} download className={`${btn2} inline-block`}>
              Descargar CSV (Excel)
            </a>
          </div>
          {data.questions.map((q, i) => (
            <QuestionBlock
              key={q.id}
              q={q}
              result={data.results[i]}
              participants={data.participants.length}
              before={beforeOf(data, i)}
            />
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

type Before = { q: Question; result: QuestionResult };

function Thumb({ src }: { src: string }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" />;
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const d = now - prev;
  return (
    <span className={`text-xs font-bold ${d > 0 ? "text-[#2e9e6e]" : d < 0 ? "text-red-700" : "text-[#8a5a3c]"}`}>
      antes {prev} ({d > 0 ? "+" : ""}
      {d})
    </span>
  );
}

function QuestionBlock({
  q,
  result,
  participants,
  before,
}: {
  q: Question;
  result: QuestionResult;
  participants: number;
  before?: Before;
}) {
  const max = Math.max(1, ...result.counts);
  const fmt = (n: number | null) => (n === null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(2));

  return (
    <div className={`flex flex-col gap-3 ${card}`}>
      <h3 className="whitespace-pre-wrap text-xl font-extrabold leading-snug">{q.text}</h3>
      <p className="text-sm text-[#8a5a3c]">
        {TYPE_LABEL[q.type]} · Respondieron {result.answered} de {participants}
      </p>
      {before && (
        <p className="text-xs font-semibold text-[#8a5a3c]">
          Comparada con la pregunta {q.compareTo! + 1} ({before.result.answered} respuestas).
        </p>
      )}

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

      {q.type === "matrix" && (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr>
                <th />
                {q.options.map((o, c) => (
                  <th key={c} className="px-2 pb-1 text-center align-bottom font-bold">
                    <div className="flex flex-col items-center gap-1">
                      <Thumb src={q.images[c]} />
                      {o}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.rows.map((row, r) => {
                const best = Math.max(...result.matrix[r]);
                return (
                  <tr key={r}>
                    <td className="max-w-[16rem] rounded-l-xl bg-[#faead7] p-2 font-semibold">{row}</td>
                    {q.options.map((_, c) => {
                      const n = result.matrix[r][c];
                      const win = best > 0 && n === best;
                      const prev = before?.result.matrix[r]?.[c];
                      return (
                        <td
                          key={c}
                          className={`bg-[#faead7] p-2 text-center last:rounded-r-xl ${win ? "font-extrabold text-[#2e9e6e]" : ""}`}
                        >
                          <div className="text-lg leading-none">{n}</div>
                          {prev !== undefined && <Delta now={n} prev={prev} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {q.type === "ranking" && (
        <>
          <p className="text-xs text-[#8a5a3c]">Ordenado por posición promedio (1 = la más importante).</p>
          <ol className="flex flex-col gap-2">
            {q.options
              .map((opt, i) => ({ opt, rank: result.ranks[i], i }))
              .sort((x, y) => (result.answered ? x.rank - y.rank : 0))
              .map(({ opt, rank, i }, k) => (
                <li key={opt + k} className="flex items-center justify-between gap-3 rounded-xl bg-[#faead7] p-3 text-sm">
                  <span className="flex items-center gap-3">
                    <Thumb src={q.images[i]} />
                    <span>
                      <strong>{k + 1}.</strong> {opt}
                    </span>
                  </span>
                  <span className="text-[#8a5a3c]">
                    {result.answered ? `pos. ${rank.toFixed(2)}` : "–"}
                    {before?.result.answered ? ` (antes ${before.result.ranks[i].toFixed(2)})` : ""}
                  </span>
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
              {before?.result.average != null && <> (antes {fmt(before.result.average)})</>}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {q.options.map((opt, i) => (
              <li key={i} className="flex items-center gap-3">
                <Thumb src={q.images[i]} />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{opt}</span>
                    <span className="flex items-center gap-2">
                      {before && <Delta now={result.counts[i]} prev={before.result.counts[i]} />}
                      {result.counts[i]}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#f6dcc0]">
                    <div className="h-2.5 rounded-full bg-[#2e9e6e] transition-all duration-500" style={{ width: `${(result.counts[i] / max) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const TYPE_LABEL: Record<QuestionType, string> = {
  single: "Selección simple",
  multiple: "Selección múltiple",
  rating: "Clasificación (escala numérica)",
  ranking: "Ranking (ordenar opciones)",
  number: "Número",
  text: "Texto libre",
  matrix: "Matriz (aspectos × opciones)",
};

const scale = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, k) => String(min + k));

const blankQuestion = (): Draft => ({ text: "", type: "single", options: ["", ""], images: ["", ""], rows: [], compareTo: null });

function Editor({
  code,
  initialTitle,
  initial,
  onStart,
  onError,
  busy,
}: {
  code: string;
  initialTitle: string;
  initial: Question[];
  onStart: (save: () => Promise<{ error?: string }>) => void;
  onError: (msg: string | undefined) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState<Draft[]>(
    initial.length
      ? initial.map(({ text, type, options, images, rows, compareTo }) => ({ text, type, options, images, rows, compareTo }))
      : [blankQuestion()],
  );
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();
  const [confirmGuide, setConfirmGuide] = useState(false);

  const update = (i: number, patch: Partial<Draft>) => {
    setSaved(false);
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };
  const setOption = (qi: number, oi: number, v: string) =>
    update(qi, { options: questions[qi].options.map((o, k) => (k === oi ? v : o)) });
  const setImage = (qi: number, oi: number, v: string) =>
    update(qi, { images: questions[qi].images.map((o, k) => (k === oi ? v : o)) });
  const setRow = (qi: number, ri: number, v: string) =>
    update(qi, { rows: questions[qi].rows.map((o, k) => (k === ri ? v : o)) });

  // order[k] = índice anterior de la pregunta que queda en la posición k; mantiene las comparaciones.
  const reorder = (order: number[]) => {
    setSaved(false);
    setQuestions((qs) => {
      const where = new Map(order.map((old, k) => [old, k]));
      return order.map((old, k) => {
        const q = qs[old];
        const c = q.compareTo === null ? null : (where.get(q.compareTo) ?? null);
        return { ...q, compareTo: c !== null && c < k ? c : null };
      });
    });
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= questions.length) return;
    const order = questions.map((_, k) => k);
    [order[i], order[j]] = [order[j], order[i]];
    reorder(order);
  };
  const remove = (i: number) => reorder(questions.map((_, k) => k).filter((k) => k !== i));

  const changeType = (i: number, type: QuestionType) => {
    const prev = questions[i];
    let options: string[];
    if (type === "text" || type === "number") options = [];
    else if (type === "rating") options = scale(1, 7);
    else options = prev.type === "rating" || prev.options.length < 2 ? ["", ""] : prev.options;
    update(i, {
      type,
      options,
      images: options.map((_, k) => (prev.images[k] && options === prev.options ? prev.images[k] : "")),
      rows: type === "matrix" ? (prev.rows.length ? prev.rows : [""]) : [],
      compareTo: null,
    });
  };

  // Preguntas anteriores con las que esta se puede comparar (mismo tipo y mismas opciones).
  const comparable = (i: number) =>
    questions
      .map((c, k) => ({ c, k }))
      .filter(
        ({ c, k }) =>
          k < i &&
          c.type === questions[i].type &&
          c.options.length === questions[i].options.length &&
          c.rows.length === questions[i].rows.length,
      );

  const save = () => saveQuestions(code, title, questions);

  function onSave() {
    onError(undefined);
    startSaving(async () => {
      const res = await save();
      if (res.error) onError(res.error);
      else setSaved(true);
    });
  }

  function loadGuide() {
    setConfirmGuide(false);
    setSaved(false);
    setTitle(GUIDE_TITLE);
    setQuestions(GUIDE_QUESTIONS.map((q) => ({ ...q })));
  }

  return (
    <section className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-[#8a5a3c]">
        Título
        <input value={title} onChange={(e) => { setSaved(false); setTitle(e.target.value); }} maxLength={100} className={`${input} text-base`} />
      </label>

      <button
        type="button"
        className={`${btn2} self-start`}
        onClick={() => (questions.some((q) => q.text.trim()) ? setConfirmGuide(true) : loadGuide())}
      >
        Cargar preguntas de la guía (Sello de Sostenibilidad)
      </button>

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
            <button type="button" className={btn2} disabled={questions.length === 1} onClick={() => remove(i)}>
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

          {q.type === "matrix" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[#8a5a3c]">
                Filas (aspectos): en cada una, el encuestado elige una de las opciones de abajo.
              </p>
              {q.rows.map((r, ri) => (
                <div key={ri} className="flex gap-2">
                  <input value={r} onChange={(e) => setRow(i, ri, e.target.value)} maxLength={150} placeholder={`Aspecto ${ri + 1}`} className={`${input} flex-1`} />
                  <button
                    type="button"
                    className={btn2}
                    disabled={q.rows.length <= 1}
                    onClick={() => update(i, { rows: q.rows.filter((_, k) => k !== ri) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={`${btn2} self-start`}
                disabled={q.rows.length >= 15}
                onClick={() => update(i, { rows: [...q.rows, ""] })}
              >
                + Aspecto
              </button>
              <p className="pt-1 text-xs text-[#8a5a3c]">Opciones (columnas):</p>
            </div>
          )}

          {(q.type === "single" || q.type === "multiple" || q.type === "ranking" || q.type === "matrix") && (
            <div className="flex flex-col gap-2">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex flex-wrap gap-2">
                  <input value={o} onChange={(e) => setOption(i, oi, e.target.value)} maxLength={150} placeholder={`Opción ${oi + 1}`} className={`${input} min-w-40 flex-1`} />
                  <input
                    value={q.images[oi] ?? ""}
                    onChange={(e) => setImage(i, oi, e.target.value)}
                    maxLength={300}
                    placeholder="Imagen (opcional): /sellos/huella.png"
                    className={`${input} min-w-40 flex-1 text-sm`}
                  />
                  <button
                    type="button"
                    className={btn2}
                    disabled={q.options.length <= 2}
                    onClick={() =>
                      update(i, {
                        options: q.options.filter((_, k) => k !== oi),
                        images: q.images.filter((_, k) => k !== oi),
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={`${btn2} self-start`}
                disabled={q.options.length >= 10}
                onClick={() => update(i, { options: [...q.options, ""], images: [...q.images, ""] })}
              >
                + Opción
              </button>
            </div>
          )}

          {comparable(i).length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              Comparar resultados con
              <select
                value={q.compareTo ?? ""}
                onChange={(e) => update(i, { compareTo: e.target.value === "" ? null : Number(e.target.value) })}
                className={`${input} py-1`}
              >
                <option value="">— ninguna —</option>
                {comparable(i).map(({ k }) => (
                  <option key={k} value={k}>Pregunta {k + 1}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      ))}

      <button
        type="button"
        className={`${btn2} self-start`}
        disabled={questions.length >= 50}
        onClick={() => { setSaved(false); setQuestions((qs) => [...qs, blankQuestion()]); }}
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
      {confirmGuide && (
        <ConfirmDialog
          message="Se reemplazarán las preguntas actuales por las de la guía. ¿Continuar?"
          label="Cargar guía"
          onCancel={() => setConfirmGuide(false)}
          onConfirm={loadGuide}
        />
      )}
    </section>
  );
}
