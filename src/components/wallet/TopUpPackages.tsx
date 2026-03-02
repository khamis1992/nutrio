import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import type { TopUpPackage } from "@/hooks/useWallet";

interface TopUpPackagesProps {
  packages: TopUpPackage[];
  loading?: boolean;
  onSelectPackage: (pkg: TopUpPackage) => void;
  selectedPackageId?: string;
  processingId?: string;
}

export function TopUpPackages({ 
  packages, 
  loading, 
  onSelectPackage, 
  selectedPackageId,
  processingId 
}: TopUpPackagesProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Top-up Packages</h2>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-16 mb-2" />
                <div className="h-6 bg-muted rounded w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getPackageStyle = (pkg: TopUpPackage) => {
    if (pkg.bonus_amount >= 100) return "border-purple-500 bg-purple-50";
    if (pkg.bonus_amount >= 30) return "border-amber-500 bg-amber-50";
    if (pkg.bonus_amount >= 10) return "border-gray-400 bg-gray-50";
    return "";
  };

  const getPackageBadge = (pkg: TopUpPackage) => {
    if (pkg.bonus_amount >= 100) return { text: "Best Value", color: "bg-purple-500" };
    if (pkg.bonus_amount >= 30) return { text: "Popular", color: "bg-amber-500" };
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Top-up Packages</h2>
        <p className="text-sm text-muted-foreground">Get bonus credits!</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {packages.map((pkg) => {
          const badge = getPackageBadge(pkg);
          const totalAmount = pkg.amount + pkg.bonus_amount;
          const isSelected = selectedPackageId === pkg.id;
          const isProcessing = processingId === pkg.id;

          return (
            <Card 
              key={pkg.id} 
              className={`relative cursor-pointer transition-all ${
                getPackageStyle(pkg)
              } ${isSelected ? 'ring-2 ring-green-500' : ''}`}
              onClick={() => onSelectPackage(pkg)}
            >
              {badge && (
                <Badge 
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 ${badge.color}`}
                >
                  {badge.text}
                </Badge>
              )}
              
              <CardContent className="p-4 text-center">
                <p className="font-semibold text-lg">{pkg.name}</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(pkg.amount)}
                </p>
                
                {pkg.bonus_amount > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-purple-600">
                    <span className="text-sm font-medium">
                      +{formatCurrency(pkg.bonus_amount)} bonus
                    </span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  You get {formatCurrency(totalAmount)}
                </p>

                <Button 
                  className="w-full mt-3"
                  variant={isSelected ? "default" : "outline"}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    "Processing..."
                  ) : isSelected ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Selected
                    </>
                  ) : (
                    "Select"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Secure payment via Sadad • Credits never expire
      </p>
    </div>
  );
}
