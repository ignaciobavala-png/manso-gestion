# Manso Gestión — Plan v2.0

> Documento de planificación. No ejecutar nada hasta que el plan esté validado.

---

## Resumen ejecutivo

La v2.0 extiende la app en tres dimensiones:

1. **Sistema de roles** — dos tipos de usuario interno: Control (master admin) y Empleados (barra + entradas).
2. **Cara pública** — dos nuevas secciones accesibles por los clientes sin login: Carta (menú + pre-pago por transferencia) y Registro de entradas (QR único por persona, visible en pantalla).
3. **Seguridad** — la app pasa de ser una herramienta interna a tener superficies públicas; hay que endurecerla antes de exponer nada.

---

## Sistema de roles internos

### Dos roles, dos PINs

| Rol | Usuario | Quién lo usa |
|---|---|---|
| **Control** | Ana (administración) | Ve números, configura el sistema, exporta datos |
| **Empleados** | Personal del local | Opera Barra y/o Entradas, sin acceso a números |

El login es un **teclado de 4 dígitos**. Sin emails, sin contraseñas largas. Práctico para usar durante un evento.

Ana tiene su PIN. Los empleados comparten otro PIN. Ambos son editables desde la sección Control.

### Secciones por rol

**Control (Ana):**

- **Home** — balance en tiempo real, ingresos desglosados, arqueo y cierre de evento, historial de eventos cerrados.
- **Configuración** — alias/CBU del local para cobros por transferencia + activar/desactivar Carta pública + cambiar PINs.
- **Comunidad** — tabla de emails y nombres por evento + exportación a Excel.
- **Gestión de productos** — agregar, editar, eliminar productos; marcar visibles/ocultos en la carta pública.

**Empleados:**

- **Barra** — carrito de ventas, pre-pedidos pendientes de la Carta pública.
- **Entradas** — escáner QR, registro manual de invitados.
- Un empleado puede acceder a Barra y Entradas al mismo tiempo (mismo PIN, misma sesión).

### Implementación técnica de autenticación

Se usan **dos cuentas de Supabase Auth** creadas una sola vez durante el setup inicial (detalle de implementación invisible para los usuarios):

- `control@manso.internal` — contraseña = PIN de Control
- `empleado@manso.internal` — contraseña = PIN de Empleados

La UI muestra solo un teclado numérico de 4 dígitos. Al ingresar el PIN:

```
PIN ingresado
→ app intenta signInWithPassword({ email: 'control@manso.internal', password: PIN })
→ si falla, intenta con 'empleado@manso.internal'
→ según qué cuenta autenticó, establece el rol en la sesión local
→ redirige a la sección correspondiente
```

Esto da sesiones reales de Supabase (tokens con auto-refresh), RLS funciona con `auth.uid()`, y los PINs son hasheados por Supabase Auth — nunca en texto plano.

**Cambio de PIN desde Control:**

Edge Function `api/change-pin.ts` (autenticada, solo accesible con sesión de Control) que llama a la Admin API de Supabase para actualizar la contraseña de la cuenta correspondiente.

**Setup inicial (una sola vez, hecho por el dev):**

1. Crear las dos cuentas en Supabase Auth dashboard.
2. Crear la tabla `user_profiles` con el rol de cada cuenta.
3. Configurar los PINs iniciales.

Después de esto, Ana nunca ve un email — solo su teclado de 4 dígitos.

### Tabla de perfiles

```sql
CREATE TABLE user_profiles (
  id    UUID PRIMARY KEY REFERENCES auth.users(id),
  role  TEXT NOT NULL CHECK (role IN ('control', 'empleado'))
);

-- Insertar una vez durante el setup
INSERT INTO user_profiles VALUES
  ('<uid-de-control@manso.internal>', 'control'),
  ('<uid-de-empleado@manso.internal>', 'empleado');
```

### Flujo de login

```
/login  → teclado de 4 dígitos
  → PIN correcto de Control  → /admin/home
  → PIN correcto de Empleados → /admin/barra (con acceso a Entradas también)
  → PIN incorrecto × 3       → bloqueo temporario (Supabase Auth nativo)
```

---

## Sección 1 — Carta pública (menú + pre-pago)

### Concepto

El cliente accede a `/carta` (alias fijo del local, no por evento). Ve el menú con nombre y precio, selecciona sus ítems y recibe un **código de pedido único** generado por la app. Luego paga por transferencia al alias/CBU del local (configurado por Control) usando el código como referencia. Al llegar a la barra muestra el código. El empleado lo valida y despacha.

No se integra ninguna pasarela de pago. El sistema no verifica el pago — eso lo hace el empleado visualmente. Lo que garantiza el sistema es que **cada código de pedido solo puede despacharse una vez**.

### Qué hace el cliente

1. Accede a `/carta`.
2. Ve la lista de productos con nombre y precio.
3. Arma su pedido seleccionando cantidades.
4. La app muestra el total, las instrucciones de pago (alias/CBU configurado por Control) y el **código de pedido** (ej: `MSO-4F2A`).
5. Paga la transferencia usando el código como referencia/concepto.
6. Llega a la barra y muestra el código en pantalla.

### Qué hace el empleado de Barra

- Sección nueva en Barra: lista de pre-pedidos pendientes con código, ítems detallados y total.
- Busca el código del cliente en la lista (o el cliente lo muestra).
- Confirma el pago en su app bancaria.
- Toca "Despachar" → el pedido queda marcado como despachado, el código inutilizable.
- Si el código ya fue despachado, el sistema lo indica con fecha y hora (prevención de reusos).

### Prevención de uso doble

- Cada pedido tiene `status`: `pendiente` → `despachado` → `cancelado`.
- Una vez despachado, el botón desaparece y aparece un badge con timestamp.
- El token es UUID v4 truncado — no adivinable por fuerza bruta.

### Flujo de datos

```
[Cliente] → /carta
  → Lee productos visibles + alias/CBU del local (Supabase, lectura anon)
  → Selecciona ítems → "Generar pedido"
  → POST api/crear-pedido.ts → inserta drink_order (status: pendiente)
  → Cliente ve código + instrucciones de transferencia

[Barra interna]
  → Lista drink_orders pendientes del evento activo
  → Empleado toca "Despachar"
  → drink_order.status = despachado, despachado_at = now()
```

### Configuración del alias/CBU

Control accede a `/admin/configuracion` y edita el alias y CBU del local. Se guarda en una tabla `venue_config` (una sola fila). La Carta pública la lee con la anon key vía RLS de solo lectura.

```sql
CREATE TABLE venue_config (
  id          INT PRIMARY KEY DEFAULT 1,             -- fila única
  alias_pago  TEXT,
  cbu_pago    TEXT,
  carta_activa BOOLEAN DEFAULT false,
  CHECK (id = 1)                                     -- garantiza fila única
);
```

### Cambios en base de datos

```sql
-- Visibilidad de productos en la carta
ALTER TABLE products ADD COLUMN visible_en_carta BOOLEAN DEFAULT true;

-- Pre-pedidos de clientes
CREATE TABLE drink_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID REFERENCES events(id),
  items             JSONB NOT NULL,
  total             NUMERIC NOT NULL,
  status            TEXT DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'despachado', 'cancelado')),
  comprobante_token TEXT UNIQUE NOT NULL,
  despachado_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

### Nuevas páginas y Edge Functions

- `src/pages/public/Carta.tsx` — menú público + generador de pedido
- `src/pages/public/PedidoGenerado.tsx` — código de pedido + instrucciones de pago
- `src/pages/admin/Configuracion.tsx` — solo Control: edita alias/CBU, activa/desactiva carta
- `api/crear-pedido.ts` — Edge Function: valida evento activo, inserta `drink_order`
- Sección nueva en `Barra.tsx` — lista de pre-pedidos pendientes + despachar

---

## Sección 2 — Registro de entradas público (QR único)

### Concepto

El cliente ingresa nombre y email. El sistema verifica que ese email no esté registrado para el evento activo. Si está libre, genera un **UUID único como token**, lo guarda en la base de datos y muestra el QR en pantalla. El QR se puede descargar como imagen PNG. La app lo persiste en `localStorage` para que esté disponible aunque el cliente cierre la pestaña.

**No se envía email con el QR.** La pantalla recomienda explícitamente descargar la imagen.

### Qué hace el cliente

1. Accede a `/registro`.
2. Ingresa nombre completo + email. Checkbox de aceptación: *"Acepto que Manso Club guarde mis datos para comunicaciones futuras."*
3. El sistema verifica unicidad por email + evento activo.
   - Si ya existe: *"Ya tenés una entrada. Si perdiste tu QR, acercate a la puerta."*
   - Si no existe: genera token, guarda, muestra QR.
4. Pantalla del QR (`/mi-entrada`):
   - Estilo gráfico de Manso Club (assets cargados en `/public` por el equipo).
   - QR grande y centrado con el nombre del asistente debajo.
   - Botón **"Descargar imagen"** — exporta la pantalla completa como PNG.
   - Aviso: *"Guardá esta imagen. No necesitás internet para mostrarla en la puerta."*
   - El token se guarda en `localStorage` con clave `manso_ticket_{event_id}`.
5. Si el cliente vuelve a `/registro` o `/mi-entrada`, la app detecta el `localStorage` y muestra su QR directamente.

### Qué hace el empleado de Entradas

- El escáner existente lee el nuevo formato: `manso-ticket|{token}`.
- Al escanear valida: token existe + pertenece al evento activo + `used_at IS NULL`.
- Si válido: muestra nombre del asistente + marca `used_at = now()`.
- Si ya usado: muestra error con timestamp del ingreso anterior.
- Si de otro evento o inválido: error igual que hoy.

### Flujo de datos

```
[Cliente] → /registro
  → Ingresa nombre + email + acepta términos
  → POST api/registro-entrada.ts
  → Verifica UNIQUE(email, event_id) en ticket_registrations
  → Inserta registro, devuelve token
  → App genera QR, muestra en pantalla, guarda en localStorage

[Entradas interna]
  → Escanea QR → extrae token
  → Valida event_id + used_at IS NULL
  → UPDATE used_at = now()
  → Muestra nombre del asistente
```

### Cambios en base de datos

```sql
CREATE TABLE ticket_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  token         TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  used_at       TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (email, event_id)
);
```

### Los emails como activo de Manso Club

- `ticket_registrations` es la base de datos de la comunidad Manso.
- Sección **Comunidad** en el panel de Control: tabla con nombre, email, evento y fecha por cada asistente.
- Botón de exportación a **Excel (`.xlsx`)** filtrable por evento.
- El checkbox de aceptación en el formulario público cubre el cumplimiento mínimo de privacidad.
- A futuro: conectar con herramientas de email marketing. Por ahora solo recolección y exportación.

### Nuevas páginas y Edge Functions

- `src/pages/public/RegistroEntrada.tsx` — formulario nombre + email + aceptación
- `src/pages/public/MiEntrada.tsx` — QR en pantalla con estilos Manso + botón descarga
- `src/pages/admin/Comunidad.tsx` — solo Control: tabla de asistentes + exportar Excel
- `api/registro-entrada.ts` — Edge Function: valida unicidad, inserta, devuelve token

---

## Seguridad

### Superficie de ataque por rol

| Superficie | Acceso | Riesgo |
|---|---|---|
| `/carta` | Anon | Spam de pedidos falsos → throttling por IP |
| `/registro` | Anon | Registro masivo de emails falsos → throttling + validación de formato |
| `/admin/*` | Authenticated | Panel interno → protegido por Supabase Auth |
| `/admin/configuracion` | Solo rol `control` | Cambio de alias/CBU → RLS + check de rol en server |
| `/admin/comunidad` | Solo rol `control` | Exportación de emails → misma protección |

### Políticas RLS principales

```sql
-- ticket_registrations
ALTER TABLE ticket_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registro_publico_insert"
  ON ticket_registrations FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "registro_interno_select"
  ON ticket_registrations FOR SELECT TO authenticated USING (true);

CREATE POLICY "registro_interno_update"
  ON ticket_registrations FOR UPDATE TO authenticated USING (true);

-- drink_orders
ALTER TABLE drink_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedido_publico_insert"
  ON drink_orders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "pedido_interno_select"
  ON drink_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "pedido_interno_update"
  ON drink_orders FOR UPDATE TO authenticated USING (true);

-- venue_config: anon solo puede leer, solo control puede escribir
ALTER TABLE venue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_config_public_read"
  ON venue_config FOR SELECT TO anon USING (true);

CREATE POLICY "venue_config_control_write"
  ON venue_config FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'control')
  );
```

### Otras medidas

- Eliminar todos los `console.log` antes de activar páginas públicas.
- Rate limiting por IP en `api/crear-pedido.ts` y `api/registro-entrada.ts`.
- Tokens no predecibles: UUID v4 completo en `ticket_registrations`, UUID truncado legible en `drink_orders`.

---

## Cambios de arquitectura

### Rutas con react-router-dom

```
/login                  → formulario de acceso
/carta                  → Carta pública (alias fijo del local)
/registro               → Registro de entrada público
/mi-entrada             → QR del cliente (lee localStorage o redirige a /registro)
/pedido/:token          → Confirmación de pedido generado
/admin/home             → Control: balance, arqueo, eventos
/admin/barra            → Empleado (con permiso): carrito + pre-pedidos
/admin/entradas         → Empleado (con permiso): escáner QR
/admin/configuracion    → Control: alias/CBU, activar carta
/admin/comunidad        → Control: emails de asistentes + exportar
```

### Layouts

- `PublicLayout` — sin BottomNav, sin auth, estilos orientados al cliente.
- `AdminLayout` — con BottomNav adaptado al rol del usuario activo.

### Variables de entorno

Sin integraciones de pago ni email externas, las variables nuevas son mínimas:

```
# Ya existentes
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

El alias/CBU no va en `.env` — va en `venue_config` en Supabase, editable desde la app por Control.

---

## Orden de implementación

### Fase 2.1 — Fundaciones

1. Eliminar `console.log` de debug
2. Eliminar `test-supabase.js` del root
3. Spinner real usando `isLoading` del store
4. Tabla `user_profiles` + Supabase Auth con roles
5. Pantalla de login (`/login`)
6. Incorporar `react-router-dom`, migrar navegación actual, proteger rutas `/admin/*`
7. BottomNav adaptado al rol del usuario

### Fase 2.2 — Registro de entradas público

1. Tabla `ticket_registrations` con RLS
2. Edge Function `api/registro-entrada.ts`
3. Páginas `RegistroEntrada.tsx` + `MiEntrada.tsx` (QR + descarga + localStorage)
4. Actualizar escáner interno para validar nuevo formato de token
5. Página `Comunidad.tsx` (Control): tabla de asistentes + exportar Excel

### Fase 2.3 — Carta pública y pre-pago

1. Tabla `venue_config` + `drink_orders` con RLS
2. Columna `visible_en_carta` en `products`
3. Página `Configuracion.tsx` (Control): alias/CBU + activar carta
4. Edge Function `api/crear-pedido.ts`
5. Páginas públicas `Carta.tsx` + `PedidoGenerado.tsx`
6. Sección de pre-pedidos en `Barra.tsx` + lógica de despachar

### Fase 2.4 — Pulido y seguridad final

1. Rate limiting en Edge Functions públicas
2. Auditoría completa de RLS
3. Assets gráficos de Manso Club en páginas públicas
4. Actualizar README principal

---

## Decisiones confirmadas

- [x] Alias de Carta: fijo del local (`/carta`), no por evento.
- [x] Autenticación: PIN de 4 dígitos. Dos PINs — Control (Ana) y Empleados. Sin emails visibles para los usuarios.
- [x] Control: una sola cuenta, Ana. Un PIN.
- [x] Empleados: un único PIN compartido. Acceden a Barra y Entradas al mismo tiempo.
- [x] Alias/CBU: configurable desde la sección Control, guardado en `venue_config` en Supabase.
- [x] Pantalla "Mi entrada": con estilos gráficos de Manso Club (assets cargados en `/public`).
- [x] Emails de la comunidad: recolectados en `ticket_registrations`, exportables a Excel desde la sección Comunidad de Control. Sin herramienta de email marketing por ahora.
