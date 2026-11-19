"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type ActionResult } from "../../actions";
import { field } from "../../theme";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState<ActionResult, FormData>(login, {});

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-[#fdf5ea] p-6 text-[#5a2210]">
      <form action={action} className="flex w-full max-w-sm flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <h1 className="text-3xl font-extrabold">Acceso de moderador</h1>
        <label htmlFor="password" className="text-[#8a5a3c]">
          Contraseña
        </label>
        <input id="password" name="password" type="password" autoFocus autoComplete="current-password" className={field} />
        {state.error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {state.error}
          </p>
        )}
        <button disabled={pending} className="w-full rounded-2xl bg-[#5a2210] px-5 py-4 text-lg font-bold text-white disabled:opacity-40">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
