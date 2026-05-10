import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { captureError } from "@/lib/sentry";

export interface MealReview {
  review_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  rating: number;
  title: string | null;
  review_text: string | null;
  photo_urls: string[];
  is_verified_purchase: boolean;
  would_recommend: boolean | null;
  tags: string[];
  helpful_count: number;
  created_at: string;
}

export interface MealRatingStats {
  average_rating: number;
  total_reviews: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
}

interface UseMealReviewsReturn {
  reviews: MealReview[];
  stats: MealRatingStats | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  fetchReviews: (reset?: boolean) => Promise<void>;
  submitReview: (review: SubmitReviewParams) => Promise<{ success: boolean; error?: string }>;
  deleteReview: (reviewId: string) => Promise<{ success: boolean; error?: string }>;
  voteHelpful: (reviewId: string) => Promise<{ success: boolean; error?: string }>;
}

interface SubmitReviewParams {
  mealId: string;
  rating: number;
  title?: string;
  reviewText?: string;
  photoUrls?: string[];
  wouldRecommend?: boolean;
  tags?: string[];
}

export function useMealReviews(mealId: string): UseMealReviewsReturn {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<MealReview[]>([]);
  const [stats, setStats] = useState<MealRatingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState("newest");

  const fetchReviews = useCallback(
    async (reset = false) => {
      if (!mealId) return;

      try {
        setLoading(true);
        setError(null);

        const newOffset = reset ? 0 : offset;

        const { data: reviewsData, error: reviewsError } = await supabase.rpc(
          "get_meal_reviews",
          {
            p_meal_id: mealId,
            p_limit: 10,
            p_offset: newOffset,
            p_sort_by: sortBy,
          }
        );

        if (reviewsError) throw reviewsError;

        const { data: statsData, error: statsError } = await supabase.rpc(
          "calculate_meal_rating",
          { p_meal_id: mealId }
        );

        if (statsError) throw statsError;

        if (reset) {
          setReviews(reviewsData || []);
          setOffset(10);
        } else {
          setReviews((prev) => [...prev, ...(reviewsData || [])]);
          setOffset((prev) => prev + 10);
        }

        if (statsData && statsData.length > 0) {
          setStats(statsData[0]);
        }

        setHasMore((reviewsData || []).length === 10);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch reviews";
        setError(message);
        captureError(err instanceof Error ? err : new Error(message), {
          context: "useMealReviews.fetchReviews",
        });
      } finally {
        setLoading(false);
      }
    },
    [mealId, offset, sortBy]
  );

  const submitReview = useCallback(
    async (params: SubmitReviewParams): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "Please sign in to submit a review" };
      }

      try {
        const { data, error } = await supabase.rpc("submit_meal_review", {
          p_meal_id: params.mealId,
          p_user_id: user.id,
          p_rating: params.rating,
          p_title: params.title || null,
          p_review_text: params.reviewText || null,
          p_photo_urls: params.photoUrls || [],
          p_would_recommend: params.wouldRecommend ?? null,
          p_tags: params.tags || [],
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
          // Refresh reviews after submission
          await fetchReviews(true);
          return { success: true };
        } else {
          return { success: false, error: result.error || "Failed to submit review" };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to submit review";
        captureError(err instanceof Error ? err : new Error(message), {
          context: "useMealReviews.submitReview",
        });
        return { success: false, error: message };
      }
    },
    [user, fetchReviews]
  );

  const deleteReview = useCallback(
    async (reviewId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "Please sign in" };
      }

      try {
        const { data, error } = await supabase.rpc("delete_meal_review", {
          p_review_id: reviewId,
          p_user_id: user.id,
        });

        if (error) throw error;

        const result = data as { success: boolean; message?: string; error?: string };

        if (result.success) {
          // Remove from local state
          setReviews((prev) => prev.filter((r) => r.review_id !== reviewId));
          return { success: true };
        } else {
          return { success: false, error: result.error || "Failed to delete review" };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete review";
        captureError(err instanceof Error ? err : new Error(message), {
          context: "useMealReviews.deleteReview",
        });
        return { success: false, error: message };
      }
    },
    [user]
  );

  const voteHelpful = useCallback(
    async (reviewId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "Please sign in to vote" };
      }

      try {
        const { error } = await supabase.from("review_votes").insert({
          review_id: reviewId,
          user_id: user.id,
          is_helpful: true,
        });

        if (error) throw error;

        // Update local state
        setReviews((prev) =>
          prev.map((r) =>
            r.review_id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
          )
        );

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to vote";
        captureError(err instanceof Error ? err : new Error(message), {
          context: "useMealReviews.voteHelpful",
        });
        return { success: false, error: message };
      }
    },
    [user]
  );

  // Initial fetch
  useEffect(() => {
    fetchReviews(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  return {
    reviews,
    stats,
    loading,
    error,
    hasMore,
    fetchReviews,
    submitReview,
    deleteReview,
    voteHelpful,
  };
}
