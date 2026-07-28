/// <reference types="node" />
import type { SupabaseClient } from '@supabase/supabase-js'

// Cliente mínimo de Mercado Pago sobre fetch. Sin SDK a propósito: el SDK
// oficial es Node-only y estas funciones corren en runtime edge, igual que
// el resto de api/. El contrato de los endpoints usados acá fue verificado
// contra la API real (POST /checkout/preferences, GET /v1/payments/{id},
// GET /v1/payments/search).

const MP_API = 'https://api.mercadopago.com'

export function accessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) throw new Error('MP_ACCESS_TOKEN no está configurado')
  return token
}

async function mpFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

// ── Preferences ──────────────────────────────────────────────────────────────

export interface PreferenceItem {
  id: string
  title: string
  quantity: number
  unit_price: number
  currency_id: 'ARS'
}

export interface CreatePreferenceInput {
  items: PreferenceItem[]
  externalReference: string
  payerEmail: string
  baseUrl: string
  expiresAt: Date
  metadata?: Record<string, unknown>
}

export interface Preference {
  id: string
  init_point: string
  sandbox_init_point: string
}

export async function createPreference(input: CreatePreferenceInput): Promise<Preference> {
  const { items, externalReference, payerEmail, baseUrl, expiresAt, metadata } = input

  const res = await mpFetch('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items,
      payer: { email: payerEmail },
      external_reference: externalReference,
      notification_url: `${baseUrl}/api/mp/webhook`,
      back_urls: {
        success: `${baseUrl}/registro/pago?ref=${encodeURIComponent(externalReference)}`,
        pending: `${baseUrl}/registro/pago?ref=${encodeURIComponent(externalReference)}`,
        failure: `${baseUrl}/registro/pago?ref=${encodeURIComponent(externalReference)}`,
      },
      auto_return: 'approved',
      expires: true,
      expiration_date_to: expiresAt.toISOString(),
      metadata: metadata ?? {},
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`MP preference ${res.status}: ${detail.slice(0, 500)}`)
  }

  return res.json() as Promise<Preference>
}

// ── Payments ─────────────────────────────────────────────────────────────────

export interface MpPayment {
  id: number | string
  status: string
  status_detail?: string
  external_reference?: string
  transaction_amount?: number
  payer?: { email?: string }
  fee_details?: { amount?: number }[]
  transaction_details?: { net_received_amount?: number }
}

export async function getPayment(paymentId: string): Promise<MpPayment | null> {
  const res = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`)
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`MP payment ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  return res.json() as Promise<MpPayment>
}

/**
 * Busca los pagos de una orden. Es el camino de reconciliación que NO depende
 * del webhook: si la notificación nunca llegó o el webhook no está configurado,
 * esto consulta el estado real igual.
 */
export async function searchPaymentsByReference(externalReference: string): Promise<MpPayment[]> {
  const qs = new URLSearchParams({
    external_reference: externalReference,
    sort: 'date_created',
    criteria: 'desc',
  })
  const res = await mpFetch(`/v1/payments/search?${qs}`)
  if (!res.ok) {
    throw new Error(`MP search ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const body = await res.json() as { results?: MpPayment[] }
  return body.results ?? []
}

/** Entre varios pagos de la misma orden, el aprobado manda. */
export function pickRelevantPayment(payments: MpPayment[]): MpPayment | null {
  if (payments.length === 0) return null
  return payments.find(p => p.status === 'approved') ?? payments[0]
}

// ── Aplicar resultado a la DB ────────────────────────────────────────────────

/**
 * Única vía para persistir el resultado de un pago: delega en el RPC
 * mp_apply_payment, que es idempotente y hace la transición de estado.
 * La usan el webhook y el endpoint de estado por igual.
 */
export async function applyPayment(
  supabase: SupabaseClient,
  payment: MpPayment
): Promise<number> {
  if (!payment.external_reference) return 0

  const feeAmount = (payment.fee_details ?? [])
    .reduce((acc, f) => acc + (f.amount ?? 0), 0)

  const { data, error } = await supabase.rpc('mp_apply_payment', {
    p_payment_id: String(payment.id),
    p_external_reference: payment.external_reference,
    p_status: payment.status,
    p_status_detail: payment.status_detail ?? null,
    p_amount: payment.transaction_amount ?? null,
    p_fee_amount: feeAmount || null,
    p_net_amount: payment.transaction_details?.net_received_amount ?? null,
    p_payer_email: payment.payer?.email ?? null,
    p_raw: payment as unknown as Record<string, unknown>,
  })

  if (error) throw new Error(`mp_apply_payment: ${error.message}`)
  return (data as number) ?? 0
}

// ── Firma del webhook ────────────────────────────────────────────────────────

/**
 * Valida el header x-signature (formato "ts=...,v1=...") con HMAC-SHA256
 * sobre el manifest id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * Si MP_WEBHOOK_SECRET no está configurado devuelve 'skipped': el webhook
 * sigue siendo seguro porque nunca confía en el body — vuelve a consultar el
 * pago contra la API de MP con nuestro access token. La firma es una capa
 * extra que se activa sola cuando el secret exista.
 */
export type SignatureCheck = 'valid' | 'invalid' | 'skipped'

export async function verifyWebhookSignature(
  req: Request,
  dataId: string
): Promise<SignatureCheck> {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return 'skipped'

  const signature = req.headers.get('x-signature')
  const requestId = req.headers.get('x-request-id')
  if (!signature) return 'invalid'

  const parts = new Map(
    signature.split(',')
      .map(p => p.split('=', 2))
      .filter((p): p is [string, string] => p.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()])
  )

  const ts = parts.get('ts')
  const v1 = parts.get('v1')
  if (!ts || !v1) return 'invalid'

  let manifest = ''
  if (dataId) manifest += `id:${dataId.toLowerCase()};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(manifest)
  )
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return timingSafeEqual(computed, v1) ? 'valid' : 'invalid'
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
