import { connection } from "next/server";
import { buildModState, createSession, getCurrentSession } from "@/lib/quest";

export async function GET() {
  await connection(); // siempre en tiempo de petición, nunca prerenderizado
  const session = (await getCurrentSession()) ?? (await createSession("Quest"));
  return Response.json(await buildModState(session), { headers: { "Cache-Control": "no-store" } });
}
