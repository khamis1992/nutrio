import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Mail, Lock, ArrowLeft, Loader2, User } from 'lucide-react'
import { AnimatedNutrioLogo } from '@/components/motion/AnimatedNutrioLogo'
import { useLanguage } from '@/contexts/LanguageContext'
import { signUpSchema, SignUpFormValues } from './validation'
import { FormField } from '@/components/forms/FormField'

interface SignUpScreenProps {
  agreedToTerms: boolean
  loading: boolean
  onToggleTerms: () => void
  onBack: () => void
  onSwitchToSignIn: () => void
  onSubmit: (values: SignUpFormValues) => Promise<void>
}

export const SignUpScreen = ({
  agreedToTerms,
  loading,
  onToggleTerms,
  onBack,
  onSwitchToSignIn,
  onSubmit,
}: SignUpScreenProps) => {
  const { t } = useLanguage()
  const { control, handleSubmit } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#F6F8FB] text-[#020617]"
      style={{ maxWidth: 430, margin: '0 auto' }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <button
          type="button"
          data-testid="signup-back-btn"
          onClick={onBack}
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5EAF1] bg-white transition-opacity hover:opacity-70"
        >
          <ArrowLeft className="h-5 w-5 text-[#020617]" />
        </button>

        <div className="mb-5 flex justify-center">
          <AnimatedNutrioLogo className="h-24 w-24" />
        </div>

        <div className="rounded-[34px] border border-[#E5EAF1] bg-white p-5 shadow-[0_16px_34px_rgba(2,6,23,0.06)]">
          <h1 className="mb-1 text-[28px] font-extrabold leading-tight text-[#020617]">
            {t('join_nutrio_today')}
          </h1>
          <p className="mb-5 text-sm font-semibold leading-relaxed text-[#64748B]">
            {t('create_account_desc')}
          </p>

          <form id="signup-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            name="name"
            label={t('full_name')}
            control={control}
            type="text"
            icon={User}
            disabled={loading}
            autoComplete="name"
            testId="signup-name-input"
            className="border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
          />
          <FormField
            name="email"
            label={t('email')}
            control={control}
            type="email"
            icon={Mail}
            disabled={loading}
            testId="signup-email-input"
            className="border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
          />
          <FormField
            name="password"
            label={t('password')}
            control={control}
            type="password"
            icon={Lock}
            showPasswordToggle
            disabled={loading}
            testId="signup-password-input"
            className="border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
          />

          <label className="flex items-start gap-3 cursor-pointer select-none" data-testid="signup-terms-toggle">
            <div
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${agreedToTerms ? 'border-[#020617] bg-[#020617]' : 'border-[#94A3B8]'}`}
              onClick={onToggleTerms}
            >
              {agreedToTerms && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm leading-relaxed text-[#64748B]">
              {t('i_agree_to_nutrio')}{' '}
              <Link to="/terms" className="font-semibold text-[#020617]">
                {t('terms')}
              </Link>
              .
            </span>
          </label>

          <p className="text-center text-sm text-[#64748B]">
            {t('already_have_account')}{' '}
            <button type="button" data-testid="signup-signin-link" onClick={onSwitchToSignIn} className="font-semibold text-[#020617] hover:underline" disabled={loading}>
              {t('sign_in')}
            </button>
          </p>
          <div className="pt-3" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <Button
              type="submit"
              data-testid="signup-submit-btn"
              variant="gradient"
              size="lg"
              className="w-full rounded-2xl bg-[#020617] font-bold text-white shadow-none hover:bg-[#111827]"
              disabled={loading || !agreedToTerms}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('creating_account')}</> : t('sign_up')}
            </Button>
          </div>
          </form>
        </div>
      </div>
    </div>
  )
}
