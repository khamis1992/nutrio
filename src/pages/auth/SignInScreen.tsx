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
      className="fixed inset-0 flex flex-col overflow-hidden bg-[#F7F8F3]"
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
            style={{ backgroundColor: 'rgba(16,185,129,0.24)' }}
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
            className="absolute -bottom-28 -left-20 h-[280px] w-[280px] rounded-full bg-emerald-200/30 blur-3xl"
          />
        </motion.div>
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#0f172a 0.8px, transparent 0.8px)', backgroundSize: '18px 18px' }} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between px-6 pt-[max(3rem,env(safe-area-inset-top))]"
        >
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
        </motion.div>

        {/* Logo + Brand */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex items-center justify-center gap-3 mt-6 mb-8"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <Logo size="sm" />
          </div>
          <div>
            <p className="text-[16px] font-black tracking-[-0.04em] text-slate-950">NUTRIO</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Fuel better</p>
          </div>
        </motion.div>

        {/* Main form card */}
        <div className="flex-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[38px] border border-white/80 bg-white/90 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
          >
            <motion.div
              custom={0}
              variants={cardItem}
              initial="hidden"
              animate="visible"
            >
              <h1 className="text-[32px] font-extrabold text-slate-950 leading-tight mb-1">
                {t('welcome_back')}
              </h1>
              <p className="text-[15px] font-semibold text-slate-500 leading-relaxed mb-6">
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
                <label className="text-[16px] font-semibold text-slate-900">{t('email')}</label>
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
              </motion.div>

              <motion.div
                custom={2}
                variants={cardItem}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <label className="text-[16px] font-semibold text-slate-900">{t('password')}</label>
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
              </motion.div>

              <motion.div
                custom={3}
                variants={cardItem}
                initial="hidden"
                animate="visible"
                className="flex items-center justify-between"
              >
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
                  <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors">
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
              </motion.div>

              <motion.div
                custom={4}
                variants={cardItem}
                initial="hidden"
                animate="visible"
              >
                <p className="text-sm text-slate-500 text-center pt-2">
                  {t('dont_have_account')}{' '}
                  <button type="button" onClick={onSwitchToSignUp} className="font-semibold hover:underline text-emerald-600" disabled={loading}>
                    {t('sign_up')}
                  </button>
                </p>
                <div className="pt-4">
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
              </motion.div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
