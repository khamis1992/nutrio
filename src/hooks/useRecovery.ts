import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RecoveryPartner {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  opening_hours: Record<string, { open: string; close: string }> | null;
  services: RecoveryService[];
  rating: number;
  review_count: number;
  is_active: boolean;
}

export interface RecoveryService {
  name: string;
  name_ar: string;
  duration_min: number;
  credits_required: number;
  description: string;
}

export interface RecoveryBooking {
  id: string;
  user_id: string;
  partner_id: string;
  partner?: RecoveryPartner | null;
  service_name: string | null;
  credits_used: number;
  booking_date: string;
  booking_time: string;
  status: "booked" | "completed" | "cancelled" | "no_show";
  qr_code: string | null;
  notes: string | null;
  created_at: string;
}

export interface MemberCredits {
  id: string;
  user_id: string;
  total_credits: number;
  used_credits: number;
  period_start: string;
  period_end: string;
}

export function useRecoveryPartners() {
  const [partners, setPartners] = useState<RecoveryPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPartners = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recovery_partners")
      .select("*")
      .eq("is_active", true)
      .order("rating", { ascending: false });

    if (!error && data) setPartners(data as unknown as RecoveryPartner[]);
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, []);

  return { partners, loading, refetch: fetchPartners };
}

export function useRecoveryPartner(id: string) {
  const [partner, setPartner] = useState<RecoveryPartner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    let cancelled = false;

    supabase
      .from("recovery_partners")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load partner:", error);
          setPartner(null);
        } else {
          setPartner(data as unknown as RecoveryPartner | null);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  return { partner, loading };
}

export function useRecoveryCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<MemberCredits | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredits = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase.rpc(
      "get_or_create_recovery_credits" as never,
    );

    if (error) {
      console.error("Failed to load recovery credits:", error);
      setCredits(null);
    } else if (data) {
      setCredits(data as MemberCredits);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCredits(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return { credits, loading, refetch: fetchCredits };
}

export function useRecoveryBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<RecoveryBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("recovery_bookings")
      .select("*, partner:recovery_partners(id, name, name_ar, logo_url, address)")
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: false });

    if (data) setBookings(data as unknown as RecoveryBooking[]);
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return { bookings, loading, refetch: fetchBookings };
}

export async function createRecoveryBooking(params: {
  partnerId: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc(
    "create_recovery_booking" as never,
    {
      p_partner_id: params.partnerId,
      p_service_name: params.serviceName,
      p_booking_date: params.bookingDate,
      p_booking_time: params.bookingTime,
      p_notes: params.notes ?? null,
    } as never,
  );

  if (error) throw error;
  return data as RecoveryBooking;
}

export async function cancelRecoveryBooking(bookingId: string) {
  const { data, error } = await supabase.rpc(
    "cancel_recovery_booking" as never,
    { p_booking_id: bookingId } as never,
  );

  if (error) throw error;
  return data as { success: boolean; already_cancelled?: boolean };
}
