import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Store, User, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RoleIndicatorProps {
  role: "customer" | "partner";
  showSwitch?: boolean;
}

export function RoleIndicator({ role, showSwitch = true }: RoleIndicatorProps) {
  const isPartner = role === "partner";
  
  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={`gap-1.5 px-2.5 py-1 ${
          isPartner 
            ? "bg-amber-500/10 text-amber-600 border-amber-500/30" 
            : "bg-primary/10 text-primary border-primary/30"
        }`}
      >
        {isPartner ? (
          <Store className="w-3 h-3" />
        ) : (
          <User className="w-3 h-3" />
        )}
        <span className="text-xs font-medium">
          {isPartner ? "Partner" : "Customer"}
        </span>
      </Badge>
      
      {showSwitch && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to={isPartner ? "/dashboard" : "/partner"}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeftRight className="w-4 h-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Switch to {isPartner ? "Customer" : "Partner"} view</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
