"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { deleteSession, newSession } from "../actions";
import type { SessionSummary, Status } from "@/lib/quest";
import { usePolling } from "@/lib/usePolling";

const STATUS_LABEL: Record<Status, string> = {
  draft: "Borrador",
  ready: "Lista",
  live: "En curso",
  finished: "Finalizada",
};

const btn = "rounded-2xl bg-[#5a2210] px-6 py-3 font-bold text-white transition active:scale-[.98] disabled:opacity-40";

export function QuestList() {
  const router = useRouter();
  const { data, failed, refresh } = usePolling<SessionSummary[]>("/api/mod/list", 5000);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function create() {
    setError(undefined);
    startTransition(async () => {
      const res = await newSession();
      if (res.error || !res.code) setError(res.error ?? "No se pudo crear el quest");
      else router.push(`/mod/${res.code}`);
    });
  }

  const [toDelete, setToDelete] = useState<{ code: string; title: string } | null>(null);

  function remove(code: string) {
    setToDelete(null);
    setError(undefined);
    startTransition(async () => {
      const res = await deleteSession(code);
      if (res.error) setError(res.error);
      refresh();
    });
  }

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-[#fdf5ea] text-[#5a2210]">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">Mis quests</h1>
          <button disabled={pending} onClick={create} className={btn}>
            {pending ? "Creando…" : "+ Nuevo quest"}
          </button>
        </header>

        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

        {!data ? (
          <p className="text-[#8a5a3c]">{failed ? "No se pudo cargar. Reintentando…" : "Cargando…"}</p>
        ) : data.length === 0 ? (
          <p className="text-[#8a5a3c]">Todavía no hay quests. Crea el primero.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((s) => (
              <li key={s.code} className="flex items-stretch gap-2">
                <Link
                  href={`/mod/${s.code}`}
                  className="flex flex-1 flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#f3c9a3] bg-white/70 p-5 transition hover:border-[#ee8b43]"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-extrabold">{s.title}</span>
                    <span className="text-sm text-[#8a5a3c]">
                      Código {s.code} · {s.questions} pregunta{s.questions === 1 ? "" : "s"} · {s.participants} participante
                      {s.participants === 1 ? "" : "s"} · {new Date(s.createdAt.replace(" ", "T") + "Z").toLocaleDateString("es-CO")}
                    </span>
                  </div>
                  <span className="rounded-full bg-[#faead7] px-3 py-1 text-sm font-bold">{STATUS_LABEL[s.status]}</span>
                </Link>
                {s.status === "draft" && (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Eliminar ${s.title}`}
                    onClick={() => setToDelete({ code: s.code, title: s.title })}
                    className="rounded-2xl border-2 border-[#f3c9a3] bg-white px-4 text-sm font-bold text-red-700 transition hover:border-red-700 disabled:opacity-40"
                  >
                    Eliminar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {toDelete && (
        <ConfirmDialog
          message={`¿Eliminar el quest «${toDelete.title}» (${toDelete.code})? Esta acción no se puede deshacer.`}
          label="Eliminar"
          onCancel={() => setToDelete(null)}
          onConfirm={() => remove(toDelete.code)}
        />
      )}
    </div>
  );
}
