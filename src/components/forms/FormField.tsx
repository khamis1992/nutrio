import { Control, Controller, FieldValues, Path } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

interface FormFieldProps<T extends FieldValues> {
  name: Path<T>
  label: string
  control: Control<T>
  type?: string
  placeholder?: string
  icon?: React.ElementType
  showPasswordToggle?: boolean
  disabled?: boolean
  autoComplete?: string
  className?: string
  testId?: string
}

export function FormField<T extends FieldValues>({
  name,
  label,
  control,
  type = 'text',
  placeholder,
  icon: Icon,
  showPasswordToggle = false,
  disabled = false,
  autoComplete,
  className,
  testId,
}: FormFieldProps<T>) {
  const [visible, setVisible] = useState(false)
  const inputType = showPasswordToggle && visible ? 'text' : type

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <div className="space-y-1">
          <Label
            htmlFor={`ff-${name}`}
            className="text-sm font-semibold text-[#020617]"
          >
            {label}
          </Label>
          <div className="relative">
            {Icon && (
              <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            )}
            <Input
              id={`ff-${name}`}
              type={inputType}
              placeholder={placeholder ?? label}
              disabled={disabled}
              autoComplete={autoComplete}
              data-testid={testId ?? `form-field-${name}`}
              className={cn(
                'h-12 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-1 focus-visible:ring-[#020617]',
                Icon && 'pl-11',
                showPasswordToggle && 'pr-12',
                error && 'ring-1 ring-destructive',
                className,
              )}
              {...field}
            />
            {showPasswordToggle && (
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] transition-colors hover:text-[#020617]"
                disabled={disabled}
              >
                {visible ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
          {error && (
            <p className="text-xs text-destructive">{error.message}</p>
          )}
        </div>
      )}
    />
  )
}
