

## Fix: Meal Image Analysis Not Working

### Problem
The `analyze-meal-image` edge function uses Zhipu AI with model `glm-4v-plus`, which returns error 1211 ("model does not exist"). The model name is invalid or deprecated on the Zhipu platform.

### Solution
Rewrite the `analyze-meal-image` edge function to use the **Lovable AI gateway** with `google/gemini-2.5-flash` instead of Zhipu AI. This project already has Lovable Cloud enabled with a `LOVABLE_API_KEY` secret configured, so no new API keys are needed.

### Changes

**1. Rewrite `supabase/functions/analyze-meal-image/index.ts`**
- Remove all Zhipu AI logic
- Use the Lovable AI gateway (`https://ai-gateway.lovable.dev/v1/chat/completions`) with model `google/gemini-2.5-flash`
- For image input, fetch the image from the URL, convert to base64, and send as `inline_data` in the request (Gemini format via the gateway)
- Keep the same request/response interface so the frontend code in `PartnerMenu.tsx` and `LogMealDialog.tsx` continues to work without changes
- Keep both `quick_scan` and full analysis modes
- Use `LOVABLE_API_KEY` secret (already configured) for authentication

**2. Fix pre-existing build errors in 4 edge functions**
- `adaptive-goals-batch/index.ts` line 131: cast `error` to `Error`
- `adaptive-goals/index.ts` line 517: cast `error` to `Error`
- `check-ip-location/index.ts` line 83: cast `error` to `Error`
- `log-user-ip/index.ts` line 59: cast `error` to `Error`

### Technical Details

The new edge function will:
1. Receive `imageUrl`, `availableTags`, and `mode` from the request body
2. Fetch the image from the URL and convert it to base64
3. Call `https://ai-gateway.lovable.dev/v1/chat/completions` with model `google/gemini-2.5-flash`, passing the image as base64 inline data
4. Parse the JSON response from the AI model
5. Return the same response format the frontend expects (`{ success, mealDetails }` or `{ success, detectedItems }`)

No frontend changes are required since the response format remains the same.

