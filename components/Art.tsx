"use client";

import { useEffect, useState } from "react";
import { mirrorUrl, type Art as ArtT } from "@/lib/audius";
import { hueOf } from "@/lib/format";
import { Icon } from "./Icon";

type Size = "s" | "m" | "l";

function candidates(art: ArtT | undefined, size: Size): string[] {
  if (!art) return [];
  const order: Size[] = size === "s" ? ["s", "m", "l"] : size === "m" ? ["m", "l", "s"] : ["l", "m", "s"];
  const base = order.map((k) => art[k]).find(Boolean);
  if (!base) return [];
  return [base, ...(art.mirrors ?? []).map((m) => mirrorUrl(base, m))];
}

/** Imagen de Audius que prueba los espejos si un nodo falla, con respaldo de color. */
export function Art({ art, size = "m", seed, round, className, icon = "music", alt = "" }: { art?: ArtT; size?: Size; seed: string; round?: boolean; className?: string; icon?: string; alt?: string }) {
  const list = candidates(art, size);
  const key = list[0] ?? "";
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setI(0);
    setLoaded(false);
  }, [key]);
  const src = list[i];
  const h = hueOf(seed);
  return (
    <span
      className={"art" + (round ? " round" : "") + (className ? " " + className : "")}
      style={{ background: `linear-gradient(135deg, hsl(${h} 45% 32%), hsl(${(h + 40) % 360} 50% 18%))` }}
    >
      {!loaded && <Icon name={icon} size={size === "s" ? 18 : 36} className="art-ph" />}
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setI((x) => x + 1)}
        />
      )}
    </span>
  );
}

/** Tapa de una playlist propia: mosaico con las tapas de los primeros temas. */
export function Mosaic({ arts, seed, className }: { arts: (ArtT | undefined)[]; seed: string; className?: string }) {
  const a = arts.filter(Boolean).slice(0, 4);
  if (a.length < 4) return <Art art={a[0]} seed={seed} className={className} icon="music" />;
  return (
    <span className={"art mosaic" + (className ? " " + className : "")}>
      {a.map((x, i) => (
        <Art key={i} art={x} size="s" seed={seed + i} />
      ))}
    </span>
  );
}

export function LikedArt({ className }: { className?: string }) {
  return (
    <span className={"art liked-art" + (className ? " " + className : "")}>
      <Icon name="heartFill" size={30} />
    </span>
  );
}

/* ---------- color dominante de una tapa ---------- */

const colors = new Map<string, Promise<string | null>>();

function extract(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 12;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 12, 12);
        const d = ctx.getImageData(0, 0, 12, 12).data;
        let best = { score: -1, r: 0, g: 0, b: 0 };
        let R = 0,
          G = 0,
          B = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
          R += r;
          G += g;
          B += b;
          const max = Math.max(r, g, b),
            min = Math.min(r, g, b);
          const sat = max ? (max - min) / max : 0;
          const score = sat * (max / 255) * (max > 40 && max < 245 ? 1 : 0.2);
          if (score > best.score) best = { score, r, g, b };
        }
        const n = d.length / 4;
        const pick = best.score > 0.25 ? best : { r: R / n, g: G / n, b: B / n };
        resolve(toHsl(pick.r, pick.g, pick.b));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function toHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  // colores de fondo: saturación moderada y luz baja para que el texto blanco se lea
  return `hsl(${Math.round(h)} ${Math.round(Math.min(s, 0.7) * 100)}% ${Math.round(Math.max(0.24, Math.min(l, 0.38)) * 100)}%)`;
}

/** Color para encabezados y la pantalla de reproducción. */
export function useArtColor(art: ArtT | undefined, seed: string) {
  const url = art?.s ?? art?.m;
  const fallback = `hsl(${hueOf(seed)} 40% 30%)`;
  const [c, setC] = useState<string>(fallback);
  useEffect(() => {
    let alive = true;
    setC(fallback);
    if (!url) return;
    if (!colors.has(url)) colors.set(url, extract(url));
    colors.get(url)!.then((x) => alive && x && setC(x));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, seed]);
  return c;
}
