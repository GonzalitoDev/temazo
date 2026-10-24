import { describe, expect, it } from "vitest";
import fs from "node:fs";
import * as Q from "./queue";
import { parseLrc, lineAt, guessQuery } from "./lyrics";
import { parse, href } from "./route";
import { toTrack, toPlaylist, slim, mirrorUrl, apiUrl } from "./audius";
import { clock, usernameFromEmail, ago } from "./format";
import type { Track } from "./audius";

const T = (id: string, streamable = true): Track => ({ id, title: id, duration: 100, artist: { id: "a", handle: "a", name: "A" }, streamable });
const list = ["a", "b", "c", "d"].map((x) => T(x));
const seq = () => {
  let i = 0;
  const xs = [0.1, 0.9, 0.5, 0.3, 0.7];
  return () => xs[i++ % xs.length];
};

describe("cola", () => {
  it("reproduce el contexto en orden y termina", () => {
    let q = Q.playContext(Q.emptyQueue, list, 1, { name: "x" });
    expect(q.current?.id).toBe("b");
    q = Q.next(q).q;
    expect(q.current?.id).toBe("c");
    q = Q.next(q).q;
    expect(q.current?.id).toBe("d");
    expect(Q.next(q).ended).toBe(true);
  });
  it("repetir todo vuelve al principio; repetir uno reinicia solo si terminó solo", () => {
    let q = Q.playContext({ ...Q.emptyQueue, repeat: "all" }, list, 3, null);
    q = Q.next(q).q;
    expect(q.current?.id).toBe("a");
    q = { ...q, repeat: "one" };
    expect(Q.next(q, true).restart).toBe(true);
    expect(Q.next(q, false).q.current?.id).toBe("b");
  });
  it("lo agregado a mano va primero y después sigue el contexto", () => {
    let q = Q.playContext(Q.emptyQueue, list, 0, null);
    q = Q.addToQueue(q, T("x"));
    q = Q.addToQueue(q, T("y"), true);
    expect(q.manual.map((t) => t.id)).toEqual(["y", "x"]);
    q = Q.next(q).q;
    expect(q.current?.id).toBe("y");
    q = Q.next(q).q;
    expect(q.current?.id).toBe("x");
    q = Q.next(q).q;
    expect(q.current?.id).toBe("b");
  });
  it("salta temas no disponibles", () => {
    const l = [T("a"), T("b", false), T("c")];
    let q = Q.playContext(Q.emptyQueue, l, 0, null);
    q = Q.next(q).q;
    expect(q.current?.id).toBe("c");
    expect(Q.playContext(Q.emptyQueue, l, 1, null).current?.id).toBe("c");
  });
  it("aleatorio deja el actual primero y no pierde temas; al apagarlo vuelve al orden", () => {
    let q = Q.playContext(Q.emptyQueue, list, 2, null);
    q = Q.setShuffle(q, true, seq());
    expect(q.order[0]).toBe(2);
    expect([...q.order].sort()).toEqual([0, 1, 2, 3]);
    expect(q.pos).toBe(0);
    q = Q.next(q).q;
    const cur = q.current!.id;
    q = Q.setShuffle(q, false);
    expect(q.context[q.order[q.pos]].id).toBe(cur);
    expect(q.order).toEqual([0, 1, 2, 3]);
  });
  it("anterior retrocede y en el primero pide reiniciar", () => {
    let q = Q.playContext(Q.emptyQueue, list, 1, null);
    q = Q.prev(q).q;
    expect(q.current?.id).toBe("a");
    expect(Q.prev(q).restart).toBe(true);
  });
  it("upcoming y saltos", () => {
    let q = Q.playContext(Q.emptyQueue, list, 0, null);
    expect(Q.upcoming(q).map((t) => t.id)).toEqual(["b", "c", "d"]);
    q = Q.jumpUpcoming(q, 1);
    expect(q.current?.id).toBe("c");
    q = Q.addToQueue(Q.addToQueue(q, T("x")), T("y"));
    q = Q.jumpManual(q, 1);
    expect(q.current?.id).toBe("y");
    expect(q.manual).toEqual([]);
    expect(Q.cycleRepeat("off")).toBe("all");
    expect(Q.cycleRepeat("one")).toBe("off");
  });
});

describe("letras", () => {
  it("parsea LRC con varias marcas por línea", () => {
    const l = parseLrc("[ar:x]\n[00:01.50]hola\n[00:10.00][01:00.25]estribillo\n[00:05]chau");
    expect(l.map((x) => x.t)).toEqual([1.5, 5, 10, 60.25]);
    expect(l[2].text).toBe("estribillo");
    expect(lineAt(l, 0)).toBe(-1);
    expect(lineAt(l, 7)).toBe(1);
    expect(lineAt(l, 999)).toBe(3);
  });
  it("adivina artista y tema del título de Audius", () => {
    expect(guessQuery({ ...T("1"), title: "Sammy Virji - Rising Raider (bauti flip) [Free DL]" })).toEqual({ artist: "Sammy Virji", title: "Rising Raider (bauti flip)" });
    expect(guessQuery({ ...T("1"), title: "OnlyU (with Broey.)", artist: { id: "1", handle: "g", name: "Just A Gent" } })).toEqual({ artist: "Just A Gent", title: "OnlyU" });
  });
});

describe("rutas", () => {
  it("ida y vuelta", () => {
    const rs = [
      { name: "home" },
      { name: "search", q: "lo fi & chill", tab: "artists" },
      { name: "genre", g: "Hip-Hop/Rap" },
      { name: "artist", id: "aWvp71" },
      { name: "list", id: "f00" },
      { name: "liked" },
      { name: "user", username: "gonzadev" },
    ] as const;
    for (const r of rs) expect(parse(href(r))).toEqual(r);
    expect(parse("#/buscar?t=raro").name).toBe("search");
    expect(parse("#/cualquiera")).toEqual({ name: "notfound" });
  });
});

describe("audius", () => {
  const raw = JSON.parse(fs.readFileSync(__dirname + "/../fixtures/trending.json", "utf8")).data;
  it("normaliza temas reales", () => {
    const t = toTrack(raw[0]);
    expect(t).toMatchObject({ id: "mzXmz1", title: "On The Floor", duration: 180, streamable: true, artist: { handle: "ciaragraves", verified: true } });
    expect(t.art?.m).toMatch(/480x480/);
    const s = slim(t);
    expect(JSON.stringify(s).length).toBeLessThan(1500);
    expect(toTrack({ ...raw[0], access: { stream: false } }).streamable).toBe(false);
  });
  it("normaliza playlists reales", () => {
    const pl = JSON.parse(fs.readFileSync(__dirname + "/../fixtures/playlists.json", "utf8")).data;
    const p = toPlaylist(pl[0]);
    expect(p.name).toBe("Silentium");
    expect(p.trackCount).toBeGreaterThan(0);
  });
  it("urls", () => {
    expect(mirrorUrl("https://a.com/content/x/150x150.jpg", "https://b.org")).toBe("https://b.org/content/x/150x150.jpg");
    expect(apiUrl("/tracks/search", { query: "a b", genre: "" })).toBe("https://api.audius.co/v1/tracks/search?query=a+b&app_name=temazo");
  });
});

describe("formato", () => {
  it("varios", () => {
    expect(clock(65)).toBe("1:05");
    expect(clock(3725)).toBe("1:02:05");
    expect(usernameFromEmail("willi.rex+fogon@gmail.com")).toBe("willi.rex");
    expect(ago(new Date(Date.now() - 5 * 60_000).toISOString())).toBe("hace 5 min");
  });
});
