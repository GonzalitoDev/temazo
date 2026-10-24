"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Art as ArtT, Track } from "@/lib/audius";
import { clock, compact, ago } from "@/lib/format";
import { enqueue, playList, playOrToggle, toggle } from "@/lib/player";
import type { Ctx } from "@/lib/queue";
import { href, shareUrl, type Route } from "@/lib/route";
import { openMenu, setState, toast, toggleLike, useStore, type MenuItem } from "@/lib/store";
import { Art } from "./Art";
import { Eq, Icon } from "./Icon";

/* ---------- datos async ---------- */

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [st, setSt] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setSt((s) => ({ data: s.data, loading: true }));
    fn().then(
      (data) => alive && setSt({ data, loading: false }),
      (error) => alive && setSt({ error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { ...st, reload };
}

export function A({ to, children, className, onClick, title }: { to: Route; children: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void; title?: string }) {
  return (
    <a href={href(to)} className={className} onClick={onClick} title={title}>
      {children}
    </a>
  );
}

export const ArtistLink = ({ a }: { a: Track["artist"] }) => (
  <A to={{ name: "artist", id: a.id }} className="sub-link" onClick={(e) => e.stopPropagation()}>
    {a.name}
  </A>
);

/* ---------- botones ---------- */

export function PlayButton({ tracks, ctx, size = "l", label }: { tracks: Track[]; ctx: Ctx; size?: "l" | "m" | "s"; label?: string }) {
  const active = useStore((s) => !!s.queue.ctx?.href && s.queue.ctx.href === ctx.href && !!s.queue.current);
  const playing = useStore((s) => s.playing);
  const on = active && playing;
  return (
    <button
      className={"play-btn " + size}
      aria-label={on ? "Pausar" : label ?? `Reproducir ${ctx.name}`}
      disabled={!tracks.some((t) => t.streamable)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        playOrToggle(tracks, ctx);
      }}
    >
      <Icon name={on ? "pause" : "play"} size={size === "l" ? 26 : size === "m" ? 22 : 18} />
    </button>
  );
}

export function HeartButton({ t, size = 18, always }: { t: Track; size?: number; always?: boolean }) {
  const liked = useStore((s) => !!s.likes[t.id]);
  return (
    <button
      className={"icon-btn heart" + (liked ? " on" : "") + (always || liked ? " show" : "")}
      aria-label={liked ? "Quitar de Tus me gusta" : "Guardar en Tus me gusta"}
      aria-pressed={liked}
      onClick={(e) => {
        e.stopPropagation();
        void toggleLike(t);
      }}
    >
      <Icon name={liked ? "heartFill" : "heart"} size={size} />
    </button>
  );
}

export function copyLink(r: Route) {
  const url = shareUrl(r);
  navigator.clipboard?.writeText(url).then(
    () => toast("Link copiado"),
    () => toast(url),
  );
}

/** Menú de un tema (clic derecho o botón ···). */
export function trackMenuItems(t: Track, extra: MenuItem[] = []): MenuItem[] {
  return [
    { label: "Agregar a la cola", icon: "addQueue", onClick: () => enqueue(t), disabled: !t.streamable },
    { label: "Reproducir a continuación", icon: "playNext", onClick: () => enqueue(t, true), disabled: !t.streamable },
    { label: "Agregar a una playlist…", icon: "addList", onClick: () => setState({ picker: t }) },
    "sep",
    { label: "Ir al artista", icon: "artist", onClick: () => (location.hash = href({ name: "artist", id: t.artist.id })) },
    { label: "Ver el tema", icon: "music", onClick: () => (location.hash = href({ name: "track", id: t.id })) },
    { label: "Copiar link", icon: "share", onClick: () => copyLink({ name: "track", id: t.id }) },
    ...(extra.length ? (["sep", ...extra] as MenuItem[]) : []),
  ];
}

/* ---------- lista de temas ---------- */

export type RowOpts = {
  showArt?: boolean;
  showPlays?: boolean;
  showGenre?: boolean;
  added?: (i: number) => string | undefined;
  extraMenu?: (t: Track, i: number) => MenuItem[];
  drag?: { onMove: (from: number, to: number) => void };
};

export function TrackList({ tracks, ctx, opts = {}, header = true }: { tracks: Track[]; ctx: Ctx; opts?: RowOpts; header?: boolean }) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <div className={"tracklist" + (opts.added ? " with-added" : "") + (opts.showPlays ? " with-plays" : "")} role="list">
      {header && (
        <div className="tl-head" aria-hidden>
          <span>#</span>
          <span>Título</span>
          <span className="col-x">{opts.added ? "Agregado" : opts.showPlays ? "Reproducciones" : "Género"}</span>
          <span className="col-d">
            <Icon name="clock" size={16} />
          </span>
        </div>
      )}
      {tracks.map((t, i) => (
        <TrackRow
          key={t.id + ":" + i}
          t={t}
          i={i}
          onPlay={() => playList(tracks, i, ctx)}
          opts={opts}
          dnd={
            opts.drag
              ? {
                  over: over === i && dragFrom !== null && dragFrom !== i ? (dragFrom < i ? "below" : "above") : null,
                  start: () => setDragFrom(i),
                  enter: () => setOver(i),
                  end: () => {
                    if (dragFrom !== null && over !== null && dragFrom !== over) opts.drag!.onMove(dragFrom, over);
                    setDragFrom(null);
                    setOver(null);
                  },
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

const coarse = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function TrackRow({
  t,
  i,
  onPlay,
  opts,
  dnd,
}: {
  t: Track;
  i: number;
  onPlay: () => void;
  opts: RowOpts;
  dnd?: { over: "above" | "below" | null; start: () => void; enter: () => void; end: () => void };
}) {
  const current = useStore((s) => s.queue.current?.id === t.id);
  const playing = useStore((s) => s.playing);
  const items = () => trackMenuItems(t, opts.extraMenu?.(t, i));
  const play = () => (current ? toggle() : onPlay());
  const added = opts.added?.(i);
  return (
    <div
      role="listitem"
      className={"row" + (current ? " current" : "") + (t.streamable ? "" : " unavailable") + (dnd?.over ? " drop-" + dnd.over : "")}
      onDoubleClick={() => t.streamable && play()}
      onClick={() => coarse() && t.streamable && play()}
      onContextMenu={(e) => openMenu(e, items())}
      draggable={!!dnd}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        dnd?.start();
      }}
      onDragEnter={dnd?.enter}
      onDragOver={(e) => dnd && e.preventDefault()}
      onDragEnd={dnd?.end}
    >
      <span className="row-n">
        {current && playing ? <Eq /> : <span className="n">{i + 1}</span>}
        <button
          className="row-play"
          aria-label={current && playing ? "Pausar" : `Reproducir ${t.title}`}
          disabled={!t.streamable}
          onClick={(e) => {
            e.stopPropagation();
            play();
          }}
        >
          <Icon name={current && playing ? "pause" : "play"} size={16} />
        </button>
      </span>
      <span className="row-main">
        {opts.showArt !== false && <Art art={t.art} size="s" seed={t.id} className="row-art" />}
        <span className="row-text">
          <A to={{ name: "track", id: t.id }} className="row-title" onClick={(e) => e.stopPropagation()}>
            {t.title}
          </A>
          <span className="row-sub">
            {t.artist.verified && <Icon name="verified" size={13} className="verified" title="Verificado" />}
            <ArtistLink a={t.artist} />
            {!t.streamable && <span className="tag">No disponible</span>}
          </span>
        </span>
      </span>
      <span className="col-x row-x">{added ? ago(added) : opts.showPlays ? compact(t.plays) : t.genre}</span>
      <span className="row-end">
        <HeartButton t={t} size={17} />
        <span className="col-d">{clock(t.duration)}</span>
        <button className="icon-btn row-more" aria-label={`Más opciones para ${t.title}`} onClick={(e) => openMenu(e, items())}>
          <Icon name="more" size={18} />
        </button>
      </span>
    </div>
  );
}

/* ---------- tarjetas y filas horizontales ---------- */

export function Card({
  to,
  art,
  seed,
  title,
  sub,
  round,
  play,
  custom,
}: {
  to: Route;
  art?: ArtT;
  seed: string;
  title: string;
  sub?: React.ReactNode;
  round?: boolean;
  play?: PlayProp;
  custom?: React.ReactNode;
}) {
  return (
    <a href={href(to)} className={"card" + (round ? " round" : "")}>
      <span className="card-art">
        {custom ?? <Art art={art} seed={seed} round={round} icon={round ? "user" : "music"} />}
        {play && <CardPlay {...play} />}
      </span>
      <span className="card-title" title={title}>
        {title}
      </span>
      {sub && <span className="card-sub">{sub}</span>}
    </a>
  );
}

type PlayProp = { tracks?: Track[]; load?: () => Promise<Track[]>; ctx: Ctx; start?: number; className?: string };

export function CardPlay({ tracks, load, ctx, start, className = "card-play" }: PlayProp) {
  const trackId = start !== undefined ? tracks?.[start]?.id : undefined;
  const active = useStore((s) =>
    trackId ? s.queue.current?.id === trackId : !!s.queue.ctx?.href && s.queue.ctx.href === ctx.href && !!s.queue.current,
  );
  const playing = useStore((s) => s.playing);
  const [busy, setBusy] = useState(false);
  const on = active && playing;
  return (
    <button
      className={"play-btn m " + className + (on ? " on" : "")}
      aria-label={on ? "Pausar" : `Reproducir ${ctx.name}`}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (active) return toggle();
        setBusy(true);
        try {
          const list = tracks ?? (await load!());
          if (!list.length) toast("No hay temas para reproducir");
          else if (start !== undefined) playList(list, start, ctx);
          else playOrToggle(list, ctx);
        } catch {
          toast("No se pudo cargar. Probá de nuevo.", "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <span className="spinner sm" /> : <Icon name={on ? "pause" : "play"} size={20} />}
    </button>
  );
}

export function Shelf({ title, more, children, loading, error, onRetry }: { title: string; more?: Route; children?: React.ReactNode; loading?: boolean; error?: unknown; onRetry?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="shelf">
      <header>
        <h2>{more ? <A to={more}>{title}</A> : title}</h2>
        <span className="shelf-nav">
          {more && (
            <A to={more} className="more-link">
              Mostrar todo
            </A>
          )}
          <button className="icon-btn sm" aria-label="Anterior" onClick={() => scroll(-1)}>
            <Icon name="back" size={16} />
          </button>
          <button className="icon-btn sm" aria-label="Siguiente" onClick={() => scroll(1)}>
            <Icon name="fwd" size={16} />
          </button>
        </span>
      </header>
      {error ? (
        <ErrorBox onRetry={onRetry} />
      ) : (
        <div className="shelf-row" ref={ref}>
          {loading ? Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />) : children}
        </div>
      )}
    </section>
  );
}

export const CardSkeleton = () => (
  <span className="card skeleton" aria-hidden>
    <span className="card-art sk" />
    <span className="sk sk-line" />
    <span className="sk sk-line short" />
  </span>
);

export const RowsSkeleton = ({ n = 8 }: { n?: number }) => (
  <div className="tracklist" aria-busy>
    {Array.from({ length: n }, (_, i) => (
      <div className="row skeleton" key={i}>
        <span className="row-n" />
        <span className="row-main">
          <span className="row-art sk" />
          <span className="row-text">
            <span className="sk sk-line" style={{ width: `${40 + ((i * 37) % 35)}%` }} />
            <span className="sk sk-line short" />
          </span>
        </span>
      </div>
    ))}
  </div>
);

export function ErrorBox({ onRetry, text = "No pudimos hablar con Audius." }: { onRetry?: () => void; text?: string }) {
  return (
    <div className="empty small">
      <p>{text}</p>
      {onRetry && (
        <button className="btn ghost sm" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={30} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/** Encabezado con degradé del color de la tapa. */
export function Hero({ color, kind, title, art, meta, children, round }: { color: string; kind: string; title: string; art: React.ReactNode; meta?: React.ReactNode; children?: React.ReactNode; round?: boolean }) {
  const len = title.length;
  return (
    <>
      <header className="hero" style={{ "--hero": color } as React.CSSProperties}>
        <div className={"hero-art" + (round ? " round" : "")}>{art}</div>
        <div className="hero-text">
          <span className="hero-kind">{kind}</span>
          <h1 className={len > 40 ? "xl" : len > 18 ? "l" : ""}>{title}</h1>
          {meta && <div className="hero-meta">{meta}</div>}
        </div>
      </header>
      <div className="hero-bar" style={{ "--hero": color } as React.CSSProperties}>
        {children}
      </div>
    </>
  );
}
