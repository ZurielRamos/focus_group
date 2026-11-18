import { createClient } from "@libsql/client";

// Local: archivo SQLite (file:local.db). Producción (Vercel): Turso vía TURSO_DATABASE_URL.
export const db = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let ready: Promise<unknown> | undefined;

// Crea el esquema una sola vez por instancia.
export function ensureSchema() {
  ready ??= db
    .executeMultiple(
      `
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        mod_token TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        current_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        options TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id, position);
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        nickname TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_nick
        ON participants(session_id, nickname COLLATE NOCASE);
      CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        participant_id INTEGER NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(question_id, participant_id)
      );
      `,
    )
    .catch((e) => {
      ready = undefined;
      throw e;
    });
  return ready;
}
