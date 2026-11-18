import { cookies } from "next/headers";
import { connection } from "next/server";
import { buildPlayState, cookieName, getSessionByCode } from "@/lib/quest";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  await connection(); // siempre en tiempo de petición, nunca prerenderizado
  const session = await getSessionByCode((await ctx.params).code);
  if (!session) return new Response("Quest no encontrado", { status: 404 });
  const token = (await cookies()).get(cookieName(session.code))?.value;
  return Response.json(await buildPlayState(session, token), { headers: { "Cache-Control": "no-store" } });
}
