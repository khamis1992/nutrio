import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryPartners } from "@/hooks/useRecovery";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, MapPin, Clock, Zap, SlidersHorizontal, X } from "lucide-react";

const SERVICE_FILTERS = [
  { key: "all", label: "All", label_ar: "الكل" },
  { key: "massage", label: "Massage", label_ar: "مساج" },
  { key: "cryotherapy", label: "Cryotherapy", label_ar: "علاج بالتبريد" },
  { key: "float", label: "Float Tank", label_ar: "حوض طفو" },
  { key: "spa", label: "Spa", label_ar: "سبا" },
];

export default function RecoveryPartners() {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { partners, loading } = useRecoveryPartners();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = partners;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.name_ar && p.name_ar.includes(q)) ||
          (p.city && p.city.toLowerCase().includes(q)) ||
          (p.address && p.address.toLowerCase().includes(q))
      );
    }

    if (filter !== "all") {
      result = result.filter((p) => {
        const services = p.services || [];
        return services.some((s: { name?: string }) => {
          const name = (s.name || "").toLowerCase();
          if (filter === "massage") return name.includes("massage");
          if (filter === "cryotherapy") return name.includes("cryo");
          if (filter === "float") return name.includes("float");
          if (filter === "spa") return name.includes("spa") || name.includes("hammam");
          return false;
        });
      });
    }

    return result;
  }, [partners, search, filter]);

  return (
    <div className="px-4 pb-24">
      {/* Header */}
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-violet-500" />
          {isRTL ? t("recovery_title_ar") : t("recovery_title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover wellness partners and use your recovery credits
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
        <Input
          placeholder={isRTL ? t("recovery_search_ar") : t("recovery_search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} h-10 bg-gray-50 dark:bg-gray-900`}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-3" : "right-3"}`}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
        {SERVICE_FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            className={`rounded-full text-xs whitespace-nowrap shrink-0 ${
              filter === f.key ? "bg-violet-600 hover:bg-violet-700" : ""
            }`}
            onClick={() => setFilter(f.key)}
          >
            {isRTL ? f.label_ar : f.label}
          </Button>
        ))}
      </div>

      {/* Partners Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No partners found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((partner) => (
            <Card
              key={partner.id}
              className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && navigate(`/recovery/${partner.id}`)}
              onClick={() => navigate(`/recovery/${partner.id}`)}
            >
              {/* Cover */}
              <div className="h-32 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-950 dark:to-purple-950 relative">
                {partner.logo_url && (
                  <img
                    src={partner.logo_url}
                    alt={partner.name}
                    className="absolute bottom-0 right-0 translate-y-1/2 w-14 h-14 rounded-xl border-2 border-white shadow-sm object-cover"
                  />
                )}
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-white/90 text-xs backdrop-blur-sm">
                    <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                    {partner.rating?.toFixed(1)}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4 pt-6">
                <h3 className="font-semibold text-base">
                  {isRTL && partner.name_ar ? partner.name_ar : partner.name}
                </h3>

                {partner.address && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {partner.address}
                  </p>
                )}

                {/* Services preview */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {(partner.services || []).slice(0, 3).map((s: { name?: string; credits_required?: number }) => (
                    <Badge key={s.name} variant="outline" className="text-xs">
                      <Zap className="w-2.5 h-2.5 mr-0.5 text-violet-500" />
                      {s.credits_required}
                    </Badge>
                  ))}
                  {(partner.services || []).length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{(partner.services || []).length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* My Bookings FAB */}
      <Button
        className="fixed bottom-20 right-4 rounded-full shadow-lg bg-violet-600 hover:bg-violet-700 h-12"
        onClick={() => navigate("/recovery/bookings")}
      >
        <Clock className="w-5 h-5 mr-2" />
        {isRTL ? t("recovery_my_bookings_ar") : t("recovery_my_bookings")}
      </Button>
    </div>
  );
}
