"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Track } from "@/lib/audius";
import { ago, longDuration, plural } from "@/lib/format";
import { href } from "@/lib/route";
import { supabase } from "@/lib/supabase";
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  findProfile,
  followUser,
  likedList,
  loadPlaylistTracks,
  moveInPlaylist,
  myPlaylists,
  removeFromPlaylist,
  setState,
  unfollowUser,
  updatePlaylist,
  useStore,
  type MyPlaylist,
  type Profile,
  type PTrack,
} from "@/lib/store";
import { Art, LikedArt, Mosaic, useArtColor } from "./Art";
import { useDebounced } from "./Discover";
import { Icon } from "./Icon";
import { A, Card, copyLink, Empty, ErrorBox, Hero, PlayButton, RowsSkeleton, TrackList, useAsync } from "./ui";
import { Dialog } from "./Dialogs";

/* ---------- Tus me gusta ---------- */

export function LikedPage() {
  const me = useStore((s) => s.me);
  const likes = useStore((s) => s.likes);
  const list = useMemo(() => likedList({ likes } as never), [likes]);
  const tracks = list.map((l) => l.track);
  const ctx = { name: "Tus me gusta", href: href({ name: "liked" }) };
  const total = tracks.reduce((s, t) => s + t.duration, 0);
  return (
    <div className="page">
      <Hero
        color="hsl(18 62% 36%)"
        kind="Playlist"
        title="Tus me gusta"
        art={<LikedArt />}
        meta={me ? <><span className="strong">{me.display_name}</span> · {plural(tracks.length, "tema", "temas")}{tracks.length ? `, ${longDuration(total)}` : ""}</> : undefined}
      >
        <PlayButton tracks={tracks} ctx={ctx} />
      </Hero>
      <div className="page-body">
        {!me ? (
          <Empty icon="heart" title="Guardá lo que te gusta" text="Entrá o creá una cuenta para juntar tus temas favoritos acá." action={<button className="btn" onClick={() => setState({ login: {} })}>Entrar</button>} />
        ) : tracks.length ? (
          <TrackList tracks={tracks} ctx={ctx} opts={{ added: (i) => list[i]?.at }} />
        ) : (
          <Empty icon="heart" title="Todavía no hay nada" text="Tocá el corazón en cualquier tema y aparece acá." action={<A to={{ name: "search", q: "", tab: "all" }} className="btn">Buscar música</A>} />
        )}
      </div>
    </div>
  );
}

/* ---------- Playlist de Temazo ---------- */

type Remote = { pl: MyPlaylist; owner: Profile | null; tracks: PTrack[] };

export function ListPage({ id }: { id: string }) {
  const own = useStore((s) => s.playlists[id]);
  const me = useStore((s) => s.me);
  const ready = useStore((s) => s.ready);
  const rows = useStore((s) => s.plTracks[id]);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (own) loadPlaylistTracks(id).catch(setErr);
  }, [own, id]);

  // playlist de otra persona (pública)
  const remote = useAsync<Remote | null>(async () => {
    if (!ready || own || !me) return null;
    const { data, error } = await supabase.from("temazo_playlists").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [o, t] = await Promise.all([
      supabase.from("temazo_profiles").select("*").eq("id", data.owner_id).maybeSingle(),
      supabase.from("temazo_playlist_tracks").select("*").eq("playlist_id", id).order("position"),
    ]);
    if (t.error) throw t.error;
    return { pl: data as MyPlaylist, owner: (o.data as Profile) ?? null, tracks: (t.data ?? []) as PTrack[] };
  }, [id, ready, !!own, me?.id]);

  if (!ready) return <div className="page"><RowsSkeleton /></div>;
  if (!own && !me)
    return (
      <div className="page">
        <Empty icon="lock" title="Entrá para ver esta playlist" text="Las playlists de Temazo se ven con una cuenta." action={<button className="btn" onClick={() => setState({ login: {} })}>Entrar</button>} />
      </div>
    );
  if (!own && remote.loading) return <div className="page"><RowsSkeleton /></div>;
  if (!own && remote.error) return <div className="page"><ErrorBox onRetry={remote.reload} text="No se pudo cargar la playlist." /></div>;
  if (!own && !remote.data)
    return (
      <div className="page">
        <Empty icon="lock" title="Esta playlist no existe o es privada" action={<A to={{ name: "home" }} className="btn">Volver al inicio</A>} />
      </div>
    );

  const pl = own ?? remote.data!.pl;
  const list = own ? rows?.list : remote.data!.tracks;
  return <ListView pl={pl} owner={own ? me : remote.data!.owner} list={list} mine={!!own} error={err} />;
}

function ListView({ pl, owner, list, mine, error }: { pl: MyPlaylist; owner: Profile | null; list?: PTrack[]; mine: boolean; error: unknown }) {
  const tracks = useMemo(() => (list ?? []).map((r) => r.track), [list]);
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const color = useArtColor(tracks[0]?.art, pl.id);
  const total = tracks.reduce((s, t) => s + t.duration, 0);
  const ctx = { name: pl.name, href: href({ name: "list", id: pl.id }) };
  return (
    <div className="page">
      <Hero
        color={color}
        kind={pl.is_public ? "Playlist pública" : "Playlist privada"}
        title={pl.name}
        art={
          mine ? (
            <button className="hero-art-btn" onClick={() => setEdit(true)} aria-label="Editar detalles">
              <Mosaic arts={tracks.map((t) => t.art)} seed={pl.id} />
              <span className="hero-art-edit">
                <Icon name="edit" size={36} />
              </span>
            </button>
          ) : (
            <Mosaic arts={tracks.map((t) => t.art)} seed={pl.id} />
          )
        }
        meta={
          <>
            {pl.description && <span className="hero-desc">{pl.description}</span>}
            {owner && (
              <A to={{ name: "user", username: owner.username }} className="strong">
                {owner.display_name}
              </A>
            )}
            {` · ${plural(tracks.length, "tema", "temas")}`}
            {tracks.length ? `, ${longDuration(total)}` : ""}
          </>
        }
      >
        <PlayButton tracks={tracks} ctx={ctx} />
        {mine && (
          <>
            <button className="icon-btn" aria-label="Editar detalles" onClick={() => setEdit(true)}>
              <Icon name="edit" />
            </button>
            <button
              className="icon-btn"
              aria-label={pl.is_public ? "Hacer privada" : "Hacer pública"}
              title={pl.is_public ? "Pública: la ven tus amigos" : "Privada: solo vos"}
              onClick={() => updatePlaylist(pl.id, { is_public: !pl.is_public })}
            >
              <Icon name={pl.is_public ? "globe" : "lock"} />
            </button>
          </>
        )}
        <button className="icon-btn" aria-label="Copiar link de la playlist" onClick={() => copyLink({ name: "list", id: pl.id })}>
          <Icon name="share" />
        </button>
        {mine && (
          <button className="icon-btn" aria-label="Borrar playlist" onClick={() => setConfirmDel(true)}>
            <Icon name="trash" />
          </button>
        )}
      </Hero>
      <div className="page-body">
        {error ? (
          <ErrorBox onRetry={() => loadPlaylistTracks(pl.id, true).catch(() => {})} text="No se pudieron cargar los temas." />
        ) : !list ? (
          <RowsSkeleton />
        ) : tracks.length ? (
          <TrackList
            tracks={tracks}
            ctx={ctx}
            opts={{
              added: (i) => list[i]?.added_at,
              drag: mine ? { onMove: (a, b) => moveInPlaylist(pl.id, a, b) } : undefined,
              extraMenu: mine
                ? (_t, i) => [
                    { label: "Mover arriba", icon: "up", onClick: () => moveInPlaylist(pl.id, i, i - 1), disabled: i === 0 },
                    { label: "Mover abajo", icon: "down", onClick: () => moveInPlaylist(pl.id, i, i + 1), disabled: i === tracks.length - 1 },
                    { label: "Quitar de esta playlist", icon: "trash", danger: true, onClick: () => removeFromPlaylist(pl.id, list[i].id) },
                  ]
                : undefined,
            }}
          />
        ) : (
          !mine && <Empty icon="music" title="Esta playlist está vacía" />
        )}
        {mine && <AddSongs id={pl.id} have={new Set(tracks.map((t) => t.id))} empty={!tracks.length} />}
      </div>
      {edit && <EditPlaylist pl={pl} onClose={() => setEdit(false)} />}
      {confirmDel && (
        <Dialog title="¿Borrar la playlist?" onClose={() => setConfirmDel(false)}>
          <p className="dialog-text">
            Se va a borrar <b>{pl.name}</b> de tu biblioteca. No se puede deshacer.
          </p>
          <div className="dialog-actions">
            <button className="btn ghost" onClick={() => setConfirmDel(false)}>
              Cancelar
            </button>
            <button
              className="btn danger"
              onClick={() => {
                setConfirmDel(false);
                location.hash = href({ name: "library" });
                void deletePlaylist(pl.id);
              }}
            >
              Borrar
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function AddSongs({ id, have, empty }: { id: string; have: Set<string>; empty: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(empty);
  const dq = useDebounced(q.trim(), 300);
  const r = useAsync(() => (dq ? api.searchTracks(dq, 10) : Promise.resolve([] as Track[])), [dq]);
  useEffect(() => {
    if (empty) setOpen(true);
  }, [empty]);
  if (!open)
    return (
      <button className="btn text" onClick={() => setOpen(true)}>
        Buscar más temas
      </button>
    );
  return (
    <section className="add-songs">
      <header className="sec-head">
        <h2>Busquemos algo para tu playlist</h2>
        {!empty && (
          <button className="icon-btn" aria-label="Cerrar búsqueda" onClick={() => setOpen(false)}>
            <Icon name="close" />
          </button>
        )}
      </header>
      <label className="search-box inline">
        <Icon name="search" size={18} />
        <input placeholder="Buscá canciones" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar canciones para agregar" />
      </label>
      {dq &&
        (r.loading && !r.data ? (
          <RowsSkeleton n={4} />
        ) : r.data?.length ? (
          <div className="add-list">
            {r.data.map((t) => (
              <div key={t.id} className="add-row">
                <Art art={t.art} size="s" seed={t.id} className="row-art" />
                <span className="row-text">
                  <span className="row-title">{t.title}</span>
                  <span className="row-sub">{t.artist.name}</span>
                </span>
                <button className="btn outline sm" disabled={have.has(t.id)} onClick={() => addToPlaylist(id, t)}>
                  {have.has(t.id) ? "Agregado" : "Agregar"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No encontramos «{dq}».</p>
        ))}
    </section>
  );
}

function EditPlaylist({ pl, onClose }: { pl: MyPlaylist; onClose: () => void }) {
  const [name, setName] = useState(pl.name);
  const [desc, setDesc] = useState(pl.description);
  const [pub, setPub] = useState(pl.is_public);
  return (
    <Dialog title="Editar detalles" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void updatePlaylist(pl.id, { name: name.trim(), description: desc.trim(), is_public: pub });
          onClose();
        }}
      >
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={name} maxLength={100} required autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Descripción (opcional)</span>
          <textarea className="input" rows={3} maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
          <span>
            <b>Pública</b>
            <small>La pueden ver tus amigos en tu perfil y con el link.</small>
          </span>
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn">Guardar</button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- Biblioteca ---------- */

type Item = { key: string; kind: "liked" | "list" | "artist"; name: string; sub: string; at: string; node: React.ReactNode; to: Parameters<typeof href>[0] };

export function useLibraryItems() {
  const me = useStore((s) => s.me);
  const likes = useStore((s) => s.likes);
  const playlists = useStore((s) => s.playlists);
  const plTracks = useStore((s) => s.plTracks);
  const follows = useStore((s) => s.follows);
  return useMemo(() => {
    if (!me) return [] as Item[];
    const items: Item[] = [];
    const n = Object.keys(likes).length;
    items.push({ key: "liked", kind: "liked", name: "Tus me gusta", sub: `Playlist · ${plural(n, "tema", "temas")}`, at: "9999", node: <LikedArt />, to: { name: "liked" } });
    for (const p of myPlaylists({ playlists } as never)) {
      const list = plTracks[p.id]?.list ?? [];
      items.push({
        key: p.id,
        kind: "list",
        name: p.name,
        sub: `Playlist · ${me.display_name}`,
        at: p.updated_at,
        node: <Mosaic arts={list.map((x) => x.track.art)} seed={p.id} />,
        to: { name: "list", id: p.id },
      });
    }
    for (const [id, f] of Object.entries(follows))
      items.push({ key: id, kind: "artist", name: f.artist.name, sub: "Artista", at: f.at, node: <Art art={f.artist.avatar} size="s" seed={id} round icon="user" />, to: { name: "artist", id } });
    return items;
  }, [me, likes, playlists, plTracks, follows]);
}

export function LibraryPage() {
  const me = useStore((s) => s.me);
  const items = useLibraryItems();
  const [filter, setFilter] = useState<"all" | "list" | "artist">("all");
  const [sort, setSort] = useState<"recent" | "alpha">("recent");
  if (!me)
    return (
      <div className="page">
        <h1 className="page-title">Tu biblioteca</h1>
        <Empty icon="library" title="Armá tu biblioteca" text="Con una cuenta guardás temas, armás playlists y seguís artistas." action={<button className="btn" onClick={() => setState({ login: {} })}>Entrar</button>} />
      </div>
    );
  let shown = items.filter((i) => filter === "all" || i.kind === filter || (filter === "list" && i.kind === "liked"));
  shown = shown.slice().sort((a, b) => (a.kind === "liked" ? -1 : b.kind === "liked" ? 1 : sort === "alpha" ? a.name.localeCompare(b.name, "es") : b.at.localeCompare(a.at)));
  return (
    <div className="page">
      <header className="lib-head">
        <h1 className="page-title">Tu biblioteca</h1>
        <button className="btn outline sm" onClick={async () => {
          const pl = await createPlaylist();
          if (pl) location.hash = href({ name: "list", id: pl.id });
        }}>
          <Icon name="plus" size={16} /> Nueva playlist
        </button>
      </header>
      <div className="lib-tools">
        <div className="chips">
          {(
            [
              ["all", "Todo"],
              ["list", "Playlists"],
              ["artist", "Artistas"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} className={"chip" + (filter === v ? " on" : "")} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as "recent" | "alpha")} aria-label="Ordenar">
          <option value="recent">Recientes</option>
          <option value="alpha">Alfabético</option>
        </select>
      </div>
      <div className="card-grid">
        {shown.map((i) => (
          <Card key={i.key} to={i.to} seed={i.key} title={i.name} sub={i.sub} round={i.kind === "artist"} custom={i.node} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Perfil de usuario de Temazo ---------- */

export function UserPage({ username }: { username: string }) {
  const me = useStore((s) => s.me);
  const ready = useStore((s) => s.ready);
  const friends = useStore((s) => s.friends);
  const followers = useStore((s) => s.followers);
  const myPls = useStore((s) => s.playlists);
  const r = useAsync(async () => {
    if (!ready || !me) return null;
    const p = await findProfile(username);
    if (!p) return { p: null, pls: [] as MyPlaylist[] };
    const { data, error } = await supabase.from("temazo_playlists").select("*").eq("owner_id", p.id).eq("is_public", true).order("updated_at", { ascending: false });
    if (error) throw error;
    return { p, pls: (data ?? []) as MyPlaylist[] };
  }, [username, ready, me?.id]);
  if (!ready || r.loading) return <div className="page"><RowsSkeleton n={4} /></div>;
  if (!me)
    return (
      <div className="page">
        <Empty icon="user" title={`@${username}`} text="Entrá para ver perfiles y seguir a tus amigos." action={<button className="btn" onClick={() => setState({ login: {} })}>Entrar</button>} />
      </div>
    );
  if (r.error) return <div className="page"><ErrorBox onRetry={r.reload} text="No se pudo cargar el perfil." /></div>;
  const p = r.data?.p;
  if (!p) return <div className="page"><Empty icon="user" title={`No hay nadie con @${username}`} /></div>;
  const isMe = p.id === me.id;
  const pls = isMe ? Object.values(myPls).filter((x) => x.is_public) : r.data!.pls;
  const follows = !!friends[p.id];
  return (
    <div className="page">
      <Hero
        color={p.color}
        kind="Perfil"
        title={p.display_name}
        round
        art={<span className="avatar huge" style={{ background: p.color }}>{p.display_name.slice(0, 1).toUpperCase()}</span>}
        meta={<>@{p.username} · {pls.length} playlists públicas{isMe ? ` · ${Object.keys(friends).length} seguidos · ${followers.length} seguidores` : ""}</>}
      >
        {!isMe && (
          <button className={"btn outline" + (follows ? " on" : "")} onClick={() => (follows ? unfollowUser(p.id) : followUser(p))}>
            {follows ? "Siguiendo" : "Seguir"}
          </button>
        )}
        <button className="icon-btn" aria-label="Copiar link del perfil" onClick={() => copyLink({ name: "user", username: p.username })}>
          <Icon name="share" />
        </button>
      </Hero>
      <div className="page-body">
        <h2 className="sec-title">Playlists públicas</h2>
        {pls.length ? (
          <div className="card-grid">
            {pls.map((x) => (
              <Card key={x.id} to={{ name: "list", id: x.id }} seed={x.id} title={x.name} sub={`Actualizada ${ago(x.updated_at)}`} />
            ))}
          </div>
        ) : (
          <p className="muted">{isMe ? "Tus playlists públicas aparecen acá." : "Todavía no compartió ninguna playlist."}</p>
        )}
      </div>
    </div>
  );
}

