import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCoachAttachments(coachId: string | undefined, clientId: string | undefined) {
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!coachId || !clientId) {
        throw new Error("Missing coach or client ID");
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size must be under 10MB");
      }

      // Validate file type — block executables
      const blockedExtensions = [".exe", ".sh", ".bat", ".cmd", ".ps1", ".msi", ".dmg", ".app"];
      const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (blockedExtensions.includes(extension)) {
        throw new Error("File type not allowed");
      }

      setUploading(true);
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${coachId}/${clientId}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("coach-attachments")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          // Try to find a more descriptive error
          if (uploadError.message.includes("Bucket") && uploadError.message.includes("not found")) {
            throw new Error("Storage bucket not configured. Please create the 'coach-attachments' bucket in your Supabase dashboard.");
          }
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from("coach-attachments")
          .getPublicUrl(filePath);

        return {
          filePath,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          publicUrl: urlData.publicUrl,
        };
      } catch (err) {
        console.error("Error uploading file:", err);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [coachId, clientId]
  );

  const saveAttachment = useCallback(
    async (messageId: string, fileData: { filePath: string; fileName: string; fileSize: number; fileType: string }) => {
      if (!coachId) return;
      try {
        const { error } = await supabase.from("coach_chat_attachments").insert({
          message_id: messageId,
          file_path: fileData.filePath,
          file_name: fileData.fileName,
          file_size: fileData.fileSize,
          file_type: fileData.fileType,
          uploaded_by: coachId,
        });
        if (error) throw error;
      } catch (err) {
        console.error("Error saving attachment record:", err);
        throw err;
      }
    },
    [coachId]
  );

  return { uploading, uploadFile, saveAttachment };
}
