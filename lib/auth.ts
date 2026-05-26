import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from './supabase'

export async function requireUser() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  return userId
}

export async function getUserRecord(userId: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export async function isProUser(userId: string): Promise<boolean> {
  const user = await getUserRecord(userId)
  if (!user) return false
  if (user.subscription_tier === 'pro' && user.subscription_status === 'active') return true
  // Also allow during trial for all tiers — trial users get Pro features
  if (user.subscription_status === 'trial' && new Date(user.trial_ends_at) > new Date()) return true
  return false
}

export async function getActiveBrokerConnection(userId: string, broker = 'alpaca') {
  const { data } = await supabaseAdmin
    .from('brokerage_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('broker', broker)
    .eq('is_active', true)
    .single()
  return data
}
