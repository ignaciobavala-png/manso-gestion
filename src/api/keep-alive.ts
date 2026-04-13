import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge'
}

export async function GET() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Missing environment variables',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const timestamp = new Date().toISOString()

  try {
    const { data, error } = await supabase
      .from('products')
      .select('count')
      .limit(1)

    if (error) {
      throw error
    }

    console.log(`✅ [${timestamp}] Ping exitoso a Supabase`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Supabase ping successful',
        timestamp,
        data
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error(`❌ [${timestamp}] Error en ping:`, error.message)

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}