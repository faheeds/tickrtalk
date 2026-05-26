import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📈</span>
          <span className="text-xl font-bold text-white">Tickr<span className="text-emerald-400">Talk</span></span>
        </div>
        <div className="flex items-center gap-3">
          <SignedOut>
            <Link href="/sign-in" className="text-slate-300 hover:text-white px-4 py-2 transition-colors">Sign In</Link>
            <Link href="/sign-up" className="btn-primary">Start Free Trial</Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
          </SignedIn>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
          ✦ 100% Halal-Screened Trading
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Algo Trading Built For<br />
          <span className="text-emerald-400">Muslim Investors</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
          AI-powered trend following with SuperTrend, automatic halal screening across 1,100+ certified symbols, and professional risk management — all on your own Alpaca account.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/sign-up" className="btn-primary text-lg px-8 py-3">
            Start 30-Day Free Trial
          </Link>
          <a href="#features" className="btn-secondary text-lg px-8 py-3">See Features</a>
        </div>
        <p className="text-slate-500 text-sm mt-4">No credit card required · Cancel anytime</p>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Everything You Need to Trade Confidently</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '🌙', title: 'Halal Screened', desc: '1,112 certified symbols from Halal Terminal. Every signal is screened before execution.' },
            { icon: '🤖', title: 'AI Algo Engine', desc: 'SuperTrend + ATR stops, automatic position sizing with 1% risk per trade, cash-only trading.' },
            { icon: '📊', title: 'Multi-Broker', desc: 'Connect Alpaca, Schwab, or Interactive Brokers. Paper or live trading modes.' },
            { icon: '🛡️', title: 'Risk Management', desc: 'Hard position caps, portfolio heat limits, no margin, no shorting, no derivatives.' },
            { icon: '📈', title: 'Market Regime Filter', desc: 'Automatically switches between bull/bear modes using SPY trend analysis.' },
            { icon: '💰', title: 'Trade Journal', desc: 'Full P&L tracking, win rate, expectancy, and performance metrics.' },
          ].map(f => (
            <div key={f.title} className="card hover:border-emerald-500/50 transition-colors">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-4">Simple, Transparent Pricing</h2>
        <p className="text-slate-400 text-center mb-12">30-day free trial on all plans. No credit card required to start.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Basic */}
          <div className="card border-slate-600">
            <div className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-2">Basic</div>
            <div className="text-4xl font-bold text-white mb-1">$19<span className="text-lg text-slate-400 font-normal">/mo</span></div>
            <p className="text-slate-400 text-sm mb-6">Manual trading + journal + halal screener</p>
            <ul className="space-y-3 text-sm text-slate-300 mb-8">
              {['Halal screening (1,112 symbols)', 'Personal watchlist with real-time quotes', 'Portfolio tracking + P&L journal', 'Connect 1 broker (Alpaca)', 'Manual trade execution'].map(f => (
                <li key={f} className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/sign-up" className="btn-secondary w-full text-center block">Start Free Trial</Link>
          </div>

          {/* Pro */}
          <div className="card border-emerald-500/50 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
            <div className="text-emerald-400 text-sm font-medium uppercase tracking-wide mb-2">Pro</div>
            <div className="text-4xl font-bold text-white mb-1">$49<span className="text-lg text-slate-400 font-normal">/mo</span></div>
            <p className="text-slate-400 text-sm mb-6">Full algo engine + auto-trading</p>
            <ul className="space-y-3 text-sm text-slate-300 mb-8">
              {['Everything in Basic', 'AI algo engine (SuperTrend + ATR)', 'Auto-trading with risk management', 'Market regime filter', 'Connect all brokers (Alpaca, Schwab, IBKR)', 'Cron-powered scans every 5 minutes', 'Options open interest filter'].map(f => (
                <li key={f} className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/sign-up" className="btn-primary w-full text-center block">Start Free Trial</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 px-8 py-8 text-center text-slate-500 text-sm">
        <p>© 2026 TickrTalk, Inc. Not financial advice. Trading involves risk.</p>
      </footer>
    </main>
  )
}
