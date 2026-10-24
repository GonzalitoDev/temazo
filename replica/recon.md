# Recon map: Spotify (web)

Alcance: "con todo" menos el catálogo. Reproductor persistente con cola, aleatorio y repetir; inicio, buscar, biblioteca, artista, playlists (de Audius y propias), me gusta, recientes, seguir artistas, amigos y lo que están escuchando, letras cuando existan, pantalla de reproducción, celular.
Música: catálogo abierto de **Audius** (temas completos, legales, gratis). El catálogo de Spotify no se puede clonar.
Para: uso propio / aprender. Nombre del clon: **Temazo**.
Fecha: 2026-10-23

## Fuentes

| # | fuente | URL | notas |
| --- | --- | --- | --- |
| 1 | Audius API Plans | https://api.audius.co/plans | gratis: 10 pedidos/s y 500.000/mes; base `https://api.audius.co/v1` |
| 2 | SDK oficial de Audius (npm `@audius/sdk` 15.3.1) | https://www.npmjs.com/package/@audius/sdk | rutas y parámetros reales; lecturas con `app_name` o `api_key` en la query; el bearer token es solo para servidores |
| 3 | Guía de imágenes y espejos | https://github.com/audiusproject/apps/blob/c273cdd918b8e7b554e7db40de459a9e484b3e8d/packages/docs/docs/pages/developers/guides/image-mirrors.mdx | `artwork` con 150x150 / 480x480 / 1000x1000 + `mirrors`: si falla una imagen, probar otro host |
| 4 | Respuesta real de `/v1/tracks/trending` | https://api.audius.co/v1/tracks/trending?limit=1&time=week&app_name=temazo | JSON en snake_case; `stream.url` firmado + `mirrors`; `is_streamable`, `access.stream` |
| 5 | LRCLIB | https://lrclib.net | letras sincronizadas gratis (para temas que estén ahí) |
| 6 | Spotify como usuario | — | navegación: barra lateral (Inicio, Buscar, Tu biblioteca), barra de reproducción abajo, panel derecho (cola / amigos) |

### Endpoints de Audius que usa el clon

```
GET /v1/tracks/trending?time=week|month|year|allTime&genre=&limit=&offset=
GET /v1/tracks/trending/underground
GET /v1/tracks/search?query=&genre=&limit=
GET /v1/tracks/{id}
GET /v1/tracks/{id}/stream            -> redirige al audio (se usa como src del <audio>)
GET /v1/users/search?query=
GET /v1/users/{id}
GET /v1/users/{id}/tracks?sort=plays|date
GET /v1/users/{id}/related             (artistas parecidos)
GET /v1/playlists/search?query=
GET /v1/playlists/trending
GET /v1/playlists/{id}
GET /v1/playlists/{id}/tracks
siempre con &app_name=temazo
```

## Core loop

Buscar o descubrir un tema, darle play, y que siga sonando mientras navegás (cola, me gusta, armar playlists).

## Pantallas

| ID | pantalla | ruta | propósito | componentes | estados |
| --- | --- | --- | --- | --- | --- |
| S01 | Login / registro | `/login` | cuenta para guardar biblioteca | email, contraseña, @usuario | error |
| S02 | Inicio | `/` | descubrir | saludo según la hora, accesos rápidos (recientes), filas: Tendencias de la semana, Under, por género, Playlists en tendencia, Tus playlists | cargando (esqueletos), sin conexión |
| S03 | Buscar | `/buscar?q=` | encontrar | input, sin texto: grilla de géneros; con texto: Mejor resultado, Canciones, Artistas, Playlists | sin resultados |
| S04 | Género | `/genero/:g` | tendencias del género | encabezado de color, lista | — |
| S05 | Artista | `/artista/:id` | conocer y escuchar | portada, verificado, seguidores, Seguir, Populares (top 5/10), Playlists, Artistas parecidos | cargando, no existe |
| S06 | Playlist de Audius | `/playlist/:id` | escuchar una lista | portada, creador, duración total, tabla de temas | vacía |
| S07 | Tu playlist | `/mi/:id` | armar y editar | igual que S06 + renombrar, descripción, quitar, reordenar arrastrando, borrar, compartir | vacía ("Buscá algo para agregar") |
| S08 | Tus me gusta | `/me-gusta` | canciones guardadas | lista ordenada por fecha | vacía |
| S09 | Tu biblioteca | `/biblioteca` | todo lo tuyo | filtros: Playlists, Artistas; orden: recientes / alfabético | vacía |
| S10 | Barra de reproducción | siempre abajo | controlar | tapa, título, artista, me gusta, anterior, play/pausa, siguiente, aleatorio, repetir, barra de progreso, volumen, cola, letras, pantalla completa | sin tema, cargando, error de audio |
| S11 | Cola | panel derecho | qué viene | Sonando ahora, A continuación (agregados a mano), Siguiente de: (contexto) | vacía |
| S12 | Pantalla de reproducción | celular: deslizar arriba; escritorio: botón | ver en grande | tapa grande, fondo con el color de la tapa, controles, letras | — |
| S13 | Letras | panel / pantalla | cantar | líneas sincronizadas, la actual resaltada, clic para saltar | sin letras |
| S14 | Amigos | panel derecho | qué escuchan | lista de seguidos con tema actual o último y hace cuánto, seguir por @usuario | sin amigos |
| S15 | Perfil | `/u/:username` | ver a otro usuario de Temazo | playlists públicas, seguir | — |

## Flujos

```
F01 Escuchar algo de Inicio
    S02 tarjeta -> play (hover) -> suena; la cola = el resto de esa fila
    edge: tema no reproducible (is_streamable=false), error de red, autoplay bloqueado

F02 Buscar y reproducir
    S03 escribir -> resultados en vivo (debounce 300 ms) -> doble clic / play -> suena
    edge: búsqueda vacía, sin resultados, caracteres raros

F03 Me gusta
    corazón en S10 o en una fila -> aparece en S08 al instante

F04 Armar playlist
    S09 "+" -> S07 nueva -> buscar -> "Agregar a playlist" (menú) -> reordenar arrastrando
    edge: agregar un tema que ya está (avisar), playlist sin nombre

F05 Cola
    menú de un tema: "Agregar a la cola" -> S11 "A continuación"
    siguiente: primero lo agregado a mano, después el contexto
    aleatorio: mezcla el resto del contexto sin perder el actual; repetir: off -> todo -> uno

F06 Seguir artista
    S05 Seguir -> aparece en S09 -> sus temas en Inicio ("De artistas que seguís")

F07 Amigos
    S14 seguir @usuario -> ves su "escuchando ahora" en vivo (Realtime)
    edge: el otro tiene la actividad privada

F08 Letras
    S10 botón micrófono -> S13; si LRCLIB no tiene el tema: "No hay letra para este tema"

F09 Control del sistema
    teclas multimedia / pantalla bloqueada del celu (Media Session API), barra espaciadora
```

## Componentes

| componente | variantes | estados | usado en |
| --- | --- | --- | --- |
| Tarjeta | tema, artista (redonda), playlist | hover con botón play, sonando (ecualizador) | S02, S03, S05 |
| Fila de tema | con número, con tapa, con álbum/fecha | hover (play en el número), sonando (verde/acento), no disponible (atenuado) | S05–S08 |
| Barra de progreso | tema, volumen | arrastrando, hover (muestra la bolita) | S10, S12 |
| Botón play redondo | grande, chico | play / pausa | todas |
| Menú contextual | tema, playlist | — | filas, tarjetas |
| Encabezado con degradé | playlist, artista, género | — | S04–S08 |
| Esqueleto de carga | fila, tarjeta | — | todas |

## Modelo de datos

Los temas, artistas y playlists públicas viven en Audius. En Supabase guardamos solo lo del usuario, con una copia chica del tema para mostrarlo sin pedirlo de nuevo.

```
Profile         id (auth), username, display_name, color, share_activity (bool)
Like            user_id, track_id, track (json chico), created_at
Playlist        id, owner_id, name, description, is_public, created_at, updated_at
PlaylistTrack   id, playlist_id, track_id, track (json), position (orden), added_at
FollowArtist    user_id, artist_id, artist (json), created_at
History         user_id, track_id, track (json), played_at   (últimos 200)
Friend          follower_id, followee_id
NowPlaying      user_id, track (json), is_playing, updated_at  (Realtime)
```

## Matriz de features

Ver `features.csv`.

## Fuera de alcance

- El catálogo de Spotify (licencias). Todo sale de Audius: música independiente, mucha electrónica, hip hop y beats; no vas a encontrar a los artistas de los sellos grandes.
- Podcasts y audiolibros, Spotify Connect (controlar otro dispositivo), Jam (sesión compartida), descargas offline cifradas, Wrapped.
- Recomendaciones con el algoritmo de Spotify: se reemplazan con tendencias por género, artistas parecidos de Audius y "de los que seguís".
- La marca, el verde y el logo de Spotify.

## Tamaño

Pantallas 15, flujos 9, entidades 8.

Partes difíciles:
1. **El reproductor:** un solo `<audio>` que sobrevive a la navegación, con la cola (manual + contexto), aleatorio y repetir bien hechos, precarga del siguiente y manejo de errores de la red de Audius (espejos).
2. **Rendimiento con una API externa:** caché, debounce en la búsqueda, esqueletos y respetar el límite de 10 pedidos/s.
3. **Tiempo real de amigos** sin inundar la base: actualizar "escuchando ahora" solo al cambiar de tema o pausar.

Tamaño: **L**. El slice (inicio con tendencias + buscar + reproductor con cola) es un fin de semana.
