import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Mail, Lock, ArrowLeft, Loader2, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useLanguage } from '@/contexts/LanguageContext'
import { signInSchema, SignInFormValues } from './validation'
import { useState } from 'react'

interface SignInScreenProps {
  loading: boolean
  biometricAvailable: boolean
  biometricType: string
  biometricLoading: boolean
  enableBiometric: boolean
  rememberMe: boolean
  initialEmail?: string
  onBiometricLogin: () => void
  onEnableBiometric: (value: boolean) => void
  onRememberMe: (value: boolean) => void
  onBack: () => void
  onSwitchToSignUp: () => void
  onSwitchToForgot: () => void
  onSubmit: (values: SignInFormValues) => Promise<void>
}

export const SignInScreen = ({
  loading,
  rememberMe,
  initialEmail = '',
  onRememberMe,
  onBack,
  onSwitchToSignUp,
  onSwitchToForgot,
  onSubmit,
}: SignInScreenProps) => {
  const { t } = useLanguage()
  const [pwVisible, setPwVisible] = useState(false)
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: initialEmail, password: '' },
  })

  return (
    <div
      className="fixed inset-0 flex flex-col bg-background"
      style={{ maxWidth: 430, margin: '0 auto' }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6 relative">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-6 -left-10 w-[240px] h-[240px] bg-emerald-100/40 rounded-full blur-2xl" />
          <div className="absolute -right-16 top-16 w-[200px] h-[200px] bg-emerald-100/30 rounded-full blur-2xl" />
          <div className="absolute left-4 top-10 opacity-30" style={{backgroundImage:'radial-gradient(#16a34a 1px, transparent 1px)', backgroundSize:'10px 10px', width:120, height:120, borderRadius:16}} />
        </div>
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>

        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        <h1 className="text-[32px] font-extrabold text-foreground leading-tight mb-1 text-center">
          {t('welcome_back')}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed mb-8 text-center">
          {t('signin_desc')}
        </p>

        <form id="signin-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="space-y-2">
            <label className="text-[16px] font-semibold text-foreground">{t('email')}</label>
            <div className="relative h-16 rounded-[20px] border border-emerald-200 bg-white shadow-[0_6px_24px_rgba(16,185,129,0.08)]">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Mail className="w-[18px] h-[18px]" />
              </span>
              <input
                id="email"
                type="email"
                placeholder={t('enter_email') ?? 'Enter your email'}
                className="absolute inset-0 w-full h-full rounded-[20px] border-0 outline-none pl-16 pr-12 text-[16px] placeholder:text-gray-400 bg-transparent"
                disabled={loading}
                {...register('email')}
              />
              <button
                type="button"
                onClick={() => setValue('email','')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear email"
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {errors.email && <p className="text-xs text-destructive">{String(errors.email.message)}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[16px] font-semibold text-foreground">{t('password')}</label>
            <div className="relative h-16 rounded-[20px] border border-emerald-200 bg-white shadow-[0_6px_24px_rgba(16,185,129,0.08)]">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Lock className="w-[18px] h-[18px]" />
              </span>
              <input
                id="password"
                type={pwVisible ? 'text' : 'password'}
                placeholder={t('enter_password') ?? 'Enter your password'}
                className="absolute inset-0 w-full h-full rounded-[20px] border-0 outline-none pl-16 pr-12 text-[16px] placeholder:text-gray-400 bg-transparent"
                disabled={loading}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setPwVisible(v=>!v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600"
                aria-label="Toggle password visibility"
                disabled={loading}
              >
                <span className="inline-block w-5 h-5 rounded-full border border-gray-500 relative">
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-600" />
                </span>
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{String(errors.password.message)}</p>}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => onRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                    rememberMe ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      rememberMe ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {t('remember_me')}
              </span>
            </label>
            <button
              type="button"
              onClick={onSwitchToForgot}
              className="text-sm font-semibold hover:underline text-emerald-600"
            >
              {t('forgot_password')}
            </button>
          </div>

          <div className="flex items-center gap-3 my-1">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-gray-400">{t('or_divider')}</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <div className="flex flex-col gap-4 mt-2">
            <button type="button" className="h-14 rounded-2xl bg-white shadow-[0_12px_24px_rgba(0,0,0,0.06)] border border-gray-100 flex items-center justify-center gap-3">
              <img alt="Google" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath d='M23.04 12.261c0-.815-.073-1.596-.209-2.348H12v4.44h6.24c-.27 1.45-1.09 2.676-2.32 3.497v2.9h3.76c2.2-2.027 3.46-5.015 3.46-8.49Z' fill='%234285F4'/%3E%3Cpath d='M12 24c3.24 0 5.96-1.074 7.947-2.917l-3.76-2.9c-1.044.7-2.385 1.114-4.187 1.114-3.215 0-5.94-2.17-6.914-5.09H1.2v3.02C3.176 21.41 7.28 24 12 24Z' fill='%2334A853'/%3E%3Cpath d='M5.086 14.207A7.2 7.2 0 0 1 4.8 12c0-.765.132-1.505.37-2.207V6.773H1.2A11.96 11.96 0 0 0 0 12c0 1.908.46 3.708 1.2 5.227l3.886-3.02Z' fill='%23FBBC05'/%3E%3Cpath d='M12 4.727c1.764 0 3.35.607 4.598 1.795l3.448-3.448C17.953 1.18 15.24 0 12 0 7.28 0 3.176 2.59 1.2 6.773l3.972 3.02C6.06 6.897 8.785 4.727 12 4.727Z' fill='%23EA4335'/%3E%3C/svg%3E" />
              <span className="text-[16px] font-medium text-gray-800">Continue with Google</span>
            </button>
            <button type="button" className="h-14 rounded-2xl bg-white shadow-[0_12px_24px_rgba(0,0,0,0.06)] border border-gray-100 flex items-center justify-center gap-3">
              <img alt="Apple" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M16.365 1.43c0 1.085-.43 2.136-1.13 2.9-.857.93-2.258 1.648-3.432 1.552-.12-1.072.472-2.213 1.176-2.95.83-.87 2.287-1.54 3.386-1.502zM20.75 18.12c-.65 1.507-1.43 2.993-2.58 4.314-1.008 1.158-2.27 2.46-3.89 2.46-1.63 0-2.062-.79-3.83-.79-1.794 0-2.26.78-3.867.81-1.632.03-2.864-1.245-3.877-2.405C.93 20.1-.65 15.46 1.82 12.1c1.028-1.45 2.625-2.37 4.46-2.4 1.676-.03 3.26.85 4.28.85 1 0 2.84-1.05 4.79-.9.82.03 3.12.33 4.59 2.5-3.89 2.23-3.27 7.02.8 5.97z'/%3E%3C/svg%3E" />
              <span className="text-[16px] font-medium text-gray-800">Continue with Apple</span>
            </button>
          </div>

          <p className="text-sm text-muted-foreground text-center pt-2">
            {t('dont_have_account')}{' '}
            <button type="button" onClick={onSwitchToSignUp} className="font-semibold hover:underline text-emerald-600" disabled={loading}>
              {t('sign_up')}
            </button>
          </p>
        </form>
      </div>

      <div className="px-6 pt-3 bg-background border-t border-transparent" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <Button
          type="submit"
          form="signin-form"
          variant="gradient"
          size="xl"
          className="w-full rounded-3xl h-16 text-[17px] font-extrabold"
          disabled={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('signing_in')}</> : <><Lock className="w-5 h-5 mr-2" />{t('sign_in')}</>}
        </Button>
      </div>
    </div>
  )
}