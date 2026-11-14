import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Inicio from './pages/Inicio'

// La portada se carga entera; el resto de las pantallas se baja recién al entrar,
// para que el primer JS no traiga todo el sitio (ver Analógica y el hero).
const Lineup = lazy(() => import('./pages/Lineup'))
const Escenarios = lazy(() => import('./pages/Escenarios'))
const Barra = lazy(() => import('./pages/Barra'))
const Mapa = lazy(() => import('./pages/Mapa'))
const Analogica = lazy(() => import('./pages/Analogica'))
const Revelado = lazy(() => import('./pages/Revelado'))
const Rollo = lazy(() => import('./pages/Rollo'))
const Cuenta = lazy(() => import('./pages/Cuenta'))

export default function App() {
  return (
    <Suspense fallback={null}>
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Inicio />} />
        <Route path="lineup" element={<Lineup />} />
        <Route path="lineup/escenarios" element={<Escenarios />} />
        <Route path="barra" element={<Barra />} />
        <Route path="mapa" element={<Mapa />} />
        <Route path="mapa/lanchas" element={<Navigate to="/mapa#lanchas" replace />} />
        <Route path="analogica" element={<Analogica />} />
        <Route path="analogica/revelado" element={<Revelado />} />
        {/* Las fotos de un rollo: el de este teléfono, o el del link personal que manda la organización. */}
        <Route path="cuenta" element={<Cuenta />} />
        <Route path="rollo" element={<Rollo />} />
        <Route path="rollo/:token" element={<Rollo />} />

        {/* Las URL de cuando Escenarios, Lanchas (y antes Transporte) eran pestañas propias. */}
        <Route path="escenarios" element={<Navigate to="/lineup/escenarios" replace />} />
        <Route path="lanchas" element={<Navigate to="/mapa/lanchas" replace />} />
        <Route path="transporte" element={<Navigate to="/mapa/lanchas" replace />} />

        <Route path="*" element={<Inicio />} />
      </Route>
    </Routes>
    </Suspense>
  )
}
