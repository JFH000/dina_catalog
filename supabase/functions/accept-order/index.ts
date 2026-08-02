import { createClient } from 'jsr:@supabase/supabase-js@2'

const ODOO_URL = Deno.env.get('ODOO_URL')!
const ODOO_MCP_API_KEY = Deno.env.get('ODOO_MCP_API_KEY')!
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

interface OdooInvoiceLine {
  product_id?: number
  name: string
  quantity: number
  price_unit?: number
}

let mcpRequestId = 0

async function callOdooTool(toolName: string, args: Record<string, unknown>) {
  mcpRequestId++
  const res = await fetch(`${ODOO_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ODOO_MCP_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: mcpRequestId,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })
  if (!res.ok) {
    throw new Error(`Odoo MCP request failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json()
  if (json.error) {
    throw new Error(`Odoo MCP error: ${json.error.message ?? JSON.stringify(json.error)}`)
  }
  return json.result
}

function extractRecords(mcpResult: unknown): Array<Record<string, unknown>> {
  const content = (mcpResult as { content?: Array<{ text?: string }> })?.content
  const text = content?.[0]?.text
  if (!text) return []
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : ((parsed.records as Array<Record<string, unknown>>) ?? [])
}

function extractCreatedId(mcpResult: unknown): number {
  const content = (mcpResult as { content?: Array<{ text?: string }> })?.content
  const text = content?.[0]?.text
  if (!text) throw new Error('Respuesta inesperada de Odoo al crear la factura')
  const parsed = JSON.parse(text)
  const id = parsed.id ?? parsed[0]?.id ?? parsed
  if (typeof id !== 'number') throw new Error('No se pudo determinar el ID de la factura creada')
  return id
}

async function findOdooProduct(reference: string): Promise<{ id: number; name: string } | null> {
  const result = await callOdooTool('ai_tool_search', {
    model_name: 'product.product',
    domain: JSON.stringify([['default_code', '=', reference]]),
    fields: ['id', 'name'],
    limit: 1,
  })
  const records = extractRecords(result)
  return records.length > 0
    ? { id: records[0].id as number, name: records[0].name as string }
    : null
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

    let invoiceId: number
    let odooCreateIssued = false
    try {
      const items = order.items as OrderItem[]
      const { data: products } = await adminClient
        .from('products')
        .select('id, reference, name')
        .in('id', items.map(i => i.product_id))

      const lines: OdooInvoiceLine[] = []
      for (const item of items) {
        const product = products?.find(p => p.id === item.product_id)
        const reference = product?.reference ?? item.product_id
        const name = product?.name ?? 'Producto'
        const odooProduct = await findOdooProduct(reference)
        if (odooProduct) {
          lines.push({ product_id: odooProduct.id, name: odooProduct.name, quantity: item.quantity })
        } else {
          lines.push({
            name: `[${reference}] ${name} (no encontrado en Odoo)`,
            quantity: item.quantity,
            price_unit: 0,
          })
        }
      }

      odooCreateIssued = true
      const invoiceResult = await callOdooTool('ai_tool_create_record', {
        model_name: 'account.move',
        values: JSON.stringify({
          move_type: 'out_invoice',
          partner_id: ODOO_DEFAULT_PARTNER_ID,
          invoice_line_ids: lines.map(line => [0, 0, line]),
        }),
      })
      invoiceId = extractCreatedId(invoiceResult)
    } catch (odooError) {
      // Only revert the claim if the create call itself never went out — if it did, the invoice
      // may already exist in Odoo, so reverting to 'pending' here would let a retry create a duplicate.
      if (!odooCreateIssued) {
        await adminClient.from('orders').update({ status: 'pending' }).eq('id', orderId)
      }
      console.error('accept-order: Odoo call failed', { orderId, odooCreateIssued, error: (odooError as Error).message })
      return new Response(
        JSON.stringify({
          error: odooCreateIssued
            ? `La factura pudo haberse creado en Odoo pero no se pudo confirmar. Revisa manualmente en Odoo antes de reintentar. Detalle: ${(odooError as Error).message}`
            : `No se pudo crear la factura en Odoo: ${(odooError as Error).message}`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // The Odoo invoice now exists. From here on we must NOT revert status to 'pending' on failure,
    // since that would let a retry pass the atomic claim again and create a duplicate invoice in Odoo.
    let finalOrder = null
    let lastUpdateError = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await adminClient
          .from('orders')
          .update({ odoo_invoice_id: invoiceId, accepted_at: new Date().toISOString() })
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
      console.error({ orderId, invoiceId, lastUpdateError })
      return new Response(
        JSON.stringify({
          error: `La factura se creó en Odoo (ID: ${invoiceId}) pero no se pudo guardar en el pedido. Contacta soporte con este ID para vincularla manualmente.`,
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
