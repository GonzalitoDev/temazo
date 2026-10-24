"use client";

import { useEffect, useState } from "react";
import { ago } from "@/lib/format";
import { adminList, adminSet, fail, recheckAccess, signOut, toast, useStore, type AccessRow } from "@/lib/store";
import { Icon, Logo } from "./Icon";
import { A, Empty, ErrorBox, RowsSkeleton, useAsync } from "./ui";

/* ---------- lo que ve una cuenta que todavía no está aprobada ---------- */

export function PendingScreen() {
  const access = useStore((s) => s.access);
  const email = useStore((s) => s.session?.user.email);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    await recheckAccess();
    setBusy(false);
  };
  // revisa solo cada 30 s, así entra apenas lo aprueban
  useEffect(() => {
    if (access !== "pending") return;
    const t = setInterval(() => void recheckAccess(), 30_000);
    return () => clearInterval(t);
  }, [access]);
  const rejected = access === "rejected";
  return (
    <main className="pending">
      <div className="pending-card">
        <Logo size={48} />
        <h1>{rejected ? "Tu cuenta no fue aprobada" : "Tu cuenta está esperando aprobación"}</h1>
        <p>
          {rejected
            ? "El admin de Temazo no aprobó esta cuenta. Si creés que es un error, hablale directamente."
            : "Temazo es por invitación. Ya le llegó tu pedido al admin; apenas lo apruebe, entrás directo (esta pantalla se actualiza sola)."}
        </p>
        <p className="pending-email">
          <Icon name="user" size={16} /> {email}
        </p>
        <div className="pending-actions">
          {!rejected && (
            <button className="btn" onClick={check} disabled={busy}>
              {busy ? "Revisando…" : "Revisar de nuevo"}
            </button>
          )}
          <button className="btn ghost" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}

/* ---------- panel de admin ---------- */

const TABS = [
  { v: "pending", label: "Pendientes" },
  { v: "approved", label: "Aprobadas" },
  { v: "rejected", label: "Rechazadas" },
] as const;

export function AdminPage() {
  const isAdmin = useStore((s) => s.isAdmin);
  const ready = useStore((s) => s.ready);
  const [tab, setTab] = useState<AccessRow["status"]>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const r = useAsync(() => (isAdmin ? adminList() : Promise.resolve([] as AccessRow[])), [isAdmin]);

  if (!ready) return <div className="page"><RowsSkeleton n={4} /></div>;
  if (!isAdmin)
    return (
      <div className="page">
        <Empty icon="lock" title="Esta pantalla es solo para el admin" action={<A to={{ name: "home" }} className="btn">Volver al inicio</A>} />
      </div>
    );

  const rows = r.data ?? [];
  const shown = rows.filter((x) => x.status === tab);
  const count = (s: AccessRow["status"]) => rows.filter((x) => x.status === s).length;

  const decide = async (row: AccessRow, status: AccessRow["status"]) => {
    setBusy(row.user_id);
    try {
      await adminSet(row.user_id, status);
      toast(status === "approved" ? `Aprobaste a ${row.email}` : status === "rejected" ? `Rechazaste a ${row.email}` : `${row.email} volvió a pendientes`);
      r.reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page admin">
      <header className="lib-head">
        <h1 className="page-title">Panel de admin</h1>
        <button className="btn outline sm" onClick={r.reload} disabled={r.loading}>
          Actualizar
        </button>
      </header>
      <p className="muted">Las cuentas nuevas no pueden usar Temazo hasta que las apruebes. Aprobar o rechazar se aplica al instante.</p>
      <div className="chips" role="tablist" style={{ margin: "16px 0" }}>
        {TABS.map((t) => (
          <button key={t.v} role="tab" aria-selected={tab === t.v} className={"chip" + (tab === t.v ? " on" : "")} onClick={() => setTab(t.v)}>
            {t.label}
            {r.data && <span className="chip-count">{count(t.v)}</span>}
          </button>
        ))}
      </div>
      {r.error ? (
        <ErrorBox onRetry={r.reload} text="No se pudo cargar la lista." />
      ) : !r.data ? (
        <RowsSkeleton n={4} />
      ) : !shown.length ? (
        <Empty icon={tab === "pending" ? "check" : "user"} title={tab === "pending" ? "No hay nadie esperando" : "No hay cuentas acá"} text={tab === "pending" ? "Cuando alguien cree una cuenta, aparece en esta lista." : undefined} />
      ) : (
        <div className="admin-list">
          {shown.map((row) => (
            <div key={row.user_id} className="admin-row">
              <span className="avatar" style={{ background: "var(--raise)", color: "var(--ink)" }}>
                {(row.display_name ?? row.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="row-text">
                <span className="row-title">{row.email || "(sin email)"}</span>
                <span className="row-sub">
                  {row.username ? `@${row.username} · ` : ""}
                  {tab === "pending" ? `pidió acceso ${ago(row.requested_at)}` : row.decided_at ? `${tab === "approved" ? "aprobada" : "rechazada"} ${ago(row.decided_at)}` : ""}
                </span>
              </span>
              <span className="admin-actions">
                {tab !== "approved" && (
                  <button className="btn sm" disabled={busy === row.user_id} onClick={() => decide(row, "approved")}>
                    Aprobar
                  </button>
                )}
                {tab !== "rejected" && (
                  <button className="btn ghost sm" disabled={busy === row.user_id} onClick={() => decide(row, "rejected")}>
                    {tab === "approved" ? "Quitar acceso" : "Rechazar"}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
