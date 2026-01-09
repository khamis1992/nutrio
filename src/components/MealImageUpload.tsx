import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, ImageIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MealImageUploadProps {
  currentImageUrl?: string | null;
  onImageChange: (url: string | null) => void;
  mealId?: string;
  onImageUploaded?: (imageUrl: string) => void;
  isAnalyzing?: boolean;
}

export const MealImageUpload = ({ currentImageUrl, onImageChange, mealId, onImageUploaded, isAnalyzing }: MealImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
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
      const fileName = `${mealId || "new"}-${Date.now()}.${fileExt}`;
      const filePath = `meals/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("meal-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("meal-images")
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onImageChange(publicUrl);

      toast({ title: "Image uploaded successfully" });

      // Trigger auto-analysis if callback is provided
      if (onImageUploaded) {
        console.log("Triggering AI analysis for image:", publicUrl);
        try {
          onImageUploaded(publicUrl);
        } catch (callbackError) {
          console.error("Error in onImageUploaded callback:", callbackError);
        }
      } else {
        console.log("No onImageUploaded callback provided");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
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
    onImageChange(null);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Meal Image
      </Label>

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Meal preview"
                className={`w-full h-full object-cover ${isAnalyzing ? "opacity-50" : ""}`}
                onError={() => setPreviewUrl(null)}
              />
              {isAnalyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <Sparkles className="w-6 h-6 animate-pulse text-primary" />
                </div>
              )}
              {!isAnalyzing && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </>
          ) : (
            <div className="text-center text-muted-foreground">
              <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
              <span className="text-xs">No image</span>
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
            id="meal-image-upload"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || isAnalyzing}
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAnalyzing ? (
              <Sparkles className="h-4 w-4 animate-pulse" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : isAnalyzing ? "Analyzing with AI..." : "Upload Image"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {isAnalyzing ? "AI is analyzing your meal image..." : "JPG, PNG or WebP. Max 5MB."}
          </p>
        </div>
      </div>
    </div>
  );
};
