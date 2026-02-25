import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Wallet, Smartphone, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/lib/payment-simulation-config';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  amount: number;
}

const paymentMethods = [
  {
    id: 'credit_card' as PaymentMethod,
    name: 'Credit Card',
    description: 'Visa, Mastercard, Amex',
    Icon: CreditCard,
    color: 'bg-blue-500',
  },
  {
    id: 'debit_card' as PaymentMethod,
    name: 'Debit Card',
    description: 'Direct from bank account',
    Icon: CreditCard,
    color: 'bg-green-500',
  },
  {
    id: 'sadad' as PaymentMethod,
    name: 'Sadad',
    description: 'Qatar National Payment',
    Icon: Wallet,
    color: 'bg-purple-500',
    popular: true,
  },
  {
    id: 'apple_pay' as PaymentMethod,
    name: 'Apple Pay',
    description: 'Fast & secure',
    Icon: Smartphone,
    color: 'bg-gray-900',
  },
  {
    id: 'google_pay' as PaymentMethod,
    name: 'Google Pay',
    description: 'Quick checkout',
    Icon: QrCode,
    color: 'bg-indigo-500',
  },
];

export function PaymentMethodSelector({ 
  selectedMethod, 
  onSelect,
  amount 
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Select Payment Method</h3>
        <span className="text-lg font-bold">QAR {amount}</span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {paymentMethods.map((method) => (
          <Card
            key={method.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              selectedMethod === method.id && 'ring-2 ring-primary border-primary'
            )}
            onClick={() => onSelect(method.id)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white', method.color)}>
                <method.Icon className="w-6 h-6" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{method.name}</span>
                  {method.popular && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{method.description}</p>
              </div>

              <div className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center',
                selectedMethod === method.id 
                  ? 'bg-primary border-primary' 
                  : 'border-muted-foreground'
              )}>
                {selectedMethod === method.id && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
