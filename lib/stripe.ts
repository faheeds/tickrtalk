import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const PLANS = {
  basic: {
    name: 'Basic',
    priceId: process.env.STRIPE_BASIC_PRICE_ID!,
    price: 19,
    features: ['Halal screening', 'Portfolio tracking', 'Personal watchlist', '1 broker connection'],
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    price: 49,
    features: ['Everything in Basic', 'AI algo engine', 'Auto-trading', 'All broker connections', 'Cron scans every 5 min'],
  },
} as const

export type PlanKey = keyof typeof PLANS
