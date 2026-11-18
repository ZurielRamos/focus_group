import { randomBytes, randomInt } from "node:crypto";
import { db, ensureSchema } from "./db";

// single/multiple: selección · text: texto libre · rating: escala numérica (las opciones son los números)
// ranking: ordenar opciones · number: respuesta numérica
// matrix: varias filas (aspectos), en cada una se elige una opción (columna)
export type QuestionType = "single" | "multiple" | "text" | "rating" | "ranking" | "number" | "matrix";
// draft: editando · ready: preguntas listas, esperando iniciar · live: en curso · finished: terminada
export type Status = "draft" | "ready" | "live" | "finished";

export type Question = {
  id: number;
  position: number;
  text: string;
  type: QuestionType;
  options: string[];
  images: string[]; // una URL por opción ("" si no tiene); misma longitud que options
  rows: string[]; // solo matrix: los aspectos a calificar
  compareTo: number | null; // posición de una pregunta anterior con la que se compara el resultado
};

export type SessionRow = {
  id: number;
  code: string;
  modToken: string;
  title: string;
  status: Status;
  currentIndex: number;
};

export type QuestionResult = {
  questionId: number;
  answered: number;
  counts: number[]; // votos por opción (selección y clasificación)
  texts: { nickname: string; text: string }[]; // respuestas libres y numéricas
  average: number | null; // promedio (clasificación y número)
  min: number | null; // solo número
  max: number | null; // solo número
  ranks: number[]; // posición promedio por opción (ranking); 1 = primera
  matrix: number[][]; // matrix: votos por fila y por opción
};

export type ModState = {
  title: string;
  code: string;
  status: Status;
  index: number;
  questions: Question[];
  participants: string[];
  results: QuestionResult[];
};

export type PlayState = {
  title: string;
  status: Status | "none"; // "none": todavía no hay ninguna sesión
  index: number;
  total: number;
  me: string | null;
  question: {
    id: number;
    text: string;
    type: QuestionType;
    options: string[];
    images: string[];
    rows: string[];
  } | null;
  answered: boolean;
};

export const cookieName = (code: string) => `p_${code}`;

function mapSession(r: Record<string, unknown>): SessionRow {
  return {
    id: Number(r.id),
    code: String(r.code),
    modToken: String(r.mod_token),
    title: String(r.title),
    status: String(r.status) as Status,
    currentIndex: Number(r.current_index),
  };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Crea una sesión nueva; pasa a ser la sesión actual de moderador y encuestados.
export async function createSession(title: string) {
  await ensureSchema();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    try {
      await db.execute({
        sql: "INSERT INTO sessions (code, mod_token, title) VALUES (?, ?, ?)",
        args: [code, randomBytes(18).toString("base64url"), title],
      });
      return (await getCurrentSession())!;
    } catch (e) {
      if (!/UNIQUE|constraint/i.test(String(e))) throw e;
    }
  }
  throw new Error("No se pudo generar un código único");
}

export async function getSessionByCode(code: string) {
  await ensureSchema();
  const res = await db.execute({ sql: "SELECT * FROM sessions WHERE code = ?", args: [code] });
  return res.rows[0] ? mapSession(res.rows[0]) : null;
}

// Los encuestados siempre entran a la sesión más reciente.
export async function getCurrentSession() {
  await ensureSchema();
  const res = await db.execute("SELECT * FROM sessions ORDER BY id DESC LIMIT 1");
  return res.rows[0] ? mapSession(res.rows[0]) : null;
}

export const emptyPlayState: PlayState = {
  title: "",
  status: "none",
  index: 0,
  total: 0,
  me: null,
  question: null,
  answered: false,
};

export async function getQuestions(sessionId: number): Promise<Question[]> {
  const res = await db.execute({
    sql: "SELECT id, position, text, type, options, config FROM questions WHERE session_id = ? ORDER BY position",
    args: [sessionId],
  });
  return res.rows.map((r) => {
    const options = JSON.parse(String(r.options)) as string[];
    const config = JSON.parse(String(r.config ?? "{}")) as Partial<{
      images: string[];
      rows: string[];
      compareTo: number | null;
    }>;
    return {
      id: Number(r.id),
      position: Number(r.position),
      text: String(r.text),
      type: String(r.type) as QuestionType,
      options,
      images: options.map((_, i) => config.images?.[i] ?? ""),
      rows: config.rows ?? [],
      compareTo: typeof config.compareTo === "number" ? config.compareTo : null,
    };
  });
}

export async function getParticipantByToken(sessionId: number, token: string) {
  const res = await db.execute({
    sql: "SELECT id, nickname FROM participants WHERE session_id = ? AND token = ?",
    args: [sessionId, token],
  });
  const r = res.rows[0];
  return r ? { id: Number(r.id), nickname: String(r.nickname) } : null;
}

export async function buildModState(s: SessionRow): Promise<ModState> {
  const [questions, parts, ans] = await Promise.all([
    getQuestions(s.id),
    db.execute({ sql: "SELECT nickname FROM participants WHERE session_id = ? ORDER BY id", args: [s.id] }),
    db.execute({
      sql: `SELECT a.question_id, a.value, p.nickname
            FROM answers a
            JOIN participants p ON p.id = a.participant_id
            JOIN questions q ON q.id = a.question_id
            WHERE q.session_id = ?`,
      args: [s.id],
    }),
  ]);

  const results: QuestionResult[] = questions.map((q) => {
    const mine = ans.rows.filter((a) => Number(a.question_id) === q.id);
    const counts = q.options.map(() => 0);
    const rankSums = q.options.map(() => 0);
    const texts: QuestionResult["texts"] = [];
    const numbers: number[] = [];
    const matrix = q.rows.map(() => q.options.map(() => 0));

    for (const a of mine) {
      const value = JSON.parse(String(a.value));
      if (q.type === "text") {
        texts.push({ nickname: String(a.nickname), text: String(value) });
      } else if (q.type === "number") {
        numbers.push(Number(value));
        texts.push({ nickname: String(a.nickname), text: String(value) });
      } else if (q.type === "matrix") {
        (value as number[]).forEach((optionIndex, row) => {
          if (matrix[row]?.[optionIndex] !== undefined) matrix[row][optionIndex]++;
        });
      } else if (q.type === "ranking") {
        (value as number[]).forEach((optionIndex, position) => {
          if (rankSums[optionIndex] !== undefined) rankSums[optionIndex] += position + 1;
        });
      } else {
        for (const i of value as number[]) if (counts[i] !== undefined) counts[i]++;
      }
    }

    let average: number | null = null;
    if (q.type === "number" && numbers.length) {
      average = numbers.reduce((x, y) => x + y, 0) / numbers.length;
    } else if (q.type === "rating" && mine.length) {
      const total = counts.reduce((sum, c, i) => sum + c * Number(q.options[i]), 0);
      average = total / mine.length;
    }

    return {
      questionId: q.id,
      answered: mine.length,
      counts,
      texts,
      average,
      min: numbers.length ? Math.min(...numbers) : null,
      max: numbers.length ? Math.max(...numbers) : null,
      ranks: rankSums.map((sum) => (mine.length ? sum / mine.length : 0)),
      matrix,
    };
  });

  return {
    title: s.title,
    code: s.code,
    status: s.status,
    index: s.currentIndex,
    questions,
    participants: parts.rows.map((r) => String(r.nickname)),
    results,
  };
}

export async function buildPlayState(s: SessionRow, participantToken: string | undefined): Promise<PlayState> {
  const me = participantToken ? await getParticipantByToken(s.id, participantToken) : null;
  const questions = await getQuestions(s.id);
  const current = me && s.status === "live" ? (questions[s.currentIndex] ?? null) : null;

  let answered = false;
  if (current && me) {
    const res = await db.execute({
      sql: "SELECT 1 FROM answers WHERE question_id = ? AND participant_id = ?",
      args: [current.id, me.id],
    });
    answered = res.rows.length > 0;
  }

  return {
    title: s.title,
    status: s.status,
    index: s.currentIndex,
    total: questions.length,
    me: me?.nickname ?? null,
    question: current
      ? {
          id: current.id,
          text: current.text,
          type: current.type,
          options: current.options,
          images: current.images,
          rows: current.rows,
        }
      : null,
    answered,
  };
}

// ---------- Exportación ----------

const csvCell = (v: unknown) => {
  let t = String(v ?? "");
  // Evita que Excel ejecute como fórmula un texto escrito por un participante.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

const TYPE_NAME: Record<QuestionType, string> = {
  single: "Selección simple",
  multiple: "Selección múltiple",
  rating: "Escala",
  ranking: "Ranking",
  number: "Número",
  text: "Texto libre",
  matrix: "Matriz",
};

// CSV en formato largo: una fila por participante, pregunta (y aspecto en matrices).
export async function buildCsv(s: SessionRow): Promise<string> {
  const questions = await getQuestions(s.id);
  const ans = await db.execute({
    sql: `SELECT a.question_id, a.value, p.nickname
          FROM answers a
          JOIN participants p ON p.id = a.participant_id
          JOIN questions q ON q.id = a.question_id
          WHERE q.session_id = ?
          ORDER BY q.position, p.id`,
    args: [s.id],
  });

  const lines: unknown[][] = [["Pregunta #", "Enunciado", "Tipo", "Participante", "Aspecto", "Respuesta"]];
  for (const [qi, q] of questions.entries()) {
    for (const a of ans.rows.filter((r) => Number(r.question_id) === q.id)) {
      const value = JSON.parse(String(a.value));
      const base = [qi + 1, q.text, TYPE_NAME[q.type], String(a.nickname)];
      if (q.type === "matrix") {
        (value as number[]).forEach((o, row) => lines.push([...base, q.rows[row] ?? "", q.options[o] ?? ""]));
      } else if (q.type === "ranking") {
        lines.push([...base, "", (value as number[]).map((o) => q.options[o]).join(" > ")]);
      } else if (q.type === "text" || q.type === "number") {
        lines.push([...base, "", value]);
      } else {
        lines.push([...base, "", (value as number[]).map((o) => q.options[o]).join(" | ")]);
      }
    }
  }
  // BOM para que Excel lea bien los acentos.
  return "\ufeff" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
}
