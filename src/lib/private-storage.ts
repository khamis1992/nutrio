import { supabase } from "@/integrations/supabase/client";

const STORAGE_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export type SensitiveStorageBucket =
  | "blood-reports"
  | "ticket-attachments"
  | "coach-photos"
  | "coach-attachments"
  | "fleet-documents";

type SensitiveUploadResponse = {
  path: string;
  sha256: string;
  scan_status: "clean" | "validated_only";
  evidence_id: string;
};

export function validatePrivateStorageFile(
  file: File,
  allowedMimeTypes: readonly string[],
  maxBytes: number,
): string {
  if (file.size <= 0) throw new Error("The selected file is empty");
  if (file.size > maxBytes) throw new Error(`File must be under ${Math.floor(maxBytes / 1024 / 1024)}MB`);
  if (!allowedMimeTypes.includes(file.type) || !STORAGE_EXTENSIONS[file.type]) {
    throw new Error("File type not allowed");
  }
  return STORAGE_EXTENSIONS[file.type];
}

export async function uploadSensitiveFile(
  bucket: SensitiveStorageBucket,
  path: string,
  file: File,
): Promise<SensitiveUploadResponse> {
  const form = new FormData();
  form.set("bucket", bucket);
  form.set("path", path);
  form.set("file", file, file.name);

  const { data, error } = await supabase.functions.invoke("secure-sensitive-upload", {
    body: form,
  });

  if (error) throw error;
  if (
    !data
    || data.path !== path
    || typeof data.sha256 !== "string"
    || !/^[a-f0-9]{64}$/i.test(data.sha256)
    || !["clean", "validated_only"].includes(data.scan_status)
    || typeof data.evidence_id !== "string"
    || data.evidence_id.length === 0
  ) {
    throw new Error("The secure upload service returned an invalid response");
  }
  return data as SensitiveUploadResponse;
}

export function extractStorageObjectPath(bucket: string, storedValue: string): string {
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
  const path = extractStorageObjectPath(bucket, storedValue);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
