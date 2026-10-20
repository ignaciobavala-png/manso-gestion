import { lazy, Suspense, type ComponentType } from 'react'
import Cargando from './components/Cargando'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RegistroEntrada from './pages/public/RegistroEntrada'
import MiEntrada from './pages/public/MiEntrada'
import PagoRetorno from './pages/public/PagoRetorno'
import Inicio from './pages/public/Inicio'
import { importarConRecarga } from './lib/importarConRecarga'

// Lo público de la compra (inicio, registro, mi entrada, retorno de pago) va
// en el paquete principal: es lo que abre el que está en la calle o en la
// puerta, y /mi-entrada tiene que andar sin señal. El resto —el panel y las
// pantallas de cowork, carta y cineclub— se baja recién al entrar.
const pagina = (importar: () => Promise<{ default: ComponentType }>) =>
  lazy(() => importarConRecarga(importar))

const AdminLayout = pagina(() => import('./components/AdminLayout'))
const Login = pagina(() => import('./pages/Login'))
const Home = pagina(() => import('./pages/Home'))
const Barra = pagina(() => import('./pages/Barra'))
const Entradas = pagina(() => import('./pages/Entradas'))
const Carta = pagina(() => import('./pages/public/Carta'))
const Comunidad = pagina(() => import('./pages/admin/Comunidad'))
const VistasPublicas = pagina(() => import('./pages/admin/VistasPublicas'))
const CineclubAdmin = pagina(() => import('./pages/admin/Cineclub'))
const Cineclub = pagina(() => import('./pages/public/Cineclub'))
const Cowork = pagina(() => import('./pages/public/Cowork'))
const CarnetCowork = pagina(() => import('./pages/public/Carnet'))
const Sala = pagina(() => import('./pages/public/Sala'))
const Llegada = pagina(() => import('./pages/public/Llegada'))
const Cartel = pagina(() => import('./pages/admin/Cartel'))
const CoworkAdmin = pagina(() => import('./pages/admin/Cowork'))

// Stats arrastra recharts (~300 KB con d3) y solo la abre el owner: va en
// su propio chunk para que no lo baje el que entra a buscar su QR.
const Contabilidad = lazy(() => importarConRecarga(() => import('./pages/admin/Contabilidad')))
const Stats = lazy(() => importarConRecarga(() => import('./pages/admin/Stats')))

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Cargando /></div>}>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />

          {/* Rutas públicas */}
          <Route path="/registro" element={<RegistroEntrada />} />
          <Route path="/registro/:slug" element={<RegistroEntrada />} />
          <Route path="/mi-entrada" element={<MiEntrada />} />
          {/* Retorno de Mercado Pago. Fuera de /registro/* para no colisionar
              con /registro/:slug si un evento tuviera el slug "pago". */}
          <Route path="/pago" element={<PagoRetorno />} />
          <Route path="/carta" element={<Carta />} />
          <Route path="/cineclub" element={<Cineclub />} />
          <Route path="/cowork" element={<Cowork />} />
          {/* El carnet del coworker y el QR de la puerta de cada sala. Van
              cortas a propósito: el token ya es largo y estas dos URLs se
              tipean, se mandan por WhatsApp y se imprimen en un cartel. */}
          <Route path="/c/:token" element={<CarnetCowork />} />
          <Route path="/sala/:token" element={<Sala />} />
          {/* El cartel de la entrada: registra la visita del día sin ocupar
              ninguna sala. */}
          <Route path="/llegue/:token" element={<Llegada />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="home"
              element={
                <ProtectedRoute requiredRole="control">
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route path="barra" element={<Barra />} />
            <Route path="entradas" element={<Entradas />} />
            <Route
              path="comunidad"
              element={
                <ProtectedRoute requiredRole="owner">
                  <Comunidad />
                </ProtectedRoute>
              }
            />
            <Route
              path="stats"
              element={
                <ProtectedRoute requiredRole="owner">
                  <Suspense fallback={<p className="text-gray-400 text-sm text-center py-10">Cargando…</p>}>
                    <Stats />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="contabilidad"
              element={
                <ProtectedRoute requiredRole="owner">
                  <Suspense fallback={<p className="text-gray-400 text-sm text-center py-10">Cargando…</p>}>
                    <Contabilidad />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="publico"
              element={
                <ProtectedRoute requiredRole="control">
                  <VistasPublicas />
                </ProtectedRoute>
              }
            />
            <Route
              path="cowork"
              element={
                <ProtectedRoute requiredRole="control">
                  <CoworkAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="cartel"
              element={
                <ProtectedRoute requiredRole="control">
                  <Cartel />
                </ProtectedRoute>
              }
            />
            <Route
              path="cineclub"
              element={
                <ProtectedRoute requiredRole="owner">
                  <CineclubAdmin />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Cualquier otra ruta va a la landing pública */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
