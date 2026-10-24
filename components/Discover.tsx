"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, GENRES, genreLabel, type APlaylist, type Artist, type Track, type TrendTime } from "@/lib/audius";
import { compact, greeting, plural } from "@/lib/format";
import { go, href, type Route } from "@/lib/route";
import { likedList, myPlaylists, pref, savePref, useStore } from "@/lib/store";
import { playList } from "@/lib/player";
import { Art, LikedArt, Mosaic } from "./Art";
import { Icon } from "./Icon";
import { A, Card, CardPlay, Empty, ErrorBox, Hero, PlayButton, RowsSkeleton, Shelf, TrackList, useAsync } from "./ui";

/* ---------- tarjetas reutilizables ---------- */

export const trackCards = (list: Track[], ctx: { name: string; href: string }) =>
  list.map((t, i) => (
    <Card
      key={t.id}
      to={{ name: "track", id: t.id }}
      art={t.art}
      seed={t.id}
      title={t.title}
      sub={t.artist.name}
      play={{ tracks: list, start: i, ctx }}
    />
  ));

export const artistCards = (list: Artist[]) =>
  list.map((a) => (
    <Card
      key={a.id}
      to={{ name: "artist", id: a.id }}
      art={a.avatar}
      seed={a.id}
      title={a.name}
      sub="Artista"
      round
      play={{ load: () => api.artistTracks(a.id, "plays", 20), ctx: { name: a.name, href: href({ name: "artist", id: a.id }) } }}
    />
  ));

export const playlistCards = (list: APlaylist[]) =>
  list.map((p) => (
    <Card
      key={p.id}
      to={{ name: "playlist", id: p.id }}
      art={p.art}
      seed={p.id}
      title={p.name}
      sub={`${p.isAlbum ? "Álbum" : "Playlist"} · ${p.owner.name}`}
      play={{ load: () => api.playlistTracks(p.id), ctx: { name: p.name, href: href({ name: "playlist", id: p.id }) } }}
    />
  ));

/* ---------- Inicio ---------- */

export function HomePage() {
  const me = useStore((s) => s.me);
  const trending = useAsync(() => api.trending({ limit: 20 }), []);
  const under = useAsync(() => api.underground(20), []);
  const pls = useAsync(() => api.trendingPlaylists(12), []);
  const tCtx = { name: "Tendencias de la semana", href: href({ name: "genre", g: "todo" }) };

  return (
    <div className="page home">
      <div className="home-glow" />
      <h1 className="greet">{greeting()}{me ? `, ${me.display_name}` : ""}</h1>
      <QuickTiles />
      <Shelf title="Tendencias de la semana" more={{ name: "genre", g: "todo" }} loading={trending.loading && !trending.data} error={trending.error} onRetry={trending.reload}>
        {trending.data && trackCards(trending.data, tCtx)}
      </Shelf>
      <FollowedShelf />
      <RecentShelf />
      <Shelf title="Playlists en tendencia" loading={pls.loading && !pls.data} error={pls.error} onRetry={pls.reload}>
        {pls.data && playlistCards(pls.data)}
      </Shelf>
      <Shelf title="Lo más escuchado del under" loading={under.loading && !under.data} error={under.error} onRetry={under.reload}>
        {under.data && trackCards(under.data, { name: "Lo más escuchado del under", href: "#under" })}
      </Shelf>
      {["Electronic", "Hip-Hop/Rap", "Lo-Fi", "House"].map((g) => (
        <GenreShelf key={g} genre={g} />
      ))}
    </div>
  );
}

function GenreShelf({ genre }: { genre: string }) {
  const r = useAsync(() => api.trending({ genre, limit: 16 }), [genre]);
  const label = genreLabel(genre);
  if (r.data && !r.data.length) return null;
  return (
    <Shelf title={label} more={{ name: "genre", g: genre }} loading={r.loading && !r.data} error={r.error} onRetry={r.reload}>
      {r.data && trackCards(r.data, { name: label, href: href({ name: "genre", g: genre }) })}
    </Shelf>
  );
}

function FollowedShelf() {
  const follows = useStore((s) => s.follows);
  const ids = Object.keys(follows).slice(0, 6).join(",");
  const r = useAsync(async () => {
    if (!ids) return [];
    const lists = await Promise.all(ids.split(",").map((id) => api.artistTracks(id, "date", 6).catch(() => [] as Track[])));
    return lists
      .flat()
      .sort((a, b) => (b.released ?? "").localeCompare(a.released ?? ""))
      .slice(0, 20);
  }, [ids]);
  if (!ids || (r.data && !r.data.length)) return null;
  return (
    <Shelf title="Lo nuevo de los que seguís" loading={r.loading && !r.data} error={r.error} onRetry={r.reload}>
      {r.data && trackCards(r.data, { name: "Lo nuevo de los que seguís", href: "#seguidos" })}
    </Shelf>
  );
}

function RecentShelf() {
  const history = useStore((s) => s.history);
  if (history.length < 3) return null;
  const list = history.slice(0, 16).map((h) => h.track);
  return <Shelf title="Escuchado recientemente">{trackCards(list, { name: "Escuchado recientemente", href: "#recientes" })}</Shelf>;
}

function QuickTiles() {
  const me = useStore((s) => s.me);
  const likes = useStore((s) => s.likes);
  const playlists = useStore((s) => s.playlists);
  const plTracks = useStore((s) => s.plTracks);
  const history = useStore((s) => s.history);
  const liked = useMemo(() => likedList({ likes } as never).map((l) => l.track), [likes]);
  const tiles: React.ReactNode[] = [];
  if (me) {
    tiles.push(
      <Tile key="liked" to={{ name: "liked" }} art={<LikedArt />} title="Tus me gusta" tracks={liked} ctx={{ name: "Tus me gusta", href: href({ name: "liked" }) }} />,
    );
    for (const p of myPlaylists({ playlists } as never).slice(0, 3)) {
      const list = plTracks[p.id]?.list.map((x) => x.track) ?? [];
      tiles.push(
        <Tile key={p.id} to={{ name: "list", id: p.id }} art={<Mosaic arts={list.map((t) => t.art)} seed={p.id} />} title={p.name} tracks={list} ctx={{ name: p.name, href: href({ name: "list", id: p.id }) }} />,
      );
    }
  }
  const recent = history.slice(0, 8 - tiles.length).map((h) => h.track);
  recent.forEach((t, i) =>
    tiles.push(<Tile key={"h" + t.id} to={{ name: "track", id: t.id }} art={<Art art={t.art} size="s" seed={t.id} />} title={t.title} tracks={recent} start={i} ctx={{ name: "Escuchado recientemente", href: "#recientes" }} />),
  );
  if (tiles.length < 2) return null;
  return <div className="tiles">{tiles.slice(0, 8)}</div>;
}

function Tile({ to, art, title, tracks, ctx, start }: { to: Route; art: React.ReactNode; title: string; tracks: Track[]; ctx: { name: string; href: string }; start?: number }) {
  const current = useStore((s) => (start !== undefined ? s.queue.current?.id === tracks[start]?.id : s.queue.ctx?.href === ctx.href && !!s.queue.current));
  const playing = useStore((s) => s.playing);
  return (
    <a href={href(to)} className={"tile" + (current ? " current" : "")}>
      {art}
      <span className="tile-title">{title}</span>
      {tracks.length > 0 &&
        (start !== undefined ? (
          <button
            className="play-btn s tile-play"
            aria-label={`Reproducir ${title}`}
            onClick={(e) => {
              e.preventDefault();
              playList(tracks, start, ctx);
            }}
          >
            <Icon name={current && playing ? "pause" : "play"} size={16} />
          </button>
        ) : (
          <span className="tile-play">
            <PlayButton tracks={tracks} ctx={ctx} size="s" />
          </span>
        ))}
    </a>
  );
}

/* ---------- Género (y "Tendencias" generales) ---------- */

const TIMES: { v: TrendTime; label: string }[] = [
  { v: "week", label: "Semana" },
  { v: "month", label: "Mes" },
  { v: "year", label: "Año" },
  { v: "allTime", label: "Siempre" },
];

export function GenrePage({ g }: { g: string }) {
  const all = g === "todo";
  const [time, setTime] = useState<TrendTime>("week");
  const r = useAsync(() => api.trending({ genre: all ? undefined : g, time, limit: 50 }), [g, time]);
  const meta = GENRES.find((x) => x.value === g);
  const title = all ? "Tendencias" : genreLabel(g);
  const color = all ? "hsl(18 70% 34%)" : `hsl(${meta?.hue ?? 200} 55% 32%)`;
  const ctx = { name: title, href: href({ name: "genre", g }) };
  return (
    <div className="page">
      <Hero
        color={color}
        kind={all ? "Lo que más suena en Audius" : "Género"}
        title={title}
        art={
          <span className="art genre-art" style={{ background: color }}>
            <Icon name={all ? "music" : "grid"} size={56} />
          </span>
        }
        meta={r.data ? `${plural(r.data.length, "tema", "temas")} en tendencia` : " "}
      >
        <PlayButton tracks={r.data ?? []} ctx={ctx} />
        <div className="seg" role="tablist" aria-label="Período">
          {TIMES.map((t) => (
            <button key={t.v} role="tab" aria-selected={time === t.v} onClick={() => setTime(t.v)}>
              {t.label}
            </button>
          ))}
        </div>
      </Hero>
      <div className="page-body">
        {r.error ? <ErrorBox onRetry={r.reload} /> : !r.data ? <RowsSkeleton /> : r.data.length ? <TrackList tracks={r.data} ctx={ctx} opts={{ showPlays: true }} /> : <Empty icon="music" title="Nada por acá" text="No hay tendencias de este género en este período." />}
      </div>
    </div>
  );
}

/* ---------- Buscar ---------- */

const TABS = [
  { v: "all", label: "Todo" },
  { v: "tracks", label: "Canciones" },
  { v: "artists", label: "Artistas" },
  { v: "playlists", label: "Playlists" },
] as const;

export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function SearchPage({ q, tab }: { q: string; tab: "all" | "tracks" | "artists" | "playlists" }) {
  const query = q.trim();
  return <div className="page search-page">{query ? <Results q={query} tab={tab} /> : <Browse />}</div>;
}

function Browse() {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(pref<string[]>("recentSearches", [])), []);
  return (
    <>
      {recent.length > 0 && (
        <section className="recent-searches">
          <header className="sec-head">
            <h2>Búsquedas recientes</h2>
            <button
              className="btn ghost sm"
              onClick={() => {
                savePref("recentSearches", []);
                setRecent([]);
              }}
            >
              Borrar
            </button>
          </header>
          <div className="chips">
            {recent.map((r) => (
              <A key={r} to={{ name: "search", q: r, tab: "all" }} className="chip">
                {r}
              </A>
            ))}
          </div>
        </section>
      )}
      <h2 className="sec-title">Explorar todo</h2>
      <div className="genre-grid">
        <A to={{ name: "genre", g: "todo" }} className="genre-tile" >
          <span style={{ background: "hsl(18 72% 44%)" }} className="genre-bg" />
          <span className="genre-name">Tendencias</span>
          <Icon name="music" size={64} className="genre-ico" />
        </A>
        {GENRES.map((g) => (
          <A key={g.value} to={{ name: "genre", g: g.value }} className="genre-tile">
            <span style={{ background: `hsl(${g.hue} 58% 40%)` }} className="genre-bg" />
            <span className="genre-name">{g.label}</span>
          </A>
        ))}
      </div>
    </>
  );
}

function rememberSearch(q: string) {
  const list = pref<string[]>("recentSearches", []);
  savePref("recentSearches", [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10));
}

function Results({ q, tab }: { q: string; tab: (typeof TABS)[number]["v"] }) {
  const tracks = useAsync(() => api.searchTracks(q, tab === "tracks" ? 40 : 20), [q, tab === "tracks"]);
  const artists = useAsync(() => (tab === "all" || tab === "artists" ? api.searchArtists(q, tab === "artists" ? 30 : 12) : Promise.resolve([])), [q, tab]);
  const pls = useAsync(() => (tab === "all" || tab === "playlists" ? api.searchPlaylists(q, tab === "playlists" ? 30 : 12) : Promise.resolve([])), [q, tab]);
  const saved = useRef("");
  useEffect(() => {
    const t = setTimeout(() => {
      if (saved.current !== q) {
        saved.current = q;
        rememberSearch(q);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [q]);

  const ctx = { name: `Resultados de «${q}»`, href: href({ name: "search", q, tab: "tracks" }) };
  const tabs = (
    <div className="chips tabs-chips" role="tablist">
      {TABS.map((t) => (
        <button key={t.v} role="tab" aria-selected={tab === t.v} className={"chip" + (tab === t.v ? " on" : "")} onClick={() => go({ name: "search", q, tab: t.v }, true)}>
          {t.label}
        </button>
      ))}
    </div>
  );
  const err = tracks.error && artists.error;
  if (err)
    return (
      <>
        {tabs}
        <ErrorBox onRetry={() => (tracks.reload(), artists.reload(), pls.reload())} />
      </>
    );
  const loading = tracks.loading && !tracks.data;
  const nothing = !loading && !tracks.data?.length && !artists.data?.length && !pls.data?.length && !artists.loading && !pls.loading;

  if (nothing)
    return (
      <>
        {tabs}
        <Empty icon="search" title={`No encontramos «${q}»`} text="Revisá cómo lo escribiste o probá con menos palabras. En Audius hay sobre todo música independiente." />
      </>
    );

  if (tab === "tracks")
    return (
      <>
        {tabs}
        {loading ? <RowsSkeleton n={12} /> : <TrackList tracks={tracks.data ?? []} ctx={ctx} opts={{ showPlays: true }} />}
      </>
    );
  if (tab === "artists")
    return (
      <>
        {tabs}
        <div className="card-grid">{artists.data ? artistCards(artists.data) : null}</div>
      </>
    );
  if (tab === "playlists")
    return (
      <>
        {tabs}
        <div className="card-grid">{pls.data ? playlistCards(pls.data) : null}</div>
      </>
    );

  // Todo
  const topArtist = artists.data?.find((a) => a.name.toLowerCase() === q.toLowerCase() || a.handle.toLowerCase() === q.toLowerCase());
  const topTrack = tracks.data?.[0];
  return (
    <>
      {tabs}
      <div className="top-grid">
        <section>
          <h2 className="sec-title">Mejor resultado</h2>
          {loading ? (
            <div className="top-card sk" />
          ) : topArtist ? (
            <a href={href({ name: "artist", id: topArtist.id })} className="top-card">
              <Art art={topArtist.avatar} seed={topArtist.id} round className="top-art" icon="user" />
              <span className="top-name">{topArtist.name}</span>
              <span className="top-kind">Artista · {compact(topArtist.followers)} seguidores</span>
              <span className="top-play">
                <CardPlay load={() => api.artistTracks(topArtist.id, "plays", 20)} ctx={{ name: topArtist.name, href: href({ name: "artist", id: topArtist.id }) }} className="" />
              </span>
            </a>
          ) : topTrack ? (
            <a href={href({ name: "track", id: topTrack.id })} className="top-card">
              <Art art={topTrack.art} seed={topTrack.id} className="top-art" />
              <span className="top-name">{topTrack.title}</span>
              <span className="top-kind">Canción · {topTrack.artist.name}</span>
              <span className="top-play">
                <PlayButton tracks={tracks.data!} ctx={ctx} size="m" />
              </span>
            </a>
          ) : null}
        </section>
        <section>
          <h2 className="sec-title">
            <A to={{ name: "search", q, tab: "tracks" }}>Canciones</A>
          </h2>
          {loading ? <RowsSkeleton n={4} /> : <TrackList tracks={(tracks.data ?? []).slice(0, 4)} ctx={ctx} header={false} />}
        </section>
      </div>
      {!!artists.data?.length && (
        <Shelf title="Artistas" more={{ name: "search", q, tab: "artists" }}>
          {artistCards(artists.data)}
        </Shelf>
      )}
      {!!pls.data?.length && (
        <Shelf title="Playlists" more={{ name: "search", q, tab: "playlists" }}>
          {playlistCards(pls.data)}
        </Shelf>
      )}
      {(tracks.data?.length ?? 0) > 4 && (
        <Shelf title="Más canciones" more={{ name: "search", q, tab: "tracks" }}>
          {trackCards(tracks.data!.slice(4), { name: ctx.name, href: ctx.href + "#mas" })}
        </Shelf>
      )}
    </>
  );
}
