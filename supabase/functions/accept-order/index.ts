import { createClient } from 'jsr:@supabase/supabase-js@2'

const ODOO_URL = Deno.env.get('ODOO_URL')!
const ODOO_DB = Deno.env.get('ODOO_DB')!
const ODOO_USER = Deno.env.get('ODOO_USER')!
const ODOO_API_KEY = Deno.env.get('ODOO_API_KEY')!
const ODOO_DEFAULT_PARTNER_ID = Number(Deno.env.get('ODOO_DEFAULT_PARTNER_ID')!)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderItem {
  product_id: string
  quantity: number
}

interface OdooOrderLine {
  product_id?: number
  name: string
  product_uom_qty: number
  price_unit?: number
}

let jsonRpcId = 0

async function odooCall(service: string, method: string, args: unknown[]) {
  jsonRpcId++
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: jsonRpcId }),
  })
  if (!res.ok) {
    throw new Error(`Odoo JSON-RPC request failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json()
  if (json.error) {
    const message = json.error.data?.message ?? json.error.message ?? JSON.stringify(json.error)
    throw new Error(`Odoo error: ${message}`)
  }
  return json.result
}

let cachedUid: number | null = null

async function odooAuthenticate(): Promise<number> {
  if (cachedUid !== null) return cachedUid
  const uid = await odooCall('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}])
  if (!uid) throw new Error('Odoo authentication failed')
  cachedUid = uid as number
  return cachedUid
}

async function odooExecuteKw(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
) {
  const uid = await odooAuthenticate()
  return odooCall('object', 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])
}

async function findOdooProduct(reference: string): Promise<{ id: number; name: string } | null> {
  const records = (await odooExecuteKw(
    'product.product',
    'search_read',
    [[['default_code', '=', reference]]],
    { fields: ['id', 'name'], limit: 1 }
  )) as Array<{ id: number; name: string }>
  return records.length > 0 ? { id: records[0].id, name: records[0].name } : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('*, catalogs!inner(owner_id)')
      .eq('id', orderId)
      .single()
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (order.catalogs.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized for this order' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: claimed, error: claimError } = await adminClient
      .from('orders')
      .update({ status: 'accepted' })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select()
      .single()
    if (claimError || !claimed) {
      return new Response(JSON.stringify({ error: 'Este pedido ya fue gestionado' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let quotationId: number
    let odooCreateIssued = false
    try {
      const items = order.items as OrderItem[]
      const { data: products } = await adminClient
        .from('products')
        .select('id, reference, name')
        .in('id', items.map(i => i.product_id))

      const lines: OdooOrderLine[] = []
      for (const item of items) {
        const product = products?.find(p => p.id === item.product_id)
        const reference = product?.reference ?? item.product_id
        const name = product?.name ?? 'Producto'
        const odooProduct = await findOdooProduct(reference)
        if (odooProduct) {
          lines.push({ product_id: odooProduct.id, name: odooProduct.name, product_uom_qty: item.quantity })
        } else {
          lines.push({
            name: `[${reference}] ${name} (no encontrado en Odoo)`,
            product_uom_qty: item.quantity,
            price_unit: 0,
          })
        }
      }

      odooCreateIssued = true
      // sale.order defaults to state='draft' ("Cotización") on creation — we never call
      // action_confirm, so it stays a quotation, matching what was requested.
      quotationId = (await odooExecuteKw('sale.order', 'create', [{
        partner_id: ODOO_DEFAULT_PARTNER_ID,
        order_line: lines.map(line => [0, 0, line]),
      }])) as number
    } catch (odooError) {
      // Only revert the claim if the create call itself never went out — if it did, the quotation
      // may already exist in Odoo, so reverting to 'pending' here would let a retry create a duplicate.
      if (!odooCreateIssued) {
        await adminClient.from('orders').update({ status: 'pending' }).eq('id', orderId)
      }
      console.error('accept-order: Odoo call failed', { orderId, odooCreateIssued, error: (odooError as Error).message })
      return new Response(
        JSON.stringify({
          error: odooCreateIssued
            ? `La cotización pudo haberse creado en Odoo pero no se pudo confirmar. Revisa manualmente en Odoo antes de reintentar. Detalle: ${(odooError as Error).message}`
            : `No se pudo crear la cotización en Odoo: ${(odooError as Error).message}`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // The Odoo quotation now exists. From here on we must NOT revert status to 'pending' on failure,
    // since that would let a retry pass the atomic claim again and create a duplicate quotation in Odoo.
    let finalOrder = null
    let lastUpdateError = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await adminClient
          .from('orders')
          .update({ odoo_quotation_id: quotationId, accepted_at: new Date().toISOString() })
          .eq('id', orderId)
          .select()
          .single()
        if (error) throw error
        finalOrder = data
        lastUpdateError = null
        break
      } catch (err) {
        lastUpdateError = err
      }
    }

    if (lastUpdateError || !finalOrder) {
      console.error({ orderId, quotationId, lastUpdateError })
      return new Response(
        JSON.stringify({
          error: `La cotización se creó en Odoo (ID: ${quotationId}) pero no se pudo guardar en el pedido. Contacta soporte con este ID para vincularla manualmente.`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ order: finalOrder }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
