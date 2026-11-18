import { connection } from "next/server";
import { listSessions } from "@/lib/quest";

export async function GET() {
  await connection();
  return Response.json(await listSessions(), { headers: { "Cache-Control": "no-store" } });
}
