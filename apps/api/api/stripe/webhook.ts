import type { VercelRequest, VercelResponse } from '@vercel/node'
import { makeSupabase } from '../../_lib/supabase'

// POST /api/stripe/webhook
// Gestisce eventi Stripe: customer.subscription.created/updated/deleted
export const config = { api: { bodyParser: false } }

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeWebhookSecret || !stripeSecretKey) {
    return res.status(500).json({ error: 'Stripe env vars mancanti' })
  }

  // Verifica firma Stripe (importazione dinamica per evitare cold start pesante)
  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']
  if (!sig) return res.status(400).json({ error: 'stripe-signature header mancante' })

  let event: { type: string; data: { object: Record<string, unknown> } }

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeSecretKey)
    event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret) as unknown as typeof event
  } catch (err) {
    console.error('[stripe-webhook] firma non valida:', err)
    return res.status(400).json({ error: 'Firma webhook non valida' })
  }

  const supabase = makeSupabase()
  const obj = event.data.object

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const customerId = obj.customer as string
        const status = obj.status as string
        const subscriptionId = obj.id as string
        const items = obj.items as { data: { price: { id: string } }[] }
        const priceId = items?.data?.[0]?.price?.id

        const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID
        const proPriceId = process.env.STRIPE_PRO_PRICE_ID
        let piano: 'starter' | 'pro' | 'enterprise' = 'starter'
        if (priceId === proPriceId) piano = 'pro'
        else if (priceId !== starterPriceId) piano = 'enterprise'

        await supabase
          .from('tenants')
          .update({
            stripe_subscription_id: subscriptionId,
            subscription_status: status,
            piano,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'customer.subscription.deleted': {
        const customerId = obj.customer as string
        await supabase
          .from('tenants')
          .update({ subscription_status: 'canceled', piano: 'starter' })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'checkout.session.completed': {
        const customerId = obj.customer as string
        const subscriptionId = obj.subscription as string
        if (customerId && subscriptionId) {
          await supabase
            .from('tenants')
            .update({ stripe_subscription_id: subscriptionId })
            .eq('stripe_customer_id', customerId)
        }
        break
      }
    }
  } catch (err) {
    console.error(`[stripe-webhook] errore gestione ${event.type}:`, err)
    return res.status(500).json({ error: 'Errore interno' })
  }

  return res.status(200).json({ received: true })
}


