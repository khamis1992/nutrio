import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LogoUploadProps {
  currentLogoUrl?: string | null;
  onLogoChange: (url: string | null) => void;
  restaurantId?: string;
}

export const LogoUpload = ({ currentLogoUrl, onLogoChange, restaurantId }: LogoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      // Create a unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${restaurantId || Date.now()}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("restaurant-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("restaurant-logos")
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onLogoChange(publicUrl);

      toast({ title: "Logo uploaded successfully" });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onLogoChange(null);
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Image className="h-4 w-4" />
        Restaurant Logo
      </Label>

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Logo preview"
                className="w-full h-full object-cover"
                onError={() => setPreviewUrl(null)}
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="text-center text-muted-foreground">
              <Image className="w-8 h-8 mx-auto mb-1 opacity-50" />
              <span className="text-xs">No logo</span>
            </div>
          )}
        </div>

        {/* Upload button */}
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="logo-upload"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload Logo"}
          </Button>
          <p className="text-xs text-muted-foreground">
            JPG, PNG or WebP. Max 5MB.
          </p>
        </div>
      </div>
    </div>
  );
};
