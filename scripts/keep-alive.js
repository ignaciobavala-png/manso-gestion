#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Variables de entorno faltantes')
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl)
  console.error('   VITE_SUPABASE_ANON_KEY:', !!supabaseAnonKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function pingSupabase() {
  const timestamp = new Date().toISOString()
  
  try {
    console.log(`🔄 [${timestamp}] Ping a Supabase...`)
    
    const { data, error } = await supabase
      .from('products')
      .select('count')
      .limit(1)
    
    if (error) {
      throw error
    }
    
    console.log(`✅ [${timestamp}] Ping exitoso. Respuesta:`, data)
    return true
  } catch (error) {
    console.error(`❌ [${timestamp}] Error en ping:`, error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Iniciando script keep-alive para Supabase')
  console.log('📊 URL:', supabaseUrl.replace(/\/$/, ''))
  console.log('⏰ Intervalo: Cada 10 minutos')
  
  const success = await pingSupabase()
  
  if (success) {
    console.log('✨ Script completado exitosamente')
    process.exit(0)
  } else {
    console.log('💥 Script falló')
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { pingSupabase }