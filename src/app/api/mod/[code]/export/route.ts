import { connection } from "next/server";
import { buildCsv, getSessionByCode } from "@/lib/quest";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  await connection();
  const session = await getSessionByCode((await ctx.params).code);
  if (!session) return new Response("Quest no encontrado", { status: 404 });
  return new Response(await buildCsv(session), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quest-${session.code}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
