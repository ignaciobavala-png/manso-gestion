-- ============================================================
-- Manso Gestión — Migración 039: tipos de entrada por evento
-- ============================================================
-- Contexto: el festival BLUR se vende en la web de Manso Club (otro repo,
-- otro proyecto de Supabase) y en la puerta se usa el lector de Gestión.
-- Una sola fuente de verdad: el evento, sus tipos de entrada y el stock viven
-- acá; la web vende contra Gestión con las RPC web_* de esta migración, y
-- cada entrada que vende es una fila de ticket_registrations con su QR
-- `manso-ticket|<token>`, que el lector valida igual que las de la app.
--
-- Compatibilidad: un evento SIN tipos funciona exactamente como antes, con
-- regular_ticket_price. Nada de esto toca el QR comodín (018) ni el cowork,
-- salvo que el trigger del cowork pasa a usar entrada_vendida() en vez de
-- su copia de la regla (ver sección 6).
--
-- Orden de deploy: esta migración ANTES del código que la usa (el mail y el
-- recordatorio filtran por `origen`, que sin la 039 no existe).
-- ============================================================

-- ============================================================
-- 1. Tipos de entrada
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_ticket_types (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  nombre              TEXT NOT NULL CHECK (length(btrim(nombre)) > 0),
  descripcion         TEXT,
  precio              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
  -- Cuántas entradas (personas, QR) da una unidad: un pack x3 = 3.
  entradas_por_unidad INTEGER NOT NULL DEFAULT 1 CHECK (entradas_por_unidad >= 1),
  -- Tope propio del tipo, en ENTRADAS (no en packs). NULL = sin tope propio;
  -- igual lo limita el aforo del evento.
  cupo                INTEGER CHECK (cupo IS NULL OR cupo >= 0),
  -- Máximo de UNIDADES por compra. NULL = sin tope.
  max_por_compra      INTEGER CHECK (max_por_compra IS NULL OR max_por_compra >= 1),
  -- Lo que decide Ana. 'agotado' por cupo no se escribe acá: se calcula al
  -- leer (estado_efectivo en web_tipos_entrada), así no hay que cambiarlo a mano.
  estado              TEXT NOT NULL DEFAULT 'en_venta'
                      CHECK (estado IN ('en_venta', 'proximamente', 'agotado', 'finalizado')),
  orden               INTEGER NOT NULL DEFAULT 0,
  activo              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event
  ON public.event_ticket_types (event_id, orden);

ALTER TABLE public.event_ticket_types ENABLE ROW LEVEL SECURITY;

-- Lectura pública, como events: precio y nombre ya están en el flyer.
DROP POLICY IF EXISTS event_ticket_types_public_select ON public.event_ticket_types;
CREATE POLICY event_ticket_types_public_select
  ON public.event_ticket_types
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS event_ticket_types_staff_all ON public.event_ticket_types;
CREATE POLICY event_ticket_types_staff_all
  ON public.event_ticket_types
  FOR ALL
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['control@manso.internal', 'empleado@manso.internal', 'owner@manso.internal']))
  WITH CHECK ((auth.jwt() ->> 'email') = ANY (ARRAY['control@manso.internal', 'empleado@manso.internal', 'owner@manso.internal']));

-- ============================================================
-- 2. Columnas nuevas en ticket_registrations
-- ============================================================
ALTER TABLE public.ticket_registrations
  ADD COLUMN IF NOT EXISTS ticket_type_id UUID
    REFERENCES public.event_ticket_types(id) ON DELETE SET NULL,
  -- Snapshot: lo escribe el trigger de capacidad desde la tabla de tipos,
  -- nunca el cliente. Si después se renombra o borra el tipo, la entrada
  -- sigue diciendo lo que se vendió.
  ADD COLUMN IF NOT EXISTS ticket_type_nombre TEXT,
  -- Agrupa las filas de una misma compra. Es la clave de idempotencia de las
  -- compras con tipo (web y Gestión).
  ADD COLUMN IF NOT EXISTS order_ref TEXT,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'gestion',
  -- Posición dentro de un pack: "Pack x3 · 2/3". NULL si no es pack.
  -- El nombre de la persona va literal en las N filas; el número no se le
  -- pega al nombre para no ensuciar el buscador, el mail ni la llave del cowork.
  ADD COLUMN IF NOT EXISTS pack_pos  SMALLINT,
  ADD COLUMN IF NOT EXISTS pack_size SMALLINT;

ALTER TABLE public.ticket_registrations
  DROP CONSTRAINT IF EXISTS ticket_registrations_origen_check;
ALTER TABLE public.ticket_registrations
  ADD CONSTRAINT ticket_registrations_origen_check
  CHECK (origen IN ('gestion', 'web'));

ALTER TABLE public.ticket_registrations
  DROP CONSTRAINT IF EXISTS ticket_registrations_pack_check;
ALTER TABLE public.ticket_registrations
  ADD CONSTRAINT ticket_registrations_pack_check
  CHECK (
    (pack_pos IS NULL AND pack_size IS NULL)
    OR (pack_size >= 2 AND pack_pos BETWEEN 1 AND pack_size)
  );

-- 'web': entrada vendida por la web de Manso Club contra las RPC web_*.
ALTER TABLE public.ticket_registrations
  DROP CONSTRAINT IF EXISTS ticket_registrations_payment_provider_check;
ALTER TABLE public.ticket_registrations
  ADD CONSTRAINT ticket_registrations_payment_provider_check
  CHECK (payment_provider IS NULL OR payment_provider IN ('transferencia', 'mercadopago', 'web'));

CREATE INDEX IF NOT EXISTS idx_ticket_registrations_order_ref
  ON public.ticket_registrations (order_ref)
  WHERE order_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_registrations_ticket_type
  ON public.ticket_registrations (ticket_type_id)
  WHERE ticket_type_id IS NOT NULL;

-- mp_expires_at deja de ser sólo de MP: es "hasta cuándo esta reserva ocupa
-- cupo". No se renombra porque el código deployado lo usa por ese nombre y un
-- rename lo rompería entre la migración y el deploy.
COMMENT ON COLUMN public.ticket_registrations.mp_expires_at IS
  'Vencimiento de la reserva. MP: plazo de la preference (NULL = no reserva). '
  'web: plazo que manda la web (NULL = no vence sola). Liberar = ponerlo en now().';

-- ============================================================
-- 3. Predicados canónicos, generalizados
-- ============================================================
-- Misma firma que en la 020: todo lo que ya los llama sigue andando.
--
--   VENDIDA   = no rechazada Y (no es de MP ni de la web  Ó  está pagada)
--   RESERVADA = no rechazada, no pagada, y
--                 MP:  vence en el futuro (NULL no reserva: es una fila que
--                      quedó sin preference)
--                 web: vence en el futuro o no vence (NULL = hasta que la web
--                      confirme o libere; transferencias del festival)
CREATE OR REPLACE FUNCTION public.entrada_vendida(
  p_is_banned        BOOLEAN,
  p_payment_provider TEXT,
  p_payment_verified BOOLEAN
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(p_is_banned, false) = false
     AND (
       (p_payment_provider IS DISTINCT FROM 'mercadopago'
        AND p_payment_provider IS DISTINCT FROM 'web')
       OR COALESCE(p_payment_verified, false)
     );
$function$;

COMMENT ON FUNCTION public.entrada_vendida(BOOLEAN, TEXT, BOOLEAN) IS
  'Entrada que cuenta como vendida y da derecho a QR. Rechazar QR (is_banned) '
  'la saca; una de Mercado Pago o de la web sin pago confirmado nunca entró.';

CREATE OR REPLACE FUNCTION public.entrada_reservada(
  p_is_banned        BOOLEAN,
  p_payment_provider TEXT,
  p_payment_verified BOOLEAN,
  p_mp_expires_at    TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(p_is_banned, false) = false
     AND COALESCE(p_payment_verified, false) = false
     AND (
       (p_payment_provider = 'mercadopago'
        AND p_mp_expires_at IS NOT NULL
        AND p_mp_expires_at > NOW())
       OR
       (p_payment_provider = 'web'
        AND (p_mp_expires_at IS NULL OR p_mp_expires_at > NOW()))
     );
$function$;

COMMENT ON FUNCTION public.entrada_reservada(BOOLEAN, TEXT, BOOLEAN, TIMESTAMPTZ) IS
  'Compra en curso (checkout de MP o reserva de la web): ocupa cupo hasta que '
  'vence o se confirma. No es una venta — no da QR ni entra en los totales.';

-- ============================================================
-- 4. Capacidad: aforo del evento + cupo del tipo
-- ============================================================
-- Misma fila del evento bloqueada (FOR UPDATE) para las dos cuentas: dos
-- compras simultáneas del último lugar se serializan acá.
--
-- Los inserts de varias filas en un mismo statement (un pack) también se
-- controlan bien: un trigger BEFORE ROW ve las filas que el mismo statement
-- ya insertó. Si una falla, el statement entero vuelve atrás.
CREATE OR REPLACE FUNCTION public.check_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_max_capacity  INTEGER;
  v_current_count INTEGER;
  v_tipo          public.event_ticket_types%ROWTYPE;
  v_tipo_count    INTEGER;
BEGIN
  SELECT max_capacity INTO v_max_capacity
  FROM public.events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF NEW.ticket_type_id IS NOT NULL THEN
    SELECT * INTO v_tipo
    FROM public.event_ticket_types
    WHERE id = NEW.ticket_type_id;

    IF NOT FOUND OR v_tipo.event_id <> NEW.event_id THEN
      RAISE EXCEPTION 'tipo_invalido: el tipo de entrada no es de este evento'
        USING ERRCODE = 'P0001';
    END IF;

    -- El snapshot lo pone la base, no quien inserta.
    NEW.ticket_type_nombre := v_tipo.nombre;
  ELSE
    NEW.ticket_type_nombre := NULL;
  END IF;

  IF v_max_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.ticket_registrations
    WHERE event_id = NEW.event_id
      AND (
        public.entrada_vendida(is_banned, payment_provider, payment_verified)
        OR public.entrada_reservada(is_banned, payment_provider, payment_verified, mp_expires_at)
      );

    IF v_current_count >= v_max_capacity THEN
      RAISE EXCEPTION 'capacity_exceeded: el evento alcanzó su capacidad máxima (%)', v_max_capacity
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.ticket_type_id IS NOT NULL AND v_tipo.cupo IS NOT NULL THEN
    SELECT COUNT(*) INTO v_tipo_count
    FROM public.ticket_registrations
    WHERE ticket_type_id = NEW.ticket_type_id
      AND (
        public.entrada_vendida(is_banned, payment_provider, payment_verified)
        OR public.entrada_reservada(is_banned, payment_provider, payment_verified, mp_expires_at)
      );

    IF v_tipo_count >= v_tipo.cupo THEN
      RAISE EXCEPTION 'tipo_agotado: no quedan entradas de "%"', v_tipo.nombre
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 5. Disponibilidad por tipo (una sola cuenta, la usan la web y Gestión)
-- ============================================================
-- Legible por anon: son sólo números. Mismo criterio que el trigger, para
-- que la pantalla no diga "quedan 3" y el insert falle.
CREATE OR REPLACE FUNCTION public.web_tipos_entrada(p_event_id UUID)
RETURNS TABLE (
  id                   UUID,
  nombre               TEXT,
  descripcion          TEXT,
  precio               NUMERIC,
  entradas_por_unidad  INTEGER,
  max_por_compra       INTEGER,
  estado               TEXT,
  estado_efectivo      TEXT,
  orden                INTEGER,
  disponibles_entradas INTEGER,
  disponibles_unidades INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH ev AS (
    SELECT e.max_capacity,
           (SELECT COUNT(*)::INTEGER FROM public.ticket_registrations r
             WHERE r.event_id = e.id
               AND (public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified)
                    OR public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at))
           ) AS ocupadas
    FROM public.events e
    WHERE e.id = p_event_id
  ),
  t AS (
    SELECT tt.*,
           (SELECT COUNT(*)::INTEGER FROM public.ticket_registrations r
             WHERE r.ticket_type_id = tt.id
               AND (public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified)
                    OR public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at))
           ) AS ocupadas_tipo
    FROM public.event_ticket_types tt
    WHERE tt.event_id = p_event_id
      AND tt.activo
  ),
  d AS (
    SELECT t.*,
           -- LEAST ignora los NULL: NULL sólo si no hay tope en ningún lado.
           LEAST(
             CASE WHEN ev.max_capacity IS NULL THEN NULL
                  ELSE GREATEST(ev.max_capacity - ev.ocupadas, 0) END,
             CASE WHEN t.cupo IS NULL THEN NULL
                  ELSE GREATEST(t.cupo - t.ocupadas_tipo, 0) END
           ) AS disp
    FROM t CROSS JOIN ev
  )
  SELECT d.id,
         d.nombre,
         d.descripcion,
         d.precio,
         d.entradas_por_unidad,
         d.max_por_compra,
         d.estado,
         CASE WHEN d.estado = 'en_venta' AND d.disp IS NOT NULL
                   AND d.disp / d.entradas_por_unidad = 0
              THEN 'agotado'
              ELSE d.estado END,
         d.orden,
         d.disp,
         d.disp / d.entradas_por_unidad
  FROM d
  ORDER BY d.orden, d.created_at;
$function$;

REVOKE ALL ON FUNCTION public.web_tipos_entrada(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.web_tipos_entrada(UUID) TO anon, authenticated, service_role;

-- ============================================================
-- 6. Cowork: la llave sale sólo de una entrada vendida
-- ============================================================
-- Tenía la regla de "vendida" copiada adentro (no MP ⇒ vendida), y con eso
-- una reserva web sin pagar le habría emitido una llave. Ahora usa el
-- predicado. El resto de la función queda igual.
CREATE OR REPLACE FUNCTION public.cowork_llave_desde_registracion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_event  events%rowtype;
  v_fecha  date;
  v_vendida boolean;
begin
  select * into v_event from events where id = new.event_id;
  if not found or not v_event.cowork_day then
    return new;
  end if;

  v_vendida := public.entrada_vendida(new.is_banned, new.payment_provider, new.payment_verified);

  -- La fecha del pase es el dia del evento en hora de Buenos Aires:
  -- start_date es timestamptz y un evento de la manana no puede caer
  -- en el dia anterior por leer el UTC crudo.
  v_fecha := (v_event.start_date at time zone 'America/Argentina/Buenos_Aires')::date;

  if v_vendida then
    perform cowork_emitir_llave(
      p_email      => new.email,
      p_nombre     => new.name,
      p_tipo       => 'dia',
      p_desde      => v_fecha,
      p_hasta      => v_fecha,
      p_origen     => 'cowork_day',
      p_origen_ref => new.id::text,
      p_plan       => v_event.name,
      p_precio     => new.price_per_ticket,
      p_moneda     => 'ARS',
      p_telefono   => new.phone,
      p_instagram  => new.instagram
    );
  else
    -- Rechazar el QR o desverificar el pago apaga la llave, no la borra.
    update cowork_llaves
      set anulada_at = coalesce(anulada_at, now()),
          anulada_por = coalesce(anulada_por, 'cowork_day: la entrada dejo de estar vendida')
      where origen = 'cowork_day' and origen_ref = new.id::text;
  end if;

  return new;
end;
$function$;

-- La 029 le había sacado el EXECUTE a todos; CREATE OR REPLACE no lo cambia,
-- pero se repite para que esta migración no dependa de eso.
REVOKE ALL ON FUNCTION public.cowork_llave_desde_registracion() FROM public, anon, authenticated;

-- ============================================================
-- 7. API para la web: reservar / confirmar / liberar
-- ============================================================
-- SECURITY DEFINER, EXECUTE sólo para service_role: la web las llama desde
-- su servidor con la service role de Gestión. Contrato completo en
-- docs/WEB-API-ENTRADAS.md. Errores: RAISE con prefijo estable
-- ('<codigo>: <detalle>') y ERRCODE P0001.
--
-- Todas tocan sólo filas con origen = 'web': la web no puede confirmar ni
-- liberar una orden de Gestión aunque adivine su order_ref.

-- ── web_reservar ──────────────────────────────────────────────
-- Crea las filas (sin pagar) y devuelve una por QR. Todo o nada: un error en
-- cualquier fila (cupo, aforo) tira abajo la llamada entera.
-- Idempotente por order_ref: si ya existe, devuelve las filas que tiene sin
-- mirar p_items de nuevo.
CREATE OR REPLACE FUNCTION public.web_reservar(
  p_event_id  UUID,
  p_order_ref TEXT,
  p_nombre    TEXT,
  p_email     TEXT,
  p_items     JSONB,
  p_vence_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (token TEXT, tipo_nombre TEXT, pack_pos SMALLINT, pack_size SMALLINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ref     TEXT := btrim(COALESCE(p_order_ref, ''));
  v_nombre  TEXT := btrim(COALESCE(p_nombre, ''));
  v_email   TEXT := lower(btrim(COALESCE(p_email, '')));
  v_event   public.events%ROWTYPE;
  v_item    RECORD;
  v_tipo    public.event_ticket_types%ROWTYPE;
  v_n       INTEGER;
  v_base    NUMERIC(10,2);
  v_precio  NUMERIC(10,2);
  v_unidad  INTEGER;
  v_pos     INTEGER;
  v_token   TEXT;
BEGIN
  IF v_ref = '' OR v_nombre = '' OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'datos_invalidos: order_ref, nombre y un email válido son obligatorios'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_vence_at IS NOT NULL AND p_vence_at <= now() THEN
    RAISE EXCEPTION 'datos_invalidos: p_vence_at tiene que ser futuro (o NULL)'
      USING ERRCODE = 'P0001';
  END IF;

  -- Se bloquea el evento antes de mirar el order_ref: dos llamadas con la
  -- misma orden quedan en fila y la segunda ve lo que creó la primera.
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'evento_inexistente: %', p_event_id USING ERRCODE = 'P0001';
  END IF;

  -- Idempotencia
  IF EXISTS (SELECT 1 FROM public.ticket_registrations r WHERE r.order_ref = v_ref) THEN
    IF EXISTS (SELECT 1 FROM public.ticket_registrations r
                WHERE r.order_ref = v_ref
                  AND (r.origen <> 'web' OR r.event_id <> p_event_id)) THEN
      RAISE EXCEPTION 'orden_de_otro_evento: el order_ref % ya se usó para otra cosa', v_ref
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.ticket_registrations r
                    WHERE r.order_ref = v_ref
                      AND (public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified)
                           OR public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at))) THEN
      RAISE EXCEPTION 'orden_liberada: la orden % venció o fue liberada; usá un order_ref nuevo', v_ref
        USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY
      SELECT r.token, r.ticket_type_nombre, r.pack_pos, r.pack_size
      FROM public.ticket_registrations r
      WHERE r.order_ref = v_ref
      ORDER BY r.registered_at, r.pack_pos NULLS FIRST;
    RETURN;
  END IF;

  IF v_event.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'evento_cerrado: el evento ya finalizó' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_event.registrations_open THEN
    RAISE EXCEPTION 'ventas_pausadas: el registro de entradas está pausado' USING ERRCODE = 'P0001';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'datos_invalidos: p_items tiene que ser un array no vacío de {tipo_id, cantidad}'
      USING ERRCODE = 'P0001';
  END IF;

  -- Mismo tipo repetido en p_items: se suman las cantidades.
  FOR v_item IN
    SELECT (x->>'tipo_id')::UUID AS tipo_id, SUM((x->>'cantidad')::INTEGER)::INTEGER AS cantidad
    FROM jsonb_array_elements(p_items) AS x
    GROUP BY 1
    ORDER BY 1
  LOOP
    IF v_item.tipo_id IS NULL OR v_item.cantidad IS NULL OR v_item.cantidad < 1 THEN
      RAISE EXCEPTION 'datos_invalidos: cada item necesita tipo_id y cantidad >= 1'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_tipo FROM public.event_ticket_types t WHERE t.id = v_item.tipo_id;
    IF NOT FOUND OR v_tipo.event_id <> p_event_id OR NOT v_tipo.activo
       OR v_tipo.estado <> 'en_venta' THEN
      RAISE EXCEPTION 'tipo_no_disponible: el tipo % no está a la venta', v_item.tipo_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_tipo.max_por_compra IS NOT NULL AND v_item.cantidad > v_tipo.max_por_compra THEN
      RAISE EXCEPTION 'max_por_compra: "%" permite hasta % por compra', v_tipo.nombre, v_tipo.max_por_compra
        USING ERRCODE = 'P0001';
    END IF;

    -- El precio de la unidad se reparte entre sus filas y la última absorbe
    -- el redondeo: $70.000 / 3 = 23.333,33 + 23.333,33 + 23.333,34. Así la
    -- suma de price_per_ticket cierra contra lo cobrado.
    v_n    := v_tipo.entradas_por_unidad;
    v_base := round(v_tipo.precio / v_n, 2);

    FOR v_unidad IN 1..v_item.cantidad LOOP
      FOR v_pos IN 1..v_n LOOP
        v_precio := CASE WHEN v_pos = v_n THEN v_tipo.precio - v_base * (v_n - 1) ELSE v_base END;
        v_token  := gen_random_uuid()::TEXT;

        -- Un INSERT por fila: el trigger de capacidad corre por cada una y
        -- una falla deshace todo lo anterior de esta llamada.
        INSERT INTO public.ticket_registrations (
          event_id, name, email, token, ticket_type_id, order_ref, origen,
          payment_provider, payment_verified, mp_expires_at, price_per_ticket,
          pack_pos, pack_size, registered_at
        ) VALUES (
          p_event_id, v_nombre, v_email, v_token, v_tipo.id, v_ref, 'web',
          'web', false, p_vence_at,
          CASE WHEN v_event.is_paid THEN v_precio ELSE NULL END,
          CASE WHEN v_n > 1 THEN v_pos END,
          CASE WHEN v_n > 1 THEN v_n END,
          -- clock_timestamp y no now(): ordena las filas de la orden en el
          -- orden en que se crearon, para devolverlas igual en un reintento.
          clock_timestamp()
        );

        token       := v_token;
        tipo_nombre := v_tipo.nombre;
        pack_pos    := CASE WHEN v_n > 1 THEN v_pos END;
        pack_size   := CASE WHEN v_n > 1 THEN v_n END;
        RETURN NEXT;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$function$;

-- ── web_confirmar ─────────────────────────────────────────────
-- Marca la orden como pagada. Idempotente. Si el pago llega con la reserva
-- ya vencida o liberada, confirma igual (la plata entró) y avisa con
-- excede_cupo si eso dejó el evento o algún tipo por encima del tope.
CREATE OR REPLACE FUNCTION public.web_confirmar(p_order_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ref         TEXT := btrim(COALESCE(p_order_ref, ''));
  v_event_id    UUID;
  v_max         INTEGER;
  v_total       INTEGER;
  v_confirmadas INTEGER;
  v_tardia      BOOLEAN;
  v_excede      BOOLEAN := false;
BEGIN
  SELECT r.event_id, COUNT(*) OVER () INTO v_event_id, v_total
  FROM public.ticket_registrations r
  WHERE r.order_ref = v_ref AND r.origen = 'web'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'orden_inexistente: %', v_ref USING ERRCODE = 'P0001';
  END IF;

  -- Misma fila que bloquea el trigger de capacidad: la cuenta de excede_cupo
  -- no se cruza con una reserva concurrente.
  SELECT max_capacity INTO v_max FROM public.events WHERE id = v_event_id FOR UPDATE;

  -- ¿Había filas que ya no ocupaban cupo? Esas vuelven a ocuparlo ahora.
  SELECT bool_or(NOT r.payment_verified
                 AND NOT public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at)
                 AND NOT COALESCE(r.is_banned, false))
  INTO v_tardia
  FROM public.ticket_registrations r
  WHERE r.order_ref = v_ref AND r.origen = 'web';

  UPDATE public.ticket_registrations r
  SET payment_verified = true,
      paid_at = COALESCE(r.paid_at, now())
  WHERE r.order_ref = v_ref
    AND r.origen = 'web'
    AND NOT r.payment_verified;
  GET DIAGNOSTICS v_confirmadas = ROW_COUNT;

  IF v_tardia THEN
    IF v_max IS NOT NULL THEN
      SELECT COUNT(*) > v_max INTO v_excede
      FROM public.ticket_registrations r
      WHERE r.event_id = v_event_id
        AND (public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified)
             OR public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at));
    END IF;

    IF NOT v_excede THEN
      SELECT COALESCE(bool_or(c.ocupadas > t.cupo), false) INTO v_excede
      FROM public.event_ticket_types t
      JOIN LATERAL (
        SELECT COUNT(*) AS ocupadas
        FROM public.ticket_registrations r
        WHERE r.ticket_type_id = t.id
          AND (public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified)
               OR public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at))
      ) c ON true
      WHERE t.cupo IS NOT NULL
        AND t.id IN (SELECT r.ticket_type_id FROM public.ticket_registrations r
                      WHERE r.order_ref = v_ref AND r.origen = 'web');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'confirmadas', v_confirmadas,
    'total', v_total,
    'ya_confirmada', v_confirmadas = 0,
    'excede_cupo', v_excede
  );
END;
$function$;

-- ── web_liberar ───────────────────────────────────────────────
-- Libera el cupo de una orden vencida o rechazada: vence sus reservas ahora.
-- Las filas quedan (con su token) pero no cuentan para nada y el lector las
-- rechaza. Idempotente. No libera una orden ya confirmada.
CREATE OR REPLACE FUNCTION public.web_liberar(p_order_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ref       TEXT := btrim(COALESCE(p_order_ref, ''));
  v_event_id  UUID;
  v_liberadas INTEGER;
BEGIN
  SELECT r.event_id INTO v_event_id
  FROM public.ticket_registrations r
  WHERE r.order_ref = v_ref AND r.origen = 'web'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'orden_inexistente: %', v_ref USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.events WHERE id = v_event_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.ticket_registrations r
              WHERE r.order_ref = v_ref AND r.origen = 'web' AND r.payment_verified) THEN
    RAISE EXCEPTION 'orden_confirmada: la orden % ya está pagada; para anular una entrada, rechazá el QR desde Gestión', v_ref
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ticket_registrations r
  SET mp_expires_at = now()
  WHERE r.order_ref = v_ref
    AND r.origen = 'web'
    AND NOT r.payment_verified
    AND (r.mp_expires_at IS NULL OR r.mp_expires_at > now());
  GET DIAGNOSTICS v_liberadas = ROW_COUNT;

  RETURN jsonb_build_object('liberadas', v_liberadas);
END;
$function$;

REVOKE ALL ON FUNCTION public.web_reservar(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.web_confirmar(TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.web_liberar(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_reservar(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_confirmar(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_liberar(TEXT) TO service_role;

-- ============================================================
-- 8. Contadores por tipo para el panel
-- ============================================================
-- Hermana de event_ticket_counts (020). security_invoker: manda la RLS de
-- ticket_registrations (staff). ticket_type_id NULL = entradas sin tipo.
DROP VIEW IF EXISTS public.event_ticket_type_counts;
CREATE VIEW public.event_ticket_type_counts
WITH (security_invoker = on) AS
SELECT
  event_id,
  ticket_type_id,
  MAX(ticket_type_nombre) AS ticket_type_nombre,
  COUNT(*) FILTER (
    WHERE public.entrada_vendida(is_banned, payment_provider, payment_verified)
  )::INTEGER AS vendidas,
  COUNT(*) FILTER (
    WHERE origen = 'web'
      AND public.entrada_vendida(is_banned, payment_provider, payment_verified)
  )::INTEGER AS vendidas_web,
  COUNT(*) FILTER (
    WHERE public.entrada_reservada(is_banned, payment_provider, payment_verified, mp_expires_at)
  )::INTEGER AS reservadas,
  COUNT(*) FILTER (
    WHERE public.entrada_vendida(is_banned, payment_provider, payment_verified)
      AND used_at IS NOT NULL
  )::INTEGER AS ingresadas
FROM public.ticket_registrations
GROUP BY event_id, ticket_type_id;

GRANT SELECT ON public.event_ticket_type_counts TO authenticated;

-- ============================================================
-- 9. Verificación
-- ============================================================
SELECT 'table: event_ticket_types' AS item,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_ticket_types') AS ok
UNION ALL
SELECT 'col: ticket_registrations.origen',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'ticket_registrations' AND column_name = 'origen')
UNION ALL
SELECT 'vendida(web sin pagar) = false',
       public.entrada_vendida(false, 'web', false) = false
UNION ALL
SELECT 'vendida(transferencia) = true',
       public.entrada_vendida(false, 'transferencia', false)
UNION ALL
SELECT 'reservada(web sin vencimiento) = true',
       public.entrada_reservada(false, 'web', false, NULL)
UNION ALL
SELECT 'reservada(mp sin vencimiento) = false',
       public.entrada_reservada(false, 'mercadopago', false, NULL) = false
UNION ALL
SELECT 'fn: web_reservar sin EXECUTE para anon',
       NOT has_function_privilege('anon', 'public.web_reservar(uuid, text, text, text, jsonb, timestamptz)', 'EXECUTE')
UNION ALL
SELECT 'fn: web_tipos_entrada con EXECUTE para anon',
       has_function_privilege('anon', 'public.web_tipos_entrada(uuid)', 'EXECUTE');
