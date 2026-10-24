"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { go, href, type Route } from "@/lib/route";
import * as P from "@/lib/player";
import { createPlaylist, getState, openMenu, setState, signOut, toggleLike, useStore } from "@/lib/store";
import { Icon, Logo } from "./Icon";
import { useLibraryItems } from "./Mine";
import { SettingsDialog } from "./Dialogs";

/* ---------- barra lateral con la biblioteca ---------- */

export function Sidebar() {
  const route = useStore((s) => s.route);
  const me = useStore((s) => s.me);
  const items = useLibraryItems();
  const [filter, setFilter] = useState<"all" | "list" | "artist">("all");
  const [q, setQ] = useState("");
  const shown = items
    .filter((i) => filter === "all" || i.kind === filter || (filter === "list" && i.kind === "liked"))
    .filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.kind === "liked" ? -1 : b.kind === "liked" ? 1 : b.at.localeCompare(a.at)));
  const active = (r: Route) => href(r) === href(route);
  return (
    <aside className="sidebar" aria-label="Navegación">
      <nav className="side-nav box">
        <a href="#/" className="brand">
          <Logo size={30} />
          <span>Temazo</span>
        </a>
        <a href="#/" className={"nav-item" + (route.name === "home" ? " on" : "")} aria-current={route.name === "home" ? "page" : undefined}>
          <Icon name={route.name === "home" ? "homeFill" : "home"} size={24} /> Inicio
        </a>
        <a href="#/buscar" className={"nav-item" + (route.name === "search" ? " on" : "")} aria-current={route.name === "search" ? "page" : undefined}>
          <Icon name="search" size={24} /> Buscar
        </a>
      </nav>
      <section className="side-lib box">
        <header className="side-lib-head">
          <a href="#/biblioteca" className={"nav-item" + (route.name === "library" ? " on" : "")}>
            <Icon name="library" size={24} /> Tu biblioteca
          </a>
          <button
            className="icon-btn"
            aria-label="Crear playlist"
            title="Crear playlist"
            onClick={async () => {
              const pl = await createPlaylist();
              if (pl) location.hash = href({ name: "list", id: pl.id });
            }}
          >
            <Icon name="plus" size={20} />
          </button>
        </header>
        {me ? (
          <>
            <div className="chips side-chips">
              {(
                [
                  ["list", "Playlists"],
                  ["artist", "Artistas"],
                ] as const
              ).map(([v, l]) => (
                <button key={v} className={"chip sm" + (filter === v ? " on" : "")} onClick={() => setFilter(filter === v ? "all" : v)}>
                  {l}
                </button>
              ))}
            </div>
            <label className="side-search">
              <Icon name="search" size={15} />
              <input placeholder="Buscar en tu biblioteca" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en tu biblioteca" />
            </label>
            <ul className="side-list">
              {shown.map((i) => (
                <li key={i.key}>
                  <a href={href(i.to)} className={"side-item" + (active(i.to) ? " on" : "") + (i.kind === "artist" ? " artist" : "")}>
                    {i.node}
                    <span className="row-text">
                      <span className="row-title">{i.name}</span>
                      <span className="row-sub">{i.sub}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="side-cta">
            <b>Armá tu primera playlist</b>
            <p>Guardá temas, seguí artistas y mirá qué escuchan tus amigos.</p>
            <button className="btn sm" onClick={() => setState({ login: {} })}>
              Entrar o crear cuenta
            </button>
          </div>
        )}
      </section>
    </aside>
  );
}

/* ---------- barra superior ---------- */

export function TopBar({ scrolled }: { scrolled: boolean }) {
  const route = useStore((s) => s.route);
  const me = useStore((s) => s.me);
  const session = useStore((s) => s.session);
  const [settings, setSettings] = useState(false);
  const pending = useStore((s) => (s.isAdmin ? s.pendingCount : 0));
  const q = route.name === "search" ? route.q : "";
  const [text, setText] = useState(q);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (route.name !== "search" || document.activeElement !== input.current) setText(q);
  }, [q, route.name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (route.name === "search" && !route.q && window.innerWidth >= 760) input.current?.focus();
  }, [route.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const timer = useRef<number | undefined>(undefined);
  const onText = (v: string) => {
    setText(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = getState().route;
      go({ name: "search", q: v, tab: r.name === "search" ? r.tab : "all" }, r.name === "search");
    }, 300);
  };

  return (
    <div className={"topbar" + (scrolled ? " scrolled" : "") + (route.name === "search" ? " searching" : "")}>
      <div className="nav-arrows">
        <button className="icon-btn round" aria-label="Atrás" onClick={() => history.back()}>
          <Icon name="back" size={18} />
        </button>
        <button className="icon-btn round" aria-label="Adelante" onClick={() => history.forward()}>
          <Icon name="fwd" size={18} />
        </button>
      </div>
      <label className="search-box top">
        <Icon name="search" size={20} />
        <input
          ref={input}
          type="search"
          placeholder="¿Qué querés escuchar?"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onFocus={() => route.name !== "search" && go({ name: "search", q: text, tab: "all" })}
          aria-label="Buscar canciones, artistas o playlists"
        />
        {text && (
          <button
            className="icon-btn sm"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setText("");
              go({ name: "search", q: "", tab: "all" }, true);
              input.current?.focus();
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </label>
      <div className="top-right">
        {me ? (
          <button
            className="avatar-btn"
            aria-label="Tu cuenta"
            style={{ background: me.color }}
            onClick={(e) =>
              openMenu(e, [
                { label: "Perfil", icon: "user", onClick: () => (location.hash = href({ name: "user", username: me.username })) },
                { label: "Ajustes", icon: "edit", onClick: () => setSettings(true) },
                ...(getState().isAdmin
                  ? [{ label: `Panel de admin${getState().pendingCount ? ` (${getState().pendingCount})` : ""}`, icon: "lock", onClick: () => (location.hash = href({ name: "admin" })) }]
                  : []),
                "sep",
                { label: "Cerrar sesión", icon: "logout", onClick: () => void signOut() },
              ])
            }
          >
            {me.display_name.slice(0, 1).toUpperCase()}
            {pending > 0 && <span className="avatar-badge" aria-label={`${pending} cuentas esperando aprobación`}>{pending}</span>}
          </button>
        ) : session ? null : (
          <button className="btn sm" onClick={() => setState({ login: {} })}>
            Entrar
          </button>
        )}
      </div>
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
    </div>
  );
}

/* ---------- navegación del celular ---------- */

export function MobileNav() {
  const route = useStore((s) => s.route);
  const items = [
    { r: { name: "home" } as Route, label: "Inicio", icon: route.name === "home" ? "homeFill" : "home", on: route.name === "home" },
    { r: { name: "search", q: "", tab: "all" } as Route, label: "Buscar", icon: "search", on: route.name === "search" || route.name === "genre" },
    { r: { name: "library" } as Route, label: "Tu biblioteca", icon: "library", on: ["library", "liked", "list"].includes(route.name) },
  ];
  return (
    <nav className="mobile-nav" aria-label="Navegación">
      {items.map((i) => (
        <a key={i.label} href={href(i.r)} className={i.on ? "on" : ""} aria-current={i.on ? "page" : undefined} onClick={() => setState({ panel: null })}>
          <Icon name={i.icon} size={24} />
          <span>{i.label}</span>
        </a>
      ))}
      <button className={useStore((s) => s.panel === "friends") ? "on" : ""} onClick={() => setState({ panel: getState().panel === "friends" ? null : "friends" })}>
        <Icon name="friends" size={24} />
        <span>Amigos</span>
      </button>
    </nav>
  );
}

/* ---------- menú contextual ---------- */

export function ContextMenu() {
  const menu = useStore((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null);
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8));
    const y = menu.y + r.height > window.innerHeight - 8 ? Math.max(8, menu.y - r.height) : menu.y;
    setPos({ x, y });
    ref.current.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setState({ menu: null });
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const bs = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
        const i = bs.indexOf(document.activeElement as HTMLButtonElement);
        bs[(i + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length]?.focus();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    document.querySelector(".scroll")?.addEventListener("scroll", close, { once: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [menu]);
  if (!menu) return null;
  return (
    <>
      <div className="menu-scrim" onClick={() => setState({ menu: null })} />
      <div className="menu" role="menu" ref={ref} style={pos ? { left: pos.x, top: pos.y } : { left: menu.x, top: menu.y, visibility: "hidden" }}>
        {menu.items.map((it, i) =>
          it === "sep" ? (
            <hr key={i} />
          ) : (
            <button
              key={i}
              role="menuitem"
              className={it.danger ? "danger" : ""}
              disabled={it.disabled}
              onClick={() => {
                setState({ menu: null });
                it.onClick();
              }}
            >
              {it.icon && <Icon name={it.icon} size={18} />}
              {it.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [shown, setShown] = useState(toast);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const t = setTimeout(() => setShown(null), toast.tone === "error" ? 4500 : 2600);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div className="toast-wrap" aria-live="polite">
      {shown && (
        <div key={shown.id} className={"toast " + shown.tone}>
          {shown.text}
        </div>
      )}
    </div>
  );
}

/* ---------- atajos de teclado ---------- */

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || el.getAttribute("role") === "slider") return;
      if (e.metaKey || e.ctrlKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          go({ name: "search", q: "", tab: "all" });
          setTimeout(() => document.querySelector<HTMLInputElement>(".search-box.top input")?.focus(), 30);
        }
        return;
      }
      const s = getState();
      if (e.code === "Space" && !el.closest("button, a")) {
        e.preventDefault();
        P.toggle();
      } else if (e.key === "ArrowRight" && e.shiftKey) P.next();
      else if (e.key === "ArrowLeft" && e.shiftKey) P.prev();
      else if (e.key === "ArrowRight") P.seek(s.time + 5);
      else if (e.key === "ArrowLeft") P.seek(s.time - 5);
      else if (e.key === "m" || e.key === "M") P.toggleMute();
      else if ((e.key === "l" || e.key === "L") && s.queue.current) void toggleLike(s.queue.current);
      else if (e.key === "s" || e.key === "S") P.toggleShuffle();
      else if (e.key === "r" || e.key === "R") P.cycleRepeat();
      else if (e.key === "/") {
        e.preventDefault();
        go({ name: "search", q: "", tab: "all" });
        setTimeout(() => document.querySelector<HTMLInputElement>(".search-box.top input")?.focus(), 30);
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
