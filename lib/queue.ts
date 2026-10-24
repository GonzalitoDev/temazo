// Cola de reproducción, sin efectos: funciones puras fáciles de testear.
// "contexto" = la lista desde donde se dio play (un álbum, una fila de Inicio, tus me gusta...).
// "manual" = lo que agregaste con "Agregar a la cola": suena antes que el resto del contexto.
import type { Track } from "./audius";

export type Repeat = "off" | "all" | "one";
export type Ctx = { name: string; href?: string };

export type Queue = {
  context: Track[];
  ctx: Ctx | null;
  order: number[]; // índices de context en el orden en que van a sonar
  pos: number; // posición dentro de order del tema del contexto actual
  manual: Track[];
  current: Track | null;
  fromManual: boolean;
  shuffle: boolean;
  repeat: Repeat;
};

export const emptyQueue: Queue = { context: [], ctx: null, order: [], pos: -1, manual: [], current: null, fromManual: false, shuffle: false, repeat: "off" };

export function shuffled<T>(xs: T[], rnd = Math.random): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function buildOrder(n: number, start: number, shuffle: boolean, rnd?: () => number) {
  if (!shuffle) return { order: range(n), pos: start };
  const rest = shuffled(range(n).filter((i) => i !== start), rnd);
  return { order: [start, ...rest], pos: 0 };
}

/** Primer índice reproducible desde i en adelante (o -1). */
function playableFrom(tracks: Track[], i: number) {
  for (let k = i; k < tracks.length; k++) if (tracks[k].streamable) return k;
  return -1;
}

export function playContext(q: Queue, tracks: Track[], start: number, ctx: Ctx | null, rnd?: () => number): Queue {
  const s = playableFrom(tracks, Math.max(0, start));
  if (s < 0) return q;
  const { order, pos } = buildOrder(tracks.length, s, q.shuffle, rnd);
  return { ...q, context: tracks, ctx, order, pos, current: tracks[s], fromManual: false };
}

export type Step = { q: Queue; restart?: boolean; ended?: boolean };

/** Siguiente. auto=true cuando terminó el tema solo (ahí manda repetir uno). */
export function next(q: Queue, auto = false): Step {
  if (!q.current) return { q, ended: true };
  if (auto && q.repeat === "one") return { q, restart: true };
  if (q.manual.length) {
    const [head, ...rest] = q.manual;
    return { q: { ...q, manual: rest, current: head, fromManual: true } };
  }
  const n = q.order.length;
  for (let k = 1; k <= n; k++) {
    let p = q.pos + k;
    if (p >= n) {
      if (q.repeat === "off") break;
      p = p % n;
    }
    const t = q.context[q.order[p]];
    if (t?.streamable) return { q: { ...q, pos: p, current: t, fromManual: false } };
  }
  return { q, ended: true };
}

/** Anterior (el reproductor decide antes si reinicia porque pasaron más de 3 s). */
export function prev(q: Queue): Step {
  if (!q.current) return { q };
  if (q.fromManual && q.pos >= 0 && q.context[q.order[q.pos]]) {
    return { q: { ...q, current: q.context[q.order[q.pos]], fromManual: false } };
  }
  const n = q.order.length;
  for (let k = 1; k <= n; k++) {
    let p = q.pos - k;
    if (p < 0) {
      if (q.repeat !== "all") break;
      p = ((p % n) + n) % n;
    }
    const t = q.context[q.order[p]];
    if (t?.streamable) return { q: { ...q, pos: p, current: t, fromManual: false } };
  }
  return { q, restart: true };
}

export function setShuffle(q: Queue, on: boolean, rnd?: () => number): Queue {
  if (on === q.shuffle) return q;
  const cur = q.pos >= 0 ? q.order[q.pos] : 0;
  if (!q.context.length) return { ...q, shuffle: on };
  const { order, pos } = buildOrder(q.context.length, cur, on, rnd);
  return { ...q, shuffle: on, order, pos };
}

export function cycleRepeat(r: Repeat): Repeat {
  return r === "off" ? "all" : r === "all" ? "one" : "off";
}

export function addToQueue(q: Queue, t: Track, front = false): Queue {
  if (!q.current) return { ...q, current: t, fromManual: true };
  return { ...q, manual: front ? [t, ...q.manual] : [...q.manual, t] };
}

export function removeManual(q: Queue, i: number): Queue {
  return { ...q, manual: q.manual.filter((_, k) => k !== i) };
}

/** Lo que viene del contexto (sin lo agregado a mano). */
export function upcoming(q: Queue, max = 50): Track[] {
  const out: Track[] = [];
  for (let p = q.pos + 1; p < q.order.length && out.length < max; p++) out.push(q.context[q.order[p]]);
  if (q.repeat === "all") for (let p = 0; p <= q.pos && out.length < max; p++) out.push(q.context[q.order[p]]);
  return out;
}

/** Saltar a un tema de "A continuación" (k = índice en upcoming). */
export function jumpUpcoming(q: Queue, k: number): Queue {
  const n = q.order.length;
  const p = (q.pos + 1 + k) % n;
  const t = q.context[q.order[p]];
  if (!t) return q;
  return { ...q, pos: p, current: t, fromManual: false };
}

/** Saltar a un tema agregado a mano: se descartan los anteriores de la cola manual. */
export function jumpManual(q: Queue, i: number): Queue {
  const t = q.manual[i];
  if (!t) return q;
  return { ...q, manual: q.manual.slice(i + 1), current: t, fromManual: true };
}
