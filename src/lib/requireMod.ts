import { cookies } from "next/headers";
import { MOD_COOKIE, verifyToken } from "./auth";

export async function isModerator() {
  return verifyToken((await cookies()).get(MOD_COOKIE)?.value);
}
