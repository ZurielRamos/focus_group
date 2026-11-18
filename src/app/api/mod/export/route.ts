import { connection } from "next/server";
import { buildCsv, getCurrentSession } from "@/lib/quest";

export async function GET() {
  await connection();
  const session = await getCurrentSession();
  if (!session) return new Response("Sin sesión", { status: 404 });
  return new Response(await buildCsv(session), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quest-${session.code}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
