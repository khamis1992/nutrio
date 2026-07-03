import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Mail, Lock, ArrowLeft, Loader2, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useLanguage } from '@/contexts/LanguageContext'
import { signInSchema, SignInFormValues } from './validation'
import { useState } from 'react'
import { motion } from 'framer-motion'

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

const cardItem = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.35 + i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

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
      className="fixed inset-0 flex flex-col overflow-hidden bg-[#F6F8FB] text-[#020617]"
      style={{ maxWidth: 430, margin: '0 auto' }}
    >
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1], x: [0, 12, 0], y: [0, -10, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-24 -top-24 h-[300px] w-[300px] rounded-full blur-3xl"
            style={{ backgroundColor: 'rgba(34,199,161,0.16)' }}
          />
        </motion.div>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1], x: [0, -14, 0], y: [0, 10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            className="absolute -bottom-28 -left-20 h-[280px] w-[280px] rounded-full bg-[#F3F4FF] blur-3xl"
          />
        </motion.div>
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#020617 0.8px, transparent 0.8px)', backgroundSize: '18px 18px' }} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]"
        >
          <button
            type="button"
            data-testid="signin-back-btn"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5EAF1] bg-white text-[#020617] transition-opacity hover:opacity-70"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </motion.div>

        {/* Logo + Brand */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          className="mb-5 mt-2 flex items-center justify-center"
        >
          <div className="flex h-28 w-28 items-center justify-center max-[380px]:h-24 max-[380px]:w-24">
            <Logo size="xl" className="!h-28 max-[380px]:!h-24" />
          </div>
        </motion.div>

        {/* Main form card */}
        <div className="flex-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[34px] border border-[#E5EAF1] bg-white p-5 shadow-[0_16px_34px_rgba(2,6,23,0.06)]"
          >
            <motion.div
              custom={0}
              variants={cardItem}
              initial="hidden"
              animate="visible"
            >
              <h1 className="mb-1 text-[32px] font-extrabold leading-tight text-[#020617]">
                {t('welcome_back')}
              </h1>
              <p className="mb-6 text-[15px] font-semibold leading-relaxed text-[#64748B]">
                {t('signin_desc')}
              </p>
            </motion.div>

            <form id="signin-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <motion.div
                custom={1}
                variants={cardItem}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <label htmlFor="signin-email" className="text-[16px] font-semibold text-[#020617]">{t('email')}</label>
                <div className="relative h-16 rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB]">
                  <span className="absolute left-3.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-[#EFF9FF] text-[#38BDF8]">
                    <Mail className="w-[18px] h-[18px]" />
                  </span>
                  <input
                    id="signin-email"
                    data-testid="signin-email-input"
                    type="email"
                    autoComplete="username"
                    placeholder={t('enter_email') ?? 'Enter your email'}
                    className="absolute inset-0 h-full w-full rounded-[20px] border-0 bg-transparent pl-16 pr-12 text-[16px] text-[#020617] outline-none placeholder:text-[#94A3B8]"
                    disabled={loading}
                    {...register('email')}
                  />
                  <button
                    type="button"
                    onClick={() => setValue('email','')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                    aria-label="Clear email"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {errors.email && <p className="text-xs text-destructive">{String(errors.email.message)}</p>}
              </motion.div>

              <motion.div
                custom={2}
                variants={cardItem}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <label htmlFor="signin-password" className="text-[16px] font-semibold text-[#020617]">{t('password')}</label>
                <div className="relative h-16 rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB]">
                  <span className="absolute left-3.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-[#F3F4FF] text-[#7C83F6]">
                    <Lock className="w-[18px] h-[18px]" />
                  </span>
                  <input
                    id="signin-password"
                    data-testid="signin-password-input"
                    type={pwVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('enter_password') ?? 'Enter your password'}
                    className="absolute inset-0 h-full w-full rounded-[20px] border-0 bg-transparent pl-16 pr-12 text-[16px] text-[#020617] outline-none placeholder:text-[#94A3B8]"
                    disabled={loading}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    data-testid="signin-pw-toggle"
                    onClick={() => setPwVisible(v=>!v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B]"
                    aria-label="Toggle password visibility"
                    disabled={loading}
                  >
                    <span className="relative inline-block h-5 w-5 rounded-full border border-[#64748B]">
                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#64748B]" />
                    </span>
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{String(errors.password.message)}</p>}
              </motion.div>

              <motion.div
                custom={3}
                variants={cardItem}
                initial="hidden"
                animate="visible"
                className="flex items-center justify-between"
              >
                <label className="flex items-center gap-2 cursor-pointer select-none group" data-testid="signin-remember-me">
                  <div className="relative">
                    <input
                      id="signin-remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => onRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                        rememberMe ? 'bg-[#22C7A1]' : 'bg-[#E5EAF1]'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          rememberMe ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-[#64748B] transition-colors group-hover:text-[#020617]">
                    {t('remember_me')}
                  </span>
                </label>
                <button
                  type="button"
                  data-testid="signin-forgot-link"
                  onClick={onSwitchToForgot}
                  className="text-sm font-semibold text-[#020617] hover:underline"
                >
                  {t('forgot_password')}
                </button>
              </motion.div>

              <motion.div
                custom={4}
                variants={cardItem}
                initial="hidden"
                animate="visible"
              >
                <p className="pt-2 text-center text-sm text-[#64748B]">
                  {t('dont_have_account')}{' '}
                  <button type="button" data-testid="signin-signup-link" onClick={onSwitchToSignUp} className="font-semibold text-[#020617] hover:underline" disabled={loading}>
                    {t('sign_up')}
                  </button>
                </p>
                <div className="pt-4">
                  <Button
                    type="submit"
                    data-testid="signin-submit-btn"
                    variant="gradient"
                    size="xl"
                    className="h-16 w-full rounded-3xl bg-[#020617] text-[17px] font-extrabold text-white shadow-none hover:bg-[#111827]"
                    disabled={loading}
                  >
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('signing_in')}</> : <><Lock className="w-5 h-5 mr-2" />{t('sign_in')}</>}
                  </Button>
                </div>
              </motion.div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
