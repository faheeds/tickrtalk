import { UserButton } from '@clerk/nextjs'
import { auth }       from '@clerk/nextjs/server'
import Link           from 'next/link'
import { redirect }   from 'next/navigation'

const NAV = [
  { href: '/dashboard',           label: '🏠 Overview'   },
  { href: '/dashboard/portfolio', label: '💼 Portfolio'  },
  { href: '/dashboard/watchlist', label: '👁 Watchlist'  },
  { href: '/dashboard/journal',   label: '📓 Journal'    },
  { href: '/dashboard/algo',      label: '🤖 Algo Engine' },
  { href: '/dashboard/settings',  label: '⚙️ Settings'   },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="flex min-h-screen bg-slate-900">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">📈</span>
            <span className="font-bold text-white text-sm">Tickr<span className="text-emerald-400">Talk</span></span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700 flex items-center gap-3">
          <UserButton />
          <span className="text-slate-400 text-xs">Account</span>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
