# Contraste: el piso que no se baja

> Medido el 2026-08-22 sobre el diseño real, no a ojo.

## El problema que había

La app pone texto sobre tarjetas translúcidas (`bg-black/60`) que a su vez
están sobre una foto de fondo. Ese apilado sube el brillo del fondo efectivo, y
un gris que se lee perfecto sobre negro puro deja de leerse ahí.

Contraste real del texto sobre una tarjeta, antes del ajuste:

| color | sobre negro | sobre tarjeta |
|---|---|---|
| `gray-300` | 14.27:1 | 8.15:1 |
| `gray-400` | 8.07:1 | 4.61:1 |
| `gray-500` | 4.34:1 | **2.48:1** |
| `gray-600` | 2.78:1 | **1.59:1** |

El mínimo accesible es **4.5:1** para texto normal y **3:1** para texto grande.
`gray-500` y `gray-600` no llegaban ni al umbral de texto grande: eran 143 usos
de texto que, sobre una tarjeta, directamente no se leía.

## La regla

**Nada por debajo de `text-gray-400`.** No es una preferencia estética: es el
primer tono de la escala que pasa el umbral sobre una tarjeta. Medio paso menos
no alcanza, por eso `gray-500` y `gray-600` se colapsaron en `gray-400` en vez
de bajar uno solo.

Las tres jerarquías de texto quedan así, y todas pasan:

| uso | clase | sobre tarjeta |
|---|---|---|
| principal | `text-white` | 14.00:1 |
| secundario | `text-gray-300` | 9.51:1 |
| apagado | `text-gray-400` | 5.38:1 |

La jerarquía por debajo de eso se marca con **tamaño y peso**, no bajando el
gris. Un `text-xs` en `gray-400` ya se lee como secundario sin desaparecer.

## Superficies y bordes

- Capa oscura sobre la foto: `bg-black/75`
- Tarjetas: `bg-black/60`
- Bordes: `border-white/20`, y `border-white/25` donde el borde separa
  controles. Con `/10` el borde existía en el CSS pero no en la pantalla.

## Excepción

Las pantallas de fondo claro —el cartel imprimible de `/admin/cartel`— usan
`text-neutral-*` sobre blanco. Ahí la regla es al revés y esta escala no aplica.

## Cómo verificar un cambio

El cálculo está en el historial de git de este archivo, pero la versión corta:
convertir el color OKLCH de Tailwind a sRGB lineal, calcular la luminancia
relativa, y compararla contra el fondo efectivo de la tarjeta
(`0.25 × 0.25 × 0.40 ≈ 0.025` en lineal, para una foto de brillo medio).
Si da menos de 4.5, no va.
