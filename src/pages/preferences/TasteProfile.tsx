import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTastePreferences } from "@/hooks/useTastePreferences";
import { supabase } from "@/integrations/supabase/client";

export default function TasteProfilePage() {
  const { language } = useLanguage();
  const { profile, loading, recalculating, recalculate } = useTastePreferences();
  const [monthlyData, setMonthlyData] = useState<{ month: string; orders: number; diversity: number }[]>([]);

  useEffect(() => {
    async function fetchMonthlyData() {
      try {
        const { data: orders } = await supabase
          .from("orders")
          .select("created_at, meal_id")
          .in("status", ["delivered", "completed"])
          .order("created_at", { ascending: false })
          .limit(200);

        if (!orders || orders.length === 0) return;

        const byMonth = new Map<string, { orders: number; meals: Set<string> }>();
        (orders as any[]).forEach(o => {
          const month = o.created_at.substring(0, 7); // YYYY-MM
          const entry = byMonth.get(month) || { orders: 0, meals: new Set() };
          entry.orders++;
          if (o.meal_id) entry.meals.add(o.meal_id);
          byMonth.set(month, entry);
        });

        setMonthlyData(
          [...byMonth.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6)
            .map(([month, data]) => ({
              month,
              orders: data.orders,
              diversity: Math.min(100, Math.round((data.meals.size / Math.max(1, data.orders)) * 100)),
            }))
        );
      } catch (err) {
        console.error("Failed to fetch monthly data:", err);
      }
    }
    fetchMonthlyData();
  }, []);

  const favoriteCuisines = profile?.favoriteCuisines || [];
  const topIngredients = profile?.topIngredients || [];
  const proteinPreference = profile?.proteinPreference || "medium";
  const orderFrequency = profile?.orderFrequency || { weekday: "unknown", weekend: "unknown" };
  const discoveryScore = profile?.discoveryScore || 0;
  const totalOrders = profile?.totalOrders || 0;

  const diversityScore = discoveryScore > 0 ? Math.round(discoveryScore * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="h-60 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const isAr = language === "ar";

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className={`flex items-center justify-between ${isAr ? "flex-row-reverse" : ""}`}>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isAr ? "ذوقك الغذائي" : "Your Taste Profile"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isAr
                ? `${totalOrders} طلب مسجّل`
                : `${totalOrders} orders analyzed`}
            </p>
          </div>
          <button
            onClick={() => recalculate()}
            disabled={recalculating}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {recalculating
              ? (isAr ? "جارٍ التحديث..." : "Updating...")
              : (isAr ? "إعادة حساب" : "Recalculate")}
          </button>
        </div>

        {/* Diversity Score Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-3">
            {isAr ? "تنوّع ذوقك" : "Taste Diversity"}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={diversityScore > 60 ? "#10b981" : diversityScore > 30 ? "#f59e0b" : "#6b7280"}
                  strokeWidth="8"
                  strokeDasharray={`${diversityScore * 2.136} 213.6`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">
                {diversityScore}%
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {diversityScore > 60
                  ? (isAr ? "متنوّع جداً! أنت مغامر غذائي 🌍" : "Very diverse! You're a food explorer 🌍")
                  : diversityScore > 30
                    ? (isAr ? "تنوّع جيد! جرّب المزيد 🍽️" : "Good variety! Try more 🍽️")
                    : (isAr ? "أنت ملتزم بأكلاتك المفضلة 💚" : "You stick to your favorites 💚")}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {isAr
                  ? "نسبة الأكلات التي جرّبتها من الكل"
                  : "Percentage of available meals you've tried"}
              </p>
            </div>
          </div>
        </div>

        {/* "We've noticed you love..." */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">
            {isAr ? "🎉 لاحظنا أنك تحب..." : "🎉 We've noticed you love..."}
          </h2>

          <div className="space-y-4">
            {/* Favorite Cuisines */}
            {favoriteCuisines.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  {isAr ? "المطابخ المفضلة" : "Favorite Cuisines"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {favoriteCuisines.map(cuisine => (
                    <span key={cuisine} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full capitalize">
                      {cuisine}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top Ingredients */}
            {topIngredients.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  {isAr ? "المكونات المفضلة" : "Top Ingredients"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {topIngredients.slice(0, 8).map(ing => (
                    <span key={ing} className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-medium rounded-full">
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Protein Preference */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                {isAr ? "تفضيل البروتين" : "Protein Preference"}
              </h3>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  proteinPreference === "high"
                    ? "bg-red-50 text-red-700"
                    : proteinPreference === "medium"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-blue-50 text-blue-700"
                }`}>
                  {proteinPreference === "high"
                    ? (isAr ? "عالي البروتين 💪" : "High Protein 💪")
                    : proteinPreference === "medium"
                      ? (isAr ? "متوازن ⚖️" : "Balanced ⚖️")
                      : (isAr ? "خفيف 🌿" : "Light 🌿")}
                </span>
              </div>
            </div>

            {/* Order Patterns */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                {isAr ? "نمط الطلبات" : "Order Patterns"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">{isAr ? "أيام الأسبوع" : "Weekdays"}</p>
                  <p className="font-semibold text-gray-900 capitalize">{orderFrequency.weekday}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">{isAr ? "عطلة نهاية الأسبوع" : "Weekends"}</p>
                  <p className="font-semibold text-gray-900 capitalize">{orderFrequency.weekend}</p>
                </div>
              </div>
            </div>

            {favoriteCuisines.length === 0 && topIngredients.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">
                {isAr
                  ? "اطلب المزيد لكي نكتشف ذوقك! 🍽️"
                  : "Order more meals so we can discover your taste! 🍽️"}
              </p>
            )}
          </div>
        </div>

        {/* Discovery Suggestions */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 shadow-sm border border-purple-100">
          <h2 className="font-semibold text-gray-900 mb-2">
            {isAr ? "✨ جرّب شيئاً جديداً" : "✨ You might also like..."}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {isAr
              ? "بناءً على ذوقك، نعتقد أنك ستحب هذه الأكلات"
              : "Based on your taste, we think you'll love these"}
          </p>

          {favoriteCuisines.length > 0 ? (
            <div className="space-y-2">
              {getDiscoverySuggestions(favoriteCuisines, proteinPreference, isAr).map((suggestion, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/70 rounded-lg p-3">
                  <span className="text-2xl">{suggestion.emoji}</span>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{suggestion.name}</p>
                    <p className="text-xs text-gray-500">{suggestion.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-2">
              {isAr ? "احصل على 5 طلبات لفتح اقتراحات الاكتشاف" : "Get 5 orders to unlock discovery suggestions"}
            </p>
          )}
        </div>

        {/* Monthly Evolution Chart */}
        {monthlyData.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">
              {isAr ? "📊 تطور ذوقك الشهري" : "📊 Monthly Taste Evolution"}
            </h2>
            <div className="space-y-3">
              {monthlyData.map(d => (
                <div key={d.month} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{d.month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${d.diversity}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-20 text-right">
                    {d.orders} {isAr ? "طلبات" : "orders"} · {d.diversity}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getDiscoverySuggestions(favoriteCuisines: string[], proteinPreference: string, isAr: boolean) {
  const suggestions: { emoji: string; name: string; reason: string }[] = [];

  const cuisineSuggestions: Record<string, { emoji: string; name_en: string; name_ar: string }> = {
    arabic: { emoji: "🥙", name_en: "Try Mediterranean", name_ar: "جرّب المتوسطي" },
    mediterranean: { emoji: "🥗", name_en: "Try Arabic dishes", name_ar: "جرّب الأطباق العربية" },
    asian: { emoji: "🍜", name_en: "Try Middle Eastern", name_ar: "جرّب الشرق أوسطية" },
    american: { emoji: "🍔", name_en: "Try Asian fusion", name_ar: "جرّب الآسيوية" },
    italian: { emoji: "🍝", name_en: "Try Mediterranean", name_ar: "جرّب المتوسطي" },
    indian: { emoji: "🍛", name_en: "Try Middle Eastern", name_ar: "جرّب الشرق أوسطية" },
    mexican: { emoji: "🌮", name_en: "Try Mediterranean", name_ar: "جرّب المتوسطي" },
  };

  favoriteCuisines.forEach(cuisine => {
    const suggestion = cuisineSuggestions[cuisine];
    if (suggestion) {
      suggestions.push({
        emoji: suggestion.emoji,
        name: isAr ? suggestion.name_ar : suggestion.name_en,
        reason: isAr ? `بناءً على حبك للمطبخ ${cuisine}` : `Based on your love for ${cuisine} cuisine`,
      });
    }
  });

  if (proteinPreference === "high") {
    suggestions.push({
      emoji: "💪",
      name: isAr ? "أطباق بروتين أعلى" : "Higher protein dishes",
      reason: isAr ? "لأنك تفضّل البروتين العالي" : "Because you prefer high protein",
    });
  }

  return suggestions.slice(0, 4);
}
