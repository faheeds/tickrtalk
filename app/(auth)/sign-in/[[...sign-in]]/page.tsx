import { SignIn } from '@clerk/nextjs'
export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center mb-8">
        <SignIn appearance={{ variables: { colorPrimary: '#10b981', colorBackground: '#1e293b', colorText: '#e2e8f0', colorInputBackground: '#0f172a', colorInputText: '#e2e8f0' } }} />
      </div>
    </div>
  )
}
