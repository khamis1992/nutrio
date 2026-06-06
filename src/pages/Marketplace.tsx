import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCatalog, getByCategory, type Ingredient } from "@/lib/ingredientCatalog";
import { getCart, addToCart, removeFromCart, updateCartQuantity, clearCart } from "@/lib/cartStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "protein", label: "Protein" },
  { key: "vegetable", label: "Veggies" },
  { key: "grain", label: "Grains" },
  { key: "snack", label: "Snacks" },
  { key: "supplement", label: "Supps" },
] as const;

export default function Marketplace() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState(() => {
    try { return getCart(); } catch { return []; }
  });
  const [showCart, setShowCart] = useState(false);

  const catalog = useMemo(() => {
    try { return getCatalog(); } catch { return []; }
  }, []);

  const filtered = useMemo(() => {
    let items = activeCategory === "all" ? catalog : getByCategory(activeCategory as Ingredient["category"]);
    if (searchQuery) items = items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  }, [catalog, activeCategory, searchQuery]);

  const cartCount = useMemo(() => cartItems.reduce((s, ci) => s + ci.quantity, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((s, ci) => s + ci.ingredient.price_qar * ci.quantity, 0), [cartItems]);

  const handleAdd = (id: string) => {
    try {
      const updated = addToCart(id);
      setCartItems(updated);
    } catch { /* ignore */ }
  };

  const handleRemove = (id: string) => {
    try {
      const updated = removeFromCart(id);
      setCartItems(updated);
    } catch { /* ignore */ }
  };

  const handleUpdateQty = (id: string, qty: number) => {
    try {
      const updated = updateCartQuantity(id, qty);
      setCartItems(updated);
    } catch { /* ignore */ }
  };

  const handleCheckout = () => {
    clearCart();
    setCartItems([]);
    setShowCart(false);
    toast.success("Order placed! Your ingredients are on the way.");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8F9FA] pb-24 mx-auto max-w-[430px]">
      <div className="bg-white px-4 pt-safe pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Shop</h1>
            <p className="text-sm text-gray-500">Ingredients, snacks & supplements</p>
          </div>
          <button onClick={() => setShowCart(!showCart)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 hover:bg-emerald-200">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-extrabold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search ingredients..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-0 bg-slate-50 rounded-xl h-10 text-sm" />
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
              className={cn("shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors",
                activeCategory === cat.key ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-2">
        <AnimatePresence>
          {filtered.map((ing) => {
            const inCart = cartItems.find((ci) => ci.ingredient.id === ing.id);
            return (
              <motion.div key={ing.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 flex items-center gap-3">
                <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-xl bg-slate-50 text-3xl">
                  {ing.image_url}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-slate-900 truncate">{ing.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {ing.calories_per_100g} cal/100g · {ing.unit_size} {ing.unit}
                  </p>
                  <p className="text-[14px] font-extrabold text-emerald-600 mt-1">{ing.price_qar} QAR</p>
                </div>
                {inCart ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleUpdateQty(ing.id, inCart.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                      <Minus className="h-3.5 w-3.5 text-slate-600" />
                    </button>
                    <span className="text-[14px] font-extrabold tabular-nums w-6 text-center">{inCart.quantity}</span>
                    <button onClick={() => handleUpdateQty(ing.id, inCart.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                      <Plus className="h-3.5 w-3.5 text-emerald-600" />
                    </button>
                  </div>
                ) : (
                  <Button onClick={() => handleAdd(ing.id)} size="sm"
                    className="rounded-full bg-emerald-500 hover:bg-emerald-600 h-9 px-4 text-xs font-bold">
                    Add
                  </Button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No items found</p>
          </div>
        )}
      </div>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-black/20 z-20" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)] max-h-[70vh] overflow-y-auto">
              <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-4 pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-extrabold text-slate-900">
                    Cart ({cartCount} items)
                  </h2>
                  <button onClick={() => setShowCart(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {cartItems.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">Your cart is empty</p>
                ) : (
                  <>
                    {cartItems.map((ci) => (
                      <div key={ci.ingredient.id} className="flex items-center gap-3">
                        <span className="text-2xl">{ci.ingredient.image_url}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-700 truncate">{ci.ingredient.name}</p>
                          <p className="text-[11px] text-slate-400">{ci.ingredient.price_qar} QAR × {ci.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleUpdateQty(ci.ingredient.id, ci.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                            <Minus className="h-3 w-3 text-slate-500" />
                          </button>
                          <span className="text-[13px] font-extrabold w-5 text-center">{ci.quantity}</span>
                          <button onClick={() => handleUpdateQty(ci.ingredient.id, ci.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                            <Plus className="h-3 w-3 text-emerald-600" />
                          </button>
                        </div>
                        <button onClick={() => handleRemove(ci.ingredient.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50">
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </button>
                      </div>
                    ))}

                    <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-slate-500">Total</span>
                      <span className="text-[22px] font-extrabold text-emerald-600">{cartTotal} QAR</span>
                    </div>

                    <Button onClick={handleCheckout}
                      className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-[15px] gap-2 shadow-lg shadow-emerald-500/20 mt-2">
                      <ShoppingCart className="h-5 w-5" />
                      Place Order · {cartTotal} QAR
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
