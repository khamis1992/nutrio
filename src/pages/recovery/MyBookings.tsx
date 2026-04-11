import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryBookings, useRecoveryCredits, cancelRecoveryBooking } from "@/hooks/useRecovery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Clock,
  Zap,
  Calendar,
  QrCode,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export default function MyBookings() {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { bookings, loading, refetch } = useRecoveryBookings();
  const { credits } = useRecoveryCredits();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showQr, setShowQr] = useState<string | null>(null);
  const cancellingRef = useRef(false);

  // Cleanup ref on unmount
  useEffect(() => {
    return () => {
      cancellingRef.current = true;
    };
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const upcoming = bookings.filter(
    (b) => b.booking_date >= today && b.status === "booked"
  );
  const past = bookings.filter(
    (b) => b.booking_date < today || b.status !== "booked"
  );

  const displayBookings = tab === "upcoming" ? upcoming : past;
  const remainingCredits = (credits?.total_credits ?? 0) - (credits?.used_credits ?? 0);

  const handleCancel = async () => {
    if (!cancelId || !user) return;
    cancellingRef.current = false;
    setCancelling(true);
    try {
      await cancelRecoveryBooking(cancelId, user.id);
      if (cancellingRef.current) return;
      refetch();
      toast({ title: "Booking cancelled" });
    } catch {
      if (cancellingRef.current) return;
      toast({ title: "Failed to cancel", variant: "destructive" });
    } finally {
      if (!cancellingRef.current) {
        setCancelling(false);
        setCancelId(null);
      }
    }
  };

  return (
    <div className="px-4 pb-24">
      {/* Header */}
      <div className="pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
          >
            <ArrowLeft className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
          </button>
          <h1 className="text-xl font-bold">
            {isRTL ? t("recovery_my_bookings_ar") : t("recovery_my_bookings")}
          </h1>
        </div>

        {/* Credits summary */}
        <Card className="bg-gradient-to-r from-violet-500 to-purple-600 border-0 text-white mb-4">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm">
                {isRTL ? `${remainingCredits} رصيد متبقي` : `${remainingCredits} credits remaining`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={() => navigate("/recovery")}
            >
              {isRTL ? t("recovery_browse_ar") : t("recovery_browse")}
            </Button>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 rounded-lg ${tab === "upcoming" ? "bg-white dark:bg-gray-700 shadow-sm" : ""}`}
            onClick={() => setTab("upcoming")}
          >
            {isRTL ? t("recovery_upcoming_ar") : t("recovery_upcoming")} ({upcoming.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 rounded-lg ${tab === "past" ? "bg-white dark:bg-gray-700 shadow-sm" : ""}`}
            onClick={() => setTab("past")}
          >
            {isRTL ? t("recovery_past_ar") : t("recovery_past")} ({past.length})
          </Button>
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : displayBookings.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {isRTL ? t("recovery_no_bookings_ar") : t("recovery_no_bookings")}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/recovery")}
          >
            {isRTL ? t("recovery_browse_ar") : t("recovery_browse")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayBookings.map((booking) => {
            const statusConfig: Record<string, { color: string; icon: any }> = {
              booked: { color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", icon: Clock },
              completed: { color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300", icon: CheckCircle },
              cancelled: { color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", icon: XCircle },
              no_show: { color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", icon: AlertTriangle },
            };
            const cfg = statusConfig[booking.status] || statusConfig.booked;
            const StatusIcon = cfg.icon;

            return (
              <Card key={booking.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/recovery/${booking.partner_id}`)}
                    >
                      <h3 className="font-semibold text-sm">{booking.partner?.name || "Partner"}</h3>
                      <p className="text-xs text-muted-foreground">{booking.service_name || "Service"}</p>
                    </div>
                    <Badge className={`text-xs ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {booking.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(booking.booking_date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {booking.booking_time}
                    </span>
                    <span className="flex items-center gap-1 text-violet-600">
                      <Zap className="w-3 h-3" />
                      {booking.credits_used}
                    </span>
                  </div>

                  {booking.status === "booked" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setShowQr(booking.qr_code)}
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1" />
                        {isRTL ? t("recovery_show_qr_ar") : t("recovery_show_qr")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setCancelId(booking.id)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        {isRTL ? t("recovery_cancel_booking_ar") : t("recovery_cancel_booking")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Cancel Booking?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel this booking? Credits will not be refunded.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelId(null)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={!!showQr} onOpenChange={() => setShowQr(null)}>
        <DialogContent className="max-w-sm mx-auto">
          <div className="text-center py-4">
            <div className="bg-white border-2 border-gray-200 rounded-xl p-4 inline-block mb-4">
              <div className="w-48 h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                <QrCode className="w-32 h-32 text-gray-800" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-2">{showQr}</p>
            <p className="text-xs text-muted-foreground mt-1">Show this at check-in</p>
          </div>
          <Button onClick={() => setShowQr(null)} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
