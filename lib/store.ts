"use client";

import { useSyncExternalStore } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { slim, slimArtist, type Artist, type Track } from "./audius";
import { emptyQueue, type Queue } from "./queue";
import { friendlyError } from "./format";
import { parse, type Route } from "./route";

export type Profile = { id: string; username: string; display_name: string; color: string; share_activity: boolean };
export type Like = { track: Track; at: string };
export type MyPlaylist = { id: string; owner_id: string; name: string; description: string; is_public: boolean; created_at: string; updated_at: string };
export type PTrack = { id: string; playlist_id: string; track_id: string; track: Track; position: number; added_at: string };
export type Follow = { artist: Artist; at: string };
export type NowPlaying = { user_id: string; track: Track; is_playing: boolean; updated_at: string };
export type Panel = "queue" | "lyrics" | "friends" | null;
export type MenuItem = { label: string; icon?: string; onClick: () => void; danger?: boolean; disabled?: boolean } | "sep";

export type State = {
  ready: boolean;
  session: Session | null;
  me: Profile | null;
  needsProfile: boolean;
  route: Route;
  likes: Record<string, Like>;
  playlists: Record<string, MyPlaylist>;
  plTracks: Record<string, { list: PTrack[]; loaded: boolean }>;
  follows: Record<string, Follow>;
  history: { track: Track; at: string }[];
  friends: Record<string, Profile>; // a quienes sigo
  followers: string[]; // ids de quienes me siguen
  nowPlaying: Record<string, NowPlaying>;
  // reproductor
  queue: Queue;
  playing: boolean;
  buffering: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  // interfaz
  panel: Panel;
  full: boolean;
  login: { reason?: string } | null;
  menu: { x: number; y: number; items: MenuItem[] } | null;
  picker: Track | null; // "agregar a playlist"
  toast: { id: number; text: string; tone: "info" | "error" } | null;
};

const initial: State = {
  ready: false,
  session: null,
  me: null,
  needsProfile: false,
  route: { name: "home" },
  likes: {},
  playlists: {},
  plTracks: {},
  follows: {},
  history: [],
  friends: {},
  followers: [],
  nowPlaying: {},
  queue: emptyQueue,
  playing: false,
  buffering: false,
  time: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  panel: null,
  full: false,
  login: null,
  menu: null,
  picker: null,
  toast: null,
};

let state: State = initial;
const listeners = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(initial));
}

let toastId = 0;
export function toast(text: string, tone: "info" | "error" = "info") {
  setState({ toast: { id: ++toastId, text, tone } });
}
export function fail(e: unknown) {
  console.warn(e);
  toast(friendlyError(e), "error");
}

const meId = () => state.session?.user.id ?? "";
export const loggedIn = () => !!state.me;

/** Para acciones que necesitan cuenta: abre el login y devuelve false. */
export function needAccount(reason: string) {
  if (state.me) return true;
  if (state.session && state.needsProfile) return false;
  setState({ login: { reason } });
  return false;
}

export function pref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem("temazo:" + key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function savePref(key: string, v: unknown) {
  try {
    localStorage.setItem("temazo:" + key, JSON.stringify(v));
  } catch {}
}

/* ---------- arranque y sesión ---------- */

let booted = false;
export async function boot() {
  if (booted) return;
  booted = true;
  const onHash = () => {
    const mobile = window.innerWidth < 760;
    setState({ route: parse(location.hash), menu: null, full: false, panel: mobile ? null : state.panel });
  };
  window.addEventListener("hashchange", onHash);
  setState({ route: parse(location.hash), panel: window.innerWidth < 760 ? null : pref<Panel>("panel", null), volume: pref("volume", 0.8) });

  const { data } = await supabase.auth.getSession();
  await onSession(data.session);
  supabase.auth.onAuthStateChange((_e, s) => {
    if ((s?.user.id ?? "") !== meId() || (!!s && !state.session)) void onSession(s);
    else setState({ session: s });
  });
}

let rt: RealtimeChannel | null = null;

async function onSession(s: Session | null) {
  if (rt) {
    void supabase.removeChannel(rt);
    rt = null;
  }
  setState({ session: s, me: null, needsProfile: false, likes: {}, playlists: {}, plTracks: {}, follows: {}, history: [], friends: {}, followers: [], nowPlaying: {} });
  if (!s) {
    setState({ ready: true });
    return;
  }
  try {
    const { data, error } = await supabase.from("temazo_profiles").select("*").eq("id", s.user.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      setState({ needsProfile: true, ready: true });
      return;
    }
    setState({ me: data as Profile, login: null });
    await loadLibrary();
  } catch (e) {
    fail(e);
  }
  setState({ ready: true });
}

export async function createProfile(username: string, display_name: string, color: string) {
  const id = meId();
  const { data, error } = await supabase.from("temazo_profiles").insert({ id, username, display_name, color }).select().single();
  if (error) throw error;
  setState({ me: data as Profile, needsProfile: false, login: null });
  await loadLibrary();
}

export async function updateProfile(patch: Partial<Pick<Profile, "display_name" | "color" | "share_activity">>) {
  const me = state.me;
  if (!me) return;
  setState({ me: { ...me, ...patch } });
  const { error } = await supabase.from("temazo_profiles").update(patch).eq("id", me.id);
  if (error) {
    setState({ me });
    fail(error);
  } else if (patch.share_activity === false) {
    await supabase.from("temazo_now_playing").delete().eq("user_id", me.id);
  }
}

export async function signOut() {
  await setNowPlaying(null);
  await supabase.auth.signOut();
}

async function loadLibrary() {
  const id = meId();
  const [likes, pls, fol, hist, fr, frs] = await Promise.all([
    supabase.from("temazo_likes").select("track_id, track, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(2000),
    supabase.from("temazo_playlists").select("*").eq("owner_id", id).order("updated_at", { ascending: false }),
    supabase.from("temazo_follow_artists").select("artist_id, artist, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("temazo_history").select("track_id, track, played_at").eq("user_id", id).order("played_at", { ascending: false }).limit(60),
    supabase.from("temazo_friends").select("followee_id").eq("follower_id", id),
    supabase.from("temazo_friends").select("follower_id").eq("followee_id", id),
  ]);
  for (const r of [likes, pls, fol, hist, fr, frs]) if (r.error) throw r.error;

  const L: Record<string, Like> = {};
  for (const r of likes.data ?? []) L[r.track_id] = { track: r.track as Track, at: r.created_at };
  const P: Record<string, MyPlaylist> = {};
  for (const r of (pls.data ?? []) as MyPlaylist[]) P[r.id] = r;
  const F: Record<string, Follow> = {};
  for (const r of fol.data ?? []) F[r.artist_id] = { artist: r.artist as Artist, at: r.created_at };
  const seen = new Set<string>();
  const H = (hist.data ?? [])
    .filter((r) => !seen.has(r.track_id) && seen.add(r.track_id))
    .map((r) => ({ track: r.track as Track, at: r.played_at }));
  setState({ likes: L, playlists: P, follows: F, history: H, followers: (frs.data ?? []).map((r) => r.follower_id) });

  // los temas de tus playlists (para las tapas en mosaico y para darles play desde Inicio)
  const ids = Object.keys(P);
  if (ids.length) {
    const { data, error } = await supabase.from("temazo_playlist_tracks").select("*").in("playlist_id", ids).order("position").limit(5000);
    if (!error) {
      const T: State["plTracks"] = {};
      for (const id of ids) T[id] = { list: [], loaded: true };
      for (const r of (data ?? []) as PTrack[]) T[r.playlist_id]?.list.push(r);
      setState({ plTracks: T });
    }
  }

  await loadFriends((fr.data ?? []).map((r) => r.followee_id));
  subscribeRealtime();
}

async function loadFriends(ids: string[]) {
  if (!ids.length) {
    setState({ friends: {}, nowPlaying: {} });
    return;
  }
  const [p, np] = await Promise.all([
    supabase.from("temazo_profiles").select("*").in("id", ids),
    supabase.from("temazo_now_playing").select("*").in("user_id", ids),
  ]);
  if (p.error) throw p.error;
  const friends: Record<string, Profile> = {};
  for (const x of (p.data ?? []) as Profile[]) friends[x.id] = x;
  const nowPlaying: Record<string, NowPlaying> = {};
  for (const x of (np.data ?? []) as NowPlaying[]) nowPlaying[x.user_id] = x;
  setState({ friends, nowPlaying });
}

function subscribeRealtime() {
  if (rt) return;
  rt = supabase
    .channel("temazo-now-" + meId())
    .on("postgres_changes", { event: "*", schema: "public", table: "temazo_now_playing" }, (payload) => {
      const row = (payload.new && "user_id" in payload.new ? payload.new : payload.old) as Partial<NowPlaying>;
      if (!row?.user_id || row.user_id === meId()) return;
      if (payload.eventType === "DELETE") {
        setState((s) => {
          const n = { ...s.nowPlaying };
          delete n[row.user_id!];
          return { nowPlaying: n };
        });
      } else if (state.friends[row.user_id]) {
        setState((s) => ({ nowPlaying: { ...s.nowPlaying, [row.user_id!]: row as NowPlaying } }));
      }
    })
    .subscribe();
}

/* ---------- me gusta ---------- */

export async function toggleLike(t: Track) {
  if (!needAccount("Creá una cuenta para guardar tus temas favoritos.")) return;
  const had = state.likes[t.id];
  const likes = { ...state.likes };
  if (had) delete likes[t.id];
  else likes[t.id] = { track: slim(t), at: new Date().toISOString() };
  setState({ likes });
  const q = had
    ? supabase.from("temazo_likes").delete().eq("user_id", meId()).eq("track_id", t.id)
    : supabase.from("temazo_likes").insert({ user_id: meId(), track_id: t.id, track: slim(t) });
  const { error } = await q;
  if (error && error.code !== "23505") {
    const back = { ...state.likes };
    if (had) back[t.id] = had;
    else delete back[t.id];
    setState({ likes: back });
    fail(error);
  } else if (!had) toast("Se agregó a Tus me gusta");
}

export const likedList = (s: State) => Object.values(s.likes).sort((a, b) => (a.at < b.at ? 1 : -1));

/* ---------- artistas ---------- */

export async function toggleFollowArtist(a: Artist) {
  if (!needAccount("Creá una cuenta para seguir artistas.")) return;
  const had = state.follows[a.id];
  const follows = { ...state.follows };
  if (had) delete follows[a.id];
  else follows[a.id] = { artist: slimArtist(a), at: new Date().toISOString() };
  setState({ follows });
  const { error } = had
    ? await supabase.from("temazo_follow_artists").delete().eq("user_id", meId()).eq("artist_id", a.id)
    : await supabase.from("temazo_follow_artists").insert({ user_id: meId(), artist_id: a.id, artist: slimArtist(a) });
  if (error && error.code !== "23505") {
    const f = { ...state.follows };
    if (had) f[a.id] = had;
    else delete f[a.id];
    setState({ follows: f });
    fail(error);
  }
}

/* ---------- playlists propias ---------- */

export const myPlaylists = (s: State) => Object.values(s.playlists).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

export async function createPlaylist(name?: string, first?: Track) {
  if (!needAccount("Creá una cuenta para armar tus playlists.")) return null;
  const n = Object.keys(state.playlists).length + 1;
  const { data, error } = await supabase
    .from("temazo_playlists")
    .insert({ owner_id: meId(), name: (name || `Mi playlist n.° ${n}`).slice(0, 100) })
    .select()
    .single();
  if (error) {
    fail(error);
    return null;
  }
  const pl = data as MyPlaylist;
  setState((s) => ({ playlists: { ...s.playlists, [pl.id]: pl }, plTracks: { ...s.plTracks, [pl.id]: { list: [], loaded: true } } }));
  if (first) await addToPlaylist(pl.id, first);
  return pl;
}

export async function updatePlaylist(id: string, patch: Partial<Pick<MyPlaylist, "name" | "description" | "is_public">>) {
  const old = state.playlists[id];
  if (!old) return;
  setState((s) => ({ playlists: { ...s.playlists, [id]: { ...old, ...patch, updated_at: new Date().toISOString() } } }));
  const { error } = await supabase.from("temazo_playlists").update(patch).eq("id", id);
  if (error) {
    setState((s) => ({ playlists: { ...s.playlists, [id]: old } }));
    fail(error);
  }
}

export async function deletePlaylist(id: string) {
  const old = state.playlists[id];
  const pls = { ...state.playlists };
  delete pls[id];
  setState({ playlists: pls });
  const { error } = await supabase.from("temazo_playlists").delete().eq("id", id);
  if (error) {
    setState((s) => ({ playlists: { ...s.playlists, [id]: old } }));
    fail(error);
  } else toast(`Se borró «${old?.name ?? "la playlist"}»`);
}

export async function loadPlaylistTracks(id: string, force = false) {
  if (!force && state.plTracks[id]?.loaded) return;
  const { data, error } = await supabase.from("temazo_playlist_tracks").select("*").eq("playlist_id", id).order("position");
  if (error) throw error;
  setState((s) => ({ plTracks: { ...s.plTracks, [id]: { list: (data ?? []) as PTrack[], loaded: true } } }));
}

const touch = (id: string) =>
  setState((s) => (s.playlists[id] ? { playlists: { ...s.playlists, [id]: { ...s.playlists[id], updated_at: new Date().toISOString() } } } : {}));

export async function addToPlaylist(id: string, t: Track) {
  const pl = state.playlists[id];
  if (!pl) return;
  try {
    await loadPlaylistTracks(id);
  } catch (e) {
    return fail(e);
  }
  const list = state.plTracks[id]?.list ?? [];
  if (list.some((x) => x.track_id === t.id)) {
    toast(`Ya está en «${pl.name}»`);
    return;
  }
  const position = (list.length ? Math.max(...list.map((x) => x.position)) : 0) + 1;
  const row: PTrack = { id: crypto.randomUUID(), playlist_id: id, track_id: t.id, track: slim(t), position, added_at: new Date().toISOString() };
  setState((s) => ({ plTracks: { ...s.plTracks, [id]: { list: [...list, row], loaded: true } } }));
  touch(id);
  const { error } = await supabase.from("temazo_playlist_tracks").insert({ id: row.id, playlist_id: id, track_id: t.id, track: row.track, position });
  if (error) {
    setState((s) => ({ plTracks: { ...s.plTracks, [id]: { list: s.plTracks[id].list.filter((x) => x.id !== row.id), loaded: true } } }));
    return fail(error);
  }
  toast(`Se agregó a «${pl.name}»`);
}

export async function removeFromPlaylist(id: string, rowId: string) {
  const before = state.plTracks[id]?.list ?? [];
  setState((s) => ({ plTracks: { ...s.plTracks, [id]: { list: before.filter((x) => x.id !== rowId), loaded: true } } }));
  touch(id);
  const { error } = await supabase.from("temazo_playlist_tracks").delete().eq("id", rowId);
  if (error) {
    setState((s) => ({ plTracks: { ...s.plTracks, [id]: { list: before, loaded: true } } }));
    fail(error);
  }
}

/** Mueve la fila from a la posición to (índices de la lista ordenada). */
export async function moveInPlaylist(id: string, from: number, to: number) {
  const before = state.plTracks[id]?.list ?? [];
  if (from === to || !before[from] || to < 0 || to >= before.length) return;
  const list = before.slice();
  const [row] = list.splice(from, 1);
  list.splice(to, 0, row);
  const prevPos = list[to - 1]?.position;
  const nextPos = list[to + 1]?.position;
  const position = prevPos === undefined ? nextPos! - 1 : nextPos === undefined ? prevPos + 1 : (prevPos + nextPos) / 2;
  list[to] = { ...row, position };
  setState((s) => ({ plTracks: { ...s.plTracks, [id]: { list, loaded: true } } }));
  const { error } = await supabase.from("temazo_playlist_tracks").update({ position }).eq("id", row.id);
  if (error) {
    setState((s) => ({ plTracks: { ...s.plTracks, [id]: { list: before, loaded: true } } }));
    fail(error);
  }
}

/* ---------- historial y "escuchando ahora" ---------- */

export async function recordPlay(t: Track) {
  const at = new Date().toISOString();
  setState((s) => ({ history: [{ track: slim(t), at }, ...s.history.filter((h) => h.track.id !== t.id)].slice(0, 60) }));
  if (!state.me) return;
  const { error } = await supabase.from("temazo_history").insert({ user_id: meId(), track_id: t.id, track: slim(t) });
  if (error) console.warn(error);
}

let lastNp = "";
export async function setNowPlaying(t: Track | null, playing = true) {
  const me = state.me;
  if (!me || !me.share_activity) return;
  const key = t ? `${t.id}:${playing}` : "none";
  if (key === lastNp) return;
  lastNp = key;
  const { error } = t
    ? await supabase.from("temazo_now_playing").upsert({ user_id: me.id, track: slim(t), is_playing: playing, updated_at: new Date().toISOString() })
    : await supabase.from("temazo_now_playing").update({ is_playing: false, updated_at: new Date().toISOString() }).eq("user_id", me.id);
  if (error) console.warn(error);
}

/* ---------- amigos ---------- */

export async function findProfile(username: string) {
  const { data, error } = await supabase.from("temazo_profiles").select("*").eq("username", username.toLowerCase().replace(/^@/, "")).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function followUser(p: Profile) {
  if (!needAccount("Creá una cuenta para seguir a tus amigos.")) return;
  if (p.id === meId()) return toast("Ese sos vos 🙂");
  const { error } = await supabase.from("temazo_friends").insert({ follower_id: meId(), followee_id: p.id });
  if (error && error.code !== "23505") return fail(error);
  setState((s) => ({ friends: { ...s.friends, [p.id]: p } }));
  try {
    await loadFriends(Object.keys(state.friends));
  } catch {}
  toast(`Ahora seguís a ${p.display_name}`);
}

export async function unfollowUser(id: string) {
  const old = state.friends[id];
  const f = { ...state.friends };
  delete f[id];
  setState({ friends: f });
  const { error } = await supabase.from("temazo_friends").delete().eq("follower_id", meId()).eq("followee_id", id);
  if (error) {
    setState((s) => ({ friends: { ...s.friends, [id]: old } }));
    fail(error);
  }
}

/* ---------- interfaz ---------- */

export function setPanel(p: Panel) {
  const next = state.panel === p ? null : p;
  setState({ panel: next });
  if (window.innerWidth >= 760) savePref("panel", next);
}

export function openMenu(e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }, items: MenuItem[]) {
  e.preventDefault?.();
  e.stopPropagation?.();
  setState({ menu: { x: e.clientX, y: e.clientY, items } });
}
