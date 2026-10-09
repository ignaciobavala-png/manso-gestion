import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { esVendida, esReservada, type EstadoEntrada } from './entradas'

/**
 * Desglose de entradas por tipo (migración 039), con las vendidas por la web
 * incluidas. Las pantallas que ya tienen las filas en memoria lo calculan con
 * contarPorTipo; las que no, lo leen de la vista event_ticket_type_counts con
 * useConteoPorTipo. Las dos usan la misma regla de "vendida" que la DB.
 */

export interface FilaConteoTipo {
  clave: string
  nombre: string
  vendidas: number
  vendidasWeb: number
  reservadas: number
}

const SIN_TIPO = 'Sin tipo'

/** Desde filas ya cargadas. Vacío si ninguna entrada del evento tiene tipo. */
export function contarPorTipo(
  rows: (EstadoEntrada & { ticket_type_id: string | null; ticket_type_nombre: string | null; origen: string })[]
): FilaConteoTipo[] {
  if (!rows.some(r => r.ticket_type_nombre)) return []

  const porClave = new Map<string, FilaConteoTipo>()
  for (const r of rows) {
    const clave = r.ticket_type_id ?? r.ticket_type_nombre ?? SIN_TIPO
    const fila = porClave.get(clave) ?? {
      clave,
      nombre: r.ticket_type_nombre ?? SIN_TIPO,
      vendidas: 0,
      vendidasWeb: 0,
      reservadas: 0,
    }
    if (esVendida(r)) {
      fila.vendidas++
      if (r.origen === 'web') fila.vendidasWeb++
    } else if (esReservada(r)) {
      fila.reservadas++
    }
    porClave.set(clave, fila)
  }
  return [...porClave.values()].filter(f => f.vendidas + f.reservadas > 0)
}

interface FilaVista {
  event_id: string
  ticket_type_id: string | null
  ticket_type_nombre: string | null
  vendidas: number
  vendidas_web: number
  reservadas: number
}

/** Desglose de la vista, agrupado por evento. Vacío para eventos sin tipos. */
export function agruparVista(data: FilaVista[]): Record<string, FilaConteoTipo[]> {
  const conTipo = new Set(data.filter(d => d.ticket_type_id || d.ticket_type_nombre).map(d => d.event_id))
  const out: Record<string, FilaConteoTipo[]> = {}
  for (const d of data) {
    if (!conTipo.has(d.event_id) || d.vendidas + d.reservadas === 0) continue
    ;(out[d.event_id] ??= []).push({
      clave: d.ticket_type_id ?? d.ticket_type_nombre ?? SIN_TIPO,
      nombre: d.ticket_type_nombre ?? SIN_TIPO,
      vendidas: d.vendidas,
      vendidasWeb: d.vendidas_web,
      reservadas: d.reservadas,
    })
  }
  return out
}

export async function leerConteoPorTipo(eventIds?: string[]): Promise<Record<string, FilaConteoTipo[]>> {
  let q = supabase
    .from('event_ticket_type_counts')
    .select('event_id, ticket_type_id, ticket_type_nombre, vendidas, vendidas_web, reservadas')
  if (eventIds) q = q.in('event_id', eventIds)
  const { data } = await q
  return agruparVista((data ?? []) as FilaVista[])
}

export function useConteoPorTipo(eventId: string | undefined): FilaConteoTipo[] {
  const [filas, setFilas] = useState<FilaConteoTipo[]>([])
  useEffect(() => {
    if (!eventId) return
    let vigente = true
    leerConteoPorTipo([eventId]).then(r => { if (vigente) setFilas(r[eventId] ?? []) })
    return () => { vigente = false }
  }, [eventId])
  return filas
}
