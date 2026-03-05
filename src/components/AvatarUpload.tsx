import { useState, useRef } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  onAvatarUpdate: (url: string) => void;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { container: "w-16 h-16", icon: "w-6 h-6", camera: "w-5 h-5", badge: "w-5 h-5 bottom-0 right-0" },
  md: { container: "w-20 h-20", icon: "w-8 h-8", camera: "w-5 h-5", badge: "w-6 h-6 bottom-0 right-0" },
  lg: { container: "w-28 h-28", icon: "w-10 h-10", camera: "w-5 h-5", badge: "w-8 h-8 bottom-0 right-0" },
};

export const AvatarUpload = ({
  currentAvatarUrl,
  onAvatarUpdate,
  size = "md",
}: AvatarUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayUrl = previewUrl || currentAvatarUrl;
  const sizes = sizeMap[size];

  const uploadBase64 = async (base64Data: string, ext: string) => {
    if (!user) return;
    setUploading(true);
    try {
      // Convert base64 data URL to Blob for upload
      const res = await fetch(base64Data);
      const blob = await res.blob();
      const filePath = `avatars/${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { upsert: true, contentType: blob.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      onAvatarUpdate(publicUrl);
      toast({ title: "Avatar updated", description: "Your profile picture has been updated." });
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      setPreviewUrl(null);
      const msg = err?.message || "";
      const description = msg.includes("Bucket not found") || msg.includes("bucket")
        ? "Storage not set up. Please contact support."
        : msg.includes("row-level security") || msg.includes("policy")
        ? "Permission denied. Please try again or re-login."
        : msg || "Failed to upload avatar. Please try again.";
      toast({ title: "Upload failed", description, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Native: use Capacitor Camera plugin (avoids WebView file input issues)
  const handleNativePick = async () => {
    if (uploading) return;
    try {
      const photo = await CapCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 85,
      });
      if (!photo.dataUrl) return;
      setPreviewUrl(photo.dataUrl);
      const ext = photo.format || "jpeg";
      await uploadBase64(photo.dataUrl, ext);
    } catch {
      // User cancelled — do nothing
    }
  };

  // Web: standard file input
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewUrl(dataUrl);
      const ext = file.name.split(".").pop() || "jpg";
      await uploadBase64(dataUrl, ext);
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    if (uploading) return;
    if (Capacitor.isNativePlatform()) {
      handleNativePick();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          "relative rounded-full overflow-hidden bg-muted border-4 border-background shadow-lg cursor-pointer",
          sizes.container
        )}
        onClick={handleClick}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <User className={cn(sizes.icon, "text-primary")} />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className={cn(sizes.icon, "animate-spin text-white")} />
          </div>
        )}
      </div>

      {/* Camera badge */}
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md border-2 border-background",
          sizes.badge
        )}
      >
        <Camera className={sizes.camera} />
      </button>

      {/* Web-only hidden file input */}
      {!Capacitor.isNativePlatform() && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
};
