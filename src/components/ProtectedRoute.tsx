import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  requiredRole?: 'control' | 'empleado'
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, role, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Si la ruta requiere Control y el usuario es Empleado, redirigir a Barra
  if (requiredRole === 'control' && role !== 'control') {
    return <Navigate to="/admin/barra" replace />
  }

  return <>{children}</>
}
