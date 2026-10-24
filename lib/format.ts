export function clock(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export function longDuration(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

const nf = new Intl.NumberFormat("es-AR");
export const num = (n?: number) => (n === undefined ? "" : nf.format(n));
export function compact(n?: number) {
  if (n === undefined) return "";
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 6 && h < 13) return "Buen día";
  if (h >= 13 && h < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Tono estable a partir de un texto (para colores de respaldo). */
export function hueOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function usernameFromEmail(email: string) {
  const base = email.split("@")[0].split("+")[0].toLowerCase().replace(/[^a-z0-9_.]/g, "");
  return (base.replace(/^[.]+|[.]+$/g, "") || "oyente").slice(0, 24).padEnd(2, "0");
}

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const code = (e as { code?: string })?.code;
  if (/Invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/Email not confirmed/i.test(msg)) return "Todavía no confirmaste tu email. Revisá tu casilla.";
  if (/Password should be/i.test(msg)) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Esperá un minuto.";
  if (code === "23505" || /duplicate key/i.test(msg)) return "Ese nombre ya está tomado.";
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) return "No tenés permiso para hacer eso.";
  if (/Failed to fetch|NetworkError|Sin conexión/i.test(msg)) return "Sin conexión. Probá de nuevo.";
  return msg || "Algo salió mal.";
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
