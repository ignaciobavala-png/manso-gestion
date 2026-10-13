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
| Mapa | Maqueta (MOCK): croquis SVG, filtros, leyenda, descarga | Plano real |
| Transporte | Maqueta (MOCK): cuenta regresiva, reserva, aviso | Horarios y cupos reales, push |
| Analógica | **Real**: rollo de 10, 7 películas, sube a Gestión | — |

Navegación: barra inferior fija (como el panel de Gestión). Los textos cargados por la
organización se muestran literales (sin mayúsculas forzadas).

## Analógica — fotos
- Migración `supabase/migrations/043_blur_analogica_fotos.sql` (**aplicada en producción de Gestión**).
- Flujo: fila en `blur_fotos` primero (el servidor corta a las 10 por dispositivo) y después el
  archivo al bucket privado `blur-analogica`. Anon solo inserta: no lee ni lista.
- Revisión: `/admin/fotos` en Gestión (roles control/owner): publicar, descargar, borrar.
- El tope es por id de dispositivo guardado en el navegador: borrar datos del navegador da otro rollo.
- Una subida que registra la fila pero falla el archivo igual cuenta contra las 10.
- La marca `publicada` se guarda pero **ninguna pantalla pública la usa todavía**.

## Pendientes
1. Borrar desde `/admin/fotos` la foto de prueba (9 bytes) que quedó en el bucket.
2. Cargar en manso-club los horarios, los escenarios que faltan y las charlas.
3. Reemplazar los MOCK (Barra, Mapa, Transporte) por datos reales.
4. Mostrar las fotos `publicada` en alguna pantalla pública (galería).
5. Decidir cuándo mergear a `master` (publica `/blur/` en el dominio real de Gestión) y si se
   separa a un proyecto de Vercel propio con `blur.mansoclub.com.ar` (sumaría una regla para que
   la raíz del subdominio caiga en `/blur/`).
6. Se apagó la protección de deploys de todo el proyecto (los previews `*.vercel.app` son públicos;
   los dominios propios no cambian). Se reactiva en Settings → Deployment Protection.
