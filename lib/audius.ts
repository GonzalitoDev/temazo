// Cliente del catálogo abierto de Audius. Solo lecturas públicas con app_name (sin claves).
// Caché en memoria, límite de pedidos por segundo y un reintento ante fallas de red.

export const AUDIUS = "https://api.audius.co/v1";
export const APP_NAME = "temazo";

export type Art = { s?: string; m?: string; l?: string; mirrors?: string[] };
export type ArtistRef = { id: string; handle: string; name: string; verified?: boolean };
export type Track = {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  mood?: string;
  plays?: number;
  art?: Art;
  artist: ArtistRef;
  streamable: boolean;
  released?: string;
};
export type Artist = ArtistRef & {
  followers?: number;
  following?: number;
  trackCount?: number;
  avatar?: Art;
  cover?: Art;
  bio?: string;
  location?: string;
};
export type APlaylist = {
  id: string;
  name: string;
  description?: string;
  art?: Art;
  owner: ArtistRef;
  trackCount: number;
  isAlbum: boolean;
  plays?: number;
};

/* ---------- normalizar (JSON de Audius en snake_case -> tipos chicos) ---------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
function art(a: any): Art | undefined {
  if (!a || typeof a !== "object") return undefined;
  const out: Art = {
    s: a["150x150"] || a["640x"] || undefined,
    m: a["480x480"] || a["640x"] || undefined,
    l: a["1000x1000"] || a["2000x"] || undefined,
  };
  if (Array.isArray(a.mirrors) && a.mirrors.length) out.mirrors = a.mirrors.slice(0, 3);
  return out.s || out.m || out.l ? out : undefined;
}

export function toArtistRef(u: any): ArtistRef {
  return { id: String(u?.id ?? ""), handle: String(u?.handle ?? ""), name: String(u?.name || u?.handle || "Artista"), verified: !!u?.is_verified };
}

export function toTrack(t: any): Track {
  const streamable = t?.is_streamable !== false && t?.access?.stream !== false && !t?.is_delete && t?.is_available !== false;
  return {
    id: String(t.id),
    title: String(t.title ?? "Sin título"),
    duration: Number(t.duration) || 0,
    genre: t.genre || undefined,
    mood: t.mood || undefined,
    plays: typeof t.play_count === "number" ? t.play_count : undefined,
    art: art(t.artwork),
    artist: toArtistRef(t.user),
    streamable,
    released: t.release_date || t.created_at || undefined,
  };
}

export function toArtist(u: any): Artist {
  return {
    ...toArtistRef(u),
    followers: u.follower_count,
    following: u.followee_count,
    trackCount: u.track_count,
    avatar: art(u.profile_picture),
    cover: art(u.cover_photo),
    bio: u.bio || undefined,
    location: u.location || undefined,
  };
}

export function toPlaylist(p: any): APlaylist {
  return {
    id: String(p.id),
    name: String(p.playlist_name ?? "Playlist"),
    description: p.description || undefined,
    art: art(p.artwork),
    owner: toArtistRef(p.user),
    trackCount: Number(p.track_count ?? p.playlist_contents?.length ?? 0),
    isAlbum: !!p.is_album,
    plays: p.total_play_count,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Copia chica de un tema para guardarla en Supabase (me gusta, playlists, historial). */
export function slim(t: Track): Track {
  const a = t.art ? { s: t.art.s, m: t.art.m, mirrors: t.art.mirrors?.slice(0, 2) } : undefined;
  return {
    id: t.id,
    title: t.title.slice(0, 200),
    duration: t.duration,
    genre: t.genre,
    plays: t.plays,
    art: a,
    artist: { id: t.artist.id, handle: t.artist.handle, name: t.artist.name.slice(0, 100), verified: t.artist.verified },
    streamable: t.streamable,
  };
}

export function slimArtist(a: Artist): Artist {
  return { id: a.id, handle: a.handle, name: a.name, verified: a.verified, followers: a.followers, avatar: a.avatar ? { s: a.avatar.s, m: a.avatar.m, mirrors: a.avatar.mirrors?.slice(0, 2) } : undefined };
}

/* ---------- red ---------- */

const cache = new Map<string, { at: number; p: Promise<unknown> }>();
const TTL = 5 * 60_000;

// Límite gratis: 10 pedidos/s. Dejamos margen con 8.
const PER_SEC = 8;
let stamps: number[] = [];
async function slot() {
  for (;;) {
    const now = Date.now();
    stamps = stamps.filter((t) => now - t < 1000);
    if (stamps.length < PER_SEC) {
      stamps.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000 - (now - stamps[0]) + 5));
  }
}

export class AudiusError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

export function apiUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  const u = new URL(AUDIUS + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  u.searchParams.set("app_name", APP_NAME);
  return u.toString();
}

async function fetchJson(url: string, tries = 2): Promise<unknown> {
  await slot();
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (e) {
    if (tries > 1) return fetchJson(url, tries - 1);
    throw new AudiusError(0, "Sin conexión con Audius");
  }
  if (res.status === 429 || res.status >= 500) {
    if (tries > 1) {
      await new Promise((r) => setTimeout(r, 700));
      return fetchJson(url, tries - 1);
    }
  }
  if (!res.ok) throw new AudiusError(res.status, res.status === 404 ? "No existe" : `Audius respondió ${res.status}`);
  const j = (await res.json()) as { data?: unknown };
  return j.data;
}

export function get<T = unknown>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = apiUrl(path, params);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.p as Promise<T>;
  const p = fetchJson(url);
  cache.set(url, { at: Date.now(), p });
  p.catch(() => cache.delete(url));
  return p as Promise<T>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const arr = (x: unknown): any[] => (Array.isArray(x) ? x : []);

export type TrendTime = "week" | "month" | "year" | "allTime";

export const api = {
  trending: async (o: { time?: TrendTime; genre?: string; limit?: number; offset?: number } = {}) =>
    arr(await get("/tracks/trending", { time: o.time ?? "week", genre: o.genre, limit: o.limit ?? 20, offset: o.offset })).map(toTrack),
  underground: async (limit = 20) => arr(await get("/tracks/trending/underground", { limit })).map(toTrack),
  searchTracks: async (q: string, limit = 20) => arr(await get("/tracks/search", { query: q, limit })).map(toTrack),
  searchArtists: async (q: string, limit = 12) => arr(await get("/users/search", { query: q, limit })).map(toArtist),
  searchPlaylists: async (q: string, limit = 12) => arr(await get("/playlists/search", { query: q, limit })).map(toPlaylist),
  trendingPlaylists: async (limit = 12) => arr(await get("/playlists/trending", { limit, time: "week" })).map(toPlaylist),
  track: async (id: string) => toTrack(await get(`/tracks/${encodeURIComponent(id)}`)),
  artist: async (id: string) => toArtist(await get(`/users/${encodeURIComponent(id)}`)),
  artistByHandle: async (handle: string) => toArtist(await get(`/users/handle/${encodeURIComponent(handle)}`)),
  artistTracks: async (id: string, sort: "plays" | "date" = "plays", limit = 20) =>
    arr(await get(`/users/${encodeURIComponent(id)}/tracks`, { sort, limit, sort_method: sort === "plays" ? "plays" : "release_date", sort_direction: "desc" })).map(toTrack),
  artistPlaylists: async (id: string) => arr(await get(`/users/${encodeURIComponent(id)}/playlists`, { limit: 12 })).map(toPlaylist),
  related: async (id: string) => arr(await get(`/users/${encodeURIComponent(id)}/related`, { limit: 10 })).map(toArtist),
  playlist: async (id: string) => {
    const d = await get(`/playlists/${encodeURIComponent(id)}`);
    const p = Array.isArray(d) ? d[0] : d;
    if (!p) throw new AudiusError(404, "No existe");
    return toPlaylist(p);
  },
  playlistTracks: async (id: string) => arr(await get(`/playlists/${encodeURIComponent(id)}/tracks`)).map(toTrack),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** URL del audio: la API redirige al nodo que lo tiene. */
export const streamUrl = (id: string) => apiUrl(`/tracks/${encodeURIComponent(id)}/stream`);

/** Cambia el host de una URL de imagen por un espejo. */
export function mirrorUrl(url: string, mirror: string) {
  try {
    const u = new URL(url);
    const m = new URL(mirror);
    u.protocol = m.protocol;
    u.host = m.host;
    return u.toString();
  } catch {
    return url;
  }
}

/* ---------- géneros ---------- */

// value = como lo nombra Audius; label = como lo mostramos
export const GENRES: { value: string; label: string; hue: number }[] = [
  { value: "Electronic", label: "Electrónica", hue: 265 },
  { value: "Hip-Hop/Rap", label: "Hip hop / Rap", hue: 18 },
  { value: "House", label: "House", hue: 200 },
  { value: "Lo-Fi", label: "Lo-fi", hue: 160 },
  { value: "Pop", label: "Pop", hue: 330 },
  { value: "Techno", label: "Techno", hue: 230 },
  { value: "Trap", label: "Trap", hue: 0 },
  { value: "Dubstep", label: "Dubstep", hue: 285 },
  { value: "Drum & Bass", label: "Drum & bass", hue: 45 },
  { value: "Deep House", label: "Deep house", hue: 190 },
  { value: "Tech House", label: "Tech house", hue: 210 },
  { value: "R&B/Soul", label: "R&B / Soul", hue: 350 },
  { value: "Latin", label: "Latina", hue: 28 },
  { value: "Alternative", label: "Alternativa", hue: 120 },
  { value: "Rock", label: "Rock", hue: 8 },
  { value: "Ambient", label: "Ambient", hue: 175 },
  { value: "Jazz", label: "Jazz", hue: 38 },
  { value: "Experimental", label: "Experimental", hue: 300 },
  { value: "Future Bass", label: "Future bass", hue: 250 },
  { value: "Trance", label: "Trance", hue: 220 },
  { value: "Disco", label: "Disco", hue: 320 },
  { value: "Afro Beat", label: "Afrobeat", hue: 35 },
  { value: "Uk Garage", label: "UK garage", hue: 140 },
  { value: "Metal", label: "Metal", hue: 0 },
  { value: "Acoustic", label: "Acústica", hue: 60 },
  { value: "Classical", label: "Clásica", hue: 40 },
  { value: "Soundtrack", label: "Bandas sonoras", hue: 210 },
  { value: "Reggae", label: "Reggae", hue: 100 },
];
export const genreLabel = (v?: string) => GENRES.find((g) => g.value === v)?.label ?? v ?? "";
