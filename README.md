# Temazo

Clon de Spotify hecho con Next.js y Supabase, con el catálogo abierto de [Audius](https://audius.co): temas completos, gratis y legales (sobre todo música independiente).

## Qué tiene

- Reproductor persistente: cola (lo agregado a mano va primero), aleatorio, repetir todo/uno, precarga del siguiente
- Inicio con tendencias, under, playlists en tendencia, géneros, "lo nuevo de los que seguís" y escuchado recientemente
- Buscar canciones, artistas y playlists (con búsquedas recientes y grilla de géneros)
- Páginas de artista, tema, playlist de Audius y género (por semana/mes/año/siempre)
- Tus me gusta, tus playlists (crear, renombrar, descripción, pública/privada, reordenar arrastrando, borrar) y seguir artistas
- Amigos: seguís a alguien por @usuario y ves en vivo qué está escuchando (Supabase Realtime)
- Letras sincronizadas de LRCLIB cuando existen
- Pantalla de reproducción con el color de la tapa, controles del sistema (Media Session) y atajos de teclado
- Celular: navegación inferior y mini reproductor. Tema claro y oscuro.

Se puede escuchar sin cuenta; la cuenta (la misma de Fogón) sirve para guardar cosas.

## Correr

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # cola, letras, rutas y normalización de Audius
npm run build   # sitio estático en out/
```

La base es `supabase/migrations/0001_temazo.sql` (tablas `temazo_*` con RLS). La URL y la publishable key de Supabase vienen por defecto en `lib/supabase.ts`; se pueden pisar con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_KEY`.

## Atajos

Espacio play/pausa · ← → 5 s · Shift+← → tema anterior/siguiente · M silencio · L me gusta · S aleatorio · R repetir · / o Ctrl+K buscar
