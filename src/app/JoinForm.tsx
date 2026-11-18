"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { field } from "./theme";

// Entrada manual por código, para quien no recibió el enlace directo del quest.
export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-[#fdf5ea] p-6 text-[#5a2210]">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim();
          if (c) router.push(`/q/${encodeURIComponent(c.toUpperCase())}`);
        }}
      >
        <h1 className="text-3xl font-extrabold">Quest</h1>
        <label htmlFor="code" className="text-[#8a5a3c]">
          Escribe el código que te dio el moderador
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={10}
          autoComplete="off"
          autoCapitalize="characters"
          className={`${field} uppercase tracking-widest`}
        />
        <button disabled={!code.trim()} className="w-full rounded-2xl bg-[#5a2210] px-5 py-4 text-lg font-bold text-white disabled:opacity-40">
          Entrar
        </button>
      </form>
    </div>
  );
}
