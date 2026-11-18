import { cookies } from "next/headers";
import { connection } from "next/server";
import { buildPlayState, cookieName, emptyPlayState, getCurrentSession } from "@/lib/quest";

export async function GET() {
  await connection(); // siempre en tiempo de petición, nunca prerenderizado
  const headers = { "Cache-Control": "no-store" };
  const session = await getCurrentSession();
  if (!session) return Response.json(emptyPlayState, { headers });

  const token = (await cookies()).get(cookieName(session.code))?.value;
  return Response.json(await buildPlayState(session, token), { headers });
}
