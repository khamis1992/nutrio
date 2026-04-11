import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRecoveryCredits, useRecoveryPartners, createRecoveryBooking, type RecoveryPartner, type RecoveryService } from "@/hooks/useRecovery";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Clock, Star, Zap, CalendarDays, MapPin, Check } from "lucide-react";

interface Props {
  partner: RecoveryPartner;
  open: boolean;
  onClose: () => void;
  onBookingComplete?: () => void;
}

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00",
];

export function RecoveryBookingDialog({ partner, open, onClose, onBookingComplete }: Props) {
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useRecoveryCredits();
  const [selectedService, setSelectedService] = useState<RecoveryService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const remainingCredits = (credits?.total_credits ?? 0) - (credits?.used_credits ?? 0);
  const canAfford = selectedService ? remainingCredits >= selectedService.credits_required : true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDate = today;
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);

  const disabledDays = useMemo(() => {
    const days: Date[] = [];
    const d = new Date(today);
    while (d < maxDate) {
      if (d.getDay() === 0) days.push(new Date(d)); // Sundays disabled
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, []);

  const handleConfirm = async () => {
    if (!user || !selectedService || !selectedDate || !selectedTime) return;
    if (!canAfford) return;

    setBooking(true);
    try {
      const result = await createRecoveryBooking({
        userId: user.id,
        partnerId: partner.id,
        serviceName: selectedService.name,
        creditsUsed: selectedService.credits_required,
        bookingDate: selectedDate.toISOString().split("T")[0],
        bookingTime: selectedTime,
      });
      setQrCode(result.qr_code);
      setConfirmed(true);
      refetchCredits();
      onBookingComplete?.();
      toast({
        title: isRTL ? t("recovery_booking_confirmed_ar") : t("recovery_booking_confirmed"),
      });
    } catch (err: any) {
      toast({
        title: "Booking failed",
        description: err.message,
        variant: "destructive",
      });
    }
    setBooking(false);
  };

  const handleClose = () => {
    setConfirmed(false);
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setQrCode(null);
    onClose();
  };

  // Confirmation view
  if (confirmed && qrCode) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm mx-auto">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold mb-1">
              {isRTL ? t("recovery_booking_confirmed_ar") : t("recovery_booking_confirmed")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedService?.name} · {partner.name}
            </p>
            {/* QR Code */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-4 inline-block mb-4">
              <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-36 h-36">
                  {/* Simple QR-like pattern */}
                  <rect x="5" y="5" width="25" height="25" rx="3" fill="currentColor" />
                  <rect x="8" y="8" width="19" height="19" rx="2" fill="white" />
                  <rect x="11" y="11" width="13" height="13" rx="1" fill="currentColor" />
                  <rect x="70" y="5" width="25" height="25" rx="3" fill="currentColor" />
                  <rect x="73" y="8" width="19" height="19" rx="2" fill="white" />
                  <rect x="76" y="11" width="13" height="13" rx="1" fill="currentColor" />
                  <rect x="5" y="70" width="25" height="25" rx="3" fill="currentColor" />
                  <rect x="8" y="73" width="19" height="19" rx="2" fill="white" />
                  <rect x="11" y="76" width="13" height="13" rx="1" fill="currentColor" />
                  <rect x="35" y="5" width="5" height="5" fill="currentColor" />
                  <rect x="45" y="5" width="5" height="5" fill="currentColor" />
                  <rect x="55" y="5" width="5" height="5" fill="currentColor" />
                  <rect x="35" y="15" width="5" height="5" fill="currentColor" />
                  <rect x="50" y="15" width="5" height="5" fill="currentColor" />
                  <rect x="60" y="15" width="5" height="5" fill="currentColor" />
                  <rect x="35" y="25" width="5" height="5" fill="currentColor" />
                  <rect x="45" y="25" width="5" height="5" fill="currentColor" />
                  <rect x="35" y="35" width="5" height="5" fill="currentColor" />
                  <rect x="50" y="35" width="5" height="5" fill="currentColor" />
                  <rect x="60" y="35" width="5" height="5" fill="currentColor" />
                  <rect x="40" y="45" width="10" height="10" rx="2" fill="currentColor" />
                  <rect x="55" y="45" width="5" height="5" fill="currentColor" />
                  <rect x="35" y="55" width="5" height="5" fill="currentColor" />
                  <rect x="45" y="55" width="5" height="5" fill="currentColor" />
                  <rect x="60" y="55" width="5" height="5" fill="currentColor" />
                  <rect x="70" y="35" width="5" height="5" fill="currentColor" />
                  <rect x="80" y="45" width="5" height="5" fill="currentColor" />
                  <rect x="70" y="55" width="5" height="5" fill="currentColor" />
                  <rect x="80" y="55" width="5" height="5" fill="currentColor" />
                  <rect x="70" y="70" width="5" height="5" fill="currentColor" />
                  <rect x="80" y="70" width="5" height="5" fill="currentColor" />
                  <rect x="70" y="80" width="5" height="5" fill="currentColor" />
                  <rect x="85" y="80" width="5" height="5" fill="currentColor" />
                  <rect x="75" y="90" width="5" height="5" fill="currentColor" />
                  <rect x="90" y="90" width="5" height="5" fill="currentColor" />
                  <rect x="35" y="70" width="5" height="5" fill="currentColor" />
                  <rect x="50" y="70" width="5" height="5" fill="currentColor" />
                  <rect x="60" y="70" width="5" height="5" fill="currentColor" />
                  <rect x="40" y="80" width="5" height="5" fill="currentColor" />
                  <rect x="55" y="80" width="5" height="5" fill="currentColor" />
                  <rect x="45" y="90" width="5" height="5" fill="currentColor" />
                  <rect x="60" y="90" width="5" height="5" fill="currentColor" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{qrCode}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedDate?.toLocaleDateString()} · {selectedTime}
            </p>
          </div>
          <Button onClick={handleClose} className="w-full">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-violet-500" />
            {isRTL ? t("recovery_book_now_ar") : t("recovery_book_now")}
          </DialogTitle>
        </DialogHeader>

        {/* Credits balance */}
        <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-950 rounded-lg p-3">
          <span className="text-sm font-medium">
            {isRTL ? t("recovery_credits_remaining_ar", { remaining: remainingCredits }) : t("recovery_credits_remaining", { remaining: remainingCredits })}
          </span>
          {selectedService && (
            <Badge variant={canAfford ? "default" : "destructive"} className="text-xs">
              -{selectedService.credits_required} <Zap className="w-3 h-3 ml-1" />
            </Badge>
          )}
        </div>

        {/* Step 1: Select Service */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            {isRTL ? t("recovery_select_service_ar") : t("recovery_select_service")}
          </label>
          <div className="space-y-2">
            {(partner.services || []).map((service: RecoveryService) => (
              <Card
                key={service.name}
                className={`cursor-pointer transition-all ${
                  selectedService?.name === service.name
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950"
                    : "hover:border-gray-300"
                }`}
                onClick={() => setSelectedService(service)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {isRTL && service.name_ar ? service.name_ar : service.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {service.duration_min} {isRTL ? t("recovery_min_ar") : t("recovery_min")}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {service.credits_required}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Step 2: Select Date */}
        {selectedService && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              {isRTL ? t("recovery_select_date_ar") : t("recovery_select_date")}
            </label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={[...disabledDays, { before: minDate, after: maxDate }]}
              className="rounded-md border"
            />
          </div>
        )}

        {/* Step 3: Select Time */}
        {selectedDate && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              {isRTL ? t("recovery_select_time_ar") : t("recovery_select_time")}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedTime(time)}
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!selectedService || !selectedDate || !selectedTime || !canAfford || booking}
            className="w-full bg-violet-600 hover:bg-violet-700"
          >
            {booking ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> Booking...
              </span>
            ) : !canAfford ? (
              isRTL ? t("recovery_insufficient_credits_ar") : t("recovery_insufficient_credits")
            ) : (
              isRTL ? t("recovery_confirm_booking_ar") : t("recovery_confirm_booking")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
