import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'TickrTalk — Halal Algo Trading',
  description: 'AI-powered halal algorithmic trading platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="antialiased" style={{ background: '#05080F', minHeight: '100dvh' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
