import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CuisineChipsProps {
  selectedCuisine: string | null;
  onSelect: (cuisine: string | null) => void;
}

const cuisines = [
  { id: "all", label: "All", icon: "✨" },
  { id: "healthy", label: "Healthy", icon: "🥗" },
  { id: "italian", label: "Italian", icon: "🍝" },
  { id: "asian", label: "Asian", icon: "🥢" },
  { id: "mediterranean", label: "Mediterranean", icon: "🫒" },
  { id: "vegan", label: "Vegan", icon: "🌱" },
  { id: "protein", label: "High Protein", icon: "💪" },
];

export function CuisineChips({ selectedCuisine, onSelect }: CuisineChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin hide-scrollbar">
      {cuisines.map((cuisine, index) => {
        const isSelected = selectedCuisine === cuisine.id || (cuisine.id === "all" && !selectedCuisine);
        
        return (
          <motion.button
            key={cuisine.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.3, 
              delay: index * 0.05,
              ease: [0.4, 0, 0.2, 1]
            }}
            onClick={() => onSelect(cuisine.id === "all" ? null : cuisine.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 rounded-full font-accent text-sm font-medium whitespace-nowrap transition-all duration-300",
              "border-2 min-h-[44px]",
              isSelected
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-white text-foreground border-border hover:border-secondary hover:text-secondary"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-base">{cuisine.icon}</span>
            <span>{cuisine.label}</span>
            {isSelected && (
              <motion.div
                layoutId="activeChip"
                className="absolute inset-0 bg-primary rounded-full -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
