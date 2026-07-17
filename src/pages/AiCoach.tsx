import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  aiCoachService,
  type AiCoachConversation,
  type AiCoachMemory,
  type AiCoachMessage,
} from "@/lib/ai-coach";

type Panel = "history" | "memory" | null;

const copy = {
  en: {
    title: "Nutrio AI Coach",
    subtitle: "Guidance shaped by your nutrition records",
    history: "Conversations",
    memory: "Coach memory",
    newChat: "New conversation",
    emptyTitle: "What can I help you with today?",
    emptyBody: "I can review your real Nutrio records and help you make a practical next choice.",
    prompts: [
      "What should I focus on today?",
      "Review my nutrition over the last 7 days",
      "Suggest my next meal based on my targets",
    ],
    placeholder: "Ask about your nutrition...",
    disclaimer: "Lifestyle guidance only, not medical advice.",
    noHistory: "Your conversations will appear here.",
    noMemory: "No saved memories yet.",
    memoryBody: "These are stable details you explicitly shared. You can remove any of them.",
    retry: "Try again",
    loadError: "Could not load the AI Coach.",
    sendError: "The coach could not reply. Your message is ready to retry.",
    deleteConversation: "Archive conversation",
    deleteMemory: "Delete memory",
    today: "Today",
    consentTitle: "Your records stay under your control",
    consentBody: "With your permission, Nutrio sends your nutrition targets, recent meal logs, water, and progress to its AI provider to personalize replies. Conversations and saved memories remain private to your account.",
    consentAllow: "Allow personalized coaching",
    consentDecline: "Not now",
    consentRevoke: "Turn off personalized AI coaching",
    consentError: "Could not save your privacy choice.",
  },
  ar: {
    title: "مدرب Nutrio الذكي",
    subtitle: "إرشادات مبنية على سجلاتك الغذائية",
    history: "المحادثات",
    memory: "ذاكرة المدرب",
    newChat: "محادثة جديدة",
    emptyTitle: "كيف يمكنني مساعدتك اليوم؟",
    emptyBody: "أراجع سجلاتك الحقيقية في Nutrio وأساعدك على اختيار الخطوة العملية التالية.",
    prompts: [
      "على ماذا أركز اليوم؟",
      "راجع تغذيتي خلال آخر 7 أيام",
      "اقترح وجبتي التالية بناءً على أهدافي",
    ],
    placeholder: "اسأل عن تغذيتك...",
    disclaimer: "إرشادات لنمط الحياة وليست نصيحة طبية.",
    noHistory: "ستظهر محادثاتك هنا.",
    noMemory: "لا توجد معلومات محفوظة بعد.",
    memoryBody: "هذه تفاصيل ثابتة ذكرتها بوضوح، ويمكنك حذف أي منها.",
    retry: "إعادة المحاولة",
    loadError: "تعذر تحميل المدرب الذكي.",
    sendError: "تعذر على المدرب الرد. رسالتك جاهزة لإعادة المحاولة.",
    deleteConversation: "أرشفة المحادثة",
    deleteMemory: "حذف المعلومة",
    today: "اليوم",
    consentTitle: "سجلاتك تبقى تحت سيطرتك",
    consentBody: "بموافقتك، يرسل Nutrio أهدافك الغذائية وسجل الوجبات والماء والتقدم الحديث إلى مزود الذكاء لتخصيص الردود. تبقى المحادثات والذاكرة خاصة بحسابك.",
    consentAllow: "السماح بالتدريب المخصص",
    consentDecline: "ليس الآن",
    consentRevoke: "إيقاف التدريب الذكي المخصص",
    consentError: "تعذر حفظ اختيار الخصوصية.",
  },
} as const;

function formatConversationDate(value: string, locale: "ar" | "en", todayLabel: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `${todayLabel} · ${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date)}`;
  }
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}

const AiCoach = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const locale = isRTL ? "ar" : "en";
  const text = copy[locale];
  const [conversations, setConversations] = useState<AiCoachConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiCoachMessage[]>([]);
  const [memories, setMemories] = useState<AiCoachMemory[]>([]);
  const [input, setInput] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{ id: string; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) ?? null,
    [conversationId, conversations],
  );

  const openConversation = useCallback(async (id: string) => {
    setConversationId(id);
    setPanel(null);
    setLoadingMessages(true);
    setSendError(false);
    setPendingRequest(null);
    try {
      setMessages(await aiCoachService.getMessages(id));
    } catch (error) {
      console.error("Unable to load AI Coach messages", error);
      toast.error(text.loadError);
    } finally {
      setLoadingMessages(false);
    }
  }, [text.loadError]);

  const loadCoach = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [nextConversations, consentGranted] = await Promise.all([
        aiCoachService.listConversations(),
        aiCoachService.hasConsent(),
      ]);
      setHasConsent(consentGranted);
      setConversations(nextConversations);
      if (nextConversations[0]) {
        setConversationId(nextConversations[0].id);
        setMessages(await aiCoachService.getMessages(nextConversations[0].id));
      } else {
        setConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Unable to load AI Coach", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCoach();
  }, [loadCoach]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: sending ? "smooth" : "auto" });
  }, [messages, sending]);

  const startNewConversation = () => {
    if (sending) return;
    setConversationId(null);
    setMessages([]);
    setInput("");
    setSendError(false);
    setPendingRequest(null);
    setPanel(null);
  };

  const openMemory = async () => {
    setPanel("memory");
    try {
      setMemories(await aiCoachService.listMemories());
    } catch (error) {
      console.error("Unable to load AI Coach memory", error);
      toast.error(text.loadError);
    }
  };

  const send = async (message: string, retry = false) => {
    const cleanMessage = message.trim();
    if (!cleanMessage || sending) return;
    const requestId = retry && pendingRequest ? pendingRequest.id : crypto.randomUUID();

    setSending(true);
    setSendError(false);
    setPendingRequest({ id: requestId, text: cleanMessage });
    setInput("");
    if (!retry) {
      setMessages((current) => [...current, {
        id: `pending-${requestId}`,
        conversation_id: conversationId ?? "pending",
        role: "user",
        content: cleanMessage,
        created_at: new Date().toISOString(),
      }]);
    }

    try {
      const result = await aiCoachService.sendMessage({
        conversationId: conversationId ?? undefined,
        message: cleanMessage,
        locale,
        requestId,
      });
      setConversationId(result.conversation.id);
      const [savedMessages, nextConversations] = await Promise.all([
        aiCoachService.getMessages(result.conversation.id),
        aiCoachService.listConversations(),
      ]);
      setMessages(savedMessages);
      setConversations(nextConversations);
      setPendingRequest(null);
    } catch (error) {
      console.error("Unable to send AI Coach message", error);
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  const archiveConversation = async (id: string) => {
    setDeletingId(id);
    try {
      await aiCoachService.archiveConversation(id);
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      setConversations(remaining);
      if (conversationId === id) {
        if (remaining[0]) await openConversation(remaining[0].id);
        else startNewConversation();
      }
    } catch (error) {
      console.error("Unable to archive AI Coach conversation", error);
      toast.error(text.loadError);
    } finally {
      setDeletingId(null);
    }
  };

  const deleteMemory = async (id: string) => {
    setDeletingId(id);
    try {
      await aiCoachService.deleteMemory(id);
      setMemories((current) => current.filter((memory) => memory.id !== id));
    } catch (error) {
      console.error("Unable to delete AI Coach memory", error);
      toast.error(text.loadError);
    } finally {
      setDeletingId(null);
    }
  };

  const updateConsent = async (granted: boolean) => {
    setSavingConsent(true);
    try {
      await aiCoachService.setConsent(granted);
      setHasConsent(granted);
      if (!granted) {
        setPanel(null);
        setInput("");
        setSendError(false);
      }
    } catch (error) {
      console.error("Unable to update AI Coach consent", error);
      toast.error(text.consentError);
    } finally {
      setSavingConsent(false);
    }
  };

  return (
    <main
      className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#F5F8F7] text-[#081A2F]"
      dir={isRTL ? "rtl" : "ltr"}
      data-testid="ai-coach-page"
    >
      <header className="z-10 border-b border-[#DDE8E5] bg-white/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex min-h-12 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#081A2F] transition-colors hover:bg-[#F0F5F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18B894]"
            aria-label={isRTL ? "رجوع" : "Go back"}
          >
            <ArrowLeft className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
          </button>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#0B2340] text-[#43D7B5] shadow-[0_8px_22px_rgba(11,35,64,0.16)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16px] font-extrabold leading-5">{text.title}</h1>
            <p className="truncate text-[10px] font-semibold text-[#6D7F8F]">{text.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setPanel("history")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#DDE8E5] bg-white text-[#0B2340] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18B894]"
            aria-label={text.history}
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void openMemory()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#DDE8E5] bg-white text-[#0B2340] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18B894]"
            aria-label={text.memory}
          >
            <Brain className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#18B894]" aria-label="Loading" />
          </div>
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[#E1F7F1] text-[#139A7D]"><RefreshCw className="h-7 w-7" /></div>
            <p className="mt-4 text-[15px] font-bold">{text.loadError}</p>
            <button type="button" onClick={() => void loadCoach()} className="mt-4 min-h-11 rounded-full bg-[#0B2340] px-6 text-sm font-bold text-white">{text.retry}</button>
          </div>
        ) : hasConsent === false ? (
          <div className="mx-auto flex min-h-full max-w-[350px] flex-col justify-center pb-6 text-center">
            <div className="mx-auto grid h-[76px] w-[76px] place-items-center rounded-[24px] bg-[#E3F8F2] text-[#139A7D]">
              <ShieldCheck className="h-9 w-9" strokeWidth={1.8} />
            </div>
            <h2 className="mt-6 text-[22px] font-extrabold leading-8">{text.consentTitle}</h2>
            <p className="mt-3 text-[13px] font-medium leading-6 text-[#617687]">{text.consentBody}</p>
            <button
              type="button"
              onClick={() => void updateConsent(true)}
              disabled={savingConsent}
              className="mt-7 flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[#0B2340] px-5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {savingConsent ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {text.consentAllow}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="mt-2 min-h-11 text-[12px] font-bold text-[#6D7F8F]">{text.consentDecline}</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto flex min-h-full max-w-[360px] flex-col justify-center pb-6">
            <div className="relative mx-auto grid h-[92px] w-[92px] place-items-center rounded-[28px] bg-[#0B2340] text-[#43D7B5] shadow-[0_18px_40px_rgba(11,35,64,0.18)]">
              <Sparkles className="h-10 w-10" strokeWidth={1.8} />
              <span className="absolute -bottom-2 rounded-full bg-[#18B894] px-3 py-1 text-[9px] font-black uppercase text-white">AI</span>
            </div>
            <h2 className="mt-7 text-center text-[23px] font-extrabold leading-8">{text.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-[320px] text-center text-[13px] font-medium leading-5 text-[#66798A]">{text.emptyBody}</p>
            <div className="mt-7 space-y-2.5">
              {text.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="flex min-h-[54px] w-full items-center gap-3 rounded-[16px] border border-[#DCE8E5] bg-white px-4 text-start text-[13px] font-bold text-[#17324A] shadow-[0_5px_16px_rgba(20,50,70,0.05)] transition-transform active:scale-[0.99]"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#E3F8F2] text-[#13A783]"><Sparkles className="h-4 w-4" /></span>
                  <span className="flex-1">{prompt}</span>
                  <ChevronRight className={`h-4 w-4 text-[#91A2AE] ${isRTL ? "rotate-180" : ""}`} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeConversation && (
              <p className="pb-1 text-center text-[10px] font-bold uppercase text-[#91A2AE]">{formatConversationDate(activeConversation.last_message_at, locale, text.today)}</p>
            )}
            {loadingMessages ? (
              <Loader2 className="mx-auto mt-12 h-6 w-6 animate-spin text-[#18B894]" />
            ) : messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <span className="me-2 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#0B2340] text-[#43D7B5]"><Sparkles className="h-4 w-4" /></span>
                )}
                <div className={`max-w-[82%] whitespace-pre-wrap rounded-[18px] px-4 py-3 text-[13px] font-medium leading-[1.65] ${message.role === "user" ? "rounded-ee-[5px] bg-[#18B894] text-white" : "rounded-es-[5px] border border-[#DDE8E5] bg-white text-[#17324A] shadow-[0_5px_16px_rgba(20,50,70,0.04)]"}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <span className="me-2 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#0B2340] text-[#43D7B5]"><Sparkles className="h-4 w-4" /></span>
                <div className="flex h-11 items-center gap-1.5 rounded-[18px] rounded-es-[5px] border border-[#DDE8E5] bg-white px-4">
                  {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#18B894]" style={{ animationDelay: `${dot * 140}ms` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </section>

      <footer className="z-10 border-t border-[#DDE8E5] bg-white px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-3">
        {sendError && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-[12px] bg-[#FFF1EF] px-3 py-2 text-[11px] font-bold text-[#B93C31]">
            <span>{text.sendError}</span>
            <button type="button" onClick={() => pendingRequest && void send(pendingRequest.text, true)} className="min-h-8 shrink-0 underline" disabled={sending}>{text.retry}</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-[18px] border border-[#D4E3DF] bg-[#F7FAF9] p-1.5 focus-within:border-[#18B894] focus-within:ring-2 focus-within:ring-[#18B894]/15">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 1600))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim()) void send(input);
              }
            }}
            rows={1}
            className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-[14px] font-medium leading-5 outline-none placeholder:text-[#91A2AE]"
            placeholder={text.placeholder}
            aria-label={text.placeholder}
            disabled={sending || hasConsent !== true}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending || hasConsent !== true}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#0B2340] text-white transition-opacity disabled:opacity-35"
            aria-label={isRTL ? "إرسال" : "Send"}
          >
            <Send className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
          </button>
        </form>
        <p className="mt-1.5 flex items-center justify-center gap-1 text-[9px] font-semibold text-[#80919E]"><ShieldCheck className="h-3 w-3" />{text.disclaimer}</p>
      </footer>

      {panel && (
        <div className="absolute inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={panel === "history" ? text.history : text.memory}>
          <button type="button" className="absolute inset-0 bg-[#071629]/45 backdrop-blur-[2px]" onClick={() => setPanel(null)} aria-label={isRTL ? "إغلاق" : "Close"} />
          <div className="relative max-h-[82dvh] w-full overflow-hidden rounded-t-[26px] bg-white shadow-[0_-20px_50px_rgba(7,22,41,0.18)]">
            <div className="flex items-center gap-3 border-b border-[#E2ECE9] px-5 py-4">
              <div className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#E3F8F2] text-[#139A7D]">{panel === "history" ? <History className="h-5 w-5" /> : <Brain className="h-5 w-5" />}</div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-extrabold">{panel === "history" ? text.history : text.memory}</h2>
                {panel === "memory" && <p className="mt-0.5 text-[10px] font-medium text-[#738695]">{text.memoryBody}</p>}
              </div>
              <button type="button" onClick={() => setPanel(null)} className="grid h-11 w-11 place-items-center rounded-full bg-[#F1F5F4]" aria-label={isRTL ? "إغلاق" : "Close"}><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[calc(82dvh-76px)] overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
              {panel === "history" ? (
                <>
                  <button type="button" onClick={startNewConversation} disabled={sending} className="mb-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#0B2340] text-[13px] font-bold text-white"><Plus className="h-4 w-4" />{text.newChat}</button>
                  {conversations.length === 0 ? <p className="py-12 text-center text-sm font-semibold text-[#81929F]">{text.noHistory}</p> : (
                    <div className="space-y-2">
                      {conversations.map((conversation) => (
                        <div key={conversation.id} className={`flex items-center rounded-[15px] border px-1 ${conversation.id === conversationId ? "border-[#9CDECE] bg-[#F0FBF8]" : "border-[#E2ECE9] bg-white"}`}>
                          <button type="button" onClick={() => void openConversation(conversation.id)} className="min-w-0 flex-1 px-3 py-3 text-start">
                            <p className="truncate text-[13px] font-bold text-[#17324A]">{conversation.title}</p>
                            <p className="mt-1 text-[10px] font-semibold text-[#83939F]">{formatConversationDate(conversation.last_message_at, locale, text.today)}</p>
                          </button>
                          <button type="button" onClick={() => void archiveConversation(conversation.id)} disabled={deletingId === conversation.id || sending} className="grid h-11 w-11 place-items-center rounded-full text-[#91A2AE] hover:bg-[#FFF1EF] hover:text-[#C64B40]" aria-label={text.deleteConversation}>{deletingId === conversation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  {memories.length === 0
                    ? <p className="py-12 text-center text-sm font-semibold text-[#81929F]">{text.noMemory}</p>
                    : memories.map((memory) => (
                      <div key={memory.id} className="flex items-start gap-3 rounded-[15px] border border-[#E2ECE9] bg-[#FAFCFB] p-3">
                        <span className="mt-0.5 rounded-full bg-[#E3F8F2] px-2 py-1 text-[9px] font-black uppercase text-[#139A7D]">{memory.memory_type}</span>
                        <p className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-[#314B60]">{memory.content}</p>
                        <button type="button" onClick={() => void deleteMemory(memory.id)} disabled={deletingId === memory.id} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#91A2AE] hover:bg-[#FFF1EF] hover:text-[#C64B40]" aria-label={text.deleteMemory}>{deletingId === memory.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
                      </div>
                    ))}
                  <button
                    type="button"
                    onClick={() => void updateConsent(false)}
                    disabled={savingConsent}
                    className="mt-5 min-h-11 w-full rounded-[14px] border border-[#F0C9C4] px-4 text-[11px] font-bold text-[#B9473E] disabled:opacity-50"
                  >
                    {text.consentRevoke}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default AiCoach;
