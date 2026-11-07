# BLUR — web app del festival

App independiente en `blur/` dentro del repo de Manso Gestión (rama `blur-app`, **sin mergear a
`master`**). Tiene su propio `package.json` y build, pero hoy **se publica dentro del proyecto de
Vercel de Gestión** bajo `/blur/`. Pensada para salir después a `blur.mansoclub.com.ar`.

- **Vista previa pública (rama `blur-app`):** https://manso-gestion-git-blur-app-ethoslogs-projects.vercel.app/blur/
- **Local:** `cd blur && pnpm install && pnpm dev` → http://localhost:5174/blur/

## Cómo se publica
- `vite.config.ts`: `base: '/blur/'`; `main.tsx`: `basename` desde `BASE_URL`.
- Build raíz (`vercel.json`): `pnpm run build && pnpm run build:blur` (copia `blur/dist` a `dist/blur`).
- `vercel.json` reescribe `/blur/*` a `/blur/index.html`, antes del catch-all de Gestión.
- Si se agrega una dependencia en `blur/`, regenerar `blur/pnpm-lock.yaml` (el build usa `--frozen-lockfile`).

## Variables (Vercel, proyecto manso-gestion)
`VITE_MANSOCLUB_URL`, `VITE_MANSOCLUB_ANON_KEY`, `VITE_ANALOGICA_SUBIR=1`.
Cargadas en Production y en Preview **solo de la rama `blur-app`**. La URL y la clave de Gestión se
reusan de `VITE_SUPABASE_*`. Local: `blur/.env.local` (ver `.env.example`). Cambiarlas exige redeploy.

## Qué es real y qué es maqueta
| Pantalla | Estado | Falta |
|---|---|---|
| Home | **Real** (manso-club): banner, fecha, lugar, visión, line up | DJ "ahora" cuando haya horarios |
| Line up | **Real**: artistas por escenario | Horarios (hoy nadie tiene día/hora), charlas Sinapsis |
| Escenarios | **Real**: escenarios y spots | Faltan El Beso y Bello Horizonte; descripciones |
| Barra | Maqueta (MOCK): saldo, carta, carrito, QR de retiro | Saldo/pedidos en backend, lector en barra |
| Mapa | Maqueta (MOCK): isla low-poly de ejemplo, recorrible (arrastre, pellizco), puntos tocables, "Ir acá" con ruta, filtros | El dibujo real de la isla: cambiar solo la geometría en `src/lib/mapa.ts` |
| Lanchas | **Real**: horarios de salida y regreso que carga Ana en el panel de manso-club (Festival → Transporte, tabla `festival_lanchas`) | Reservas y avisos (se sacaron) |
| Analógica | **Real**: rollo de 10, 7 películas, sube a Gestión | — |

Navegación: barra inferior fija de **5 pestañas** (Home, Line up, Barra, Mapa, Analógica).
Escenarios vive dentro de Line up (`/lineup/escenarios`) y Lanchas dentro de Mapa
(`/mapa/lanchas`), con un selector arriba de cada una. Las URL viejas (`/escenarios`,
`/lanchas`, `/transporte`) redirigen. La Home muestra la próxima lancha solo la noche del festival. Los textos cargados por la
organización se muestran literales (sin mayúsculas forzadas).

## Analógica — fotos
- Migración `supabase/migrations/043_blur_analogica_fotos.sql` (**aplicada en producción de Gestión**).
- Flujo: fila en `blur_fotos` primero (el servidor corta a las 10 por dispositivo) y después el
  archivo al bucket privado `blur-analogica`. Anon solo inserta: no lee ni lista.
- Revisión: `/admin/fotos` en Gestión (roles control/owner): publicar, descargar, borrar.
- El tope es por id de dispositivo guardado en el navegador: borrar datos del navegador da otro rollo.
- Una subida que registra la fila pero falla el archivo igual cuenta contra las 10.
- Revisión en 3 estados (migración `045_blur_fotos_descartada.sql`, **aplicada en producción de Gestión
  el 07/11/2026**): sin revisar / para publicar (`publicada`) / revisada y no se publica (`descartada`).
- **Rollos y links personales** (migración `046_blur_rollos.sql`, **aplicada el 07/11/2026**): cada teléfono
  es una cámara con un token propio (tabla `blur_rollos`, solo staff: `anon` no la lee). Link para mandarle a
  la persona: `/blur/rollo/<token>`; ahí ve sus fotos (todas menos las descartadas) y las guarda juntas (hoja
  de compartir del teléfono, o `.zip`). Panel: pestaña **Rollos** de `/admin/fotos` (copiar link, mail
  armado con `mailto:`, marcar enviado). Es `mailto`, no se envía solo: el envío automático con Resend
  (patrón de `api/reenviar-entradas.ts`) no está hecho.
- Al entregar el rollo la app pide el mail (opcional) con `blur_rollo_dejar_contacto()`: guarda el mail y
  no devuelve el token. El mail no se guarda en el teléfono, solo la marca de que ya lo dejó.
- **Revelado público** (`/analogica/revelado`): cerrado hasta que lo abre la organización, **desde
  `/admin/fotos` → pestaña Revelado** (migración `047_blur_config.sql`, **aplicada el 07/11/2026**): programar
  fecha y hora, "Abrir ahora" o "Cerrar", sin Vercel ni redeploy. La fecha vive en `blur_config.revelado_desde`
  (solo staff); sin fecha, con fecha inválida o si el servidor no puede leerla, queda cerrado. Abierto muestra
  solo las `publicada`. Después de esa fecha, cada persona también
  ve su rollo desde su teléfono (`/rollo`). Con el revelado cerrado, el link `/rollo/<token>` que manda la
  org sí funciona: cuándo mandarlo lo decide la org.
- Cómo se sirven las fotos: funciones de servidor con la clave de servicio, no URLs del bucket.
  `api/blur-reveladas.ts` y `api/blur-rollo.ts` devuelven la lista; `api/blur-foto.ts?i=<id>` entrega cada
  imagen y valida cada pedido (publicada / token / dispositivo; las descartadas no salen por ninguna
  puerta). **No se usan URLs firmadas del bucket porque el path (`<dispositivo>/<id>.jpg`) las delata**: una
  foto publicada habría bastado para sacar el id del dispositivo y pedir el rollo entero.
- Solo `vercel dev` o un deploy ejecutan `api/`: con `pnpm dev` de Vite esas rutas no existen y el
  revelado se ve cerrado (a propósito).

## Pendientes
1. Borrar desde `/admin/fotos` (filtro "No se publican", botón Borrar) las 2 fotos de prueba del 07/11/2026
   17:20 y 17:25 (película noche): ya están descartadas, pero Supabase no deja borrar archivos por SQL.
   La foto de prueba de 9 bytes de octubre ya no figura en la base.
2. Cargar en manso-club los horarios, los escenarios que faltan y las charlas.
3. Reemplazar los MOCK (Barra, Mapa) por datos reales.
4. Cuando se quiera abrir el revelado: terminar la revisión de fotos y usar la pestaña Revelado. Decidir si
   los mails se mandan solos (Resend) en vez de `mailto:`. Publicar fotos de asistentes pide términos claros al sacar la foto.
5. Decidir cuándo mergear a `master` (publica `/blur/` en el dominio real de Gestión) y si se
   separa a un proyecto de Vercel propio con `blur.mansoclub.com.ar` (sumaría una regla para que
   la raíz del subdominio caiga en `/blur/`).
6. Se apagó la protección de deploys de todo el proyecto (los previews `*.vercel.app` son públicos;
   los dominios propios no cambian). Se reactiva en Settings → Deployment Protection.
