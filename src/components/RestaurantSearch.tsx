import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search, Star, X } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
}

interface RestaurantSearchProps {
  restaurants: Restaurant[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RestaurantSearch({ 
  restaurants, 
  value, 
  onChange,
  placeholder = "Search restaurants..."
}: RestaurantSearchProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  const suggestions = value.length > 0
    ? restaurants
        .filter(r => 
          r.name.toLowerCase().includes(value.toLowerCase()) ||
          r.description?.toLowerCase().includes(value.toLowerCase())
        )
        .slice(0, 5)
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          navigate(`/restaurants/${suggestions[highlightedIndex].id}`);
          setIsOpen(false);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSuggestionClick = (restaurantId: string) => {
    navigate(`/restaurants/${restaurantId}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-fade-in">
          {suggestions.map((restaurant, index) => (
            <button
              key={restaurant.id}
              onClick={() => handleSuggestionClick(restaurant.id)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                highlightedIndex === index 
                  ? "bg-accent" 
                  : "hover:bg-muted"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl overflow-hidden shrink-0">
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
                <p className="font-medium truncate">{restaurant.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="w-3 h-3 fill-warning text-warning" />
                  <span>{restaurant.rating.toFixed(1)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
