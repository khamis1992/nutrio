import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface RestaurantLink { restaurant_id: string }
interface OrderItem { id: string; order_id: string; meal_id: string; quantity: number; unit_price: number; total_price: number }
interface OrderRow { id: string; status: string; created_at: string; restaurant_id: string; order_items?: OrderItem[] }

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: restLinks } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", user.id);

  const restaurantIds = (restLinks as RestaurantLink[] | null)?.map((r) => r.restaurant_id) ?? [];
  if (restaurantIds.length === 0) return NextResponse.json({ orders: [] });

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), restaurants(name)")
    .in("restaurant_id", restaurantIds)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data as OrderRow[] });
}


