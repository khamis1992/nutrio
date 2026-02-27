import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ChevronRight, Heart } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  isFavorite: boolean;
  onToggleFavorite: (id: string, name: string) => void;
}

export function RestaurantCard({ restaurant, isFavorite, onToggleFavorite }: RestaurantCardProps) {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite(restaurant.id, restaurant.name);
  };

  return (
    <Link to={`/restaurant/${restaurant.id}`}>
      <Card variant="interactive">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-4xl overflow-hidden shrink-0 shadow-md border border-border/50">
              {restaurant.logo_url ? (
                <img 
                  src={restaurant.logo_url} 
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                "🍽️"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{restaurant.name}</h3>
                  {restaurant.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {restaurant.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={handleFavoriteClick}
                  >
                    <Heart 
                      className={`w-5 h-5 transition-colors ${
                        isFavorite 
                          ? "fill-destructive text-destructive" 
                          : "text-muted-foreground hover:text-destructive"
                      }`} 
                    />
                  </Button>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-warning text-warning" />
                  {restaurant.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  {restaurant.total_orders} orders
                </span>
                <span className="text-muted-foreground">
                  {restaurant.meal_count} meals
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default RestaurantCard;
