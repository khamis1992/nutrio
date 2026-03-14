# Payment Processing

<cite>
**Referenced Files in This Document**
- [payment-simulation.ts](file://src/lib/payment-simulation.ts)
- [payment-simulation-config.ts](file://src/lib/payment-simulation-config.ts)
- [sadad.ts](file://src/lib/sadad.ts)
- [walletService.ts](file://src/services/walletService.ts)
- [useSimulatedPayment.ts](file://src/hooks/useSimulatedPayment.ts)
- [useWallet.ts](file://src/hooks/useWallet.ts)
- [PaymentMethodSelector.tsx](file://src/components/payment/PaymentMethodSelector.tsx)
- [SimulatedCardForm.tsx](file://src/components/payment/SimulatedCardForm.tsx)
- [Simulated3DSecure.tsx](file://src/components/payment/Simulated3DSecure.tsx)
- [Wallet.tsx](file://src/pages/Wallet.tsx)
- [index.ts](file://supabase/functions/simulate-payment/index.ts)
- [payment-processing-load.test.ts](file://tests/load/payment-processing-load.test.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [PCI Compliance and Security](#pci-compliance-and-security)
10. [Conclusion](#conclusion)

## Introduction
This document describes the payment processing system in Nutrio, covering:
- Payment simulation framework for development and testing
- Real payment gateway integration via Sadad (Qatari payment provider)
- Wallet management system for customer balances and top-ups
- Orchestration of payment flows, transaction lifecycle management, and payment method handling
- Examples of payment initiation, verification, failure handling, and refund processing
- PCI compliance considerations, security measures, and data protection
- Payment analytics, reconciliation, and performance monitoring

## Project Structure
The payment system spans frontend libraries, hooks, UI components, backend Supabase Edge Functions, and service utilities:
- Frontend simulation and gateway integration: src/lib, src/hooks, src/components/payment
- Wallet management: src/services, src/hooks, src/pages
- Backend simulation: supabase/functions/simulate-payment
- Load testing: tests/load

```mermaid
graph TB
subgraph "Frontend"
UI_Wallet["Wallet Page<br/>src/pages/Wallet.tsx"]
Hook_Wallet["useWallet Hook<br/>src/hooks/useWallet.ts"]
Hook_Sim["useSimulatedPayment Hook<br/>src/hooks/useSimulatedPayment.ts"]
Lib_Sim["Payment Simulation<br/>src/lib/payment-simulation.ts"]
Lib_Config["Simulation Config<br/>src/lib/payment-simulation-config.ts"]
Lib_Sadad["Sadad Integration<br/>src/lib/sadad.ts"]
Comp_Method["PaymentMethodSelector<br/>src/components/payment/PaymentMethodSelector.tsx"]
Comp_Card["SimulatedCardForm<br/>src/components/payment/SimulatedCardForm.tsx"]
Comp_3D["Simulated3DSecure<br/>src/components/payment/Simulated3DSecure.tsx"]
end
subgraph "Backend"
Func_Sim["Supabase Function<br/>supabase/functions/simulate-payment/index.ts"]
end
subgraph "Services"
Service_Wallet["Wallet Service<br/>src/services/walletService.ts"]
end
UI_Wallet --> Hook_Wallet
Hook_Wallet --> Func_Sim
Hook_Wallet --> Lib_Sadad
Hook_Sim --> Lib_Sim
Hook_Sim --> Lib_Config
Hook_Wallet --> Service_Wallet
Comp_Method --> Hook_Sim
Comp_Card --> Hook_Sim
Comp_3D --> Hook_Sim
```

**Diagram sources**
- [Wallet.tsx:1-221](file://src/pages/Wallet.tsx#L1-L221)
- [useWallet.ts:1-276](file://src/hooks/useWallet.ts#L1-L276)
- [useSimulatedPayment.ts:1-189](file://src/hooks/useSimulatedPayment.ts#L1-L189)
- [payment-simulation.ts:1-223](file://src/lib/payment-simulation.ts#L1-L223)
- [payment-simulation-config.ts:1-79](file://src/lib/payment-simulation-config.ts#L1-L79)
- [sadad.ts:1-220](file://src/lib/sadad.ts#L1-L220)
- [PaymentMethodSelector.tsx:1-107](file://src/components/payment/PaymentMethodSelector.tsx#L1-L107)
- [SimulatedCardForm.tsx:1-144](file://src/components/payment/SimulatedCardForm.tsx#L1-L144)
- [Simulated3DSecure.tsx:1-105](file://src/components/payment/Simulated3DSecure.tsx#L1-L105)
- [index.ts:1-119](file://supabase/functions/simulate-payment/index.ts#L1-L119)
- [walletService.ts:1-180](file://src/services/walletService.ts#L1-L180)

**Section sources**
- [Wallet.tsx:1-221](file://src/pages/Wallet.tsx#L1-L221)
- [useWallet.ts:1-276](file://src/hooks/useWallet.ts#L1-L276)
- [useSimulatedPayment.ts:1-189](file://src/hooks/useSimulatedPayment.ts#L1-L189)
- [payment-simulation.ts:1-223](file://src/lib/payment-simulation.ts#L1-L223)
- [payment-simulation-config.ts:1-79](file://src/lib/payment-simulation-config.ts#L1-L79)
- [sadad.ts:1-220](file://src/lib/sadad.ts#L1-L220)
- [index.ts:1-119](file://supabase/functions/simulate-payment/index.ts#L1-L119)
- [walletService.ts:1-180](file://src/services/walletService.ts#L1-L180)

## Core Components
- Payment Simulation Service: Manages simulated payment lifecycle, 3D Secure simulation, and outcomes.
- Simulation Configuration: Controls success rates, delays, allowed methods, and 3D Secure behavior.
- Sadad Payment Service: Integrates with the Sadad gateway for real payments in Qatar.
- Wallet Management Hooks and Services: Fetch, top-up, and track wallet balances and transactions.
- UI Components: Method selection, card form, and 3D Secure dialogs for simulated flows.
- Supabase Edge Function: Backend simulation for wallet top-ups and payment records.

**Section sources**
- [payment-simulation.ts:25-223](file://src/lib/payment-simulation.ts#L25-L223)
- [payment-simulation-config.ts:4-79](file://src/lib/payment-simulation-config.ts#L4-L79)
- [sadad.ts:39-191](file://src/lib/sadad.ts#L39-L191)
- [useWallet.ts:56-276](file://src/hooks/useWallet.ts#L56-L276)
- [walletService.ts:13-180](file://src/services/walletService.ts#L13-L180)
- [index.ts:9-119](file://supabase/functions/simulate-payment/index.ts#L9-L119)

## Architecture Overview
The system supports two primary flows:
- Simulated payments for development and testing
- Real Sadad payments for production

```mermaid
sequenceDiagram
participant User as "Customer"
participant UI as "Wallet Page"
participant Hook as "useWallet Hook"
participant Func as "Supabase Function"
participant Sim as "Payment Simulation Service"
participant Sadad as "Sadad Gateway"
User->>UI : Select top-up package
UI->>Hook : initiateTopUp(packageId, method)
alt Method == "sadad"
Hook->>Sadad : createPayment(...)
Sadad-->>Hook : {payment_id, payment_url}
Hook-->>UI : Redirect to Sadad
else Method == "card" and simulation enabled
Hook->>Func : initiate-payment (simulation_mode=true)
Func->>Sim : createPayment(record)
Sim-->>Func : {status : pending}
Func-->>Hook : {payment_id, status}
Hook-->>UI : Show simulated flow
UI->>Sim : createPayment(...)
Sim-->>UI : {payment_id, payment_url}
UI->>Sim : initiate3DSecure(paymentId)
Sim-->>UI : {requires3D, redirectUrl?}
UI->>Sim : processPayment(paymentId)
Sim-->>UI : {success, transactionId?}
end
```

**Diagram sources**
- [useWallet.ts:137-167](file://src/hooks/useWallet.ts#L137-L167)
- [index.ts:28-101](file://supabase/functions/simulate-payment/index.ts#L28-L101)
- [payment-simulation.ts:38-140](file://src/lib/payment-simulation.ts#L38-L140)
- [sadad.ts:54-103](file://src/lib/sadad.ts#L54-L103)

## Detailed Component Analysis

### Payment Simulation Framework
The simulation framework provides deterministic payment outcomes for testing:
- Lifecycle: pending → 3d_secure (optional) → processing → success or failed
- Configurable success rate, artificial delays, and 3D Secure probability
- Event-driven updates via subscription listeners
- Forced outcomes for test harnesses

```mermaid
classDiagram
class PaymentSimulationService {
-config : SimulationConfig
-payments : Map
-listeners : Set
+isSimulationMode() boolean
+createPayment(request) Promise
+initiate3DSecure(id) Promise
+verify3DSecure(id, otp) Promise
+processPayment(id) Promise
+getPaymentStatus(id) SimulatedPayment
+subscribe(cb) Unsubscribe
+forceOutcome(id, outcome)
+cancelPayment(id)
+getAllPayments() SimulatedPayment[]
+updateConfig(cfg)
-delay(min,max) Promise
-updatePaymentStatus(id,status,extras)
-notifyListeners(payment)
}
class SimulatedPayment {
+paymentId : string
+orderId : string
+amount : number
+status : enum
+method : PaymentMethod
+createdAt : Date
+completedAt : Date
+failureReason : string
+transactionId : string
+cardLast4 : string
}
PaymentSimulationService --> SimulatedPayment : "manages"
```

**Diagram sources**
- [payment-simulation.ts:25-209](file://src/lib/payment-simulation.ts#L25-L209)

**Section sources**
- [payment-simulation.ts:25-223](file://src/lib/payment-simulation.ts#L25-L223)
- [payment-simulation-config.ts:4-79](file://src/lib/payment-simulation-config.ts#L4-L79)

### Sadad Payment Integration
Sadad integration handles real payment creation, verification, status polling, and refunds:
- Creates payment requests with merchant credentials and callbacks
- Verifies signatures and statuses
- Retrieves payment status and processes refunds

```mermaid
sequenceDiagram
participant Client as "Client"
participant Service as "SadadService"
participant Gateway as "Sadad API"
Client->>Service : createPayment({amount, orderId, ...})
Service->>Gateway : POST /v1/payments
Gateway-->>Service : {payment_id, payment_url, status}
Service-->>Client : {payment_id, payment_url}
Client->>Service : getPaymentStatus(paymentId)
Service->>Gateway : GET /v1/payments/{id}
Gateway-->>Service : {status, amount, transactionId}
Service-->>Client : status details
Client->>Service : refundPayment(paymentId, amount?)
Service->>Gateway : POST /v1/payments/{id}/refund
Gateway-->>Service : {refundId, status}
Service-->>Client : refund result
```

**Diagram sources**
- [sadad.ts:39-191](file://src/lib/sadad.ts#L39-L191)

**Section sources**
- [sadad.ts:39-191](file://src/lib/sadad.ts#L39-L191)

### Wallet Management System
The wallet system manages customer balances, top-up packages, transactions, and invoices:
- Fetch wallet, transactions, and top-up packages
- Initiate top-ups via Supabase functions or Sadad
- Credit wallet and generate invoices
- Real-time updates via Supabase Postgres changes

```mermaid
flowchart TD
Start(["Initiate Top-up"]) --> CheckUser["Check Authenticated User"]
CheckUser --> |Authenticated| FetchPkg["Fetch Selected Package"]
CheckUser --> |Not Auth| Redirect["Redirect to Login"]
FetchPkg --> InvokeFn["Invoke Supabase Function<br/>initiate-payment"]
InvokeFn --> FnResult{"Function Result"}
FnResult --> |Success| HandleResult["Handle Payment Response"]
FnResult --> |Error| ShowError["Show Error Message"]
HandleResult --> CreditWallet["RPC: credit_wallet"]
CreditWallet --> CreateInvoice["Create Invoice Record"]
CreateInvoice --> EmailInvoice["Send Invoice Email"]
EmailInvoice --> Done(["Done"])
ShowError --> Done
Redirect --> Done
```

**Diagram sources**
- [useWallet.ts:137-167](file://src/hooks/useWallet.ts#L137-L167)
- [walletService.ts:13-137](file://src/services/walletService.ts#L13-L137)

**Section sources**
- [useWallet.ts:56-276](file://src/hooks/useWallet.ts#L56-L276)
- [walletService.ts:13-180](file://src/services/walletService.ts#L13-L180)

### Payment UI Components and Hooks
- PaymentMethodSelector: Renders selectable payment methods with icons and descriptions.
- SimulatedCardForm: Formats card inputs and submits card details for simulated processing.
- Simulated3DSecure: Handles OTP entry and simulates 3D Secure verification.
- useSimulatedPayment: Orchestrates simulated payment steps, progress tracking, and outcomes.
- useWallet: Centralizes wallet state, transactions, and top-up initiation.

```mermaid
sequenceDiagram
participant UI as "UI Components"
participant Hook as "useSimulatedPayment"
participant Sim as "PaymentSimulationService"
UI->>Hook : initPayment()
Hook->>Hook : set step "selecting_method"
UI->>Hook : selectMethod(method)
Hook->>Hook : set step "entering_details"
UI->>Hook : processCardPayment(cardData)
Hook->>Sim : createPayment({amount, order_id})
Sim-->>Hook : {payment_id, payment_url}
Hook->>Sim : initiate3DSecure(payment_id)
Sim-->>Hook : {requires3D, redirectUrl?}
alt Requires 3D Secure
Hook->>Hook : set step "3d_secure"
UI->>Hook : verify3DSecure(otp)
Hook->>Sim : verify3DSecure(payment_id, otp)
Sim-->>Hook : boolean
Hook->>Sim : processPayment(payment_id)
else No 3D Secure
Hook->>Sim : processPayment(payment_id)
end
Sim-->>Hook : {success, transactionId?}
Hook->>UI : step "success" or "failed"
```

**Diagram sources**
- [PaymentMethodSelector.tsx:51-106](file://src/components/payment/PaymentMethodSelector.tsx#L51-L106)
- [SimulatedCardForm.tsx:19-143](file://src/components/payment/SimulatedCardForm.tsx#L19-L143)
- [Simulated3DSecure.tsx:16-104](file://src/components/payment/Simulated3DSecure.tsx#L16-L104)
- [useSimulatedPayment.ts:22-188](file://src/hooks/useSimulatedPayment.ts#L22-L188)
- [payment-simulation.ts:38-140](file://src/lib/payment-simulation.ts#L38-L140)

**Section sources**
- [PaymentMethodSelector.tsx:1-107](file://src/components/payment/PaymentMethodSelector.tsx#L1-L107)
- [SimulatedCardForm.tsx:1-144](file://src/components/payment/SimulatedCardForm.tsx#L1-L144)
- [Simulated3DSecure.tsx:1-105](file://src/components/payment/Simulated3DSecure.tsx#L1-L105)
- [useSimulatedPayment.ts:1-189](file://src/hooks/useSimulatedPayment.ts#L1-L189)

### Backend Simulation Function
The Supabase Edge Function provides a backend simulation for wallet top-ups:
- Creates payment records
- Randomly succeeds or fails after a delay
- Credits wallet upon success
- Returns structured responses for frontend handling

```mermaid
sequenceDiagram
participant Client as "Client"
participant Func as "Supabase Function"
participant DB as "Database"
Client->>Func : invoke initiate-payment {simulation_mode=true}
Func->>DB : INSERT payments {status : pending}
DB-->>Func : payment record
Func->>Func : delay 2s
alt Success (95%)
Func->>DB : UPDATE payments {status : completed}
Func->>DB : RPC credit_wallet
Func-->>Client : {success : true, payment_id, transaction_id}
else Failure (5%)
Func->>DB : UPDATE payments {status : failed}
Func-->>Client : {success : false, error}
end
```

**Diagram sources**
- [index.ts:9-119](file://supabase/functions/simulate-payment/index.ts#L9-L119)

**Section sources**
- [index.ts:9-119](file://supabase/functions/simulate-payment/index.ts#L9-L119)

## Dependency Analysis
- Frontend hooks depend on Supabase client and environment variables for gateway configuration.
- Simulation service is decoupled from gateway logic and configurable via environment.
- Wallet service integrates with Supabase RPC functions and external email service.
- Edge function encapsulates simulation logic and interacts with database and wallet procedures.

```mermaid
graph LR
Hook_W["useWallet.ts"] --> Func["simulate-payment/index.ts"]
Hook_S["useSimulatedPayment.ts"] --> Lib_Sim["payment-simulation.ts"]
Lib_Sim --> Lib_Config["payment-simulation-config.ts"]
Hook_W --> Lib_Sadad["sadad.ts"]
Service_W["walletService.ts"] --> Supabase["Supabase RPC"]
UI_W["Wallet.tsx"] --> Hook_W
UI_P["Payment Components"] --> Hook_S
```

**Diagram sources**
- [useWallet.ts:137-167](file://src/hooks/useWallet.ts#L137-L167)
- [useSimulatedPayment.ts:1-189](file://src/hooks/useSimulatedPayment.ts#L1-L189)
- [payment-simulation.ts:1-223](file://src/lib/payment-simulation.ts#L1-L223)
- [payment-simulation-config.ts:1-79](file://src/lib/payment-simulation-config.ts#L1-L79)
- [sadad.ts:1-220](file://src/lib/sadad.ts#L1-L220)
- [walletService.ts:1-180](file://src/services/walletService.ts#L1-L180)
- [Wallet.tsx:1-221](file://src/pages/Wallet.tsx#L1-L221)
- [index.ts:1-119](file://supabase/functions/simulate-payment/index.ts#L1-L119)

**Section sources**
- [useWallet.ts:137-167](file://src/hooks/useWallet.ts#L137-L167)
- [useSimulatedPayment.ts:1-189](file://src/hooks/useSimulatedPayment.ts#L1-L189)
- [payment-simulation.ts:1-223](file://src/lib/payment-simulation.ts#L1-L223)
- [payment-simulation-config.ts:1-79](file://src/lib/payment-simulation-config.ts#L1-L79)
- [sadad.ts:1-220](file://src/lib/sadad.ts#L1-L220)
- [walletService.ts:1-180](file://src/services/walletService.ts#L1-L180)
- [Wallet.tsx:1-221](file://src/pages/Wallet.tsx#L1-L221)
- [index.ts:1-119](file://supabase/functions/simulate-payment/index.ts#L1-L119)

## Performance Considerations
- Simulation delays and success rates can be tuned for load testing scenarios.
- Use presets to simulate slow networks or flaky conditions.
- Monitor payment latency and failure rates in production via gateway logs and database metrics.
- Consider caching frequently accessed top-up packages and wallet data.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Simulation not enabled: Ensure the environment variable enabling simulation is set appropriately.
- Sadad gateway misconfiguration: Verify merchant ID and secret key are present.
- Payment verification failures: Confirm signature verification logic and callback URLs.
- Wallet credit failures: Check RPC procedure permissions and database connectivity.
- 3D Secure simulation: OTP must be a six-digit numeric code; verify dialog input handling.

**Section sources**
- [payment-simulation.ts:34-42](file://src/lib/payment-simulation.ts#L34-L42)
- [sadad.ts:50-52](file://src/lib/sadad.ts#L50-L52)
- [useWallet.ts:137-167](file://src/hooks/useWallet.ts#L137-L167)

## PCI Compliance and Security
- Never store raw card data; rely on gateway-provided tokens or redirects.
- Use HTTPS and secure cookies for all payment endpoints.
- Validate and sanitize all inputs; enforce strict format checks for card numbers and expiry dates.
- Implement rate limiting and CAPTCHA for payment forms to prevent abuse.
- Log minimal transaction data; avoid logging sensitive fields.
- Regularly rotate API keys and secrets; restrict access to service accounts.
- Use signed callbacks and verify signatures before processing payments.

[No sources needed since this section provides general guidance]

## Conclusion
Nutrio’s payment system combines a robust simulation framework with a production-ready Sadad integration and a comprehensive wallet management system. The modular design enables flexible testing, reliable production flows, and scalable transaction lifecycle management. By adhering to the outlined security and performance practices, the system maintains compliance and resilience in real-world deployments.