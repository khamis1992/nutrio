// Backward-compatible entry point. Database schema must be applied through
// Supabase migrations before assigning an administrator.
await import("./assign-admin-role-final.mjs");
