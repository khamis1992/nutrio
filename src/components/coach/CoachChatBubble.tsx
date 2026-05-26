import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Send, X, MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCoachChat } from "@/hooks/useCoachChat";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { springBouncy } from "@/lib/animations";

export function CoachChatBubble() {
  const { isVip, loading: subLoading } = useSubscription();
  const { profile, loading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { todayProgress } = useTodayProgress(user?.id ?? "", new Date(), 0);
  const { messages, initialized, init, ask, reset, quickQuestions } = useCoachChat();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!initialized && profile && !profileLoading && !subLoading) {
      init({
        caloriesTarget: profile.daily_calorie_target ?? 2000,
        caloriesConsumed: todayProgress?.calories ?? 0,
        proteinTarget: profile.protein_target_g ?? 150,
        proteinConsumed: todayProgress?.protein ?? 0,
        carbsTarget: profile.carbs_target_g ?? 200,
        carbsConsumed: todayProgress?.carbs ?? 0,
        fatTarget: profile.fat_target_g ?? 65,
        fatConsumed: todayProgress?.fat ?? 0,
        goal: profile.goal ?? "maintain",
        weight: profile.weight ?? undefined,
        targetWeight: profile.target_weight ?? undefined,
        streakDays: profile.streak_days ?? 0,
      });
    }
  }, [open, initialized, profile, profileLoading, subLoading, init, todayProgress]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !profile) return;
    ask(trimmed, {
      caloriesTarget: profile.daily_calorie_target ?? 2000,
      caloriesConsumed: todayProgress?.calories ?? 0,
      proteinTarget: profile.protein_target_g ?? 150,
      proteinConsumed: todayProgress?.protein ?? 0,
      carbsTarget: profile.carbs_target_g ?? 200,
      carbsConsumed: todayProgress?.carbs ?? 0,
      fatTarget: profile.fat_target_g ?? 65,
      fatConsumed: todayProgress?.fat ?? 0,
      goal: profile.goal ?? "maintain",
      weight: profile.weight ?? undefined,
      targetWeight: profile.target_weight ?? undefined,
      streakDays: profile.streak_days ?? 0,
    });
    setInput("");
    inputRef.current?.focus();
  };

  const handleQuickQuestion = (q: string) => {
    if (!profile) return;
    ask(q, {
      caloriesTarget: profile.daily_calorie_target ?? 2000,
      caloriesConsumed: todayProgress?.calories ?? 0,
      proteinTarget: profile.protein_target_g ?? 150,
      proteinConsumed: todayProgress?.protein ?? 0,
      carbsTarget: profile.carbs_target_g ?? 200,
      carbsConsumed: todayProgress?.carbs ?? 0,
      fatTarget: profile.fat_target_g ?? 65,
      fatConsumed: todayProgress?.fat ?? 0,
      goal: profile.goal ?? "maintain",
      weight: profile.weight ?? undefined,
      targetWeight: profile.target_weight ?? undefined,
      streakDays: profile.streak_days ?? 0,
    });
  };

  if (!isVip) return null;

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, ...springBouncy }}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.08 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center"
        aria-label="Open nutrition coach chat"
      >
        <Crown className="w-6 h-6" />
        <motion.span
          className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Crown className="w-3 h-3 text-amber-500" />
        </motion.span>
      </motion.button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] rounded-t-2xl p-0 flex flex-col"
          closeButtonClassName="top-3 right-3 z-10"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-slate-800">Nutrition Coach</SheetTitle>
                  <p className="text-[10px] text-muted-foreground">VIP exclusive</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                aria-label="Close coach chat"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Loading your coach...</p>
                </div>
              )}

              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "coach" && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mr-2 mt-0.5 shrink-0 shadow-sm">
                        <Crown className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted/80 text-foreground rounded-bl-md"
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center ml-2 mt-0.5 shrink-0">
                        <MessageCircle className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {messages.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {quickQuestions.map((q) => (
                  <motion.button
                    key={q}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleQuickQuestion(q)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full bg-muted/60 hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            )}

            <div className="px-4 py-3 border-t border-border/50 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your coach..."
                  className="flex-1 h-11 px-4 rounded-xl bg-muted/60 border border-border/50 text-sm focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
                />
                <motion.button
                  type="submit"
                  disabled={!input.trim()}
                  whileTap={{ scale: 0.94 }}
                  className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  aria-label="Send message"
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </form>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
