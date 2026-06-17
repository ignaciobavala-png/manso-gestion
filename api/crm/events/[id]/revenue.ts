import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge'
}

const CORS_ORIGIN = 'https://manso-club.vercel.app'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': CORS_ORIGIN,
    }
  })
}

export default async function handler(req: Request): Promise<Response> {
  const secret = req.headers.get('x-crm-secret')
  if (!secret || secret !== process.env.CRM_SECRET) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Access-Control-Allow-Origin': CORS_ORIGIN }
    })
  }

  const url = new URL(req.url)
  // pathname: /api/crm/events/[id]/revenue
  const segments = url.pathname.split('/')
  const id = segments[4]

  if (!id) {
    return json({ error: 'Event ID requerido' }, 400)
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [ticketSalesResult, productSalesResult] = await Promise.all([
    supabase
      .from('ticket_sales')
      .select('*')
      .eq('event_id', id),
    supabase
      .from('sales')
      .select('*')
      .eq('event_id', id),
  ])

  if (ticketSalesResult.error) {
    return json({ error: ticketSalesResult.error.message }, 500)
  }
  if (productSalesResult.error) {
    return json({ error: productSalesResult.error.message }, 500)
  }

  const ticket_sales = ticketSalesResult.data ?? []
  const product_sales = productSalesResult.data ?? []

  const tickets_revenue = ticket_sales.reduce((sum, row) => sum + Number(row.price), 0)
  const products_revenue = product_sales.reduce((sum, row) => sum + Number(row.total), 0)

  return json({
    ticket_sales,
    product_sales,
    totals: {
      tickets_revenue,
      products_revenue,
      total_revenue: tickets_revenue + products_revenue,
      tickets_count: ticket_sales.length,
    }
  })
}
