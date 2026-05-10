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

    if (!error && data) setPartners(data as RecoveryPartner[]);
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
          setPartner(data as RecoveryPartner | null);
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

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Try to get existing record first
    let { data } = await supabase
      .from("member_recovery_credits")
      .select("*")
      .eq("user_id", user.id)
      .eq("period_start", periodStart)
      .maybeSingle();

    if (!data) {
      // Upsert to avoid race condition (409 duplicate)
      const { data: newData } = await supabase
        .from("member_recovery_credits")
        .upsert({
          user_id: user.id,
          total_credits: 4,
          used_credits: 0,
          period_start: periodStart,
          period_end: periodEnd,
        }, { onConflict: "user_id,period_start" })
        .select()
        .maybeSingle();
      data = newData || data;
    }

    if (data) setCredits(data as MemberCredits);
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

    if (data) setBookings(data as RecoveryBooking[]);
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return { bookings, loading, refetch: fetchBookings };
}

export async function createRecoveryBooking(params: {
  userId: string;
  partnerId: string;
  serviceName: string;
  creditsUsed: number;
  bookingDate: string;
  bookingTime: string;
}) {
  const qrCode = `NR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const { data, error } = await supabase
    .from("recovery_bookings")
    .insert({
      user_id: params.userId,
      partner_id: params.partnerId,
      service_name: params.serviceName,
      credits_used: params.creditsUsed,
      booking_date: params.bookingDate,
      booking_time: params.bookingTime,
      qr_code: qrCode,
      status: "booked",
    })
    .select()
    .single();

  if (error) throw error;

  // Increment used credits - try RPC first, fallback to direct update
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  try {
    const { error: rpcError } = await supabase.rpc("increment_recovery_credits", {
      p_user_id: params.userId,
      p_period_start: periodStart,
      p_credits: params.creditsUsed,
    });
    
    if (rpcError) {
      // Fallback: direct update if RPC doesn't exist
      console.warn("increment_recovery_credits RPC failed, using direct update:", rpcError);
      await supabase
        .from("member_recovery_credits")
        .update({ used_credits: (await supabase.from("member_recovery_credits").select("used_credits").eq("user_id", params.userId).eq("period_start", periodStart).single()).data?.used_credits + params.creditsUsed })
        .eq("user_id", params.userId)
        .eq("period_start", periodStart);
    }
  } catch (err) {
    console.warn("Failed to increment recovery credits:", err);
    // Non-fatal - booking was created successfully
  }

  return data;
}

export async function cancelRecoveryBooking(bookingId: string, userId: string) {
  const { data: booking } = await supabase
    .from("recovery_bookings")
    .select("credits_used")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .single();

  const { error } = await supabase
    .from("recovery_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("user_id", userId);

  if (error) throw error;

  if (booking && booking.credits_used > 0) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    try {
      const { error: rpcError } = await supabase.rpc("decrement_recovery_credits", {
        p_user_id: userId,
        p_period_start: periodStart,
        p_credits: booking.credits_used,
      });

      if (rpcError) {
        console.warn("decrement_recovery_credits RPC failed, using direct update:", rpcError);
        const { data: creditRow } = await supabase
          .from("member_recovery_credits")
          .select("used_credits")
          .eq("user_id", userId)
          .eq("period_start", periodStart)
          .single();
        if (creditRow) {
          await supabase
            .from("member_recovery_credits")
            .update({ used_credits: Math.max(0, creditRow.used_credits - booking.credits_used) })
            .eq("user_id", userId)
            .eq("period_start", periodStart);
        }
      }
    } catch (err) {
      console.warn("Failed to decrement recovery credits on cancel:", err);
    }
  }
}
