// Letras de LRCLIB (gratis, sin clave). La mayoría de la música independiente no está, y está bien.
import type { Track } from "./audius";

export type Line = { t: number; text: string };
export type Lyrics = { synced: Line[] | null; plain: string | null };

const TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(lrc: string): Line[] {
  const out: Line[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const tags = [...raw.matchAll(TAG)];
    if (!tags.length) continue;
    const text = raw.replace(TAG, "").trim();
    for (const m of tags) {
      const frac = m[3] ? Number(m[3]) / 10 ** m[3].length : 0;
      out.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Índice de la línea que corresponde al segundo t (o -1 antes de la primera). */
export function lineAt(lines: Line[], t: number) {
  let lo = 0,
    hi = lines.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t + 0.15) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Los títulos de Audius muchas veces son "Artista - Tema (Remix) [Sello]". */
export function guessQuery(t: Track): { artist: string; title: string } {
  let title = t.title;
  let artist = t.artist.name;
  const dash = title.split(/\s[-–—]\s/);
  if (dash.length >= 2) {
    artist = dash[0].trim();
    title = dash.slice(1).join(" - ");
  }
  title = title
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\((?:feat|ft|prod|with)[^)]*\)/gi, "")
    .replace(/\s+(?:feat|ft)\.?\s.*$/i, "")
    .trim();
  return { artist, title };
}

type LrcItem = { syncedLyrics?: string | null; plainLyrics?: string | null; duration?: number; instrumental?: boolean };

const memo = new Map<string, Promise<Lyrics | null>>();

export function fetchLyrics(t: Track): Promise<Lyrics | null> {
  const hit = memo.get(t.id);
  if (hit) return hit;
  const p = load(t).catch(() => null);
  memo.set(t.id, p);
  return p;
}

const pick = (it: LrcItem | null | undefined): Lyrics | null => {
  if (!it || it.instrumental) return null;
  const synced = it.syncedLyrics ? parseLrc(it.syncedLyrics) : null;
  const plain = it.plainLyrics?.trim() || null;
  if (!synced?.length && !plain) return null;
  return { synced: synced?.length ? synced : null, plain };
};

async function load(t: Track): Promise<Lyrics | null> {
  const { artist, title } = guessQuery(t);
  const u = new URL("https://lrclib.net/api/get");
  u.searchParams.set("artist_name", artist);
  u.searchParams.set("track_name", title);
  if (t.duration) u.searchParams.set("duration", String(Math.round(t.duration)));
  const r = await fetch(u);
  if (r.ok) {
    const got = pick((await r.json()) as LrcItem);
    if (got) return got;
  }
  const s = new URL("https://lrclib.net/api/search");
  s.searchParams.set("q", `${artist} ${title}`);
  const r2 = await fetch(s);
  if (!r2.ok) return null;
  const list = (await r2.json()) as LrcItem[];
  const close = list.find((x) => (x.syncedLyrics || x.plainLyrics) && (!t.duration || !x.duration || Math.abs(x.duration - t.duration) <= 4));
  return pick(close);
}
