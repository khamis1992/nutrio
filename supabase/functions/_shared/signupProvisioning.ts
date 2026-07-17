import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

export type SignupProvisioningKind =
  | "partner_invitation"
  | "fleet_driver_invitation"
  | "fleet_manager_invitation";

export interface SignupProvisioningGrant {
  token: string;
  tokenHash: string;
  kind: SignupProvisioningKind;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function hashProvisioningToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function issueSignupProvisioningGrant(
  service: SupabaseClient,
  input: {
    email: string;
    kind: SignupProvisioningKind;
    createdBy: string;
  },
): Promise<SignupProvisioningGrant> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const token = base64UrlEncode(random);
  const tokenHash = await hashProvisioningToken(token);

  const { error } = await service.rpc("issue_signup_provisioning_grant", {
    p_token_hash: tokenHash,
    p_email: input.email,
    p_kind: input.kind,
    p_created_by: input.createdBy,
    p_ttl_seconds: 300,
  });
  if (error) throw error;

  return { token, tokenHash, kind: input.kind };
}

export async function assertSignupProvisioningGrantConsumed(
  service: SupabaseClient,
  tokenHash: string,
): Promise<void> {
  const { data, error } = await service.rpc(
    "is_signup_provisioning_grant_consumed",
    { p_token_hash: tokenHash },
  );
  if (error) throw error;
  if (data !== true) throw new Error("auth_hook_not_enforced");
}

export async function clearSignupProvisioningMetadata(
  service: SupabaseClient,
  userId: string,
  currentMetadata: Record<string, unknown> | null | undefined,
): Promise<void> {
  const sanitizedMetadata = { ...(currentMetadata || {}) };
  delete sanitizedMetadata.nutrio_provisioning_token;
  delete sanitizedMetadata.nutrio_provisioning_kind;

  const { error } = await service.auth.admin.updateUserById(userId, {
    user_metadata: sanitizedMetadata,
  });
  if (error) throw error;
}
