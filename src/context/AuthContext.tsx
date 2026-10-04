import { createContext, useContext, useEffect, useRef, useState } from 'react'
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

  // Los usuarios configurados sólo hacen falta para iniciar sesión, así que
  // se cargan aparte y signIn los espera. Antes el spinner de todo el panel
  // esperaba también a esta consulta.
  const usernamesCargados = useRef<Promise<void> | null>(null)

  useEffect(() => {
    usernamesCargados.current = refreshUsernames().catch(() => {})

    let resuelto = false
    const terminar = (s: Session | null) => {
      setSession(s)
      if (!resuelto) {
        resuelto = true
        setIsLoading(false)
      }
    }

    // INITIAL_SESSION llega apenas el cliente termina de leer la sesión
    // guardada, y es el camino normal para soltar el spinner.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      terminar(session)
    })

    // getSession() puede tirar en vez de resolver: Supabase sincroniza la
    // sesión entre pestañas con un lock del navegador, y con varias pestañas
    // del panel abiertas (barra, entradas, home) una le roba el lock a otra
    // y la perdedora recibe un NavigatorLockAcquireTimeoutError. Sin catch,
    // el panel quedaba girando para siempre hasta recargar. Se reintenta
    // una vez y, si vuelve a fallar, se sigue sin sesión (va al login).
    const leerSesion = async () => {
      for (let intento = 0; intento < 2; intento++) {
        try {
          const { data } = await supabase.auth.getSession()
          return terminar(data.session)
        } catch (err) {
          console.warn('[auth] getSession falló', err)
        }
      }
      // Sólo si nadie resolvió antes: si el evento ya trajo una sesión
      // válida, un getSession fallido no puede mandar al login.
      if (!resuelto) terminar(null)
    }
    leerSesion()

    // Último recurso si ni el evento ni getSession responden (red colgada
    // al refrescar el token): un spinner eterno es peor que pedir login.
    const plazo = setTimeout(() => {
      if (!resuelto) {
        console.warn('[auth] la sesión no respondió a tiempo')
        terminar(null)
      }
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(plazo)
    }
  }, [])

  const signIn = async (username: string, password: string): Promise<Role> => {
    await usernamesCargados.current
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
