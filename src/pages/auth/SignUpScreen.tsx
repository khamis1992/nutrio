import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Mail, Lock, ArrowLeft, Loader2, User } from 'lucide-react'
import { Logo } from '@/components/Logo'
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
      className="fixed inset-0 flex flex-col bg-background dark:bg-gray-950"
      style={{ maxWidth: 430, margin: '0 auto' }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6 text-foreground dark:text-gray-300" />
        </button>

        <div className="flex justify-center mb-4">
          <Logo size="lg" />
        </div>

        <h1 className="text-[22px] font-extrabold text-foreground dark:text-white leading-tight mb-1">
          {t('join_nutrio_today')}
        </h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400 leading-relaxed mb-5">
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
          />
          <FormField
            name="email"
            label={t('email')}
            control={control}
            type="email"
            icon={Mail}
            disabled={loading}
          />
          <FormField
            name="password"
            label={t('password')}
            control={control}
            type="password"
            icon={Lock}
            showPasswordToggle
            disabled={loading}
          />

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <div
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${agreedToTerms ? 'border-primary bg-primary' : 'border-primary'}`}
              onClick={onToggleTerms}
            >
              {agreedToTerms && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-muted-foreground dark:text-gray-400 leading-relaxed">
              {t('i_agree_to_nutrio')}{' '}
              <Link to="/terms" className="font-semibold text-primary">
                {t('terms')}
              </Link>
              .
            </span>
          </label>

          <p className="text-sm text-muted-foreground dark:text-gray-400 text-center">
            {t('already_have_account')}{' '}
            <button type="button" onClick={onSwitchToSignIn} className="font-semibold hover:underline text-primary" disabled={loading}>
              {t('sign_in')}
            </button>
          </p>
          <div className="pt-3" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full rounded-2xl font-bold"
              disabled={loading || !agreedToTerms}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('creating_account')}</> : t('sign_up')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
