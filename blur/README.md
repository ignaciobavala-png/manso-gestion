# BLUR — web app del festival

App independiente (futuro `blur.mansoclub.com.ar`) que vive en `blur/` dentro del
repo de Manso Gestión. Tiene su propio `package.json`, su propio build y su propio
`vercel.json`: en Vercel se despliega como un proyecto aparte con **Root Directory = `blur`**.

```
cd blur && pnpm install && pnpm dev   # http://localhost:5174
```

## Estado
Line up, escenarios y home leen manso-club (solo lectura). Barra, Mapa y Transporte
salen de `src/lib/mock.ts` y se marcan con el badge **MOCK**. Analógica sube a Gestión
(migración 043); las fotos se revisan en `/admin/fotos` de Gestión.
Variables: ver `.env.example`.

| Pantalla | Qué resuelve la maqueta | Qué falta para ser real |
|---|---|---|
| Home | Banner, fecha, visión y line up de manso-club (real) | DJ "ahora" cuando haya horarios |
| Line up | Artistas por escenario de manso-club (real) | Horarios, charlas (Sinapsis) |
| Escenarios | Escenarios y spots de manso-club (real) | El Beso, Bello Horizonte, descripciones |
| Barra | Saldo, carta, carrito, QR de retiro | Saldo y pedidos en backend, lector en barra (Gestión) |
| Mapa | Croquis SVG, filtros, leyenda, descarga | Plano real |
| Transporte | Cuenta regresiva, reserva, aviso | Horarios y cupos reales; push |
| Analógica | Cámara, rollo de 10, 7 películas; sube al bucket `blur-analogica` de Gestión (real) | — |

## Qué se reutiliza de Gestión (cuando se conecte)
- Entradas/identidad: RPC `web_*` (docs/WEB-API-ENTRADAS.md), desde servidor.
- QR y lector de puerta/barra: mismo patrón `manso-ticket|<token>`.
- Fotos de Analógica: bucket privado, escritura anónima sin lectura ni listado.
