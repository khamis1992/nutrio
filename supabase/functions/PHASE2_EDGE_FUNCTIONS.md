# Phase 2 Edge Functions Documentation

## Overview
Two Supabase Edge Functions for Nutrio Fuel Phase 2 automation:
1. **auto-assign-driver** - Automatically assigns the best available driver to delivery orders
2. **send-invoice-email** - Automatically sends invoice emails when payments are completed

---

## Environment Variables Required

Add these to your Supabase project settings:

```env
# Required for both functions
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Required for send-invoice-email
RESEND_API_KEY=<your-resend-api-key>
```

### Setting Environment Variables

```bash
# Using Supabase CLI
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set RESEND_API_KEY=your-resend-api-key
```

---

## Function 1: auto-assign-driver

### Description
Automatically assigns the best available driver to a delivery order using a scoring algorithm based on:
- Distance from pickup location (50% weight)
- Available capacity (30% weight) 
- Driver rating (15% weight)
- Experience (5% weight)

### Location
`supabase/functions/auto-assign-driver/index.ts`

### Input
```json
{
  "deliveryId": "uuid-of-delivery"  // Required
}
```

Or alternatively (for backwards compatibility):
```json
{
  "orderId": "uuid-of-delivery"
}
```

### Output
**Success:**
```json
{
  "success": true,
  "driverId": "uuid-of-driver",
  "score": 85,
  "message": "Driver assigned successfully (score: 85, distance: 2.3km)"
}
```

**No drivers available:**
```json
{
  "success": false,
  "message": "No drivers available, queued for manual assignment",
  "queued": true
}
```

**Error:**
```json
{
  "error": "Internal server error",
  "details": "Error message"
}
```

### Database Tables Used
- `deliveries` - Delivery orders
- `drivers` - Driver profiles with location and rating
- `meal_schedules` - Order scheduling
- `restaurants` - Restaurant locations

### Testing

```bash
# Test with curl
curl -X POST https://your-project.supabase.co/functions/v1/auto-assign-driver \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"deliveryId": "your-delivery-uuid"}'
```

---

## Function 2: send-invoice-email

### Description
Automatically generates and sends professional invoice emails when a payment is completed. Creates invoice records, sends via Resend, and logs to email_logs.

### Location
`supabase/functions/send-invoice-email/index.ts`

### Input
```json
{
  "paymentId": "uuid-of-payment"  // Required
}
```

### Output
**Success:**
```json
{
  "success": true,
  "message": "Invoice email sent successfully",
  "emailId": "resend-email-id",
  "invoiceNumber": "INV-2025-A1B2C3"
}
```

**Payment not completed:**
```json
{
  "success": false,
  "message": "Payment status is pending, invoice not sent"
}
```

**Already sent:**
```json
{
  "success": true,
  "message": "Invoice already sent"
}
```

### Database Tables Used
- `payments` - Payment records
- `invoices` - Invoice records
- `profiles` - User details (full_name, email)
- `email_logs` - Email sending history

### Email Template Features
- Nutrio Fuel branding with gradient header
- Professional invoice layout
- Invoice number (INV-YYYY-XXXXXX format)
- Payment details (type, method, status, transaction ID)
- Customer billing information
- Amount in QAR currency
- Footer with support links

### Testing

```bash
# Test with curl
curl -X POST https://your-project.supabase.co/functions/v1/send-invoice-email \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"paymentId": "your-payment-uuid"}'
```

---

## Deployment Instructions

### 1. Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link to your project
```bash
supabase link --project-ref your-project-ref
```

### 4. Set environment variables
```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set RESEND_API_KEY=your-resend-api-key
```

### 5. Deploy individual functions
```bash
# Deploy auto-assign-driver
supabase functions deploy auto-assign-driver

# Deploy send-invoice-email
supabase functions deploy send-invoice-email
```

### 6. Deploy all functions at once
```bash
supabase functions deploy
```

### 7. Verify deployment
```bash
# List deployed functions
supabase functions list

# Get function URL
supabase functions list --debug
```

---

## Invoking Functions from Application

### Using Supabase Client
```typescript
import { supabase } from '@/integrations/supabase/client';

// Auto assign driver
const { data, error } = await supabase.functions.invoke('auto-assign-driver', {
  body: { deliveryId: 'uuid-here' }
});

// Send invoice email
const { data, error } = await supabase.functions.invoke('send-invoice-email', {
  body: { paymentId: 'uuid-here' }
});
```

### Using HTTP Request
```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/auto-assign-driver`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deliveryId: 'uuid-here' }),
  }
);
```

---

## Automation Triggers

### Database Trigger Example (auto-assign-driver)
```sql
-- Trigger auto-assignment when delivery is created with 'pending' status
CREATE OR REPLACE FUNCTION trigger_auto_assign_driver()
RETURNS TRIGGER AS $$
BEGIN
  -- Call edge function via pg_net (requires pg_net extension)
  PERFORM net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/auto-assign-driver',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('deliveryId', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_delivery_pending
  AFTER INSERT ON deliveries
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_auto_assign_driver();
```

### Schedule Auto-Assignment Cron Job
```bash
# Using Supabase Cron (pg_cron extension)
supabase sql "
SELECT cron.schedule(
  'auto-assign-drivers',
  '*/5 * * * *',  -- Every 5 minutes
  $$
    SELECT net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/auto-assign-driver',
      headers := jsonb_build_object('Authorization', 'Bearer your-anon-key'),
      body := jsonb_build_object('deliveryId', (SELECT id FROM deliveries WHERE status = 'pending' ORDER BY created_at LIMIT 1))
    );
  $$
);
"
```

---

## Required Database Migration

To support the auto-assignment functionality, ensure these columns exist:

```sql
-- Add assignment tracking columns to deliveries table
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS assignment_method TEXT,
ADD COLUMN IF NOT EXISTS assignment_score NUMERIC,
ADD COLUMN IF NOT EXISTS assignment_notes TEXT;

-- Add index for pending deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_pending 
ON public.deliveries(status) 
WHERE status = 'pending';
```

---

## Error Handling

Both functions include comprehensive error handling:

1. **Missing credentials** - Returns 500 with clear error message
2. **Missing required fields** - Returns 400 with validation error
3. **Not found errors** - Returns 404 for missing records
4. **Service unavailable** - Returns 503 for external service failures
5. **Rate limiting** - Respects Resend API rate limits

---

## Monitoring & Logging

### View Function Logs
```bash
# Real-time logs
supabase functions logs auto-assign-driver --tail

# Recent logs
supabase functions logs send-invoice-email
```

### Database Logging
- Email logs are stored in `email_logs` table
- Assignment scores are stored in `deliveries.assignment_score`

---

## Security Considerations

1. **Service Role Key** - Required for database operations bypassing RLS
2. **JWT Verification** - Functions should be called with valid JWT
3. **Input Validation** - All inputs are validated before processing
4. **SQL Injection Protection** - Uses parameterized queries
5. **CORS Headers** - Configured for browser access

---

## Package Dependencies (Deno)

These functions use Deno runtime modules:

```typescript
// Standard library
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Supabase client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
```

No npm packages required - all dependencies are imported via URL at runtime.

---

## Troubleshooting

### Function fails to deploy
- Check Supabase CLI is up to date: `supabase --version`
- Verify you're logged in: `supabase projects list`
- Check function syntax is valid TypeScript

### Environment variables not working
- Verify secrets are set: `supabase secrets list`
- Restart functions after setting secrets
- Check variable names match exactly

### Database connection errors
- Verify SUPABASE_URL is correct
- Ensure SUPABASE_SERVICE_ROLE_KEY has proper permissions
- Check RLS policies allow service role access

### Email not sending
- Verify RESEND_API_KEY is valid
- Check Resend dashboard for sending limits
- Verify recipient email is valid
- Check email_logs table for error details

---

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs
- Review Edge Functions guide: https://supabase.com/docs/guides/functions
- Resend API docs: https://resend.com/docs
