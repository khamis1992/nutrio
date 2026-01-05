import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Star,
  MessageSquare,
  Send,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerNavigation } from "@/components/PartnerNavigation";

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  partner_response: string | null;
  responded_at: string | null;
  created_at: string;
  meal: {
    name: string;
  } | null;
  profile: {
    full_name: string | null;
  } | null;
}

const PartnerReviews = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReviews();
    }
  }, [user]);

  const fetchReviews = async () => {
    if (!user) return;

    try {
      // Get partner's restaurant
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!restaurant) {
        navigate("/partner");
        return;
      }

      // Fetch reviews
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id,
          user_id,
          rating,
          comment,
          partner_response,
          responded_at,
          created_at,
          meals:meal_id (name)
        `)
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set((data || []).map((r) => r.user_id))];
      let profilesMap: Record<string, { full_name: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { full_name: p.full_name };
            return acc;
          }, {} as Record<string, { full_name: string | null }>);
        }
      }

      const reviewsWithProfiles = (data || []).map((r: any) => ({
        ...r,
        meal: r.meals,
        profile: profilesMap[r.user_id] || null,
      }));

      setReviews(reviewsWithProfiles);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async (reviewId: string) => {
    if (!responseText.trim()) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("reviews")
        .update({
          partner_response: responseText,
          responded_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (error) throw error;

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, partner_response: responseText, responded_at: new Date().toISOString() }
            : r
        )
      );

      setRespondingTo(null);
      setResponseText("");
      toast({ title: "Response submitted" });
    } catch (error) {
      console.error("Error submitting response:", error);
      toast({
        title: "Error",
        description: "Failed to submit response",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/partner")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Reviews</h1>
              <p className="text-sm text-muted-foreground">
                {reviews.length} reviews • {averageRating.toFixed(1)} avg rating
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Summary Card */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold">{averageRating.toFixed(1)}</p>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(averageRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold">{reviews.length}</p>
                <p className="text-sm text-muted-foreground">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {reviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No reviews yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Reviews will appear here when customers rate your meals
              </p>
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4 space-y-4">
                {/* Review Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {review.profile?.full_name || "Customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Meal Badge */}
                {review.meal && (
                  <Badge variant="secondary" className="text-xs">
                    {review.meal.name}
                  </Badge>
                )}

                {/* Comment */}
                {review.comment && (
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                )}

                {/* Partner Response */}
                {review.partner_response && (
                  <div className="bg-muted/50 rounded-lg p-3 ml-6 border-l-2 border-primary">
                    <p className="text-xs font-medium text-primary mb-1">Your Response</p>
                    <p className="text-sm">{review.partner_response}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {review.responded_at &&
                        new Date(review.responded_at).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Response Form */}
                {!review.partner_response && (
                  <>
                    {respondingTo === review.id ? (
                      <div className="space-y-2 ml-6">
                        <Textarea
                          placeholder="Write your response..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => submitResponse(review.id)}
                            disabled={submitting || !responseText.trim()}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            {submitting ? "Sending..." : "Send"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRespondingTo(null);
                              setResponseText("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRespondingTo(review.id)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Respond
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>

      <PartnerNavigation />
    </div>
  );
};

export default PartnerReviews;