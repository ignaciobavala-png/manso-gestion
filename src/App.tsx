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
import Comunidad from './pages/admin/Comunidad'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Rutas públicas */}
          <Route path="/registro" element={<RegistroEntrada />} />
          <Route path="/mi-entrada" element={<MiEntrada />} />

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
                <ProtectedRoute requiredRole="control">
                  <Comunidad />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Cualquier otra ruta va a login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
