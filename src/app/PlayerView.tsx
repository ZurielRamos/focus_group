"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import { setNickname, submitAnswer, type ActionResult } from "./actions";
import type { PlayState } from "@/lib/quest";
import { usePolling } from "@/lib/usePolling";
import { INK, field, greenBtn, orangeBtn } from "./theme";

const primaryBtn = `w-full rounded-2xl bg-[#5a2210] px-5 py-4 text-lg font-bold text-white transition-opacity disabled:opacity-40`;

const spring = { type: "spring", stiffness: 380, damping: 30, mass: 0.8 } as const;

// Pantalla: entra con fundido + desplazamiento y escalona a sus hijos; sale rápido.
const screenVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], when: "beforeChildren", staggerChildren: 0.07 },
  },
  exit: { opacity: 0, y: -16, filter: "blur(4px)", transition: { duration: 0.22, ease: "easeIn" } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 26 } },
};

export function PlayerView({ code }: { code: string }) {
  const { data, notFound, failed, refresh } = usePolling<PlayState>(`/api/play/${code}/state`);

  let key = "loading";
  let title: string | undefined;
  let progress: { current: number; total: number } | undefined;
  let content: ReactNode;

  if (notFound) {
    key = "notfound";
    content = <Message title="Quest no encontrado">Revisa el enlace o el código con el moderador.</Message>;
  } else if (!data) {
    content = <Message>{failed ? "No se pudo cargar. Reintentando…" : "Cargando…"}</Message>;
  } else if (!data.me) {
    title = data.title;
    if (data.status === "finished") {
      key = "ended";
      content = <Message>Esta sesión ya terminó.</Message>;
    } else {
      key = "nickname";
      content = <NicknameForm code={code} onDone={refresh} />;
    }
  } else {
    title = data.title;
    if (data.status === "live" && data.total > 0) progress = { current: data.index + 1, total: data.total };
    if (data.status === "draft" || data.status === "ready") {
      key = "waiting";
      content = <Message title={`Hola, ${data.me}`}>Esperando a que el moderador inicie la sesión…</Message>;
    } else if (data.status === "finished") {
      key = "finished";
      content = (
        <Message title="¡Gracias por participar!" done>
          La sesión ha terminado.
        </Message>
      );
    } else if (data.status === "live" && data.question) {
      if (data.answered) {
        key = `answered-${data.question.id}`;
        content = (
          <Message title="¡Respuesta enviada!" done>
            Esperando la siguiente pregunta…
          </Message>
        );
      } else {
        key = `question-${data.question.id}`;
        content = <AnswerForm code={code} question={data.question} onDone={refresh} />;
      }
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <Shell title={title} progress={progress}>
        <AnimatePresence mode="wait" initial>
          <motion.div
            key={key}
            variants={screenVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="flex flex-1 flex-col"
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </Shell>
    </MotionConfig>
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
        <motion.div
          aria-hidden
          animate={{ x: [0, -18, 0], y: [0, 22, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-[#faead7]"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, 20, 0], y: [0, -24, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-28 bottom-10 h-80 w-80 rounded-full bg-[#faead7]"
        />

        <header className="relative z-10 flex flex-col gap-3 px-6 pb-2 pt-8">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`truncate text-center text-xl font-extrabold ${INK}`}
          >
            {title ?? "Quest"}
          </motion.h1>
          <AnimatePresence initial={false}>
            {progress && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-1 overflow-hidden"
              >
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f6dcc0]">
                  <motion.div
                    className="h-full origin-left rounded-full bg-[#2e9e6e]"
                    initial={false}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
                <p className="flex text-sm font-bold">
                  <span className="relative inline-block overflow-hidden text-[#2e9e6e]">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={progress.current}
                        className="inline-block"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "-100%", opacity: 0 }}
                        transition={spring}
                      >
                        {progress.current}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span className="text-[#c9a487]">/{progress.total}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
        <div className="relative flex h-16 w-16 items-center justify-center">
          <motion.span
            aria-hidden
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ delay: 0.25, duration: 1.1, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-[#2e9e6e]"
          />
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#2e9e6e] text-white shadow-lg shadow-[#2e9e6e]/30"
          >
            <CheckIcon className="h-8 w-8" delay={0.35} />
          </motion.span>
        </div>
      )}
      {title && (
        <motion.h2 variants={itemVariants} className={`text-2xl font-extrabold ${INK}`}>
          {title}
        </motion.h2>
      )}
      {!done && !title && (
        <motion.span
          aria-hidden
          variants={itemVariants}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="h-2 w-12 rounded-full bg-[#ee8b43]"
        />
      )}
      <motion.p variants={itemVariants} className="text-lg text-[#8a5a3c]">
        {children}
      </motion.p>
    </div>
  );
}

function NicknameForm({ code, onDone }: { code: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(setNickname, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} noValidate className="flex flex-1 flex-col justify-center gap-4">
      <input type="hidden" name="code" value={code} />
      <motion.h2 variants={itemVariants} className={`text-3xl font-extrabold leading-tight ${INK}`}>
        ¿Cómo quieres que te llamemos?
      </motion.h2>
      <motion.label variants={itemVariants} htmlFor="nickname" className="text-[#8a5a3c]">
        Elige un nickname para comenzar
      </motion.label>
      <motion.input
        variants={itemVariants}
        whileFocus={{ scale: 1.02 }}
        transition={spring}
        id="nickname"
        name="nickname"
        maxLength={20}
        autoFocus
        autoComplete="off"
        className={`${field} transition-colors`}
      />
      <motion.button
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        disabled={pending}
        className={primaryBtn}
      >
        {pending ? "Entrando…" : "Comenzar"}
      </motion.button>
      <ErrorText message={state.error} />
    </form>
  );
}

function AnswerForm({
  code,
  question,
  onDone,
}: {
  code: string;
  question: NonNullable<PlayState["question"]>;
  onDone: () => void;
}) {
  const [picks, setPicks] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>(() => question.options.map((_, i) => i));
  const [grid, setGrid] = useState<number[]>(() => question.rows.map(() => -1));
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
    const value = type === "text" || type === "number" ? text : type === "ranking" ? order : type === "matrix" ? grid : picks;
    startTransition(async () => {
      const res = await submitAnswer(code, question.id, value);
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  const ready =
    type === "text" ? text.trim().length > 0 : type === "number" ? text.trim() !== "" : type === "ranking" ? true : type === "matrix" ? grid.every((g) => g >= 0) : picks.length > 0;

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-5">
      <motion.h2 variants={itemVariants} className={`whitespace-pre-wrap text-2xl font-extrabold leading-snug ${INK}`}>
        {question.text}
      </motion.h2>

      {type === "text" && (
        <motion.textarea
          variants={itemVariants}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={6}
          placeholder="Escribe tu respuesta"
          className={`${field} resize-none transition-colors`}
        />
      )}

      {type === "number" && (
        <motion.input
          variants={itemVariants}
          type="number"
          inputMode="decimal"
          step="any"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un número"
          className={`${field} transition-colors`}
        />
      )}

      {type === "rating" && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-3">
          {question.options.map((opt, i) => {
            const selected = picks.includes(i);
            return (
              <motion.button
                key={i}
                variants={itemVariants}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(i)}
                className={`flex aspect-square items-center justify-center rounded-2xl text-2xl font-extrabold shadow-sm transition-colors duration-300 ${
                  selected ? greenBtn : orangeBtn
                }`}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>
      )}

      {type === "matrix" && (
        <div className="flex flex-col gap-4">
          {question.images.some(Boolean) && (
            <motion.div variants={itemVariants} className="flex justify-around gap-2">
              {question.options.map((opt, c) => (
                <div key={c} className="flex flex-1 flex-col items-center gap-1 text-center text-xs font-bold text-[#8a5a3c]">
                  <OptionImage src={question.images[c]} large />
                  {opt}
                </div>
              ))}
            </motion.div>
          )}
          {question.rows.map((row, r) => (
            <motion.div key={r} variants={itemVariants} className="flex flex-col gap-2">
              <p className={`text-base font-bold leading-snug ${INK}`}>
                <span className="text-[#c9a487]">{r + 1}.</span> {row}
              </p>
              <div className="flex gap-2">
                {question.options.map((opt, c) => {
                  const selected = grid[r] === c;
                  return (
                    <motion.button
                      key={c}
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setGrid((g) => g.map((v, k) => (k === r ? c : v)))}
                      className={`flex-1 rounded-xl px-2 py-3 text-sm font-bold shadow-sm transition-colors duration-300 ${
                        selected ? greenBtn : orangeBtn
                      }`}
                    >
                      {opt}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {type === "ranking" && (
        <div className="flex flex-col gap-3">
          <motion.p variants={itemVariants} className="text-sm font-semibold text-[#8a5a3c]">
            Ordena de la primera a la última con las flechas
          </motion.p>
          {order.map((optionIndex, pos) => (
            <motion.div
              key={optionIndex}
              layout
              variants={itemVariants}
              transition={{ layout: spring }}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ${orangeBtn}`}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/25 font-extrabold">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={pos}
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -14, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    {pos + 1}
                  </motion.span>
                </AnimatePresence>
              </span>
              <OptionImage src={question.images[optionIndex]} />
              <span className="flex-1 whitespace-pre-wrap text-lg font-bold">{question.options[optionIndex]}</span>
              <motion.button
                whileTap={{ scale: 0.85 }}
                type="button"
                aria-label="Subir"
                disabled={pos === 0}
                onClick={() => moveItem(pos, -1)}
                className="rounded-lg bg-white/25 p-2 transition-opacity disabled:opacity-30"
              >
                <ChevronIcon className="h-4 w-4 -rotate-90" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                type="button"
                aria-label="Bajar"
                disabled={pos === order.length - 1}
                onClick={() => moveItem(pos, 1)}
                className="rounded-lg bg-white/25 p-2 transition-opacity disabled:opacity-30"
              >
                <ChevronIcon className="h-4 w-4 rotate-90" />
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}

      {(type === "single" || type === "multiple") && (
        <div className="flex flex-col gap-3">
          {type === "multiple" && (
            <motion.p variants={itemVariants} className="text-sm font-semibold text-[#8a5a3c]">
              Puedes elegir varias opciones
            </motion.p>
          )}
          {question.options.map((opt, i) => {
            const selected = picks.includes(i);
            return (
              <motion.button
                key={i}
                variants={itemVariants}
                whileHover={{ scale: 1.02, x: 2 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(i)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left text-lg font-bold shadow-sm transition-colors duration-300 ${
                  selected ? greenBtn : orangeBtn
                }`}
              >
                <span className="flex items-center gap-3">
                  <OptionImage src={question.images[i]} />
                  <span className="whitespace-pre-wrap">{opt}</span>
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={selected ? "on" : "off"}
                    initial={{ scale: 0.3, rotate: -60, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0.3, rotate: 60, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 26 }}
                    className="flex shrink-0"
                  >
                    {selected ? <CheckIcon className="h-6 w-6" /> : <ChevronIcon className="h-5 w-5" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      )}

      <motion.div variants={itemVariants} className="mt-auto flex flex-col gap-3 pt-2">
        <ErrorText message={error} />
        <motion.button
          whileHover={ready && !pending ? { scale: 1.02 } : undefined}
          whileTap={ready && !pending ? { scale: 0.97 } : undefined}
          animate={{ y: ready ? 0 : 2 }}
          transition={spring}
          disabled={pending || !ready}
          className={primaryBtn}
        >
          {pending ? "Enviando…" : "Enviar respuesta"}
        </motion.button>
      </motion.div>
    </form>
  );
}

function OptionImage({ src, large }: { src?: string; large?: boolean }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`${large ? "h-16 w-16" : "h-12 w-12"} shrink-0 rounded-lg bg-white object-contain`} />;
}

function ErrorText({ message }: { message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          role="alert"
          initial={{ opacity: 0, height: 0, x: 0 }}
          animate={{ opacity: 1, height: "auto", x: [0, -8, 8, -5, 5, 0] }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4 }}
          className="text-sm font-semibold text-red-700"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function CheckIcon({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay }}
      />
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
