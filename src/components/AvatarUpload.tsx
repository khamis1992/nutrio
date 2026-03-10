import { useState, useRef } from "react";
import { Camera, ImageIcon, Loader2, User, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { motion, AnimatePresence } from "framer-motion";

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
  const [showSourcePicker, setShowSourcePicker] = useState(false);

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

  // Native: open camera or photo library based on user choice
  const handleNativePick = async (source: CameraSource) => {
    setShowSourcePicker(false);
    if (uploading) return;
    try {
      const photo = await CapCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source,
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
      // Show picker to choose between camera and library
      setShowSourcePicker(true);
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

      {/* Native source picker bottom sheet */}
      <AnimatePresence>
        {showSourcePicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSourcePicker(false)}
              className="fixed inset-0 bg-black/50 z-[200]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-[201] pb-safe"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
              </div>
              <p className="text-center text-sm font-semibold text-muted-foreground px-5 py-3">
                Update Profile Photo
              </p>
              <div className="px-4 pb-6 space-y-2">
                <button
                  onClick={() => handleNativePick(CameraSource.Camera)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-muted/50 active:bg-muted transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold">Take Photo</span>
                </button>
                <button
                  onClick={() => handleNativePick(CameraSource.Photos)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-muted/50 active:bg-muted transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold">Choose from Library</span>
                </button>
                <button
                  onClick={() => setShowSourcePicker(false)}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl text-muted-foreground active:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="font-semibold">Cancel</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
