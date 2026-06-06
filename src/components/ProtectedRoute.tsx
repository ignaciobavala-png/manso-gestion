import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  requiredRole?: 'owner' | 'control' | 'empleado'
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, role, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // owner tiene acceso a todo lo de control
  if (requiredRole === 'owner' && role !== 'owner') {
    return <Navigate to="/admin/home" replace />
  }

  // control y owner tienen acceso a rutas de control; empleado no
  if (requiredRole === 'control' && role !== 'control' && role !== 'owner') {
    return <Navigate to="/admin/barra" replace />
  }

  return <>{children}</>
}
