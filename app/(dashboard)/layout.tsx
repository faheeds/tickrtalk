import { auth }    from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Sidebar      from '@/app/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="flex min-h-dvh" style={{ background: 'var(--bg)' }}>
      <Sidebar />

      {/* Main content area */}
      <main
        className="flex-1 overflow-auto relative z-10"
        style={{ padding: '32px 40px' }}
      >
        {children}
      </main>
    </div>
  )
}
