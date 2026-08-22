import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import Login from './pages/Login'
import Home from './pages/Home'
import Barra from './pages/Barra'
import Entradas from './pages/Entradas'
import RegistroEntrada from './pages/public/RegistroEntrada'
import MiEntrada from './pages/public/MiEntrada'
import PagoRetorno from './pages/public/PagoRetorno'
import Carta from './pages/public/Carta'
import Inicio from './pages/public/Inicio'
import Comunidad from './pages/admin/Comunidad'
import VistasPublicas from './pages/admin/VistasPublicas'
import Stats from './pages/admin/Stats'
import CineclubAdmin from './pages/admin/Cineclub'
import Cineclub from './pages/public/Cineclub'
import Cowork from './pages/public/Cowork'
import Cartel from './pages/admin/Cartel'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
                  <Stats />
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
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
