"use client";

import { useState } from "react";
import { api, AudiusError, genreLabel, type Track } from "@/lib/audius";
import { clock, compact, longDuration, num, plural } from "@/lib/format";
import { href } from "@/lib/route";
import { openMenu, toggleFollowArtist, useStore } from "@/lib/store";
import { enqueue } from "@/lib/player";
import { Art, useArtColor } from "./Art";
import { artistCards, playlistCards, trackCards } from "./Discover";
import { Icon } from "./Icon";
import { A, copyLink, Empty, ErrorBox, HeartButton, Hero, PlayButton, RowsSkeleton, Shelf, TrackList, trackMenuItems, useAsync } from "./ui";

function NotFound({ what }: { what: string }) {
  return (
    <div className="page">
      <Empty icon="search" title={`No encontramos ${what}`} text="Puede que lo hayan borrado de Audius." action={<A to={{ name: "home" }} className="btn">Volver al inicio</A>} />
    </div>
  );
}

/* ---------- Artista ---------- */

export function ArtistPage({ id }: { id: string }) {
  const a = useAsync(() => api.artist(id), [id]);
  const top = useAsync(() => api.artistTracks(id, "plays", 20), [id]);
  const latest = useAsync(() => api.artistTracks(id, "date", 12), [id]);
  const pls = useAsync(() => api.artistPlaylists(id).catch(() => []), [id]);
  const related = useAsync(() => api.related(id).catch(() => []), [id]);
  const following = useStore((s) => !!s.follows[id]);
  const [all, setAll] = useState(false);
  const color = useArtColor(a.data?.avatar, id);

  if (a.error) return (a.error as AudiusError).status === 404 ? <NotFound what="a este artista" /> : <div className="page"><ErrorBox onRetry={a.reload} /></div>;
  const artist = a.data;
  const ctx = { name: artist?.name ?? "Artista", href: href({ name: "artist", id }) };
  const cover = artist?.cover?.l ?? artist?.cover?.m;
  return (
    <div className="page">
      <header className={"artist-hero" + (cover ? " has-cover" : "")} style={{ "--hero": color } as React.CSSProperties}>
        {cover && <img className="artist-cover" src={cover} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
        <div className="artist-hero-in">
          <Art art={artist?.avatar} seed={id} round size="l" className="artist-avatar" icon="user" />
          <div>
            {artist?.verified && (
              <span className="verified-line">
                <Icon name="verified" size={20} className="verified" /> Artista verificado
              </span>
            )}
            <h1 className={(artist?.name.length ?? 0) > 18 ? "l" : ""}>{artist?.name ?? " "}</h1>
            {artist && <p className="hero-meta">{num(artist.followers)} seguidores{artist.location ? ` · ${artist.location}` : ""}</p>}
          </div>
        </div>
      </header>
      <div className="hero-bar" style={{ "--hero": color } as React.CSSProperties}>
        <PlayButton tracks={top.data ?? []} ctx={ctx} />
        {artist && (
          <button className={"btn outline" + (following ? " on" : "")} onClick={() => toggleFollowArtist(artist)}>
            {following ? "Siguiendo" : "Seguir"}
          </button>
        )}
        <button className="icon-btn" aria-label="Copiar link del artista" onClick={() => copyLink({ name: "artist", id })}>
          <Icon name="share" />
        </button>
      </div>
      <div className="page-body">
        <h2 className="sec-title">Populares</h2>
        {top.error ? (
          <ErrorBox onRetry={top.reload} />
        ) : !top.data ? (
          <RowsSkeleton n={5} />
        ) : top.data.length ? (
          <>
            <TrackList tracks={all ? top.data : top.data.slice(0, 5)} ctx={ctx} opts={{ showPlays: true }} header={false} />
            {top.data.length > 5 && (
              <button className="btn text" onClick={() => setAll(!all)}>
                {all ? "Mostrar menos" : "Ver más"}
              </button>
            )}
          </>
        ) : (
          <Empty icon="music" title="Todavía no subió temas" />
        )}
        {!!latest.data?.length && <Shelf title="Lo último">{trackCards(latest.data, { name: `Lo último de ${artist?.name ?? ""}`, href: ctx.href + "#ultimo" })}</Shelf>}
        {!!pls.data?.length && <Shelf title="Playlists y álbumes">{playlistCards(pls.data)}</Shelf>}
        {!!related.data?.length && <Shelf title="A los fans también les gusta">{artistCards(related.data)}</Shelf>}
        {artist?.bio && (
          <section className="about">
            <h2 className="sec-title">Acerca de</h2>
            <p>{artist.bio}</p>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------- Tema ---------- */

export function TrackPage({ id }: { id: string }) {
  const r = useAsync(() => api.track(id), [id]);
  const t = r.data;
  const more = useAsync(() => (t ? api.artistTracks(t.artist.id, "plays", 12) : Promise.resolve([] as Track[])), [t?.artist.id]);
  const color = useArtColor(t?.art, id);
  if (r.error) return (r.error as AudiusError).status === 404 ? <NotFound what="este tema" /> : <div className="page"><ErrorBox onRetry={r.reload} /></div>;
  const ctx = { name: t?.title ?? "", href: href({ name: "track", id }) };
  return (
    <div className="page">
      <Hero
        color={color}
        kind="Canción"
        title={t?.title ?? " "}
        art={<Art art={t?.art} size="l" seed={id} />}
        meta={
          t && (
            <>
              <A to={{ name: "artist", id: t.artist.id }} className="strong">
                {t.artist.name}
              </A>
              {t.genre && <> · {genreLabel(t.genre)}</>}
              {t.released && <> · {new Date(t.released).getFullYear()}</>} · {clock(t.duration)}
              {t.plays !== undefined && <> · {num(t.plays)} reproducciones</>}
            </>
          )
        }
      >
        {t && (
          <>
            <PlayButton tracks={[t]} ctx={ctx} />
            <HeartButton t={t} size={28} always />
            <button className="icon-btn" aria-label="Agregar a la cola" onClick={() => enqueue(t)}>
              <Icon name="addQueue" />
            </button>
            <button className="icon-btn" aria-label="Más opciones" onClick={(e) => openMenu(e, trackMenuItems(t))}>
              <Icon name="more" size={24} />
            </button>
          </>
        )}
      </Hero>
      <div className="page-body">
        {t && !t.streamable && <p className="note">Este tema no se puede escuchar gratis en Audius (es exclusivo o pago).</p>}
        {t?.mood && <p className="note">Clima: {t.mood}</p>}
        {!!more.data?.length && t && (
          <>
            <h2 className="sec-title">
              Populares de <A to={{ name: "artist", id: t.artist.id }}>{t.artist.name}</A>
            </h2>
            <TrackList tracks={more.data.slice(0, 6)} ctx={{ name: t.artist.name, href: href({ name: "artist", id: t.artist.id }) }} header={false} opts={{ showPlays: true }} />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Playlist de Audius ---------- */

export function APlaylistPage({ id }: { id: string }) {
  const p = useAsync(() => api.playlist(id), [id]);
  const tr = useAsync(() => api.playlistTracks(id), [id]);
  const color = useArtColor(p.data?.art, id);
  if (p.error) return (p.error as AudiusError).status === 404 ? <NotFound what="esta playlist" /> : <div className="page"><ErrorBox onRetry={p.reload} /></div>;
  const pl = p.data;
  const tracks = tr.data ?? [];
  const total = tracks.reduce((s, t) => s + t.duration, 0);
  const ctx = { name: pl?.name ?? "Playlist", href: href({ name: "playlist", id }) };
  return (
    <div className="page">
      <Hero
        color={color}
        kind={pl?.isAlbum ? "Álbum" : "Playlist"}
        title={pl?.name ?? " "}
        art={<Art art={pl?.art} size="l" seed={id} />}
        meta={
          pl && (
            <>
              {pl.description && <span className="hero-desc">{pl.description}</span>}
              <A to={{ name: "artist", id: pl.owner.id }} className="strong">
                {pl.owner.name}
              </A>
              {tr.data && <> · {plural(tracks.length, "tema", "temas")}, {longDuration(total)}</>}
              {pl.plays ? <> · {compact(pl.plays)} reproducciones</> : null}
            </>
          )
        }
      >
        <PlayButton tracks={tracks} ctx={ctx} />
        <button className="icon-btn" aria-label="Copiar link de la playlist" onClick={() => copyLink({ name: "playlist", id })}>
          <Icon name="share" />
        </button>
      </Hero>
      <div className="page-body">
        {tr.error ? <ErrorBox onRetry={tr.reload} /> : !tr.data ? <RowsSkeleton /> : tracks.length ? <TrackList tracks={tracks} ctx={ctx} /> : <Empty icon="music" title="Esta playlist está vacía" />}
      </div>
    </div>
  );
}
