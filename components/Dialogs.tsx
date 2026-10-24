"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError, usernameFromEmail } from "@/lib/format";
import { addToPlaylist, createPlaylist, createProfile, getState, myPlaylists, setState, signOut, updateProfile, useStore } from "@/lib/store";
import { Art } from "./Art";
import { Icon, Logo } from "./Icon";

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLElement>("input, textarea, select, button.btn");
    first?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"dialog" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export const COLORS = ["#1fb27a", "#ff6b35", "#e8455a", "#7c5cff", "#2f8ef0", "#f2b705", "#d9488f", "#14a3a8"];

/* ---------- Entrar / crear cuenta ---------- */

export function LoginDialog() {
  const login = useStore((s) => s.login);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  if (!login) return null;
  const close = () => setState({ login: null });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setMode("in");
          setErr("Ya hay una cuenta con ese email (puede ser de Fogón u otra de tus apps). Entrá con esa contraseña.");
          return;
        }
        if (!data.session) setSent(true);
      }
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={mode === "in" ? "Entrar a Temazo" : "Crear cuenta"} onClose={close}>
      <div className="login-brand">
        <Logo size={40} />
        {login.reason && <p>{login.reason}</p>}
      </div>
      {sent ? (
        <div className="form">
          <p className="dialog-text">
            Te mandamos un link a <b>{email}</b>. Abrilo para confirmar tu cuenta y volvés directo acá.
          </p>
          <button className="btn ghost" onClick={() => setSent(false)}>
            Volver
          </button>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="seg full" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "in"} onClick={() => setMode("in")}>
              Entrar
            </button>
            <button type="button" role="tab" aria-selected={mode === "up"} onClick={() => setMode("up")}>
              Crear cuenta
            </button>
          </div>
          <label className="field">
            <span>Email</span>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              minLength={6}
              required
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </label>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn wide" disabled={busy}>
            {busy ? "Un momento…" : mode === "in" ? "Entrar" : "Crear cuenta"}
          </button>
          <p className="muted small">Si ya usás Fogón, es la misma cuenta.</p>
        </form>
      )}
    </Dialog>
  );
}

export function ProfileSetup() {
  const session = useStore((s) => s.session);
  const [username, setUsername] = useState(() => usernameFromEmail(session?.user.email ?? ""));
  const [name, setName] = useState(() => (session?.user.email ?? "").split("@")[0].split("+")[0].slice(0, 40) || "Oyente");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Dialog title="Elegí cómo te ven" onClose={() => void signOut()}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          try {
            await createProfile(username, name.trim(), color);
          } catch (e) {
            setErr(friendlyError(e).replace("Ese nombre", "Ese @usuario"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="dialog-text">Tus amigos te encuentran por tu @usuario para ver qué estás escuchando.</p>
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={name} maxLength={40} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>@usuario</span>
          <input
            className="input"
            value={username}
            pattern="[a-z0-9_.]{2,32}"
            title="De 2 a 32 letras minúsculas, números, punto o guion bajo"
            required
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
          />
        </label>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button type="button" key={c} className={"swatch" + (c === color ? " on" : "")} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn wide" disabled={busy}>
          {busy ? "Guardando…" : "Listo"}
        </button>
      </form>
    </Dialog>
  );
}

/* ---------- Agregar a playlist ---------- */

export function PlaylistPicker() {
  const t = useStore((s) => s.picker);
  const me = useStore((s) => s.me);
  const playlists = useStore((s) => s.playlists);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (t && !me) {
      setState({ picker: null, login: { reason: "Creá una cuenta para armar tus playlists." } });
    }
  }, [t, me]);
  if (!t || !me) return null;
  const close = () => {
    setQ("");
    setState({ picker: null });
  };
  const list = myPlaylists({ playlists } as never).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog title="Agregar a una playlist" onClose={close}>
      <div className="picker-track">
        <Art art={t.art} size="s" seed={t.id} className="row-art" />
        <span className="row-text">
          <span className="row-title">{t.title}</span>
          <span className="row-sub">{t.artist.name}</span>
        </span>
      </div>
      <label className="search-box inline">
        <Icon name="search" size={18} />
        <input placeholder="Buscar playlist" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar playlist" />
      </label>
      <div className="picker-list">
        <button
          className="picker-item new"
          onClick={async () => {
            close();
            await createPlaylist(q.trim() || undefined, t);
          }}
        >
          <span className="art">
            <Icon name="plus" size={22} />
          </span>
          Nueva playlist{q.trim() ? ` «${q.trim()}»` : ""}
        </button>
        {list.map((p) => (
          <button
            key={p.id}
            className="picker-item"
            onClick={() => {
              close();
              void addToPlaylist(p.id, t);
            }}
          >
            <span className="art">
              <Icon name="music" size={20} />
            </span>
            <span>
              {p.name}
              {!p.is_public && <Icon name="lock" size={13} className="inline-ico" />}
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/* ---------- Ajustes de perfil ---------- */

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const me = useStore((s) => s.me)!;
  const [name, setName] = useState(me.display_name);
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem("temazo:theme") ?? "system";
    } catch {
      return "system";
    }
  });
  return (
    <Dialog title="Ajustes" onClose={onClose}>
      <div className="form">
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== me.display_name && updateProfile({ display_name: name.trim() })} />
        </label>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button type="button" key={c} className={"swatch" + (c === me.color ? " on" : "")} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={c === me.color} onClick={() => updateProfile({ color: c })} />
            ))}
          </div>
        </div>
        <label className="switch-row">
          <input type="checkbox" checked={me.share_activity} onChange={(e) => updateProfile({ share_activity: e.target.checked })} />
          <span>
            <b>Compartir lo que escucho</b>
            <small>Tus seguidores ven en vivo qué tema está sonando.</small>
          </span>
        </label>
        <div className="field">
          <span>Tema</span>
          <div className="seg full">
            {[
              ["system", "Sistema"],
              ["dark", "Oscuro"],
              ["light", "Claro"],
            ].map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-selected={theme === v}
                onClick={() => {
                  setTheme(v);
                  applyTheme(v);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          Tu perfil: <a href={`#/u/${me.username}`} onClick={onClose}>@{me.username}</a> · Cuenta: {getState().session?.user.email}
        </p>
      </div>
    </Dialog>
  );
}

export function applyTheme(v: string) {
  try {
    localStorage.setItem("temazo:theme", v);
  } catch {}
  if (v === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", v);
}
