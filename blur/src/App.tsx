import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Inicio from './pages/Inicio'
import Lineup from './pages/Lineup'
import Escenarios from './pages/Escenarios'
import Barra from './pages/Barra'
import Mapa from './pages/Mapa'
import Lanchas from './pages/Lanchas'
import Analogica from './pages/Analogica'

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Inicio />} />
        <Route path="lineup" element={<Lineup />} />
        <Route path="lineup/escenarios" element={<Escenarios />} />
        <Route path="barra" element={<Barra />} />
        <Route path="mapa" element={<Mapa />} />
        <Route path="mapa/lanchas" element={<Lanchas />} />
        <Route path="analogica" element={<Analogica />} />

        {/* Las URL de cuando Escenarios, Lanchas (y antes Transporte) eran pestañas propias. */}
        <Route path="escenarios" element={<Navigate to="/lineup/escenarios" replace />} />
        <Route path="lanchas" element={<Navigate to="/mapa/lanchas" replace />} />
        <Route path="transporte" element={<Navigate to="/mapa/lanchas" replace />} />

        <Route path="*" element={<Inicio />} />
      </Route>
    </Routes>
  )
}
