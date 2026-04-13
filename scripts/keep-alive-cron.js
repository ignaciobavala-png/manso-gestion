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
    
    console.log(`✅ [${timestamp}] Ping exitoso`)
    return true
  } catch (error) {
    console.error(`❌ [${timestamp}] Error en ping:`, error.message)
    return false
  }
}

async function runContinuous(intervalMinutes = 10) {
  console.log('🚀 Iniciando keep-alive continuo para Supabase')
  console.log('📊 URL:', supabaseUrl.replace(/\/$/, ''))
  console.log(`⏰ Intervalo: Cada ${intervalMinutes} minutos`)
  console.log('📝 Presiona Ctrl+C para detener\n')
  
  const intervalMs = intervalMinutes * 60 * 1000
  
  while (true) {
    await pingSupabase()
    
    console.log(`⏳ Esperando ${intervalMinutes} minutos para el próximo ping...\n`)
    
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
}

async function main() {
  const args = process.argv.slice(2)
  const isContinuous = args.includes('--continuous') || args.includes('-c')
  const intervalArg = args.find(arg => arg.startsWith('--interval=')) || args.find(arg => arg.startsWith('-i='))
  
  let intervalMinutes = 10
  
  if (intervalArg) {
    const value = intervalArg.split('=')[1]
    intervalMinutes = parseInt(value, 10)
    
    if (isNaN(intervalMinutes) || intervalMinutes < 1) {
      console.error('❌ Error: Intervalo debe ser un número mayor a 0')
      process.exit(1)
    }
  }
  
  if (isContinuous) {
    await runContinuous(intervalMinutes)
  } else {
    const success = await pingSupabase()
    process.exit(success ? 0 : 1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Error fatal:', error)
    process.exit(1)
  })
}

export { pingSupabase, runContinuous }