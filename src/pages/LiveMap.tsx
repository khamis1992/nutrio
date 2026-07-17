import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerDeliveryTracker } from "@/components/customer/CustomerDeliveryTracker";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LiveMap() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [locations, setLocations] = useState<{
    restaurant?: { lat: number; lng: number; name: string; address?: string };
    customer?: { lat: number; lng: number; name: string; address?: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchLocationData = async () => {
      try {
        // 1. Fetch the meal_schedule with its meal_id, restaurant_id, and delivery_address_id
        const { data: schedule, error: scheduleError } = await supabase
          .from("meal_schedules")
          .select("meal_id, restaurant_id, delivery_address_id, order_status")
          .eq("id", id)
          .single();

        if (scheduleError || !schedule) {
          setError(t("tracking_order_not_found") || "Order not found");
          setLoading(false);
          return;
        }

        const result: NonNullable<typeof locations> = {};

        // 2. Get restaurant location via the meal
        const restaurantId = schedule.restaurant_id;
        if (restaurantId) {
          const { data: restaurant } = await supabase
            .from("public_restaurant_catalog" as "restaurants")
            .select("name, address, latitude, longitude")
            .eq("id", restaurantId)
            .single();

          if (restaurant?.latitude != null && restaurant?.longitude != null) {
            result.restaurant = {
              lat: restaurant.latitude,
              lng: restaurant.longitude,
              name: restaurant.name,
              address: restaurant.address ?? undefined,
            };
          }
        }

        // If no direct restaurant_id, try fetching via the meal
        if (!result.restaurant && schedule.meal_id) {
          const { data: meal } = await supabase
            .from("public_meal_catalog" as "meals")
            .select("restaurant_id")
            .eq("id", schedule.meal_id)
            .single();

          if (meal?.restaurant_id) {
            const { data: restaurant } = await supabase
              .from("public_restaurant_catalog" as "restaurants")
              .select("name, address, latitude, longitude")
              .eq("id", meal.restaurant_id)
              .single();

            if (restaurant?.latitude != null && restaurant?.longitude != null) {
              result.restaurant = {
                lat: restaurant.latitude,
                lng: restaurant.longitude,
                name: restaurant.name,
                address: restaurant.address ?? undefined,
              };
            }
          }
        }

        // 3. Get customer delivery address
        if (schedule.delivery_address_id) {
          const { data: address } = await supabase
            .from("user_addresses")
            .select("address_line1, city, latitude, longitude")
            .eq("id", schedule.delivery_address_id)
            .single();

          if (address?.latitude != null && address?.longitude != null) {
            result.customer = {
              lat: address.latitude,
              lng: address.longitude,
              name: t("tracking_delivery_address") || "Delivery Address",
              address: [address.address_line1, address.city].filter(Boolean).join(", ") || undefined,
            };
          }
        }

        setLocations(result);
      } catch (err) {
        console.error("Error fetching location data:", err);
        setError(t("tracking_location_error") || "Could not load location data");
      } finally {
        setLoading(false);
      }
    };

    fetchLocationData();
  }, [id, t]);

  if (!id) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-y-auto bg-[#F6F8FB] [-webkit-overflow-scrolling:touch]">
        <div className="pt-[env(safe-area-inset-top,20px)] px-5 pb-4">
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <div className="flex-1 px-5 py-6 space-y-4">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 overflow-y-auto bg-[#F6F8FB] px-6 [-webkit-overflow-scrolling:touch]">
        <div className="w-16 h-16 rounded-full bg-[#FFF0F2] flex items-center justify-center ring-1 ring-[#FB6B7A]/20">
          <span className="text-[#FB6B7A] text-2xl">!</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{error}</h2>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-[#020617] px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(2,6,23,0.16)]"
        >
          {t("go_back") || "Go Back"}
        </button>
      </div>
    );
  }

  return (
    <CustomerDeliveryTracker
      scheduleId={id}
      onBack={() => navigate(-1)}
      restaurantLocation={locations?.restaurant}
      customerLocation={locations?.customer}
    />
  );
}
