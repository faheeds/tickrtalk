'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AlgoPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(d => { setUserInfo(d); setLoading(false) })
  }, [])

  if (loading) return <div className="text-slate-400 animate-pulse">Loading…</div>

  const isPro = userInfo?.subscription_tier === 'pro' && userInfo?.subscription_status === 'active'

  if (!isPro) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="text-5xl mb-4">🤖</div>
      <h2 className="text-2xl font-bold text-white mb-3">Algo Engine — Pro Feature</h2>
      <p className="text-slate-400 mb-6">
        Automated trading with the TickrTalk algo engine requires a Pro subscription.
        It runs daily scans, generates signals, and executes bracket orders automatically.
      </p>
      <Link href="/dashboard/settings?tab=billing" className="btn-primary">Upgrade to Pro — $49/mo</Link>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Algo Engine</h1>
        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full font-medium">Pro Active</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Strategy info */}
        <div className="card">
          <h3 className="text-white font-semibold mb-3">📊 Strategy</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between"><span className="text-slate-400">Mode</span><span>Momentum + Mean Reversion</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Universe</span><span>Halal-screened stocks only</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Risk per trade</span><span>2% of portfolio</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Scan frequency</span><span>Daily at 9:30 AM ET</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Order type</span><span>Bracket (entry + stop + target)</span></div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card">
          <h3 className="text-white font-semibold mb-3">⏰ Cron Schedule</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between"><span className="text-slate-400">Daily scan</span><span>9:30 AM ET (Mon–Fri)</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Mark-to-market</span><span>4:00 PM ET (Mon–Fri)</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Next scan</span><span className="text-emerald-400">Tomorrow 9:30 AM</span></div>
          </div>
        </div>
      </div>

      {/* Signals log placeholder */}
      <div className="card">
        <h3 className="text-white font-semibold mb-4">Recent Signals</h3>
        <div className="text-center py-10">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-slate-400 text-sm">
            No signals yet. The algo runs its first scan on the next market open.
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Make sure you have an Alpaca account connected in{' '}
            <Link href="/dashboard/settings" className="text-emerald-400 hover:underline">Settings</Link>.
          </p>
        </div>
      </div>

      {/* Halal filter note */}
      <div className="card bg-emerald-900/20 border border-emerald-700/30">
        <div className="flex gap-3">
          <span className="text-2xl">☪️</span>
          <div>
            <div className="text-white font-medium text-sm mb-1">Halal Screening Active</div>
            <p className="text-slate-400 text-sm">
              The algo only trades stocks that pass our built-in halal screener (1,100+ pre-vetted symbols).
              Interest-bearing instruments, alcohol, tobacco, gambling, and weapons sectors are automatically excluded.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
