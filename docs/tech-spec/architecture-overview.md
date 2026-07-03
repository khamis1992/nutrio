# 🏗️ Technical Architecture Overview: Nutrio Customer Portal

This document defines the systemic infrastructure, data flow, and integration patterns of the Nutrio Customer Portal.

---

## 1. System Architecture
Nutrio is built as a **Modern Single Page Application (SPA)** following a decoupled architecture where the frontend acts as a thin orchestration layer for a robust serverless backend.

### 🧩 Tech Stack
- **Frontend**: React (Vite) $\rightarrow$ TypeScript $\rightarrow$ Tailwind CSS $\rightarrow$ Framer Motion.
- **Backend-as-a-Service**: Supabase (PostgreSQL, Auth, Storage).
- **Compute**: Supabase Edge Functions (Deno/TypeScript) for AI and 3rd-party integrations.
- **External APIs**: Gemini Vision (AI Image analysis), Open Food Facts (Barcode data), SADAD (Payment gateway).

---

## 2. Core Data Flow Patterns

### 🔄 The "Hook-to-DB" Pattern
The application utilizes a custom hook-driven data architecture to ensure real-time synchronization across the portal:
`React Component` $\rightarrow$ `Custom Hook (e.g., useWallet)` $\rightarrow$ `Supabase Client` $\rightarrow$ `PostgreSQL Table` $\rightarrow$ `Real-time Subscription`.

### ⚡ Edge Function Execution (The "Intelligence" Layer)
For tasks requiring external APIs or heavy computation, Nutrio uses a secure Edge Function bridge:
`Frontend` $\rightarrow$ `supabase.functions.invoke('function-name')` $\rightarrow$ `JWT Validation` $\rightarrow$ `External API` $\rightarrow$ `Structured JSON Response` $\rightarrow$ `Frontend State Update`.

---

## 3. Integration Ecosystem

### 🧬 Health Data Sync
Nutrio implements a bidirectional sync pattern for biometric data:
- **Ingestion**: `HealthKit (iOS) / Google Fit (Android)` $\rightarrow$ `Capacitor Bridge` $\rightarrow$ `Local State` $\rightarrow$ `Supabase Storage`.
- **Processing**: The system maps external units (e.g., steps, calories) to Nutrio's internal metric system using a a normalized transformation layer.

### 💳 Financial Flow (The Wallet Bridge)
The payment system is designed to prevent balance drift:
1. **Initiation**: User selects package $\rightarrow$ `SADAD` payment request generated.
2. **Validation**: `SADAD Callback` $\rightarrow$ `Edge Function` $\rightarrow$ `Verify Transaction Hash`.
3. **Commit**: `Database Transaction` $\rightarrow$ `Increment Wallet Balance` $\rightarrow$ `Log Transaction`.

---

## 4. Security & Constraint Model
- **RLS (Row Level Security)**: Every table in the database is protected by RLS policies, ensuring users can only access their own nutrition logs, health reports, and wallet data.
- **Auth Gates**: Routes are protected via an `AuthProvider` that verifies session validity before rendering components.
- **Type Safety**: End-to-end type safety is maintained using generated Supabase TypeScript types.

`💡 Architecture Note: By moving all complex logic (AI analysis, Payment verification) into Edge Functions, the client remains lightweight and secure, preventing the exposure of sensitive API keys (e.g., Gemini, SADAD) to the browser.`
