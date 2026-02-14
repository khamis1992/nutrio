

# Reset Password for admin@nutrio.com

## Approach

Create a temporary backend function that uses the admin API to update the user's password, call it to reset the password, then clean up.

## Steps

1. **Create a temporary edge function** (`reset-admin-password`) that:
   - Uses the service role key to access the admin auth API
   - Finds the user by email `admin@nutrio.com`
   - Updates their password to `Khamees1992#`
   - Returns success/failure status

2. **Deploy and call the function** to execute the password reset

3. **Delete the edge function** after use (it's a one-time operation and shouldn't remain deployed)

## Technical Details

- The edge function will use `supabase.auth.admin.updateUserById()` to set the new password
- The service role key (already configured as a secret) grants admin-level access needed for this operation
- The function will be removed immediately after successful execution to avoid security risk

