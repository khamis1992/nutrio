import { supabase } from "@/integrations/supabase/client";

function extractObjectPath(bucket: string, storedValue: string): string {
  if (!storedValue.startsWith("http://") && !storedValue.startsWith("https://")) {
    return storedValue.replace(/^\/+/, "");
  }

  const url = new URL(storedValue);
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];
  const marker = markers.find((candidate) => url.pathname.includes(candidate));

  if (!marker) {
    throw new Error(`Invalid ${bucket} storage URL`);
  }

  return decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
}

export async function createPrivateStorageUrl(
  bucket: string,
  storedValue: string,
  expiresInSeconds = 300,
): Promise<string> {
  const path = extractObjectPath(bucket, storedValue);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
