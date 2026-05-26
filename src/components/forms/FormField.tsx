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
            className="text-sm font-semibold text-foreground dark:text-gray-300"
          >
            {label}
          </Label>
          <div className="relative">
            {Icon && (
              <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground dark:text-gray-500" />
            )}
            <Input
              id={`ff-${name}`}
              type={inputType}
              placeholder={placeholder ?? label}
              disabled={disabled}
              autoComplete={autoComplete}
              className={cn(
                'h-12 rounded-2xl border-0 bg-muted dark:bg-gray-800 text-foreground dark:text-gray-200 placeholder:text-muted-foreground dark:placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-primary',
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-gray-300 transition-colors"
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
