# Mapa Delta Rica — extracción del HTML de Ana

Fuente: `~/Descargas/Mapa Delta Rica (2).html` (868 KB, casi todo es Three.js minificado y 4 fuentes embebidas).
Lo propio del mapa son ~320 líneas de script y ~120 de CSS. Esto es **todo** lo que contiene.

## Qué es

Un predio **en 3D** (Three.js, cámara orbital) con modo Noche y modo Día, nombres HTML flotando sobre la
escena y un panel lateral con lista, filtros y ficha. No es un dibujo plano: es una escena con terreno, árboles,
estructuras modeladas y luces rojas de noche.

Se parte de un **plano de 1280 × 720** (x → derecha, y → abajo). Todas las posiciones de abajo están en ese plano.
Al mundo 3D se pasa con `mundoX = (x − 640) × 0.1`, `mundoZ = (y − 360) × 0.17`.
Una unidad de mundo son 10 px de plano en horizontal y ≈5,9 px en vertical.

## 1. Los 15 lugares

`h` = altura a la que flota el nombre. `r` = radio de la zona (en px de plano). `c` = etiqueta chica.

| id | Nombre (literal) | Grupo | x | y | r | h |
|---|---|---|---|---|---|---|
| sv | sound & vision | Zonas | 690 | 335 | 135 | 7 |
| eden | El edén | Zonas | 1172 | 235 | 150 | 5 |
| chill | Chill & microdancing | Zonas | 425 | 430 | 90 | 4 |
| inst | instalación artística | Zonas | 800 | 550 | 120 | 7 |
| panel | Panel de charlas | Zonas | 365 | 247 | 60 | 7 |
| carpa | Carpa Beduina | Zonas | 640 | 195 | 105 | 9 |
| domo | Domo | Zonas | 902 | 178 | 78 | 8 |
| merc | Mercadito | Zonas | 848 | 288 | 62 | 4 |
| chir | Chiringo · Bar | Barras y baños | 522 | 250 | 36 | 4 (c) |
| barra | Barra 2 BLUR | Barras y baños | 848 | 97 | 88 | 7 |
| banos | Baños | Barras y baños | 648 | 100 | 72 | 5 |
| m1 | Muelle 1 | Muelles y salidas | 190 | 300 | 50 | 3 |
| m2 | Muelle 2 | Muelles y salidas | 1190 | 560 | 50 | 3 |
| sd | Salida Muelle Dársena | Muelles y salidas | 372 | 345 | 66 | 1,5 (c) |
| sl | Salida Muelle Luján | Muelles y salidas | 968 | 345 | 66 | 1,5 (c) |

Único texto de ficha: **El edén** → «Pista principal · cabina con neón · sistema Funktion-One · unas 650 personas».
Los otros 14 no traen descripción.

Prioridad de nombres cuando se pisan (el de más arriba gana): sv, eden, inst, chill, carpa, barra, domo, panel,
banos, merc, m1, m2, chir, sd, sl, y por último «Río Luján».

Rótulo de agua: **«Río Luján»** en (1060, 690).

## 2. Terreno

**Tierra firme** (polígono del predio, pasto). Se sale del plano por arriba y por la derecha:

```
(520,-60) (1340,-60) (1340,575) (1150,600) (1000,612) (860,628) (720,630) (590,628) (470,612)
(360,585) (260,550) (195,505) (170,445) (168,380) (192,322) (250,262) (318,190) (395,110) (455,40)
```

**Costa** (la otra orilla, arriba a la izquierda, pasto):

```
(-80,-60) (430,-60) (380,10) (300,95) (205,180) (110,262) (30,320) (-80,345)
```

Entre las dos queda un canal de agua en diagonal, y todo lo que está debajo de y≈630 es el río.
Agua: plano de 400 × 320 de mundo, centrado en (0, 0, 10).

**Manchas de arena** (elipses, `centro x, y · radio a, b`):

| centro | a | b | rotación |
|---|---|---|---|
| (690, 330) | 215 | 95 | 0,05 rad |
| (800, 560) | 250 | 62 | 0 |
| (1040, 600) | 120 | 28 | 0 |
| (650, 520) | 90 | 40 | 0 |

## 3. Caminos (curvas Catmull-Rom por esos puntos)

1. `(190,300) (260,300) (330,330) (420,335) (520,330)` — del Muelle 1 al nudo central
2. `(520,330) (540,280) (520,230) (540,170) (560,120) (600,105)` — hacia el norte, a los baños
3. `(860,240) (930,235) (990,170) (1000,110) (990,60)`
4. `(1000,110) (1060,240) (1120,380) (1170,480) (1195,560)` — baja al Muelle 2
5. `(300,520) (260,470) (250,410) (300,350)` — desde el sur-oeste

## 4. Árboles

Algoritmo determinista (semilla 7), reproducido tal cual en `lib/mapa.ts`:

- Grilla `x = -60…1340` paso 21, `y = -50…640` paso 13, con jitter `+rng()*16`, `+rng()*10`.
- Entra si cae dentro de la **tierra** o de la **costa**.
- En la tierra, se descarta si cae en un **claro** (elipse de cada zona de radio `r × 0,95`, salvo muelles y salidas,
  más estos claros extra: `(690,330,230) (800,560,250) (1175,240,175) (1110,95,95) (1000,140,70) (1050,600,120) (648,520,90)`)
  o a menos de 26 px de un camino; además se saltea un 18 % al azar.
- Tamaño `0,75–1,5`. Color por azar; un 6 % lleva el color raro (rosado).
- Paleta de día: `7c9a3a 9fae3e b9a63a 5f8131 c7b84a 8aa34a 7c9a3a b9a63a 5f8131` + rosado `c98da0`.
- Paleta de noche: `4a5a2c 5a6230 6a6234 445426 6a6538 546034` + `6a4a50`.

## 5. Estructuras (huella en plano; medidas de mundo ÷ 0,1 en x, ÷ 0,17 en y)

| Lugar | Qué hay |
|---|---|
| **Baños** (648,100) | 2 contenedores de 52 × 15, uno amarillo (`c99a2c`) a −29 px y uno verde (`56703a`) a +29 px |
| **Barra 2 BLUR** (848,97) | Galpón de 140 × 33 con techo de lona a dos aguas; 4 pares de marcos de neón (rojo/ámbar alternados) en el frente sur, a −45, −15, +15, +45; mesa negra de 90 × 6,5 delante (y +23) |
| **Carpa Beduina** (640,195) | 2 picos de lona (cono r 72 × 33) a ±36 px; 4 postes en (±100,0) y (0,±29) |
| **Domo** (902,178) | Domo geodésico naranja (`e0864a`), elipse de 52 × 30 |
| **Panel de charlas** (365,247) | Cúpula de alambre dorado (`c79a3c`) de 36 × 21 y un anillo de 10 bancos de madera a radio 20 × 12 |
| **Chiringo** (522,250) | Cubo blanco de 26 × 13 con techo de madera de 30 × 15 |
| **Mercadito** (848,288) | 5 puestos de 22 × 7 en (−40,−9) (0,−13) (40,−9) (−20,14) (26,14), con lona alternando rojo oscuro `8a1c14` / crema |
| **sound & vision** (690,335) | Pórtico rojo (`8a1c14`): 2 postes en (±26, −35) y viga de 64 px |
| **Instalación artística** (800,550) | 5 marcos de neón sobre la playa, a x −70, −35, 0, +34, +68 y y 0, −8, +3, −6, +2; alternan rojo `ff2414` y ámbar `ffa040`, con velo translúcido |
| **Chill & microdancing** (425,430) | 3 alfombras de 36 × 14 (`8a2a1c`, `6a3f1e`, `9a6a2a`) en (−30,0) (+25,−6) (0,+15), con 3 almohadones blancos cada una |
| **Muelle 1** (190,300) | Tablón de madera de 24 × 47 (sale al agua, +19 en y) y casilla de 18 × 7; **bote** blanco en (150,300) |
| **Muelle 2** (1190,560) | Lo mismo, inclinado 0,2 rad |
| **El edén** | Ver abajo |

### El edén (pista principal) — grupo girado 0,27 rad

Origen del grupo en mundo (53,6 ; −19,5) → plano (1176, 245). Medidas dentro del grupo, en mundo:

- **Pista** 20 × 30 con borde blanco (en plano ≈ 200 × 176).
- **Dos galpones de lona** detrás (semicilindros de radio 5,2 en x = ±6, z = −23,5), iluminados en rojo de noche.
- **Cabina**: barra negra de 10 × 1,4 en z = −12,8; 5 paneles de vidrio rojo con neón; DJ de cápsula; 3 pads (rojo, violeta, verde).
- **Funktion-One**: 2 stacks altos al frente en x = ±6,4 y 2 delays laterales en x = ±11,2; parlantes con cara gris.
- **6 faroles** de 4 luces sobre pie, hacia el frente.
- **Control de sonido** en medio del público: mesa de 4,2 × 3,4 sobre 4 patas en (4,5 ; 5) y consola de madera.
- **Público**: grilla con desorden (paso 0,88 × 0,95), densidad que baja hacia el fondo, ~10 % de huecos, vacío alrededor del control de sonido.

### Gente suelta (cápsulas)

| centro | ancho × alto | cantidad |
|---|---|---|
| sound & vision (690,335) | 150 × 80 | 110 |
| Chill (425,430) | 70 × 40 | 34 |
| Mercadito (848,288) | 55 × 35 | 22 |
| Instalación (800,555) | 140 × 40 | 30 |
| Barra 2 BLUR (848,125) | 60 × 18 | 24 |

## 6. Luces y modos (solo del 3D)

- **Noche**: fondo `050103`, niebla, hemisférica violácea, bloom, haces de luz sobre el Edén, 11 luces rojas puntuales
  (sv 520, carpa 380, domo 300, barra 380, inst 420, chill 220, merc 160, panel 160, chiringo 90, m1 y m2 90; más 3 del Edén).
- **Día**: fondo `d8dcd0`, sol blanco con sombras. Colores de día: pasto `6f8a36`, agua `2b5e57`, arena `d29a5c`, camino `c98f55`, orilla `6e6a3a`.
- Se elige con `#noche` / `#dia` en la URL.

## 7. Interfaz de Ana (no se lleva: la reemplaza la nuestra)

Lista lateral agrupada en «Zonas», «Barras y baños», «Muelles y salidas»; filtros Todo / Zonas / Barras / Muelles; ficha con
tipo + nombre + info + «Cerca» (los 3 lugares más próximos, con distancia que pesa el eje y ×1,4); cámara que vuela al lugar
elegido; botones + − ⤢; marca «Delta Rica».

## 8. Lo que el HTML NO trae

Horarios, line-up por escenario, fotos, médico, hidratación, ni el nombre del canal. No hay datos de ruta entre lugares.
