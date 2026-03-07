import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StarRating } from "@/components/StarRating";
import { Camera, X, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";

interface MealReviewFormProps {
  mealId: string;
  mealName: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
}

const REVIEW_TAGS = [
  "tag_delicious",
  "tag_fresh",
  "tag_good_portion",
  "tag_healthy",
  "tag_quick_delivery",
  "tag_well_packaged",
  "tag_tasty",
  "tag_nutritious",
  "tag_great_value",
  "tag_perfect_macros",
];

export function MealReviewForm({ mealId, mealName, onSubmitted, onCancel }: MealReviewFormProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getTagDisplayName = (tagKey: string): string => {
    const displayMap: Record<string, string> = {
      tag_delicious: t("tag_delicious"),
      tag_fresh: t("tag_fresh"),
      tag_good_portion: t("tag_good_portion"),
      tag_healthy: t("tag_healthy"),
      tag_quick_delivery: t("tag_quick_delivery"),
      tag_well_packaged: t("tag_well_packaged"),
      tag_tasty: t("tag_tasty"),
      tag_nutritious: t("tag_nutritious"),
      tag_great_value: t("tag_great_value"),
      tag_perfect_macros: t("tag_perfect_macros"),
    };
    return displayMap[tagKey] || tagKey;
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!user) {
      toast.error(t("sign_in_to_upload_photos"));
      return;
    }

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(t("file_too_large").replace("{fileName}", file.name));
          continue;
        }

        if (!file.type.startsWith("image/")) {
          toast.error(t("not_an_image").replace("{fileName}", file.name));
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${mealId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("review-photos")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("review-photos").getPublicUrl(fileName);

        setPhotos((prev) => [...prev, publicUrl]);
      }

      toast.success(t("photos_uploaded_success"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("failed_to_upload_photos");
      captureError(err instanceof Error ? err : new Error(message), {
        context: "MealReviewForm.handlePhotoUpload",
      });
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t("sign_in_to_submit_review"));
      return;
    }

    if (rating === 0) {
      toast.error(t("select_rating"));
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await (supabase.rpc as any)("submit_meal_review", {
        p_meal_id: mealId,
        p_user_id: user.id,
        p_rating: rating,
        p_title: title || null,
        p_review_text: reviewText || null,
        p_photo_urls: photos,
        p_would_recommend: wouldRecommend,
        p_tags: selectedTags,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        action?: string;
        review_id?: string;
        is_verified?: boolean;
        error?: string;
      };

      if (result.success) {
        toast.success(
          result.action === "updated"
            ? t("review_updated_success")
            : t("review_submitted_success"),
          {
            description: result.is_verified
              ? t("thanks_verified_review")
              : t("thanks_feedback"),
          }
        );
        onSubmitted?.();
      } else {
        throw new Error(result.error || t("failed_to_submit_review"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("failed_to_submit_review");
      captureError(err instanceof Error ? err : new Error(message), {
        context: "MealReviewForm.handleSubmit",
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = (rating: number): string => {
    const labels = [t("rating_poor"), t("rating_fair"), t("rating_good"), t("rating_very_good"), t("rating_excellent")];
    return labels[rating - 1] || "";
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{t("review_title")} {mealName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating */}
        <div className="space-y-2">
          <Label>{t("review_rate_meal")}</Label>
          <div className="flex items-center gap-4">
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onRate={setRating}
            />
            <span className="text-sm text-muted-foreground">
              {rating > 0 ? getRatingLabel(rating) : t("select_rating_label")}
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">{t("review_title_optional")}</Label>
          <Input
            id="title"
            placeholder={t("review_title_placeholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Review Text */}
        <div className="space-y-2">
          <Label htmlFor="review">{t("review_your_review")}</Label>
          <Textarea
            id="review"
            placeholder={t("review_placeholder")}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={4}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {reviewText.length}/2000
          </p>
        </div>

        {/* Would Recommend */}
        <div className="space-y-2">
          <Label>{t("would_recommend")}</Label>
          <div className="flex gap-4">
            <Button
              type="button"
              variant={wouldRecommend === true ? "default" : "outline"}
              size="sm"
              onClick={() => setWouldRecommend(true)}
            >
              <Check className="mr-2 h-4 w-4" />
              {t("yes")}
            </Button>
            <Button
              type="button"
              variant={wouldRecommend === false ? "default" : "outline"}
              size="sm"
              onClick={() => setWouldRecommend(false)}
            >
              <X className="mr-2 h-4 w-4" />
              {t("no")}
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label>{t("review_tags_title")}</Label>
          <div className="flex flex-wrap gap-2">
            {REVIEW_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {getTagDisplayName(tag)}
              </button>
            ))}
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-2">
          <Label>{t("add_photos_optional")}</Label>
          <div className="flex flex-wrap gap-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative w-20 h-20">
                <img
                  src={photo}
                  alt={t("review_photo_alt").replace("{index}", String(index + 1))}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-muted-foreground/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
              </label>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("photo_upload_hint")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("review_submit")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
