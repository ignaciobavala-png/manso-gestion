import { Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Inicio from './pages/Inicio'
import Lineup from './pages/Lineup'
import Escenarios from './pages/Escenarios'
import Barra from './pages/Barra'
import Mapa from './pages/Mapa'
import Transporte from './pages/Transporte'
import Analogica from './pages/Analogica'

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Inicio />} />
        <Route path="lineup" element={<Lineup />} />
        <Route path="escenarios" element={<Escenarios />} />
        <Route path="barra" element={<Barra />} />
        <Route path="mapa" element={<Mapa />} />
        <Route path="transporte" element={<Transporte />} />
        <Route path="analogica" element={<Analogica />} />
        <Route path="*" element={<Inicio />} />
      </Route>
    </Routes>
  )
}
