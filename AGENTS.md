# AGENTS.md — Manso Gestión

> Generado automáticamente por brain-agents-inject desde brain-data.
> No editar manualmente — se sobreescribe al abrir Claude Code.

## Proyecto

| Campo | Valor |
|-------|-------|
| Nombre | Manso Gestión |
| Tipo | App interna |
| Cliente | Manso |
| Stack | React 19.2.4 + Supabase + Tailwind v4 + Zustand + Vite |
| Estado | activo |
| Último commit | 2026-07-15 |

## Perfil del desarrollador

# SKILL — perfil-desarrollador

## Descripción
Perfil técnico del desarrollador Ignacio Bavala. Define el stack tecnológico, convenciones y preferencias para cualquier proyecto nuevo.

## Cuándo usarla
- Al iniciar un proyecto nuevo
- Cuando necesites saber qué stack usar por defecto
- Para mantener consistencia tecnológica entre proyectos

## Cómo dirigirse a él

**Ignacio es hombre.** En español rioplatense los adjetivos van en masculino:
"vos solo", "quedaste tranquilo", "avisame cuando estés listo". Ojo con las
concordancias que se cuelan al escribir rápido ("sola", "lista", "preparada").

Tuteo con voseo, registro directo, sin formalismos.

## Stack por defecto para nuevos proyectos

```
Framework:    Next.js 16 (App Router)
UI:           React 19 + Tailwind CSS v4 + Framer Motion v12
Estado:       Zustand v5
DB:           Supabase (PostgreSQL + Auth + Storage + RLS)
Deploy:       Vercel (cuenta Pro — sin límite de frecuencia de crons)
Package:      pnpm
Linting:      ESLint 9 (flat config)
Lenguaje:     TypeScript strict
```

**Páginas livianas → Cloudflare** (Workers + Static Assets, D1/SQLite opcional, wrangler v4),
en vez de Next.js+Supabase+Vercel. Para arrancar cualquiera de los dos: scaffold
[[scaffold-nextjs-supabase]] (`kickstart`, targets `vercel` y `cloudflare`).

## Convenciones

- Server Components por defecto, Client Components solo cuando hay interactividad
- State global con Zustand v5 (no Context a menos que sea trivial)
- Animaciones con Framer Motion v12
- Estilos con Tailwind v4, configuración vía CSS `@theme` tokens
- Migraciones SQL como archivos `.sql` planos
- `vercel.json` con crons para keep-alive de Supabase
- Cada proyecto necesita su `AGENTS.md`
- **Next.js 16**: `middleware.ts` fue renombrado a `proxy.ts`; exportar `export function proxy(request)` en vez de `middleware`. Runtime Node.js por defecto. Codemod: `npx @next/codemod@canary middleware-to-proxy .`
- Sin testing, sin Docker
- Sin CSS-in-JS más allá de Tailwind
- `@/*` como path alias (apunta a `./*` o `./src/*`)
- **No subir binarios a git/GitHub** (fonts, imágenes pesadas, videos, PDFs): no se comprimen, no se pueden diffear, inflan el clone para siempre aunque se borren después, y hay límites duros de tamaño en GitHub. Para assets de proyecto usar Supabase Storage o Vercel Blob y referenciar por URL. Excepción: binarios chicos e imprescindibles para el build (ej. un logo o una fuente puntual) pueden ir directo al repo.

## ESLint

Usar flat config (`eslint.config.mjs`):
```js
import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })
const eslintConfig = [...compat.extends("next/core-web-vitals", "next/typescript")]
export default eslintConfig
```

## Skills relevantes para este proyecto

Leer el archivo completo solo si la tarea actual lo requiere — esta lista es solo un índice.

- **Tiquetera Vite + Supabase — bugs silenciosos y patrones seguros** (`/home/nch/Escritorio/brain-data/skills/tiquetera-vite-supabase/SKILL.md`)
  Al trabajar en cualquier sistema de tickets/entradas con: localStorage como caché de tickets en el cliente Supabase como fuente de verdad Escaneo de QR con confirmación de ingreso Registro de asistentes por email
- **Google OAuth con Supabase SSR en Next.js 16** (`/home/nch/Escritorio/brain-data/skills/supabase-oauth-nextjs/SKILL.md`)
  Guía completa para instalar Google OAuth en Next.js 16 (App Router) con `@supabase/ssr`. Incluye los bugs conocidos que rompen el login silenciosamente.  ## 1. Google Cloud Console 1. Crear proyecto en https://console.cl…
- **Supabase + Postgres — esquemas, RLS y queries eficientes** (`/home/nch/Escritorio/brain-data/skills/supabase-postgres-best-practices/SKILL.md`)
  Al diseñar tablas, escribir políticas RLS, optimizar queries, o integrar Supabase con Next.js 16.
- **Next.js 16 — App Router patterns y convenciones** (`/home/nch/Escritorio/brain-data/skills/nextjs-app-router-patterns/SKILL.md`)
  Al iniciar o trabajar en cualquier proyecto Next.js: estructura de rutas, data fetching, Server Actions, proxy (middleware), metadata, layouts.
- **TypeScript strict — tipos útiles en el stack Next.js + Supabase** (`/home/nch/Escritorio/brain-data/skills/typescript-advanced-types/SKILL.md`)
  Al definir tipos para API responses, props de componentes, Server Actions, datos de Supabase, o cuando TS emite un error de tipos que no se entiende.
- **Supabase Storage — egress, límites y buenas prácticas** (`/home/nch/Escritorio/brain-data/skills/supabase-storage-egress/SKILL.md`)
  Al subir archivos a Supabase Storage, especialmente videos o imágenes pesadas que se sirven públicamente. También al diseñar el hero de un sitio o cualquier sección con media grande.
- **Tailwind CSS v4 — configuración y patrones mobile-first** (`/home/nch/Escritorio/brain-data/skills/tailwindcss-mobile-first/SKILL.md`)
  Al configurar Tailwind v4 en un proyecto nuevo, definir tokens de diseño, o implementar layouts responsivos.
- **Testing E2E con Playwright — ecommerce Next.js + Supabase** (`/home/nch/Escritorio/brain-data/skills/playwright-ecommerce/SKILL.md`)
  Cuando haya un proyecto Next.js + Supabase con autenticación por roles y flujos de compra que necesiten cobertura de regresión antes del lanzamiento.
- **Jeeliz FaceFilter + Three.js — Web AR try-on** (`/home/nch/Escritorio/brain-data/skills/jeeliz-web-ar-tryon/SKILL.md`)
  ## Cuando usarla Al integrar el face tracker Jeeliz FaceFilter con Three.js en una app React (Vite) para probadores virtuales de anteojos. La API de Jeeliz es singleton global y opera sobre WebGL crudo; Three.js debe com…
- **Comprimir imágenes client-side antes de subir al storage** (`/home/nch/Escritorio/brain-data/skills/client-side-image-compress/SKILL.md`)
  Siempre que se implemente un uploader de imágenes (flyers, avatares, fondos, productos, etc.). Sin compresión, los usuarios pueden subir archivos de 10–25 MB que se sirven a cada visitante, generando egress masivo en Sup…
- **Vercel + React — performance y patrones críticos** (`/home/nch/Escritorio/brain-data/skills/vercel-react-best-practices/SKILL.md`)
  Al optimizar una página lenta, reducir el bundle, revisar re-renders, o hacer deploy en Vercel.
- **Scaffold Next.js 16 + Supabase (kickstart)** (`/home/nch/Escritorio/brain-data/skills/scaffold-nextjs-supabase/SKILL.md`)
  Al arrancar cualquier proyecto nuevo. En vez de re-hacer el setup a mano y re-debuggear los mismos bugs silenciosos en cada cliente, generar el proyecto ya con todo baked-in. Dos targets según el peso del proyecto: **`ve…
- **Inputs decimales en es-AR — coma como separador y estado string** (`/home/nch/Escritorio/brain-data/skills/inputs-decimales-coma-es-ar/SKILL.md`)
  Siempre que un formulario React/Next.js tenga campos numéricos con decimales (dimensiones, peso, precios, porcentajes) para usuarios argentinos. Síntoma típico reportado por el usuario: **"el input no toma decimales"** —…
- **Onboarding multi-paso con guest+fotos — rollback en fallo y RLS de storage por dueño** (`/home/nch/Escritorio/brain-data/skills/onboarding-guest-rollback-storage-rls/SKILL.md`)
  Cuando un flujo público (sin login) crea una fila "dueña" (guest, invitado, registro) y después, en el mismo submit, sube archivos y/o inserta filas relacionadas (acompañante, adjuntos) — típico de un onboarding con invi…
- **Postgres — MIN()/MAX() no existen para uuid y rompen la función en TODA llamada** (`/home/nch/Escritorio/brain-data/skills/postgres-min-max-no-existe-para-uuid/SKILL.md`)
  Al escribir cualquier función plpgsql o query que agregue una columna `uuid`, típicamente para "traer el id del grupo" en un `SELECT COUNT(*), MIN(algo_id)`.
- **Supabase — Max Rows silencioso trunca queries sin paginar** (`/home/nch/Escritorio/brain-data/skills/supabase-max-rows-limit/SKILL.md`)
  Al escribir o revisar cualquier `select()` de Supabase que traiga una tabla que puede crecer sin límite (emails, suscriptores, registros de eventos, logs, mensajes). También si un conteo o listado "deja de sumar" o parec…
- **Recurrencia de eventos anclada a día de semana real (no a created_at)** (`/home/nch/Escritorio/brain-data/skills/recurrencia-eventos-dia-semana/SKILL.md`)
  Al generar ocurrencias de un evento/taller recurrente (semanal, quincenal, mensual, etc.) a partir de una fila en la DB, especialmente cuando la fecha de alta (`created_at`) es distinta al día en que el evento realmente…
- **Contenido dual público/comunidad con columna visibilidad** (`/home/nch/Escritorio/brain-data/skills/contenido-dual-visibilidad/SKILL.md`)
  Cuando un sitio tiene usuarios con diferentes niveles de acceso (público, registrado, miembro) y querés extender las páginas existentes con contenido exclusivo **sin crear rutas nuevas**. El sitio es el mismo en esencia…
- **Bug silencioso — función en policy RLS necesita GRANT EXECUTE al rol que consulta** (`/home/nch/Escritorio/brain-data/skills/supabase-rls-funcion-policy-grant-execute/SKILL.md`)
  Cuando en Supabase/Postgres una tabla con RLS **devuelve 401 en TODA lectura** para un rol (típicamente `anon`), o cuando "el sitio público muestra vacío / la landing no carga datos" para visitantes no logueados, o cuand…
- **Conectar Supabase CLI con PAT** (`/home/nch/Escritorio/brain-data/skills/supabase-conexion-cli/SKILL.md`)
  El PAT de Supabase es **por cuenta**, no por proyecto. Un solo token sirve para todos los proyectos de la organización. ### Generar token 1. Ir a https://supabase.com/dashboard/account/tokens 2. Crear nuevo token 3. Copi…
- **Supabase MCP Multiproyecto** (`/home/nch/Escritorio/brain-data/skills/supabase-mcp-multiproyecto/SKILL.md`)
  Siempre. Esta skill es un guard automático: cada vez que se use cualquier herramienta MCP de Supabase, se debe verificar que el proyecto destino coincide con el proyecto activo del directorio de trabajo. No se debe deleg…
- **Soft delete sin filtrar `active` en todas las lecturas** (`/home/nch/Escritorio/brain-data/skills/soft-delete-filtro-incompleto/SKILL.md`)
  Cuando "borré algo desde el admin y volvió a aparecer" — en el listado del admin, en la home, en el listado público o en el checkout. También al introducir un soft delete nuevo.
- **Bug silencioso — login colgado en "Cargando..." con @supabase/ssr + embed ambiguo** (`/home/nch/Escritorio/brain-data/skills/supabase-ssr-login-deadlock/SKILL.md`)
  Dos bugs de admin Next.js + Supabase que aparecieron juntos en Pampa Estudio: 1. El botón de login queda en "Cargando…" para siempre (la sesión igual se crea). 2. Listados del admin muestran 0 filas / KPIs en 0 sin error…
- **Hono setSignedCookie async sin await rompe cookies silenciosamente** (`/home/nch/Escritorio/brain-data/skills/hono-set-signed-cookie-async/SKILL.md`)
  Cuando uses `setSignedCookie` de Hono para auth con cookies firmadas y el login parezca funcionar (redirige) pero luego las rutas protegidas fallen (loop infinito de login).
- **Bug silencioso de datetime-local con timestamps UTC** (`/home/nch/Escritorio/brain-data/skills/datetime-local-utc-bug/SKILL.md`)
  Siempre que un form tenga `<input type="datetime-local">` cuyo valor se carga desde un timestamp guardado en UTC (Supabase `timestamptz`, ISO strings) y se vuelve a guardar.
- **ON CONFLICT en Postgres debe matchear una constraint real, o falla siempre** (`/home/nch/Escritorio/brain-data/skills/postgres-on-conflict-debe-matchear-constraint-real/SKILL.md`)
  Al escribir o revisar funciones `plpgsql`/RPCs de Supabase que hacen `INSERT ... ON CONFLICT (cols) DO UPDATE`, especialmente si la tabla tiene varias columnas candidatas a "clave lógica" (ej. `vacaciones_id, mes` vs. la…
- **Flex item con overflow-hidden se aplasta a 0px en contenedores con scroll** (`/home/nch/Escritorio/brain-data/skills/flexbox-overflow-hidden-colapso/SKILL.md`)
  Cuando un elemento "desaparece" dentro de un panel que es `flex flex-col` con `max-h-*` + `overflow-y-auto` (sidebars sticky, drawers, resúmenes de checkout). El elemento sigue en el DOM (aparece en el accessibility tree…
- **Zustand persist — partialize obligatorio para no persistir estado de UI** (`/home/nch/Escritorio/brain-data/skills/zustand-persist-partialize/SKILL.md`)
  Siempre que un store de Zustand use el middleware `persist` y mezcle datos (items del carrito, preferencias) con estado efímero de UI (drawer abierto, loading, tab activa).
- **Escapar input de usuario en .or() de Supabase (PostgREST)** (`/home/nch/Escritorio/brain-data/skills/supabase-or-filter-escaping/SKILL.md`)
  Siempre que se interpole texto de búsqueda del usuario dentro de `.or()` de supabase-js (ej. `query.or(\`nombre.ilike.%${search}%\`)`).
- **Lenis smooth scroll — bugs silenciosos con drawers y overlays** (`/home/nch/Escritorio/brain-data/skills/lenis-smooth-scroll/SKILL.md`)
  Cuando un proyecto usa Lenis para smooth scroll y hay drawers, modales o cualquier contenedor con `overflow-y-auto` que no responde al trackpad.
