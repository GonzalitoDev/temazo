// Rutas con hash (#/artista/abc) para que funcione como sitio estático sin configurar el hosting.
export type Route =
  | { name: "home" }
  | { name: "search"; q: string; tab: "all" | "tracks" | "artists" | "playlists" }
  | { name: "genre"; g: string }
  | { name: "artist"; id: string }
  | { name: "track"; id: string }
  | { name: "playlist"; id: string } // de Audius
  | { name: "list"; id: string } // de Temazo (tuya o de otro usuario)
  | { name: "liked" }
  | { name: "library" }
  | { name: "user"; username: string }
  | { name: "admin" }
  | { name: "notfound" };

const TABS = ["all", "tracks", "artists", "playlists"] as const;

export function parse(hash: string): Route {
  const h = hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = h.split("?");
  const params = new URLSearchParams(qs);
  const parts = path.split("/").filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const [a, b] = parts;
  if (!a) return { name: "home" };
  if (a === "buscar") {
    const t = params.get("t") ?? "";
    const tab = (TABS as readonly string[]).includes(t) ? (t as (typeof TABS)[number]) : "all";
    return { name: "search", q: params.get("q") ?? "", tab };
  }
  if (a === "genero" && b) return { name: "genre", g: b };
  if (a === "artista" && b) return { name: "artist", id: b };
  if (a === "tema" && b) return { name: "track", id: b };
  if (a === "playlist" && b) return { name: "playlist", id: b };
  if (a === "lista" && b) return { name: "list", id: b };
  if (a === "me-gusta") return { name: "liked" };
  if (a === "biblioteca") return { name: "library" };
  if (a === "admin") return { name: "admin" };
  if (a === "u" && b) return { name: "user", username: b.toLowerCase() };
  return { name: "notfound" };
}

const enc = encodeURIComponent;

export function href(r: Route): string {
  switch (r.name) {
    case "home":
      return "#/";
    case "search": {
      const p = new URLSearchParams();
      if (r.q) p.set("q", r.q);
      if (r.tab !== "all") p.set("t", r.tab);
      const s = p.toString();
      return "#/buscar" + (s ? "?" + s : "");
    }
    case "genre":
      return `#/genero/${enc(r.g)}`;
    case "artist":
      return `#/artista/${enc(r.id)}`;
    case "track":
      return `#/tema/${enc(r.id)}`;
    case "playlist":
      return `#/playlist/${enc(r.id)}`;
    case "list":
      return `#/lista/${enc(r.id)}`;
    case "liked":
      return "#/me-gusta";
    case "library":
      return "#/biblioteca";
    case "user":
      return `#/u/${enc(r.username)}`;
    case "admin":
      return "#/admin";
    default:
      return "#/";
  }
}

export function go(r: Route, replace = false) {
  const h = href(r);
  if (replace) history.replaceState(null, "", h);
  else if (location.hash !== h) location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export const shareUrl = (r: Route) => location.origin + location.pathname + href(r);
