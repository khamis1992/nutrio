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
            <div className="relative h-16 rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
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
            <div className="relative h-16 rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
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
                    rememberMe ? 'bg-emerald-500' : 'bg-slate-200'
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

          <p className="text-sm text-muted-foreground text-center pt-2">
            {t('dont_have_account')}{' '}
            <button type="button" onClick={onSwitchToSignUp} className="font-semibold hover:underline text-emerald-600" disabled={loading}>
              {t('sign_up')}
            </button>
          </p>
          <div className="pt-3" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <Button
              type="submit"
              variant="gradient"
              size="xl"
              className="w-full rounded-3xl h-16 text-[17px] font-extrabold"
              disabled={loading}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('signing_in')}</> : <><Lock className="w-5 h-5 mr-2" />{t('sign_in')}</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}