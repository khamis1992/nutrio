import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const fadeVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 25 } }
};

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function EmptyState({ icon, title, description, actionLabel, actionHref, className }: EmptyStateProps) {
  return (
    <motion.div 
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[250px]">{description}</p>
      {actionLabel && actionHref && (
        <Link 
          to={actionHref}
          className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </motion.div>
  );
}