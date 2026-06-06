import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const CONTROL_EMAIL = 'control@manso.internal'
const EMPLEADO_EMAIL = 'empleado@manso.internal'
const OWNER_EMAIL = 'owner@manso.internal'

const DEFAULT_USERNAMES = { control: 'control22', empleados: 'empleados', owner: 'ah33' }

type Role = 'owner' | 'control' | 'empleado' | null

interface AuthContextType {
  session: Session | null
  role: Role
  isLoading: boolean
  signIn: (username: string, password: string) => Promise<Role>
  signOut: () => Promise<void>
  usernames: { control: string; empleados: string; owner: string }
  refreshUsernames: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function getRoleFromEmail(email: string | undefined): Role {
  if (email === OWNER_EMAIL) return 'owner'
  if (email === CONTROL_EMAIL) return 'control'
  if (email === EMPLEADO_EMAIL) return 'empleado'
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [usernames, setUsernames] = useState<{ control: string; empleados: string; owner: string }>(DEFAULT_USERNAMES)

  const refreshUsernames = async () => {
    const { data } = await supabase
      .from('venue_config')
      .select('control_username, empleado_username, owner_username')
      .eq('id', 1)
      .single()

    if (data) {
      setUsernames({
        control: data.control_username || DEFAULT_USERNAMES.control,
        empleados: data.empleado_username || DEFAULT_USERNAMES.empleados,
        owner: data.owner_username || DEFAULT_USERNAMES.owner,
      })
    }
  }

  useEffect(() => {
    Promise.all([
      supabase.auth.getSession(),
      refreshUsernames(),
    ]).then(([{ data: { session } }]) => {
      setSession(session)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (username: string, password: string): Promise<Role> => {
    const u = username.toLowerCase().trim()
    let email: string | null = null

    if (u === usernames.owner.toLowerCase()) email = OWNER_EMAIL
    else if (u === usernames.control.toLowerCase()) email = CONTROL_EMAIL
    else if (u === usernames.empleados.toLowerCase()) email = EMPLEADO_EMAIL

    if (!email) return null

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return null

    return getRoleFromEmail(email)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const role = getRoleFromEmail(session?.user?.email)

  return (
    <AuthContext.Provider value={{ session, role, isLoading, signIn, signOut, usernames, refreshUsernames }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
