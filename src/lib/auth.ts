// Acceso del moderador: una contraseña compartida (MOD_PASSWORD) y una cookie firmada con HMAC.
// Usa Web Crypto para funcionar tanto en el proxy como en acciones y rutas del servidor.
export const MOD_COOKIE = "mod_auth";
export const MOD_SESSION_SECONDS = 60 * 60 * 12;

const enc = new TextEncoder();

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante.
function same(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const password = () => process.env.MOD_PASSWORD || "";

export async function checkPassword(input: string) {
  const expected = password();
  if (!expected) return false; // sin contraseña configurada, nadie entra
  // Se comparan firmas del mismo largo para no filtrar el tamaño de la clave.
  return same(await sign(input, "pw"), await sign(expected, "pw"));
}

export async function makeToken() {
  const exp = String(Math.floor(Date.now() / 1000) + MOD_SESSION_SECONDS);
  return `${exp}.${await sign(exp, password())}`;
}

export async function verifyToken(token: string | undefined) {
  if (!token || !password()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !(Number(exp) > Date.now() / 1000)) return false;
  return same(sig, await sign(exp, password()));
}
