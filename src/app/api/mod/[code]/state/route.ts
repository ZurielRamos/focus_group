import { connection } from "next/server";
import { buildModState, getSessionByCode } from "@/lib/quest";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  await connection(); // siempre en tiempo de petición, nunca prerenderizado
  const session = await getSessionByCode((await ctx.params).code);
  if (!session) return new Response("Quest no encontrado", { status: 404 });
  return Response.json(await buildModState(session), { headers: { "Cache-Control": "no-store" } });
}
