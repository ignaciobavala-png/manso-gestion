import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'

interface Ingreso {
  fecha: string | null
  monto_ars: number | null
  concepto: string
}

interface Egreso {
  fecha: string | null
  monto_ars: number | null
}

interface Inversion {
  socio: string | null
  monto_ars: number | null
}

const MES_KEY = (d: string) => {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
const MES_LABEL: Record<string, string> = {
  '2025-11': 'Nov 25', '2025-12': 'Dic 25',
  '2026-01': 'Ene 26', '2026-02': 'Feb 26', '2026-03': 'Mar 26',
  '2026-04': 'Abr 26', '2026-05': 'May 26', '2026-06': 'Jun 26',
}

const COLORS_SOCIOS: Record<string, string> = {
  Agus: '#34d399', Porti: '#60a5fa', Anita: '#f472b6', Fran: '#fbbf24',
}
const PIE_COLORS = ['#34d399', '#f472b6', '#60a5fa', '#fbbf24', '#a78bfa', '#fb923c']

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function categorizar(concepto: string): string {
  const c = concepto.toLowerCase()
  if (c.includes('barra') || c.includes('tragos') || c.includes('alcohol') || c.includes('vino') || c.includes('puerta')) return 'Barra / Eventos'
  if (c.includes('entrada') || c.includes('ticket')) return 'Entradas'
  if (c.includes('cowork') || c.includes('membresía') || c.includes('membresia')) return 'Cowork'
  if (c.includes('taller') || c.includes('cerámica') || c.includes('ceramica') || c.includes('cine') || c.includes('cata') || c.includes('pintura')) return 'Talleres'
  if (c.includes('seña') || c.includes('restante') || c.includes('alquiler')) return 'Alquileres / Señas'
  if (c.includes('aporte') || c.includes('inversión') || c.includes('inversion')) return 'Aportes socios'
  return 'Otros'
}

const MESES_ORDEN = Object.keys(MES_LABEL)

export default function Stats() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [inversiones, setInversiones] = useState<Inversion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('financial_ingresos').select('fecha, monto_ars, concepto'),
      supabase.from('financial_egresos').select('fecha, monto_ars'),
      supabase.from('financial_inversiones_socio').select('socio, monto_ars'),
    ]).then(([i, e, inv]) => {
      setIngresos((i.data ?? []) as Ingreso[])
      setEgresos((e.data ?? []) as Egreso[])
      setInversiones((inv.data ?? []) as Inversion[])
      setLoading(false)
    })
  }, [])

  // — Ingresos vs Egresos por mes —
  const porMes = MESES_ORDEN.map(mes => {
    const ing = ingresos
      .filter(r => r.fecha && MES_KEY(r.fecha) === mes && r.monto_ars)
      .reduce((s, r) => s + (r.monto_ars ?? 0), 0)
    const egr = egresos
      .filter(r => r.fecha && MES_KEY(r.fecha) === mes && r.monto_ars)
      .reduce((s, r) => s + (r.monto_ars ?? 0), 0)
    return { mes: MES_LABEL[mes], ingresos: Math.round(ing), egresos: Math.round(egr), balance: Math.round(ing - egr) }
  })

  // — Balance acumulado —
  let acum = 0
  const balanceAcum = porMes.map(m => {
    acum += m.balance
    return { mes: m.mes, acumulado: acum }
  })

  // — Breakdown ingresos por categoría —
  const porCategoria: Record<string, number> = {}
  ingresos.forEach(r => {
    if (!r.monto_ars) return
    const cat = categorizar(r.concepto)
    porCategoria[cat] = (porCategoria[cat] ?? 0) + r.monto_ars
  })
  const pieData = Object.entries(porCategoria)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)

  // — Inversión por socio —
  const porSocio: Record<string, number> = {}
  inversiones.forEach(r => {
    if (!r.socio || !r.monto_ars) return
    porSocio[r.socio] = (porSocio[r.socio] ?? 0) + r.monto_ars
  })
  const socioData = Object.entries(porSocio)
    .map(([socio, total]) => ({ socio, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total)

  // — KPIs globales —
  const totalIngresos = ingresos.reduce((s, r) => s + (r.monto_ars ?? 0), 0)
  const totalEgresos = egresos.reduce((s, r) => s + (r.monto_ars ?? 0), 0)
  const totalInv = inversiones.reduce((s, r) => s + (r.monto_ars ?? 0), 0)

  const tooltipStyle = {
    backgroundColor: '#18181b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: 12,
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 pb-28 max-w-4xl mx-auto space-y-8">
      <h1 className="text-white font-bold text-2xl">Stats financieras</h1>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ingresos totales', value: totalIngresos, color: 'text-emerald-400' },
          { label: 'Egresos totales', value: totalEgresos, color: 'text-red-400' },
          { label: 'Inversión socios', value: totalInv, color: 'text-blue-400' },
        ].map(k => (
          <div key={k.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-gray-400 text-xs mb-1">{k.label}</p>
            <p className={`font-bold text-lg ${k.color}`}>{fmt(k.value)}</p>
          </div>
        ))}
      </div>

      {/* Ingresos vs Egresos */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <h2 className="text-white font-semibold mb-4 text-sm">Ingresos vs Egresos por mes</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={porMes} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === 'number' ? fmt(v) : ''} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#34d399" radius={[4, 4, 0, 0]} />
            <Bar dataKey="egresos" name="Egresos" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Balance acumulado */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <h2 className="text-white font-semibold mb-4 text-sm">Balance neto acumulado</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={balanceAcum} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === 'number' ? fmt(v) : ''} />
            <Line
              type="monotone" dataKey="acumulado" name="Balance acum."
              stroke={acum >= 0 ? '#34d399' : '#f87171'}
              strokeWidth={2} dot={{ fill: '#34d399', r: 3 }} activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pie + Socios lado a lado en desktop, stacked en mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Breakdown ingresos */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <h2 className="text-white font-semibold mb-4 text-sm">Ingresos por categoría</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={2}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === 'number' ? fmt(v) : ''} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Inversión por socio */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <h2 className="text-white font-semibold mb-4 text-sm">Inversión por socio (ARS)</h2>
          <div className="space-y-3 mt-2">
            {socioData.map(s => {
              const pct = totalInv > 0 ? (s.total / totalInv) * 100 : 0
              const color = COLORS_SOCIOS[s.socio] ?? '#a78bfa'
              return (
                <div key={s.socio}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300 font-medium">{s.socio}</span>
                    <span className="text-gray-400">{fmt(s.total)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-gray-600 text-xs pb-4">
        Datos del Excel — nov 2025 a jun 2026 · Solo ARS (USD no incluido en totales)
      </p>
    </div>
  )
}
