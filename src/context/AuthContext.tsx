import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const CONTROL_EMAIL = 'control@manso.internal'
const EMPLEADO_EMAIL = 'empleado@manso.internal'

type Role = 'control' | 'empleado' | null

interface AuthContextType {
  session: Session | null
  role: Role
  isLoading: boolean
  signIn: (pin: string) => Promise<Role>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function getRoleFromEmail(email: string | undefined): Role {
  if (email === CONTROL_EMAIL) return 'control'
  if (email === EMPLEADO_EMAIL) return 'empleado'
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (pin: string): Promise<Role> => {
    // Intentar con cuenta de Control
    const { error: controlError } = await supabase.auth.signInWithPassword({
      email: CONTROL_EMAIL,
      password: pin,
    })
    if (!controlError) return 'control'

    // Intentar con cuenta de Empleados
    const { error: empleadoError } = await supabase.auth.signInWithPassword({
      email: EMPLEADO_EMAIL,
      password: pin,
    })
    if (!empleadoError) return 'empleado'

    return null
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const role = getRoleFromEmail(session?.user?.email)

  return (
    <AuthContext.Provider value={{ session, role, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
