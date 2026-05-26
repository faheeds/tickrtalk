import { SignUp } from '@clerk/nextjs'
export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <SignUp appearance={{ variables: { colorPrimary: '#10b981', colorBackground: '#1e293b', colorText: '#e2e8f0', colorInputBackground: '#0f172a', colorInputText: '#e2e8f0' } }} />
    </div>
  )
}
