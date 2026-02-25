// Payment simulation configuration
// This file controls the behavior of the payment simulation system

export interface SimulationConfig {
  enabled: boolean;
  artificialDelay: {
    min: number; // milliseconds
    max: number;
  };
  successRate: number; // 0-1 probability
  enable3DSecure: boolean;
  allowedMethods: PaymentMethod[];
  simulateNetworkErrors: boolean;
}

export type PaymentMethod = 
  | 'credit_card' 
  | 'debit_card' 
  | 'sadad' 
  | 'apple_pay' 
  | 'google_pay';

export const defaultSimulationConfig: SimulationConfig = {
  enabled: import.meta.env.VITE_ENABLE_PAYMENT_SIMULATION === 'true',
  artificialDelay: { min: 2000, max: 5000 },
  successRate: 0.95, // 95% success rate
  enable3DSecure: true,
  allowedMethods: ['credit_card', 'debit_card', 'sadad', 'apple_pay', 'google_pay'],
  simulateNetworkErrors: false,
};

// For testing different scenarios
export const simulationPresets = {
  alwaysSuccess: { ...defaultSimulationConfig, successRate: 1 },
  alwaysFail: { ...defaultSimulationConfig, successRate: 0 },
  slowNetwork: { ...defaultSimulationConfig, artificialDelay: { min: 5000, max: 10000 } },
  flakyNetwork: { ...defaultSimulationConfig, successRate: 0.7, simulateNetworkErrors: true },
};

// Payment method details for UI
export const paymentMethodDetails = [
  {
    id: 'credit_card' as PaymentMethod,
    name: 'Credit Card',
    description: 'Visa, Mastercard, Amex',
    icon: 'CreditCard',
    color: 'bg-blue-500',
  },
  {
    id: 'debit_card' as PaymentMethod,
    name: 'Debit Card',
    description: 'Direct from bank account',
    icon: 'CreditCard',
    color: 'bg-green-500',
  },
  {
    id: 'sadad' as PaymentMethod,
    name: 'Sadad',
    description: 'Qatar National Payment',
    icon: 'Wallet',
    color: 'bg-purple-500',
    popular: true,
  },
  {
    id: 'apple_pay' as PaymentMethod,
    name: 'Apple Pay',
    description: 'Fast & secure',
    icon: 'Smartphone',
    color: 'bg-gray-900',
  },
  {
    id: 'google_pay' as PaymentMethod,
    name: 'Google Pay',
    description: 'Quick checkout',
    icon: 'QrCode',
    color: 'bg-indigo-500',
  },
];
