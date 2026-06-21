import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Share2,
  UtensilsCrossed,
  ChefHat,
  TrendingUp,
  MessageSquare,
} from "lucide-react";
import { springBouncy, fadeInUp } from "@/lib/animations";

interface SharedCombo {
  id: string;
  author: string;
  mealName: string;
  combo: string[];
  likes: number;
  liked: boolean;
}

const MOCK_COMBOS: SharedCombo[] = [
  {
    id: "1",
    author: "Sara M.",
    mealName: "Post-Workout Power Bowl",
    combo: ["Grilled Chicken", "Quinoa", "Steamed Veggies", "Avocado"],
    likes: 342,
    liked: false,
  },
  {
    id: "2",
    author: "Yousef A.",
    mealName: "Keto Lunch Stack",
    combo: ["Salmon Fillet", "Caesar Salad", "Almond Butter"],
    likes: 278,
    liked: false,
  },
  {
    id: "3",
    author: "Layla H.",
    mealName: "Protein Breakfast",
    combo: ["Egg White Omelette", "Oatmeal", "Mixed Berries"],
    likes: 195,
    liked: false,
  },
];

export function RecipeShareCard() {
  const [combos, setCombos] = useState(MOCK_COMBOS);

  const toggleLike = (id: string) => {
    setCombos((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 }
          : c
      )
    );
  };

  return (
    <motion.div variants={fadeInUp}>
      <Card className="overflow-hidden border-0 shadow-card">
        <div className="bg-[#020617] px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <ChefHat className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-sm font-bold text-white">
                Community Combos
              </CardTitle>
            </div>
            <Badge className="bg-white/20 text-white border-0 text-[10px] font-semibold">
              <TrendingUp className="w-3 h-3 mr-1" />
              Trending
            </Badge>
          </div>
        </div>

        <CardContent className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            See what meal combinations the community loves
          </p>

          <AnimatePresence mode="popLayout">
            {combos.slice(0, 2).map((combo, index) => (
              <motion.div
                key={combo.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl bg-muted/50 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground leading-snug">
                      {combo.mealName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      by {combo.author}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-[10px] font-medium"
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {combo.likes}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {combo.combo.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-background border border-border/50 text-[10px] font-medium text-muted-foreground"
                    >
                      <UtensilsCrossed className="w-3 h-3 mr-1 text-primary/60" />
                      {item}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <motion.div whileTap={{ scale: 0.92 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 rounded-lg text-xs font-medium gap-1.5 ${
                        combo.liked
                          ? "text-rose-500 bg-rose-50 hover:bg-rose-100"
                          : "text-muted-foreground hover:text-rose-500"
                      }`}
                      onClick={() => toggleLike(combo.id)}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          combo.liked ? "fill-rose-500" : ""
                        }`}
                      />
                      Like
                    </Button>
                  </motion.div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
