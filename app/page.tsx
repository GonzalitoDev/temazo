"use client";

import { useEffect, useRef, useState } from "react";
import { boot, useStore } from "@/lib/store";
import { restoreQueue } from "@/lib/player";
import { ContextMenu, MobileNav, Sidebar, Toast, TopBar, useShortcuts } from "@/components/Shell";
import { MiniPlayer, NowPlayingView, PlayerBar, RightPanel } from "@/components/Player";
import { LoginDialog, PlaylistPicker, ProfileSetup } from "@/components/Dialogs";
import { GenrePage, HomePage, SearchPage } from "@/components/Discover";
import { APlaylistPage, ArtistPage, TrackPage } from "@/components/Detail";
import { LibraryPage, LikedPage, ListPage, UserPage } from "@/components/Mine";
import { Empty } from "@/components/ui";

export default function Page() {
  const route = useStore((s) => s.route);
  const needsProfile = useStore((s) => s.needsProfile);
  const panel = useStore((s) => s.panel);
  const hasTrack = useStore((s) => !!s.queue.current);
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  useShortcuts();

  useEffect(() => {
    setMounted(true);
    restoreQueue();
    void boot();
  }, []);

  // cada pantalla nueva arranca arriba
  const key = JSON.stringify(route);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [key]);

  let page: React.ReactNode;
  switch (route.name) {
    case "home":
      page = <HomePage />;
      break;
    case "search":
      page = <SearchPage q={route.q} tab={route.tab} />;
      break;
    case "genre":
      page = <GenrePage g={route.g} />;
      break;
    case "artist":
      page = <ArtistPage id={route.id} />;
      break;
    case "track":
      page = <TrackPage id={route.id} />;
      break;
    case "playlist":
      page = <APlaylistPage id={route.id} />;
      break;
    case "list":
      page = <ListPage id={route.id} />;
      break;
    case "liked":
      page = <LikedPage />;
      break;
    case "library":
      page = <LibraryPage />;
      break;
    case "user":
      page = <UserPage username={route.username} />;
      break;
    default:
      page = (
        <div className="page">
          <Empty icon="search" title="Esta página no existe" action={<a className="btn" href="#/">Volver al inicio</a>} />
        </div>
      );
  }

  return (
    <div className={"app" + (panel ? " with-panel" : "") + (hasTrack ? " has-track" : "")} data-panel={panel ?? ""}>
      <Sidebar />
      <main className="main">
        <TopBar scrolled={scrolled} />
        <div className="scroll" ref={scroller} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)}>
          {mounted ? <div key={key}>{page}</div> : null}
        </div>
      </main>
      <RightPanel />
      <PlayerBar />
      <MiniPlayer />
      <MobileNav />
      <NowPlayingView />
      <ContextMenu />
      <PlaylistPicker />
      <LoginDialog />
      {needsProfile && <ProfileSetup />}
      <Toast />
    </div>
  );
}
