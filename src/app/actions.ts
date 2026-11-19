"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MOD_COOKIE, MOD_SESSION_SECONDS, checkPassword, makeToken } from "@/lib/auth";
import { isModerator } from "@/lib/requireMod";
import { db } from "@/lib/db";
import {
  cookieName,
  getParticipantByToken,
  getQuestions,
  createSession,
  getSessionByCode,
  type QuestionType,
} from "@/lib/quest";

export type ActionResult = { error?: string; ok?: boolean };

const newToken = () => randomBytes(18).toString("base64url");

// ---------- Moderador (protegido con contraseña) ----------

const DENIED = { error: "No autorizado. Vuelve a iniciar sesión." };

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ok = await checkPassword(String(formData.get("password") ?? ""));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // frena la fuerza bruta
    return { error: "Contraseña incorrecta" };
  }
  (await cookies()).set(MOD_COOKIE, await makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MOD_SESSION_SECONDS,
  });
  const next = String(formData.get("next") ?? "");
  redirect(/^\/mod(\/|$|\?)/.test(next) && !next.startsWith("//") ? next : "/mod");
}

export async function logout() {
  (await cookies()).delete(MOD_COOKIE);
  redirect("/mod/login");
}

export async function newSession(): Promise<ActionResult & { code?: string }> {
  if (!(await isModerator())) return DENIED;
  const s = await createSession("Quest");
  return { ok: true, code: s.code };
}

// Solo se pueden eliminar quests en borrador; borra también sus participantes y respuestas.
export async function deleteSession(code: string, confirmTitle: string): Promise<ActionResult> {
  if (!(await isModerator())) return DENIED;
  const s = await getSessionByCode(code);
  if (!s) return { error: "Quest no encontrado" };
  if (s.status !== "draft") return { error: "Solo se pueden eliminar quests en borrador" };
  if (String(confirmTitle ?? "").trim() !== s.title.trim()) return { error: "El nombre no coincide con el del quest" };

  const draft = "EXISTS (SELECT 1 FROM sessions WHERE id = ? AND status = 'draft')";
  await db.batch(
    [
      {
        sql: `DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE session_id = ?) AND ${draft}`,
        args: [s.id, s.id],
      },
      { sql: `DELETE FROM participants WHERE session_id = ? AND ${draft}`, args: [s.id, s.id] },
      { sql: `DELETE FROM questions WHERE session_id = ? AND ${draft}`, args: [s.id, s.id] },
      { sql: "DELETE FROM sessions WHERE id = ? AND status = 'draft'", args: [s.id] },
    ],
    "write",
  );
  return { ok: true };
}

// Copia título, preguntas y configuración en un quest nuevo en borrador (sin participantes ni respuestas).
export async function duplicateSession(code: string, title: string): Promise<ActionResult & { code?: string }> {
  if (!(await isModerator())) return DENIED;
  const source = await getSessionByCode(code);
  if (!source) return { error: "Quest no encontrado" };
  const cleanTitle = String(title ?? "").trim();
  if (!cleanTitle || cleanTitle.length > 100) return { error: "El nombre es obligatorio (máx. 100 caracteres)" };

  const copy = await createSession(cleanTitle);
  await db.execute({
    sql: `INSERT INTO questions (session_id, position, text, type, options, config)
          SELECT ?, position, text, type, options, config FROM questions WHERE session_id = ? ORDER BY position`,
    args: [copy.id, source.id],
  });
  return { ok: true, code: copy.code };
}

const QUESTION_TYPES: QuestionType[] = ["single", "multiple", "text", "rating", "ranking", "number", "matrix"];

type DraftQuestion = {
  text: string;
  type: QuestionType;
  options: string[];
  images: string[];
  rows: string[];
  compareTo: number | null;
};

// Solo rutas del propio sitio (/sellos/a.png) o https, para no incrustar contenido arbitrario.
const validImage = (u: string) => u === "" || (u.length <= 300 && (/^\/(?!\/)/.test(u) || /^https:\/\//.test(u)));

function parseQuestions(raw: unknown): DraftQuestion[] | string {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50) return "Agrega entre 1 y 50 preguntas";
  const out: DraftQuestion[] = [];
  for (const [i, q] of raw.entries()) {
    const n = i + 1;
    const text = String(q?.text ?? "").trim();
    const type = q?.type as QuestionType;
    if (!text) return `Pregunta ${n}: escribe el enunciado`;
    if (!QUESTION_TYPES.includes(type)) return `Pregunta ${n}: tipo inválido`;
    let options: string[] = [];
    let rows: string[] = [];
    if (type === "single" || type === "multiple" || type === "ranking" || type === "matrix") {
      options = (Array.isArray(q?.options) ? q.options : []).map((o: unknown) => String(o ?? "").trim());
      if (options.length < 2 || options.length > 10) return `Pregunta ${n}: debe tener entre 2 y 10 opciones`;
      if (options.some((o) => !o || o.length > 150)) return `Pregunta ${n}: hay opciones vacías o muy largas`;
      if (type === "matrix") {
        rows = (Array.isArray(q?.rows) ? q.rows : []).map((r: unknown) => String(r ?? "").trim());
        if (rows.length < 1 || rows.length > 15) return `Pregunta ${n}: la matriz debe tener entre 1 y 15 filas`;
        if (rows.some((r) => !r || r.length > 150)) return `Pregunta ${n}: hay filas vacías o muy largas`;
      }
    } else if (type === "rating") {
      // Las opciones son los números consecutivos de la escala (ej. 1..7).
      const min = Number(q?.options?.[0]);
      const max = Number(q?.options?.at?.(-1));
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || min > 1 || max < 3 || max > 10 || max <= min) {
        return `Pregunta ${n}: la escala debe ir de 0 o 1 hasta un máximo entre 3 y 10`;
      }
      options = Array.from({ length: max - min + 1 }, (_, k) => String(min + k));
    }
    const rawImages: unknown[] = Array.isArray(q?.images) ? q.images : [];
    const images = options.map((_, k) => String(rawImages[k] ?? "").trim());
    if (!images.every(validImage)) return `Pregunta ${n}: las imágenes deben ser una ruta que empiece con / o un enlace https`;

    let compareTo: number | null = null;
    if (q?.compareTo !== null && q?.compareTo !== undefined && q?.compareTo !== "") {
      const c = Number(q.compareTo);
      const target = out[c];
      const same =
        Number.isInteger(c) &&
        c >= 0 &&
        c < i &&
        target &&
        target.type === type &&
        target.options.length === options.length &&
        target.rows.length === rows.length;
      if (!same || type === "text" || type === "number") {
        return `Pregunta ${n}: solo se puede comparar con una pregunta anterior del mismo tipo y con las mismas opciones`;
      }
      compareTo = c;
    }
    out.push({ text, type, options, images, rows, compareTo });
  }
  return out;
}

export async function saveQuestions(code: string, title: string, raw: unknown): Promise<ActionResult> {
  if (!(await isModerator())) return DENIED;
  const s = await getSessionByCode(code);
  if (!s) return { error: "Sesión no encontrada" };
  if (s.status !== "draft") return { error: "La sesión ya inició y no se puede editar" };

  const cleanTitle = String(title ?? "").trim();
  if (!cleanTitle || cleanTitle.length > 100) return { error: "El título es obligatorio (máx. 100 caracteres)" };

  const questions = parseQuestions(raw);
  if (typeof questions === "string") return { error: questions };

  await db.batch(
    [
      { sql: "UPDATE sessions SET title = ? WHERE id = ?", args: [cleanTitle, s.id] },
      { sql: "DELETE FROM questions WHERE session_id = ?", args: [s.id] },
      ...questions.map((q, position) => ({
        sql: "INSERT INTO questions (session_id, position, text, type, options, config) VALUES (?, ?, ?, ?, ?, ?)",
        args: [
          s.id,
          position,
          q.text,
          q.type,
          JSON.stringify(q.options),
          JSON.stringify({ images: q.images, rows: q.rows, compareTo: q.compareTo }),
        ],
      })),
    ],
    "write",
  );
  return { ok: true };
}

export async function startSession(code: string): Promise<ActionResult> {
  if (!(await isModerator())) return DENIED;
  const s = await getSessionByCode(code);
  if (!s) return { error: "Sesión no encontrada" };
  if ((await getQuestions(s.id)).length === 0) return { error: "Guarda al menos una pregunta" };

  const res = await db.execute({
    sql: "UPDATE sessions SET status = 'live', current_index = 0 WHERE id = ? AND status IN ('draft', 'ready')",
    args: [s.id],
  });
  if (res.rowsAffected > 0) {
    await db.execute({
      sql: "UPDATE questions SET shown_at = CASE WHEN position = 0 THEN CURRENT_TIMESTAMP END WHERE session_id = ?",
      args: [s.id],
    });
  }
  return { ok: true };
}

// Borra las respuestas y vuelve al inicio, conservando preguntas y participantes.
// "ready": solo reiniciar (queda lista para iniciar). "draft": reiniciar y abrir el editor.
export async function resetSession(code: string, mode: "ready" | "draft"): Promise<ActionResult> {
  if (!(await isModerator())) return DENIED;
  const s = await getSessionByCode(code);
  if (!s) return { error: "Sesión no encontrada" };
  if (mode !== "ready" && mode !== "draft") return { error: "Modo inválido" };
  if (mode === "ready" && (await getQuestions(s.id)).length === 0) return { error: "No hay preguntas que reiniciar" };

  await db.batch(
    [
      {
        sql: "DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE session_id = ?)",
        args: [s.id],
      },
      { sql: "UPDATE questions SET shown_at = NULL WHERE session_id = ?", args: [s.id] },
      { sql: "UPDATE sessions SET status = ?, current_index = 0 WHERE id = ?", args: [mode, s.id] },
    ],
    "write",
  );
  return { ok: true };
}

// `fromIndex` evita avanzar dos veces si el moderador hace doble clic.
export async function nextQuestion(code: string, fromIndex: number): Promise<ActionResult> {
  if (!(await isModerator())) return DENIED;
  const s = await getSessionByCode(code);
  if (!s) return { error: "Sesión no encontrada" };
  if (s.status !== "live") return { error: "La sesión no está en curso" };

  const total = (await getQuestions(s.id)).length;
  const sql =
    fromIndex + 1 < total
      ? "UPDATE sessions SET current_index = current_index + 1 WHERE id = ? AND status = 'live' AND current_index = ?"
      : "UPDATE sessions SET status = 'finished' WHERE id = ? AND status = 'live' AND current_index = ?";
  const res = await db.execute({ sql, args: [s.id, Number(fromIndex)] });
  if (res.rowsAffected > 0 && fromIndex + 1 < total) {
    await db.execute({
      sql: "UPDATE questions SET shown_at = CURRENT_TIMESTAMP WHERE session_id = ? AND position = ?",
      args: [s.id, Number(fromIndex) + 1],
    });
  }
  return { ok: true };
}

// ---------- Encuestado ----------

export async function setNickname(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim().replace(/\s+/g, " ");
  if (nickname.length < 2 || nickname.length > 20) return { error: "El nickname debe tener entre 2 y 20 caracteres" };

  const s = await getSessionByCode(code);
  if (!s) return { error: "Todavía no hay una sesión activa" };
  if (s.status === "finished") return { error: "Esta sesión ya terminó" };

  const jar = await cookies();
  const name = cookieName(s.code);
  const existing = jar.get(name)?.value;
  if (existing && (await getParticipantByToken(s.id, existing))) return { ok: true };

  const token = newToken();
  try {
    await db.execute({
      sql: "INSERT INTO participants (session_id, nickname, token) VALUES (?, ?, ?)",
      args: [s.id, nickname, token],
    });
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String(e))) return { error: "Ese nickname ya está en uso, elige otro" };
    throw e;
  }

  jar.set(name, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  return { ok: true };
}

export async function submitAnswer(code: string, questionId: number, value: unknown): Promise<ActionResult> {
  const s = await getSessionByCode(code);
  if (!s) return { error: "Sesión no encontrada" };

  const token = (await cookies()).get(cookieName(s.code))?.value;
  const me = token ? await getParticipantByToken(s.id, token) : null;
  if (!me) return { error: "Primero elige un nickname" };
  if (s.status !== "live") return { error: "La sesión no está en curso" };

  const current = (await getQuestions(s.id))[s.currentIndex];
  if (!current || current.id !== Number(questionId)) return { error: "Esa pregunta ya no está activa" };

  let stored: number[] | string | number;
  const optionCount = current.options.length;
  const isIndex = (i: number) => Number.isInteger(i) && i >= 0 && i < optionCount;

  if (current.type === "text") {
    const text = String(value ?? "").trim();
    if (!text || text.length > 1000) return { error: "Escribe una respuesta (máx. 1000 caracteres)" };
    stored = text;
  } else if (current.type === "number") {
    const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
    if (String(value ?? "").trim() === "" || !Number.isFinite(n) || Math.abs(n) > 1e12) {
      return { error: "Escribe un número válido" };
    }
    stored = n;
  } else if (current.type === "matrix") {
    const picks = Array.isArray(value) ? value.map(Number) : [];
    if (picks.length !== current.rows.length || !picks.every(isIndex)) return { error: "Responde todas las filas" };
    stored = picks;
  } else if (current.type === "ranking") {
    const order = Array.isArray(value) ? value.map(Number) : [];
    const valid = order.length === optionCount && new Set(order).size === optionCount && order.every(isIndex);
    if (!valid) return { error: "Ordena todas las opciones" };
    stored = order;
  } else {
    const picks = Array.isArray(value) ? value.map(Number) : [];
    const valid =
      picks.length >= 1 &&
      new Set(picks).size === picks.length &&
      picks.every(isIndex) &&
      (current.type === "multiple" || picks.length === 1); // single y rating: una sola opción
    if (!valid) return { error: "Selección inválida" };
    stored = picks;
  }

  // Una sola respuesta por pregunta y participante.
  await db.execute({
    sql: "INSERT OR IGNORE INTO answers (question_id, participant_id, value) VALUES (?, ?, ?)",
    args: [current.id, me.id, JSON.stringify(stored)],
  });
  return { ok: true };
}
