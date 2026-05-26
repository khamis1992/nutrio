import { useMemo } from "react";
import { motion } from "framer-motion";
import { Heart, MessageSquare, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

type ComboCard = {
  id: string;
  title: string;
  author: string;
  image: string;
  likes: number;
  comments: number;
  tags: string[];
  tagTone: "emerald" | "purple";
};

const MOCK: ComboCard[] = [
  {
    id: "c1",
    title: "Power Protein Bowl",
    author: "Sara M.",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop",
    likes: 342,
    comments: 28,
    tags: ["High Protein"],
    tagTone: "emerald",
  },
  {
    id: "c2",
    title: "Keto Lunch Stack",
    author: "Yousef A.",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
    likes: 278,
    comments: 16,
    tags: ["Keto Friendly"],
    tagTone: "emerald",
  },
  {
    id: "c3",
    title: "Berry Smoothie Bowl",
    author: "Reem K.",
    image:
      "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1200&auto=format&fit=crop",
    likes: 199,
    comments: 14,
    tags: ["Low Sugar"],
    tagTone: "purple",
  },
  {
    id: "c4",
    title: "Colorful Clean Plate",
    author: "Omar S.",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop",
    likes: 185,
    comments: 11,
    tags: ["Rich Fiber"],
    tagTone: "emerald",
  },
];

export function PopularCombos() {
  const items = useMemo(() => MOCK, []);
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-foreground">Popular Combos</h2>
        <button
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          onClick={() => navigate("/meals")}
        >
          View All <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="-mx-8 overflow-x-auto px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 pr-8">
          {items.map((card) => (
            <motion.div
              key={card.id}
              whileTap={{ scale: 0.98 }}
              className="w-[126px] shrink-0 overflow-hidden rounded-[17px] border border-gray-100 bg-white shadow-[0_7px_20px_rgba(15,23,42,0.08)]"
            >
              <div className="relative h-[105px] w-full overflow-hidden">
                <img
                  src={card.image}
                  alt={card.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <button
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow"
                  aria-label="Like"
                >
                  <Heart className="h-4 w-4 text-slate-700" />
                </button>
              </div>

              <div className="space-y-2 p-3">
                <div>
                  <h3 className="line-clamp-2 min-h-[32px] text-[13px] font-extrabold leading-4 text-foreground">
                    {card.title}
                  </h3>
                  <p className="truncate text-[11px] text-muted-foreground">by {card.author}</p>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <div className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {card.likes}
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> {card.comments}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {card.tags.map((t) => (
                    <span
                      key={t}
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${card.tagTone === "purple" ? "border-purple-200 bg-purple-50 text-purple-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <button
                  className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1 rounded-[11px] bg-emerald-50 text-[12px] font-extrabold text-emerald-700"
                  onClick={() => navigate("/meals")}
                >
                  Try Combo <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PopularCombos;
