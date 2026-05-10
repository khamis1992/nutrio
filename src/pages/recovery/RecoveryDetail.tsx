import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryPartner, type RecoveryService } from "@/hooks/useRecovery";
import { RecoveryBookingDialog } from "@/components/recovery/RecoveryBookingDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecoveryBookings } from "@/hooks/useRecovery";
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Zap,
  Phone,
  Globe,
  Calendar,
  MessageSquare,
} from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RecoveryDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { partner, loading } = useRecoveryPartner(id || "");
  const { bookings, refetch: refetchBookings } = useRecoveryBookings();
  const [bookingOpen, setBookingOpen] = useState(false);

  if (loading) {
    return (
      <div className="px-4 pb-24">
        <Skeleton className="h-48 w-full mb-4" />
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-6" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Partner not found</p>
        <Button onClick={() => navigate("/recovery")} variant="outline" className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const partnerBookings = bookings.filter((b) => b.partner_id === partner.id);
  const completedCount = partnerBookings.filter((b) => b.status === "completed").length;

  return (
    <div className="pb-24">
      {/* Cover */}
      <div className="h-48 bg-gradient-to-br from-violet-200 to-purple-300 dark:from-violet-950 dark:to-purple-950 relative">
        <button
          onClick={() => navigate(-1)}
          className={`absolute top-4 ${isRTL ? "right-4" : "left-4"} bg-white/80 backdrop-blur-sm rounded-full p-2`}
        >
          <ArrowLeft className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
        </button>
        {partner.logo_url && (
          <img
            src={partner.logo_url}
            alt={partner.name}
            className="absolute bottom-0 right-0 translate-y-1/2 w-20 h-20 rounded-2xl border-3 border-white shadow-md object-cover mx-4"
          />
        )}
      </div>

      <div className="px-4 pt-12">
        {/* Name & Rating */}
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-xl font-bold">
            {isRTL && partner.name_ar ? partner.name_ar : partner.name}
          </h1>
          <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-950 px-2 py-1 rounded-lg">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold">{partner.rating?.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({partner.review_count})</span>
          </div>
        </div>

        {/* Address */}
        {partner.address && (
          <p className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
            <MapPin className="w-3.5 h-3.5" />
            {partner.address}
          </p>
        )}

        {/* Description */}
        {partner.description && (
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {isRTL && partner.description_ar ? partner.description_ar : partner.description}
          </p>
        )}

        {/* Contact */}
        <div className="flex gap-3 mb-6">
          {partner.phone && (
            <a href={`tel:${partner.phone}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                <span className="text-xs">{isRTL ? t("recovery_phone_ar") : t("recovery_phone")}</span>
              </Button>
            </a>
          )}
          {partner.website && (
            <a href={partner.website} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span className="text-xs">{isRTL ? t("recovery_website_ar") : t("recovery_website")}</span>
              </Button>
            </a>
          )}
        </div>

        {/* Opening Hours */}
        {partner.opening_hours && Object.keys(partner.opening_hours).length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500" />
                {isRTL ? t("recovery_opening_hours_ar") : t("recovery_opening_hours")}
              </h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {Object.entries(partner.opening_hours).map(([day, hours]: [string, { open: string; close: string }]) => (
                  <div key={day} className="flex justify-between">
                    <span className="text-muted-foreground">{day.slice(0, 3)}</span>
                    <span className="font-medium">
                      {hours.open} - {hours.close}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Services */}
        <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-500" />
          {isRTL ? t("recovery_services_ar") : t("recovery_services")}
        </h3>
        <div className="space-y-3 mb-6">
          {(partner.services || []).map((service: RecoveryService) => (
            <Card key={service.name} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">
                      {isRTL && service.name_ar ? service.name_ar : service.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {service.duration_min} {isRTL ? t("recovery_min_ar") : t("recovery_min")}
                    </div>
                  </div>
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    <Zap className="w-3 h-3 mr-1" />
                    {service.credits_required} {isRTL ? t("recovery_credits_ar") : t("recovery_credits")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Reviews summary */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-500" />
              {isRTL ? t("recovery_reviews_ar") : t("recovery_reviews")}
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-2xl font-bold">{partner.rating?.toFixed(1)}</span>
                <div className="flex mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${
                        s <= Math.round(partner.rating || 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{partner.review_count} reviews</p>
              </div>
              <div className="flex-1 text-xs text-muted-foreground">
                {completedCount > 0 && (
                  <p>You've visited {completedCount} time{completedCount > 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Book Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm border-t">
        <Button
          className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-base"
          onClick={() => setBookingOpen(true)}
        >
          <Zap className="w-5 h-5 mr-2" />
          {isRTL ? t("recovery_book_now_ar") : t("recovery_book_now")}
        </Button>
      </div>

      <RecoveryBookingDialog
        partner={partner}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onBookingComplete={refetchBookings}
      />
    </div>
  );
}
