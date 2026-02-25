import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating, RatingDisplay, RatingBreakdown } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ChevronDown, Check, Flag, ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";

interface Review {
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

interface RatingStats {
  average_rating: number;
  total_reviews: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
}

interface MealReviewsListProps {
  mealId: string;
  mealName: string;
  showWriteReview?: boolean;
  onWriteReview?: () => void;
}

type SortOption = "newest" | "highest" | "lowest" | "helpful";

export function MealReviewsList({
  mealId,
  mealName,
  showWriteReview = true,
  onWriteReview,
}: MealReviewsListProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [votedReviews, setVotedReviews] = useState<Set<string>>(new Set());

  const fetchReviews = async (reset = false) => {
    if (reset) {
      setOffset(0);
      setHasMore(true);
    }

    try {
      setLoading(true);

      // Fetch reviews
      const { data: reviewsData, error: reviewsError } = await (supabase.rpc as any)(
        "get_meal_reviews",
        {
          p_meal_id: mealId,
          p_limit: 10,
          p_offset: reset ? 0 : offset,
          p_sort_by: sortBy,
        }
      );

      if (reviewsError) throw reviewsError;

      // Fetch rating stats
      const { data: statsData, error: statsError } = await (supabase.rpc as any)(
        "calculate_meal_rating",
        { p_meal_id: mealId }
      );

      if (statsError) throw statsError;

      if (reset) {
        setReviews(reviewsData || []);
      } else {
        setReviews((prev) => [...prev, ...(reviewsData || [])]);
      }

      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }

      setHasMore((reviewsData || []).length === 10);
      if (!reset) {
        setOffset((prev) => prev + 10);
      }
    } catch (err) {
      captureError(err instanceof Error ? err : new Error("Failed to fetch reviews"), {
        context: "MealReviewsList.fetchReviews",
      });
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(true);
  }, [mealId, sortBy]);

  const handleVoteHelpful = async (reviewId: string) => {
    if (!user) {
      toast.error("Please sign in to vote");
      return;
    }

    if (votedReviews.has(reviewId)) {
      toast.info("You already voted on this review");
      return;
    }

    try {
      const { error } = await supabase.from("review_votes").insert({
        review_id: reviewId,
        user_id: user.id,
        is_helpful: true,
      });

      if (error) throw error;

      setVotedReviews((prev) => new Set(prev).add(reviewId));
      setReviews((prev) =>
        prev.map((r) =>
          r.review_id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
        )
      );

      toast.success("Thanks for your feedback!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to vote";
      captureError(err instanceof Error ? err : new Error(message), {
        context: "MealReviewsList.handleVoteHelpful",
      });
      toast.error(message);
    }
  };

  const handleReport = async (reviewId: string) => {
    if (!user) {
      toast.error("Please sign in to report");
      return;
    }

    try {
      const { error } = await supabase
        .from("meal_reviews")
        .update({ is_flagged: true })
        .eq("id", reviewId);

      if (error) throw error;

      toast.success("Review reported. Thank you for helping keep our community safe.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to report";
      captureError(err instanceof Error ? err : new Error(message), {
        context: "MealReviewsList.handleReport",
      });
      toast.error(message);
    }
  };

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest First" },
    { value: "highest", label: "Highest Rated" },
    { value: "lowest", label: "Lowest Rated" },
    { value: "helpful", label: "Most Helpful" },
  ];

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      {stats && stats.total_reviews > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="text-center md:text-left">
                  <div className="text-5xl font-bold mb-2">
                    {stats.average_rating.toFixed(1)}
                  </div>
                  <StarRating rating={Math.round(stats.average_rating)} size="md" />
                  <p className="text-muted-foreground mt-1">
                    Based on {stats.total_reviews} {stats.total_reviews === 1 ? "review" : "reviews"}
                  </p>
                </div>
                {showWriteReview && (
                  <Button onClick={onWriteReview} className="w-full">
                    Write a Review
                  </Button>
                )}
              </div>

              <RatingBreakdown
                fiveStar={stats.five_star_count}
                fourStar={stats.four_star_count}
                threeStar={stats.three_star_count}
                twoStar={stats.two_star_count}
                oneStar={stats.one_star_count}
                total={stats.total_reviews}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && reviews.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium mb-2">No reviews yet</p>
              <p className="text-sm mb-4">
                Be the first to review {mealName}!
              </p>
              {showWriteReview && (
                <Button onClick={onWriteReview}>Write a Review</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sort & Filter */}
      {reviews.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {stats?.total_reviews || 0} {stats?.total_reviews === 1 ? "review" : "reviews"}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border rounded-md px-3 py-1 bg-background"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.review_id}>
            <CardContent className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={review.user_avatar || undefined} />
                    <AvatarFallback>
                      {review.user_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{review.user_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <StarRating rating={review.rating} size="sm" />
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(review.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                {review.is_verified_purchase && (
                  <Badge variant="secondary" className="text-xs">
                    <Check className="mr-1 h-3 w-3" />
                    Verified Purchase
                  </Badge>
                )}
              </div>

              {/* Content */}
              <div className="space-y-2">
                {review.title && (
                  <p className="font-medium">{review.title}</p>
                )}
                {review.review_text && (
                  <p className="text-muted-foreground">{review.review_text}</p>
                )}
              </div>

              {/* Would Recommend */}
              {review.would_recommend !== null && (
                <div className="flex items-center gap-2">
                  {review.would_recommend ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <Check className="mr-1 h-3 w-3" />
                      Recommends
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                      <Flag className="mr-1 h-3 w-3" />
                      Doesn&apos;t Recommend
                    </Badge>
                  )}
                </div>
              )}

              {/* Tags */}
              {review.tags && review.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {review.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Photos */}
              {review.photo_urls && review.photo_urls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {review.photo_urls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Review photo ${idx + 1}`}
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVoteHelpful(review.review_id)}
                  disabled={votedReviews.has(review.review_id)}
                  className={votedReviews.has(review.review_id) ? "text-primary" : ""}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Helpful ({review.helpful_count})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReport(review.review_id)}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Report
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Load More */}
      {hasMore && reviews.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchReviews(false)}
            disabled={loading}
          >
            {loading ? (
              "Loading..."
            ) : (
              <>
                Load More Reviews
                <ChevronDown className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
