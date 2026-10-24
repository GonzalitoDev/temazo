"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/audius";
import { clock, ago } from "@/lib/format";
import { fetchLyrics, lineAt, type Lyrics } from "@/lib/lyrics";
import * as P from "@/lib/player";
import { upcoming } from "@/lib/queue";
import { href } from "@/lib/route";
import { findProfile, followUser, openMenu, setPanel, setState, toast, unfollowUser, useStore, type NowPlaying, type Profile } from "@/lib/store";
import { Art, useArtColor } from "./Art";
import { Eq, Icon } from "./Icon";
import { A, ArtistLink, HeartButton, trackMenuItems } from "./ui";

/* ---------- barra deslizable (progreso y volumen) ---------- */

export function Slider({ value, max, onChange, label, format, className }: { value: number; max: number; onChange: (v: number) => void; label: string; format?: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const v = drag ?? value;
  const pct = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
  const at = (x: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / r.width)) * max;
  };
  return (
    <div
      ref={ref}
      className={"slider" + (drag !== null ? " dragging" : "") + (className ? " " + className : "")}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(v)}
      aria-valuetext={format ? format(v) : undefined}
      style={{ "--pct": pct + "%" } as React.CSSProperties}
      onPointerDown={(e) => {
        if (!max) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(at(e.clientX));
      }}
      onPointerMove={(e) => drag !== null && setDrag(at(e.clientX))}
      onPointerUp={(e) => {
        if (drag === null) return;
        onChange(at(e.clientX));
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={(e) => {
        const step = max / 20;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(max, value + step));
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, value - step));
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <span className="slider-track">
        <span className="slider-fill" />
      </span>
      <span className="slider-knob" />
    </div>
  );
}

function Progress({ compact }: { compact?: boolean }) {
  const time = useStore((s) => s.time);
  const duration = useStore((s) => s.duration || s.queue.current?.duration || 0);
  return (
    <div className={"progress" + (compact ? " compact" : "")}>
      <span className="t">{clock(time)}</span>
      <Slider value={time} max={duration} onChange={P.seek} label="Posición del tema" format={clock} />
      <span className="t">{clock(duration)}</span>
    </div>
  );
}

export function Controls({ big }: { big?: boolean }) {
  const playing = useStore((s) => s.playing);
  const buffering = useStore((s) => s.buffering);
  const shuffle = useStore((s) => s.queue.shuffle);
  const repeat = useStore((s) => s.queue.repeat);
  const has = useStore((s) => !!s.queue.current);
  return (
    <div className={"controls" + (big ? " big" : "")}>
      <button className={"icon-btn toggle" + (shuffle ? " on" : "")} aria-label="Aleatorio" aria-pressed={shuffle} onClick={P.toggleShuffle} title="Aleatorio">
        <Icon name="shuffle" size={big ? 24 : 18} />
      </button>
      <button className="icon-btn" aria-label="Anterior" onClick={P.prev} disabled={!has}>
        <Icon name="prev" size={big ? 30 : 20} />
      </button>
      <button className="play-btn main" aria-label={playing ? "Pausar" : "Reproducir"} onClick={P.toggle} disabled={!has}>
        {buffering && playing ? <span className="spinner" /> : <Icon name={playing ? "pause" : "play"} size={big ? 30 : 20} />}
      </button>
      <button className="icon-btn" aria-label="Siguiente" onClick={() => P.next()} disabled={!has}>
        <Icon name="next" size={big ? 30 : 20} />
      </button>
      <button
        className={"icon-btn toggle" + (repeat !== "off" ? " on" : "")}
        aria-label={repeat === "off" ? "Repetir" : repeat === "all" ? "Repetir todo" : "Repetir uno"}
        aria-pressed={repeat !== "off"}
        onClick={P.cycleRepeat}
        title={repeat === "one" ? "Repetir uno" : repeat === "all" ? "Repetir todo" : "Repetir"}
      >
        <Icon name="repeat" size={big ? 24 : 18} />
        {repeat === "one" && <span className="one">1</span>}
      </button>
    </div>
  );
}

function Volume() {
  const volume = useStore((s) => s.volume);
  const muted = useStore((s) => s.muted);
  const v = muted ? 0 : volume;
  return (
    <div className="volume">
      <button className="icon-btn" aria-label={muted ? "Activar sonido" : "Silenciar"} onClick={P.toggleMute}>
        <Icon name={v === 0 ? "mute" : v < 0.5 ? "volumeLow" : "volume"} size={18} />
      </button>
      <Slider value={v} max={1} onChange={P.setVolume} label="Volumen" format={(x) => Math.round(x * 100) + "%"} />
    </div>
  );
}

/* ---------- barra de reproducción (escritorio) ---------- */

export function PlayerBar() {
  const t = useStore((s) => s.queue.current);
  const panel = useStore((s) => s.panel);
  return (
    <footer className="player" aria-label="Reproductor">
      <div className="player-left">
        {t ? (
          <>
            <button className="player-art" aria-label="Abrir pantalla de reproducción" onClick={() => setState({ full: true })}>
              <Art art={t.art} size="s" seed={t.id} />
            </button>
            <div className="player-text">
              <A to={{ name: "track", id: t.id }} className="player-title">
                {t.title}
              </A>
              <span className="row-sub">
                <ArtistLink a={t.artist} />
              </span>
            </div>
            <HeartButton t={t} always />
          </>
        ) : (
          <span className="muted small">Elegí algo para escuchar</span>
        )}
      </div>
      <div className="player-center">
        <Controls />
        <Progress />
      </div>
      <div className="player-right">
        <button className={"icon-btn toggle" + (panel === "lyrics" ? " on" : "")} aria-label="Letra" aria-pressed={panel === "lyrics"} onClick={() => setPanel("lyrics")} title="Letra">
          <Icon name="mic" size={18} />
        </button>
        <button className={"icon-btn toggle" + (panel === "queue" ? " on" : "")} aria-label="Cola" aria-pressed={panel === "queue"} onClick={() => setPanel("queue")} title="Cola">
          <Icon name="queue" size={18} />
        </button>
        <button className={"icon-btn toggle" + (panel === "friends" ? " on" : "")} aria-label="Amigos" aria-pressed={panel === "friends"} onClick={() => setPanel("friends")} title="Lo que escuchan tus amigos">
          <Icon name="friends" size={18} />
        </button>
        <Volume />
        <button className="icon-btn" aria-label="Pantalla de reproducción" onClick={() => setState({ full: true })} disabled={!t} title="Pantalla completa">
          <Icon name="expand" size={18} />
        </button>
      </div>
    </footer>
  );
}

/* ---------- mini reproductor (celular) ---------- */

export function MiniPlayer() {
  const t = useStore((s) => s.queue.current);
  const playing = useStore((s) => s.playing);
  const time = useStore((s) => s.time);
  const duration = useStore((s) => s.duration || s.queue.current?.duration || 1);
  const color = useArtColor(t?.art, t?.id ?? "x");
  if (!t) return null;
  return (
    <div className="mini" style={{ "--np": color } as React.CSSProperties} onClick={() => setState({ full: true })} role="button" aria-label="Abrir reproductor" tabIndex={0}>
      <Art art={t.art} size="s" seed={t.id} className="mini-art" />
      <div className="mini-text">
        <span className="mini-title">{t.title}</span>
        <span className="mini-sub">{t.artist.name}</span>
      </div>
      <span onClick={(e) => e.stopPropagation()}>
        <HeartButton t={t} always size={20} />
      </span>
      <button
        className="icon-btn"
        aria-label={playing ? "Pausar" : "Reproducir"}
        onClick={(e) => {
          e.stopPropagation();
          P.toggle();
        }}
      >
        <Icon name={playing ? "pause" : "play"} size={22} />
      </button>
      <span className="mini-bar" style={{ width: `${(time / duration) * 100}%` }} />
    </div>
  );
}

/* ---------- pantalla de reproducción ---------- */

export function NowPlayingView() {
  const full = useStore((s) => s.full);
  const t = useStore((s) => s.queue.current);
  const ctx = useStore((s) => s.queue.ctx);
  const color = useArtColor(t?.art, t?.id ?? "x");
  const [tab, setTab] = useState<"art" | "lyrics" | "queue">("art");
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState({ full: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  if (!full || !t) return null;
  const close = () => setState({ full: false });
  return (
    <div className="np" style={{ "--np": color } as React.CSSProperties} role="dialog" aria-modal="true" aria-label="Reproduciendo">
      <header className="np-head">
        <button className="icon-btn" aria-label="Cerrar" onClick={close}>
          <Icon name="down" size={26} />
        </button>
        <div className="np-ctx">
          <small>Reproduciendo desde</small>
          {ctx?.href?.startsWith("#/") ? (
            <a href={ctx.href} onClick={close}>
              {ctx.name}
            </a>
          ) : (
            <span>{ctx?.name ?? "Tu cola"}</span>
          )}
        </div>
        <button className="icon-btn" aria-label="Más opciones" onClick={(e) => openMenu(e, trackMenuItems(t))}>
          <Icon name="more" size={24} />
        </button>
      </header>
      <div className={"np-body tab-" + tab}>
        <div className="np-art-wrap">
          <Art art={t.art} size="l" seed={t.id} className="np-art" />
        </div>
        <div className="np-side">
          {tab === "lyrics" && <LyricsView t={t} big />}
          {tab === "queue" && <QueueView compact />}
        </div>
      </div>
      <div className="np-foot">
        <div className="np-info">
          <div className="np-text">
            <a className="np-title" href={href({ name: "track", id: t.id })} onClick={close}>
              {t.title}
            </a>
            <a className="np-artist" href={href({ name: "artist", id: t.artist.id })} onClick={close}>
              {t.artist.name}
            </a>
          </div>
          <HeartButton t={t} always size={26} />
        </div>
        <Progress />
        <Controls big />
        <div className="np-tabs">
          <button className={"icon-btn toggle" + (tab === "lyrics" ? " on" : "")} aria-pressed={tab === "lyrics"} aria-label="Letra" onClick={() => setTab(tab === "lyrics" ? "art" : "lyrics")}>
            <Icon name="mic" />
          </button>
          <button className={"icon-btn toggle" + (tab === "queue" ? " on" : "")} aria-pressed={tab === "queue"} aria-label="Cola" onClick={() => setTab(tab === "queue" ? "art" : "queue")}>
            <Icon name="queue" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- panel derecho ---------- */

export function RightPanel() {
  const panel = useStore((s) => s.panel);
  const t = useStore((s) => s.queue.current);
  if (!panel) return null;
  const titles = { queue: "Cola", lyrics: "Letra", friends: "Actividad de amigos" };
  return (
    <aside className="rpanel" aria-label={titles[panel]}>
      <header className="rpanel-head">
        <div className="seg" role="tablist">
          {(["queue", "lyrics", "friends"] as const).map((p) => (
            <button key={p} role="tab" aria-selected={panel === p} onClick={() => setState({ panel: p })}>
              {p === "queue" ? "Cola" : p === "lyrics" ? "Letra" : "Amigos"}
            </button>
          ))}
        </div>
        <button className="icon-btn" aria-label="Cerrar panel" onClick={() => setPanel(panel)}>
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className="rpanel-body">
        {panel === "queue" && <QueueView />}
        {panel === "lyrics" && (t ? <LyricsView t={t} /> : <p className="muted pad">Poné un tema para ver su letra.</p>)}
        {panel === "friends" && <FriendsView />}
      </div>
    </aside>
  );
}

function QRow({ t, onPlay, extra, current }: { t: Track; onPlay?: () => void; extra?: React.ReactNode; current?: boolean }) {
  const playing = useStore((s) => s.playing);
  return (
    <div className={"qrow" + (current ? " current" : "")} onDoubleClick={onPlay} onContextMenu={(e) => openMenu(e, trackMenuItems(t))}>
      <button className="qrow-art" onClick={onPlay} aria-label={`Reproducir ${t.title}`} disabled={!onPlay}>
        <Art art={t.art} size="s" seed={t.id} />
        {current && playing ? <span className="qrow-eq"><Eq /></span> : onPlay && <span className="qrow-play"><Icon name="play" size={16} /></span>}
      </button>
      <span className="row-text">
        <span className="row-title">{t.title}</span>
        <span className="row-sub">{t.artist.name}</span>
      </span>
      {extra}
    </div>
  );
}

export function QueueView({ compact }: { compact?: boolean }) {
  const q = useStore((s) => s.queue);
  if (!q.current) return <p className="muted pad">La cola está vacía. Dale play a algo.</p>;
  const next = upcoming(q, 40);
  return (
    <div className={"queue" + (compact ? " compact" : "")}>
      <h3>Sonando ahora</h3>
      <QRow t={q.current} current />
      {q.manual.length > 0 && (
        <>
          <h3>A continuación en la cola</h3>
          {q.manual.map((t, i) => (
            <QRow
              key={t.id + i}
              t={t}
              onPlay={() => P.jumpManual(i)}
              extra={
                <button className="icon-btn sm" aria-label={`Quitar ${t.title} de la cola`} onClick={() => P.removeQueued(i)}>
                  <Icon name="close" size={16} />
                </button>
              }
            />
          ))}
        </>
      )}
      {next.length > 0 && (
        <>
          <h3>Siguiente de: {q.ctx?.name ?? "la lista"}</h3>
          {next.map((t, k) => (
            <QRow key={t.id + ":" + k} t={t} onPlay={t.streamable ? () => P.jumpUpcoming(k) : undefined} />
          ))}
        </>
      )}
      {!next.length && !q.manual.length && <p className="muted">No hay nada más en la cola.</p>}
    </div>
  );
}

/* ---------- letras ---------- */

export function LyricsView({ t, big }: { t: Track; big?: boolean }) {
  const [ly, setLy] = useState<Lyrics | null | undefined>(undefined);
  const time = useStore((s) => s.time);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    setLy(undefined);
    fetchLyrics(t).then((x) => alive && setLy(x));
    return () => {
      alive = false;
    };
  }, [t]);
  const idx = ly?.synced ? lineAt(ly.synced, time) : -1;
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(".ly-line.on");
    if (el && box.current) box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 3, behavior: "smooth" });
  }, [idx]);
  if (ly === undefined) return <div className="lyrics"><p className="muted pad">Buscando la letra…</p></div>;
  if (!ly)
    return (
      <div className="lyrics empty-ly">
        <Icon name="mic" size={28} />
        <p>No hay letra para este tema.</p>
        <small>Las letras vienen de LRCLIB. La mayoría de la música independiente todavía no está.</small>
      </div>
    );
  return (
    <div className={"lyrics" + (big ? " big" : "")} ref={box}>
      {ly.synced
        ? ly.synced.map((l, i) => (
            <button key={i} className={"ly-line" + (i === idx ? " on" : i < idx ? " past" : "")} onClick={() => P.seek(l.t)}>
              {l.text || "♪"}
            </button>
          ))
        : ly.plain!.split("\n").map((l, i) => (
            <p key={i} className="ly-plain">
              {l || " "}
            </p>
          ))}
      <p className="ly-credit">Letra: LRCLIB</p>
    </div>
  );
}

/* ---------- amigos ---------- */

function FriendsView() {
  const me = useStore((s) => s.me);
  const friends = useStore((s) => s.friends);
  const np = useStore((s) => s.nowPlaying);
  const [u, setU] = useState("");
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!me)
    return (
      <div className="pad friends-empty">
        <Icon name="friends" size={30} />
        <p>Mirá qué escuchan tus amigos en vivo.</p>
        <button className="btn sm" onClick={() => setState({ login: { reason: "Creá una cuenta para seguir a tus amigos." } })}>
          Entrar
        </button>
      </div>
    );
  const list = Object.values(friends).sort((a, b) => {
    const A = np[a.id],
      B = np[b.id];
    const la = A ? (live(A) ? 2 : 1) : 0,
      lb = B ? (live(B) ? 2 : 1) : 0;
    if (la !== lb) return lb - la;
    return (B?.updated_at ?? "").localeCompare(A?.updated_at ?? "");
  });
  return (
    <div className="friends">
      <form
        className="follow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = u.trim().replace(/^@/, "");
          if (!name) return;
          setBusy(true);
          try {
            const p = await findProfile(name);
            if (!p) toast(`No hay nadie con @${name}`, "error");
            else {
              await followUser(p);
              setU("");
            }
          } catch (e) {
            toast(String((e as Error).message ?? e), "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className="input sm" placeholder="Seguir a @usuario" value={u} onChange={(e) => setU(e.target.value)} aria-label="Usuario a seguir" />
        <button className="btn sm" disabled={busy || !u.trim()}>
          Seguir
        </button>
      </form>
      <p className="muted small">Tu usuario es <b>@{me.username}</b>. Pasáselo a tus amigos.</p>
      {!list.length && <p className="muted pad">Todavía no seguís a nadie. Cuando sigas a alguien, acá ves lo que escucha.</p>}
      {list.map((p) => (
        <FriendRow key={p.id} p={p} np={np[p.id]} />
      ))}
    </div>
  );
}

const live = (n: NowPlaying) => n.is_playing && Date.now() - new Date(n.updated_at).getTime() < (n.track.duration + 120) * 1000;

function FriendRow({ p, np }: { p: Profile; np?: NowPlaying }) {
  const on = np && live(np);
  return (
    <div className="friend" onContextMenu={(e) => openMenu(e, [{ label: "Dejar de seguir", icon: "close", danger: true, onClick: () => unfollowUser(p.id) }])}>
      <a href={href({ name: "user", username: p.username })} className="avatar" style={{ background: p.color }}>
        {p.display_name.slice(0, 1).toUpperCase()}
        {on && <span className="live-dot" title="Escuchando ahora" />}
      </a>
      <div className="friend-text">
        <div className="friend-top">
          <a href={href({ name: "user", username: p.username })} className="friend-name">
            {p.display_name}
          </a>
          <span className="muted small">{np ? (on ? <Eq /> : ago(np.updated_at)) : ""}</span>
        </div>
        {np ? (
          <>
            <button className="friend-track" onClick={() => P.playList([np.track], 0, { name: `Lo que escucha ${p.display_name}`, href: href({ name: "user", username: p.username }) })}>
              {np.track.title}
            </button>
            <span className="row-sub">{np.track.artist.name}</span>
          </>
        ) : (
          <span className="row-sub">Sin actividad reciente</span>
        )}
      </div>
    </div>
  );
}
