"use client";

// Un solo <audio> para toda la app: sobrevive a la navegación porque vive fuera de React.
import { streamUrl, type Track } from "./audius";
import * as Q from "./queue";
import { getState, recordPlay, savePref, setNowPlaying, setState, toast } from "./store";

let audio: HTMLAudioElement | null = null;
let pre: HTMLAudioElement | null = null; // precarga del siguiente
let counted = ""; // tema ya sumado al historial
let errors = 0;

function el() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.volume = getState().volume;
  audio.addEventListener("timeupdate", onTime);
  audio.addEventListener("durationchange", () => setState({ duration: audio!.duration || getState().queue.current?.duration || 0 }));
  audio.addEventListener("playing", () => {
    errors = 0;
    setState({ playing: true, buffering: false });
    const t = getState().queue.current;
    if (t) void setNowPlaying(t, true);
  });
  audio.addEventListener("pause", () => {
    setState({ playing: false });
    const t = getState().queue.current;
    if (t && !audio!.ended) void setNowPlaying(t, false);
  });
  audio.addEventListener("waiting", () => setState({ buffering: true }));
  audio.addEventListener("canplay", () => setState({ buffering: false }));
  audio.addEventListener("ended", () => next(true));
  audio.addEventListener("error", onError);
  setupMediaSession();
  return audio;
}

function onTime() {
  const a = audio!;
  const s = getState();
  // redondeado a 1/4 de segundo para no re-renderizar de más
  const t = Math.floor(a.currentTime * 4) / 4;
  if (t !== s.time) setState({ time: t });
  const cur = s.queue.current;
  if (cur && counted !== cur.id && (a.currentTime >= 30 || (a.duration && a.currentTime >= a.duration * 0.6))) {
    counted = cur.id;
    void recordPlay(cur);
  }
  if (a.duration && a.duration - a.currentTime < 20) preloadNext();
  if ("mediaSession" in navigator && a.duration && isFinite(a.duration) && Math.floor(a.currentTime) % 5 === 0) {
    try {
      navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: 1 });
    } catch {}
  }
}

function onError() {
  const cur = getState().queue.current;
  setState({ buffering: false, playing: false });
  if (!cur) return;
  errors++;
  if (errors > 3) {
    toast("Audius no responde. Probá en un rato.", "error");
    return;
  }
  toast(`No se pudo reproducir «${cur.title}». Pasamos al siguiente.`, "error");
  setTimeout(() => next(false), 900);
}

function preloadNext() {
  const step = Q.next(getState().queue, false);
  const t = step.ended || step.restart ? null : step.q.current;
  if (!t) return;
  if (!pre) {
    pre = new Audio();
    pre.preload = "auto";
    pre.muted = true;
  }
  const src = streamUrl(t.id);
  if (pre.src !== src) pre.src = src;
}

function load(t: Track, autoplay = true) {
  const a = el();
  counted = "";
  a.src = streamUrl(t.id);
  setState({ time: 0, duration: t.duration, buffering: true });
  updateMetadata(t);
  if (autoplay) {
    a.play().catch((e: DOMException) => {
      setState({ playing: false, buffering: false });
      if (e?.name === "NotAllowedError") toast("Tocá play para empezar");
    });
  }
}

function commit(q: Q.Queue, autoplay = true, force = false) {
  const before = getState().queue.current;
  setState({ queue: q });
  if (q.current && (force || q.current !== before)) load(q.current, autoplay);
  saveQueue();
}

/* ---------- API pública ---------- */

/** Reproducir una lista desde el índice i. ctx describe de dónde viene ("Tendencias", una playlist...). */
export function playList(tracks: Track[], i: number, ctx: Q.Ctx | null) {
  const t = tracks[i];
  if (t && !t.streamable) {
    toast("Este tema no está disponible para escuchar gratis.");
    return;
  }
  commit(Q.playContext(getState().queue, tracks, i, ctx), true, true);
}

export function isCurrent(t: Track) {
  return getState().queue.current?.id === t.id;
}

/** Botón play de una lista: si ya suena esa lista, pausa/reanuda. */
export function playOrToggle(tracks: Track[], ctx: Q.Ctx) {
  const s = getState();
  if (s.queue.ctx?.href && s.queue.ctx.href === ctx.href && s.queue.current) return toggle();
  const start = s.queue.shuffle ? Math.floor(Math.random() * tracks.length) : 0;
  playList(tracks, start, ctx);
}

export function toggle() {
  const a = el();
  const s = getState();
  if (!s.queue.current) return;
  if (!a.src) return load(s.queue.current);
  if (a.paused) a.play().catch(() => {});
  else a.pause();
}

export function next(auto = false) {
  const step = Q.next(getState().queue, auto);
  const a = el();
  if (step.restart) {
    a.currentTime = 0;
    a.play().catch(() => {});
    return;
  }
  if (step.ended) {
    a.pause();
    if (auto) {
      a.currentTime = 0;
      setState({ time: 0 });
    }
    return;
  }
  commit(step.q, true, true);
}

export function prev() {
  const a = el();
  if (a.currentTime > 3) {
    a.currentTime = 0;
    return;
  }
  const step = Q.prev(getState().queue);
  if (step.restart) {
    a.currentTime = 0;
    return;
  }
  commit(step.q, true, true);
}

export function seek(sec: number) {
  const a = el();
  if (!isFinite(sec)) return;
  a.currentTime = Math.max(0, Math.min(sec, a.duration || sec));
  setState({ time: a.currentTime });
}

export function setVolume(v: number) {
  const a = el();
  v = Math.max(0, Math.min(1, v));
  a.volume = v;
  a.muted = v === 0;
  setState({ volume: v, muted: v === 0 });
  savePref("volume", v);
}

export function toggleMute() {
  const a = el();
  a.muted = !a.muted;
  if (!a.muted && a.volume === 0) setVolume(0.5);
  setState({ muted: a.muted });
}

export function toggleShuffle() {
  const q = getState().queue;
  setState({ queue: Q.setShuffle(q, !q.shuffle) });
  saveQueue();
}

export function cycleRepeat() {
  const q = getState().queue;
  setState({ queue: { ...q, repeat: Q.cycleRepeat(q.repeat) } });
  saveQueue();
}

export function enqueue(t: Track, front = false) {
  if (!t.streamable) return toast("Este tema no está disponible para escuchar.");
  const had = !!getState().queue.current;
  commit(Q.addToQueue(getState().queue, t, front), true);
  if (had) toast(front ? "Suena a continuación" : "Se agregó a la cola");
}

export function removeQueued(i: number) {
  setState({ queue: Q.removeManual(getState().queue, i) });
  saveQueue();
}

export function jumpUpcoming(k: number) {
  commit(Q.jumpUpcoming(getState().queue, k), true, true);
}
export function jumpManual(i: number) {
  commit(Q.jumpManual(getState().queue, i), true, true);
}

/* ---------- guardar la cola entre visitas (sin autoplay al volver) ---------- */

function saveQueue() {
  const q = getState().queue;
  savePref("queue", { ...q, context: q.context.slice(0, 200) });
}

export function restoreQueue() {
  try {
    const raw = localStorage.getItem("temazo:queue");
    if (!raw) return;
    const q = JSON.parse(raw) as Q.Queue;
    if (!q?.current) return;
    setState({ queue: q, duration: q.current.duration });
    updateMetadata(q.current);
    const a = el();
    a.src = streamUrl(q.current.id);
    a.preload = "metadata";
  } catch {}
}

/* ---------- controles del sistema ---------- */

function updateMetadata(t: Track) {
  if (!("mediaSession" in navigator)) return;
  const art = t.art;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist.name,
      album: getState().queue.ctx?.name ?? "Temazo",
      artwork: [
        art?.s && { src: art.s, sizes: "150x150", type: "image/jpeg" },
        art?.m && { src: art.m, sizes: "480x480", type: "image/jpeg" },
      ].filter(Boolean) as MediaImage[],
    });
  } catch {}
  document.title = `${t.title} · ${t.artist.name}`;
}

function setupMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const h = (a: MediaSessionAction, fn: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, fn);
    } catch {}
  };
  h("play", () => toggle());
  h("pause", () => toggle());
  h("nexttrack", () => next());
  h("previoustrack", () => prev());
  h("seekto", (d) => d.seekTime !== undefined && seek(d.seekTime));
  h("seekforward", () => seek((audio?.currentTime ?? 0) + 10));
  h("seekbackward", () => seek((audio?.currentTime ?? 0) - 10));
}
