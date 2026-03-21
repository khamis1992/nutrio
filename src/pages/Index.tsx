import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { PromoVideo } from "@/components/PromoVideo";
import { useLandingStats, formatStat } from "@/hooks/useLandingStats";
import {
  ArrowRight,
  Star,
  Menu,
  X,
  ChevronRight,
  Smartphone,
  ChefHat,
  Target,
  TrendingUp,
  Truck,
  ShieldCheck,
  Utensils,
  Leaf,
  Download,
  Store,
} from "lucide-react";
import appScreenshot from "@/assets/dashboard-app.png";
import heroFood from "@/assets/schedule-app.png";
import meal1 from "@/assets/meals-app.png";
import meal2 from "@/assets/orders-app.png";
import meal3 from "@/assets/wallet-app.png";

// Fallback values shown while loading or if data is unavailable
const MARQUEE_FALLBACK = [
  { val: "50+",  lbl: "Partner Restaurants" },
  { val: "12K+", lbl: "Members" },
  { val: "4.9★", lbl: "App Rating" },
  { val: "3M+",  lbl: "Meals Delivered" },
  { val: "#1",   lbl: "in Qatar" },
];

const STEPS = [
  { num: "1", title: "Download the App", desc: "Get Nutrio free on iOS or Android. Takes 10 seconds.", icon: Download },
  { num: "2", title: "Set Your Goals", desc: "Tell us your dietary preferences, allergies, and macro targets.", icon: Target },
  { num: "3", title: "Get Meals Delivered", desc: "Order from 50+ restaurants. Fresh, healthy meals at your door in 30 min.", icon: Truck },
];

const FEATURES = [
  { icon: Target,      title: "AI Nutrition Tracking",  desc: "Scan any meal to auto-log calories, protein, carbs, and fat. Precise to the gram." },
  { icon: ChefHat,     title: "50+ Restaurant Partners", desc: "Browse curated menus from Qatar's best healthy restaurants — all in one app." },
  { icon: TrendingUp,  title: "Visual Progress",        desc: "Beautiful charts that track your weight, streaks, and macro balance over time." },
  { icon: Utensils,    title: "Meal Plans",             desc: "Personalized weekly meal plans built by certified nutritionists, adapted to you." },
  { icon: ShieldCheck, title: "Freshness Guaranteed",   desc: "Every order quality-checked. Delivered fresh within 30 minutes of preparation." },
  { icon: Leaf,        title: "Every Diet Style",       desc: "Keto, vegan, high-protein, halal, low-carb — all crafted with premium ingredients." },
];

const REVIEWS = [
  { name: "Sarah M.", rating: 5, text: "Lost 8 kg in 3 months. The meal tracking feature is incredibly accurate and the food is delicious." },
  { name: "Ahmed K.", rating: 5, text: "Best healthy food app in Qatar. The variety of restaurants is amazing — never gets boring." },
  { name: "Fatima A.", rating: 5, text: "My whole family uses Nutrio now. The kids love the meals and I love the nutrition tracking." },
];

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const isNative =
      Capacitor.isNativePlatform() ||
      (window.location.hostname === "localhost" &&
        window.location.protocol === "https:" &&
        !window.location.port);
    if (isNative && !authLoading) {
      navigate(user ? "/dashboard" : "/walkthrough", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const stats = useLandingStats();

  // Build live marquee — falls back gracefully while loading
  const marqueeItems = stats.loading
    ? MARQUEE_FALLBACK
    : [
        { val: stats.restaurants !== null ? `${stats.restaurants}+` : "50+",          lbl: "Partner Restaurants" },
        { val: stats.members !== null ? formatStat(stats.members) : "12K+",            lbl: "Members" },
        { val: stats.avgRating !== null ? `${stats.avgRating}★` : "4.9★",            lbl: "App Rating" },
        { val: stats.ordersDelivered !== null ? formatStat(stats.ordersDelivered) : "3M+", lbl: "Meals Delivered" },
        { val: "#1", lbl: "in Qatar" },
      ];

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(".rv");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("vis")),
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const downloadButtons = (size: "lg" | "sm" = "lg") => {
    const h = size === "lg" ? 56 : 48;
    const px = size === "lg" ? 28 : 22;
    const fs = size === "lg" ? ".95rem" : ".85rem";
    return (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="#" style={{ textDecoration: "none" }}>
          <button className="btn-dark" style={{ height: h, padding: `0 ${px}px`, fontSize: fs, gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.51-3.23 0-1.44.64-2.2.45-3.06-.4C3.79 16.17 4.36 9.05 8.93 8.82c1.25.07 2.12.72 2.88.76.98-.2 1.92-.87 3.01-.79 1.28.1 2.24.61 2.88 1.56-2.65 1.58-2.02 5.09.37 6.07-.5 1.3-.9 2.6-1.87 3.84l-.15.02zM12.03 8.75c-.12-2.08 1.57-3.82 3.53-3.97.28 2.34-2.12 4.1-3.53 3.97z"/></svg>
            App Store
          </button>
        </a>
        <a href="#" style={{ textDecoration: "none" }}>
          <button className="btn-dark" style={{ height: h, padding: `0 ${px}px`, fontSize: fs, gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.61 1.81L13.42 12 3.61 22.19c-.36-.44-.61-1.04-.61-1.74V3.55c0-.7.25-1.3.61-1.74zm.75-.62L15.1 6.88l-2.76 2.76L4.36 1.19zm11.35 5.97L17.6 8.33 5.36 22.81l7.3-7.45 3.05-3.1-.01-.01 3.05-3.1-2.44-1.17zM17.6 15.67l-2.44-1.17-3.05 3.1L5.36 22.81l9.17-4.85 3.07-2.29z"/></svg>
            Google Play
          </button>
        </a>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#fff", color: "#111", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        
        /* Override Ionic's body styles that break scrolling on non-Ionic pages */
        body {
          overflow: visible !important;
          position: static !important;
          min-height: auto;
        }
        html, body, #root {
          height: auto;
          overflow: visible;
        }

        :root {
          --accent: #111;
          --green:  #22C55E;
          --orange: #F97316;
          --muted:  #6B7280;
          --border: #E5E7EB;
          --bg2:    #F9FAFB;
        }

        .rv { opacity:0; transform:translateY(20px); transition:opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1); }
        .rv.vis { opacity:1; transform:none; }
        .rv-now { opacity:1!important; transform:none!important; }
        .d1{transition-delay:.1s} .d2{transition-delay:.2s} .d3{transition-delay:.3s} .d4{transition-delay:.4s}

        .lift { transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s; }
        .lift:hover { transform:translateY(-5px); box-shadow:0 20px 44px -12px rgba(0,0,0,.12); }

        /* ── Primary download CTA ── */
        .btn-dark {
          background:#111; color:#fff; border:none; border-radius:14px;
          font-weight:600; cursor:pointer; display:inline-flex; align-items:center;
          font-family:'Inter',sans-serif; transition:all .2s; white-space:nowrap;
        }
        .btn-dark:hover { background:#222; transform:translateY(-2px); box-shadow:0 8px 28px -4px rgba(0,0,0,.35); }

        .btn-green {
          background:var(--green); color:#fff; border:none; border-radius:14px;
          padding:14px 28px; font-weight:700; font-size:.9rem; cursor:pointer;
          display:inline-flex; align-items:center; gap:8px;
          font-family:'Inter',sans-serif; transition:all .2s; white-space:nowrap;
        }
        .btn-green:hover { background:#1ea74e; transform:translateY(-2px); box-shadow:0 8px 24px -4px rgba(34,197,94,.4); }

        .btn-ghost {
          background:transparent; color:#111; border:1.5px solid var(--border); border-radius:14px;
          padding:13px 24px; font-weight:500; font-size:.9rem; cursor:pointer;
          display:inline-flex; align-items:center; gap:8px; font-family:'Inter',sans-serif; transition:all .2s;
        }
        .btn-ghost:hover { border-color:#9CA3AF; background:#F9FAFB; }

        .nav-lnk { color:var(--muted); font-size:.875rem; font-weight:500; transition:color .2s; text-decoration:none; }
        .nav-lnk:hover { color:#111; }

        .mq-track { display:flex; animation:mq 26s linear infinite; width:max-content; }
        .mq-track:hover { animation-play-state:paused; }
        @keyframes mq { from{transform:translateX(0)} to{transform:translateX(-50%)} }

        .sh::-webkit-scrollbar{display:none} .sh{-ms-overflow-style:none;scrollbar-width:none}

        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .fl1{animation:floatY 5s ease-in-out infinite} .fl2{animation:floatY 6s ease-in-out 1s infinite}

        .phone-mock {
          border-radius:32px; overflow:hidden; border:8px solid #111;
          box-shadow:0 40px 80px -20px rgba(0,0,0,.3), 0 0 0 1px rgba(0,0,0,.1);
          background:#111; position:relative;
        }
        .phone-mock::before {
          content:''; position:absolute; top:0; left:50%; transform:translateX(-50%);
          width:80px; height:20px; background:#111; border-radius:0 0 14px 14px; z-index:5;
        }

        .safe-t { padding-top:env(safe-area-inset-top,0px); }

        /* Green glow for download sections */
        .dl-glow {
          background: linear-gradient(135deg, #111 0%, #1a2e1a 50%, #111 100%);
          position: relative; overflow: hidden;
        }
        .dl-glow::before {
          content:''; position:absolute; top:-200px; right:-200px; width:600px; height:600px;
          border-radius:50%; background:radial-gradient(circle, rgba(34,197,94,.15) 0%, transparent 60%);
          pointer-events:none;
        }
      `}</style>

      {/* ── NAV ── */}
      <header className="safe-t" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: scrolled ? "rgba(255,255,255,.97)" : "rgba(255,255,255,.9)",
        backdropFilter: "blur(14px)",
        borderBottom: scrolled ? "1px solid #E5E7EB" : "none",
        boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,.05)" : "none",
        transition: "all .3s",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <Logo size="md" />
          </Link>

          <nav className="hidden md:flex" style={{ alignItems: "center", gap: 28 }}>
            <a href="#features" className="nav-lnk">Features</a>
            <a href="#how-it-works" className="nav-lnk">How It Works</a>
            <a href="#reviews" className="nav-lnk">Reviews</a>
            <Link to="/faq" className="nav-lnk">FAQ</Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link to="/auth" className="hidden md:block" style={{ textDecoration: "none" }}>
              <button className="btn-ghost" style={{ padding: "10px 18px", fontSize: ".8rem" }}>Sign In</button>
            </Link>
            <a href="#" className="hidden md:block" style={{ textDecoration: "none" }}>
              <button className="btn-dark" style={{ padding: "10px 22px", fontSize: ".8rem", height: "auto", gap: 6 }}>
                <Download size={15} /> Download App
              </button>
            </a>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button className="md:hidden" style={{ width: 42, height: 42, borderRadius: 12, border: "1.5px solid #E5E7EB", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Menu size={20} color="#6B7280" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" style={{ width: "100%", maxWidth: 400, background: "#fff", padding: 0 }}>
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 24, borderBottom: "1px solid #E5E7EB" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Logo size="sm" />
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <X size={16} color="#6B7280" />
                    </button>
                  </div>
                  <nav style={{ flex: 1, padding: 24 }}>
                    {[
                      { label: "Home", to: "/" }, { label: "Browse Meals", to: "/meals" },
                      { label: "How It Works", href: "#how-it-works" }, { label: "Reviews", href: "#reviews" },
                      { label: "FAQ", to: "/faq" }, { label: "Contact", to: "/contact" },
                      { label: "Partner Portal", to: "/partner/auth" },
                    ].map((item) =>
                      item.href ? (
                        <a key={item.label} href={item.href}
                          onClick={(e) => { e.preventDefault(); document.querySelector(item.href!)?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F3F4F6", color: "#6B7280", textDecoration: "none", fontWeight: 500 }}>
                          {item.label}<ChevronRight size={16} color="#D1D5DB" />
                        </a>
                      ) : (
                        <Link key={item.label} to={item.to!} onClick={() => setMobileMenuOpen(false)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F3F4F6", color: "#6B7280", textDecoration: "none", fontWeight: 500 }}>
                          {item.label}<ChevronRight size={16} color="#D1D5DB" />
                        </Link>
                      )
                    )}
                  </nav>
                  <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                    <a href="#" style={{ textDecoration: "none" }}>
                      <button className="btn-dark" style={{ width: "100%", justifyContent: "center", height: 52, padding: "0 20px", fontSize: ".9rem", gap: 8 }}>
                        <Download size={18} /> Download App
                      </button>
                    </a>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)} style={{ textDecoration: "none" }}>
                      <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", height: 52, marginTop: 0 }}>Sign In</button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div style={{ height: 80 }} />

      <main>

        {/* ═══════ HERO — App download focus ═══════ */}
        <section style={{ position: "relative", overflow: "hidden", padding: "48px 24px 0" }}>
          <div style={{ position: "absolute", top: -100, right: -100, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="hero-g">

              {/* Left: copy */}
              <div className="rv rv-now">
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 999, padding: "6px 16px", marginBottom: 24, fontSize: ".75rem", fontWeight: 600, color: "#16A34A" }}>
                  <Star size={13} fill="#22C55E" color="#22C55E" />
                  {stats.avgRating !== null ? `${stats.avgRating} Rated` : "4.9 Rated"} —{" "}
                  {stats.members !== null ? formatStat(stats.members) : "12K+"} Downloads
                </div>

                <h1 className="rv rv-now d1" style={{ fontWeight: 900, fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 22, color: "#111" }}>
                  Your Nutrition,<br />
                  <span style={{ color: "var(--green)" }}>One App Away.</span>
                </h1>

                <p className="rv rv-now d2" style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--muted)", marginBottom: 36, maxWidth: 440 }}>
                  Track meals, order from 50+ healthy restaurants, and reach your fitness goals — all from one beautifully designed app. Free on iOS & Android.
                </p>

                <div className="rv rv-now d3" style={{ marginBottom: 32 }}>
                  {downloadButtons("lg")}
                </div>

                <div className="rv rv-now d4" style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ display: "flex" }}>
                    {[meal1, meal2, meal3].map((img, i) => (
                      <div key={i} style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #fff", overflow: "hidden", marginLeft: i > 0 ? -10 : 0, position: "relative", zIndex: 3 - i }}>
                        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: ".8rem", color: "var(--muted)" }}>
                    <strong style={{ color: "#111" }}>
                      {stats.members !== null ? formatStat(stats.members) : "12K+"}
                    </strong>{" "}
                    people are already eating smarter
                  </p>
                </div>
              </div>

              {/* Right: phone mockup with app screenshot */}
              <div className="rv rv-now d1" style={{ display: "flex", justifyContent: "center", position: "relative" }}>
                <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.06)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.04)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />

                <div className="fl1" style={{ width: 260, position: "relative", zIndex: 2 }}>
                  <div className="phone-mock">
                    <img src={appScreenshot} alt="Nutrio app" style={{ width: "100%", display: "block" }} />
                  </div>
                </div>

                {/* Floating badges */}
                <div className="fl2" style={{ position: "absolute", top: 40, right: 10, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "10px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 8, zIndex: 3 }}>
                  <Utensils size={16} color="var(--green)" />
                  <span style={{ fontSize: ".75rem", fontWeight: 600 }}>50+ Restaurants</span>
                </div>
                <div className="fl1" style={{ position: "absolute", bottom: 60, left: 0, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "10px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 8, zIndex: 3 }}>
                  <Target size={16} color="var(--orange)" />
                  <span style={{ fontSize: ".75rem", fontWeight: 600 }}>AI Tracking</span>
                </div>
              </div>
            </div>
          </div>

          <style>{`@media(max-width:768px){.hero-g{grid-template-columns:1fr!important;gap:32px!important;}}`}</style>
        </section>

        {/* ═══════ MARQUEE ═══════ */}
        <div style={{ overflow: "hidden", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", padding: "16px 0", background: "#FAFAFA", marginTop: 48 }}>
          <div className="mq-track">
            {[...marqueeItems, ...marqueeItems].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 36px", flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "#111" }}>{s.val}</span>
                <span style={{ fontSize: ".78rem", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.lbl}</span>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#E5E7EB", marginLeft: 8 }} />
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ APP SCREENSHOTS ═══════ */}
        <section style={{ padding: "80px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="rv" style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--green)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>SEE IT IN ACTION</p>
              <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", color: "#111" }}>
                Everything in <span style={{ color: "var(--green)" }}>One Place</span>
              </h2>
            </div>

            <div className="sh" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, overflow: "visible" }}>
              {[
                { img: heroFood, title: "Browse 500+ Meals", desc: "Filter by diet, cuisine, macros, and restaurant. Every meal has full nutrition info." },
                { img: appScreenshot, title: "Track Your Nutrition", desc: "AI-powered tracking logs every meal. See calories, protein, carbs, fat in real time." },
                { img: meal1, title: "Order & Get Delivered", desc: "One-tap ordering from 50+ restaurants. Fresh meals at your door in under 30 minutes." },
              ].map((s, i) => (
                <div key={i} className={`lift rv`} style={{ borderRadius: 20, overflow: "hidden", border: "1px solid #E5E7EB", background: "#fff", transitionDelay: `${i * 0.12}s` }}>
                  <div style={{ height: 220, overflow: "hidden" }}>
                    <img src={s.img} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: "20px 22px" }}>
                    <h3 style={{ fontWeight: 700, fontSize: ".95rem", marginBottom: 6, color: "#111" }}>{s.title}</h3>
                    <p style={{ fontSize: ".82rem", color: "var(--muted)", lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <style>{`@media(max-width:768px){#app-screens .sh{grid-template-columns:repeat(3,280px)!important;overflow-x:auto!important;}}`}</style>
          </div>
        </section>

        {/* ═══════ HOW IT WORKS ═══════ */}
        <section id="how-it-works" style={{ padding: "80px 24px", background: "#F9FAFB" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="rv" style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--green)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>3 EASY STEPS</p>
              <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", color: "#111" }}>
                Get Started in <span style={{ color: "var(--green)" }}>60 Seconds</span>
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              {STEPS.map((step, i) => (
                <div key={i} className={`lift rv`} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20, padding: "32px 26px", position: "relative", overflow: "hidden", transitionDelay: `${i * 0.12}s` }}>
                  <div style={{ position: "absolute", top: -12, right: 16, fontSize: "5rem", fontWeight: 900, color: "rgba(0,0,0,0.03)", lineHeight: 1, userSelect: "none" }}>{step.num}</div>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: i === 0 ? "var(--green)" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                    <step.icon size={22} color={i === 0 ? "#fff" : "#111"} />
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 8, color: "#111" }}>{step.title}</h3>
                  <p style={{ fontSize: ".85rem", color: "var(--muted)", lineHeight: 1.65 }}>{step.desc}</p>
                </div>
              ))}
            </div>

            <div className="rv d3" style={{ textAlign: "center", marginTop: 40 }}>
              {downloadButtons("sm")}
            </div>
          </div>
        </section>

        {/* ═══════ FEATURES ═══════ */}
        <section id="features" style={{ padding: "80px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="rv" style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--green)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>PACKED WITH FEATURES</p>
              <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", color: "#111" }}>
                Why {stats.members !== null ? formatStat(stats.members) : "12K+"} People{" "}
                <span style={{ color: "var(--green)" }}>Love Nutrio</span>
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              {FEATURES.map((f, i) => (
                <div key={i} className={`lift rv`} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: "28px 24px", transitionDelay: `${(i % 3) * 0.1}s` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: i % 2 === 0 ? "rgba(34,197,94,0.1)" : "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <f.icon size={20} color={i % 2 === 0 ? "var(--green)" : "var(--orange)"} />
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: ".9rem", marginBottom: 8, color: "#111" }}>{f.title}</h3>
                  <p style={{ fontSize: ".82rem", color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ REVIEWS ═══════ */}
        <section id="reviews" style={{ padding: "80px 24px", background: "#F9FAFB" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="rv" style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--green)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>APP STORE REVIEWS</p>
              <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", color: "#111" }}>
                Loved by <span style={{ color: "var(--green)" }}>Thousands</span>
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              {REVIEWS.map((r, i) => (
                <div key={i} className={`lift rv`} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: "28px 24px", transitionDelay: `${i * 0.12}s` }}>
                  <div style={{ display: "flex", gap: 2, marginBottom: 14 }}>
                    {Array.from({ length: r.rating }).map((_, j) => (
                      <Star key={j} size={16} fill="#F59E0B" color="#F59E0B" />
                    ))}
                  </div>
                  <p style={{ fontSize: ".875rem", color: "#374151", lineHeight: 1.65, marginBottom: 18, fontStyle: "italic" }}>"{r.text}"</p>
                  <p style={{ fontSize: ".8rem", fontWeight: 700, color: "#111" }}>{r.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ FINAL DOWNLOAD CTA ═══════ */}
        <section style={{ padding: "0 24px", margin: "60px 0" }}>
          <div className="rv" style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="dl-glow" style={{ borderRadius: 28, padding: "64px 48px", textAlign: "center" }}>
              <div style={{ position: "relative", zIndex: 2 }}>
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 20, background: "var(--green)", marginBottom: 24 }}>
                  <Smartphone size={30} color="#fff" />
                </div>
                <h2 style={{ fontWeight: 900, fontSize: "clamp(1.8rem, 4vw, 3rem)", color: "#fff", marginBottom: 14, letterSpacing: "-0.02em" }}>
                  Start Eating Smarter Today
                </h2>
                <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.6)", marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
                  Download Nutrio for free. Track your meals, order healthy food, and transform your nutrition — all in one app.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                  <a href="#" style={{ textDecoration: "none" }}>
                    <button style={{ background: "#fff", color: "#111", border: "none", borderRadius: 14, padding: "16px 30px", fontWeight: 700, fontSize: ".9rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, transition: "all .2s", fontFamily: "'Inter',sans-serif" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#111"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.51-3.23 0-1.44.64-2.2.45-3.06-.4C3.79 16.17 4.36 9.05 8.93 8.82c1.25.07 2.12.72 2.88.76.98-.2 1.92-.87 3.01-.79 1.28.1 2.24.61 2.88 1.56-2.65 1.58-2.02 5.09.37 6.07-.5 1.3-.9 2.6-1.87 3.84l-.15.02zM12.03 8.75c-.12-2.08 1.57-3.82 3.53-3.97.28 2.34-2.12 4.1-3.53 3.97z"/></svg>
                      Download for iOS
                    </button>
                  </a>
                  <a href="#" style={{ textDecoration: "none" }}>
                    <button style={{ background: "#fff", color: "#111", border: "none", borderRadius: 14, padding: "16px 30px", fontWeight: 700, fontSize: ".9rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, transition: "all .2s", fontFamily: "'Inter',sans-serif" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#111"><path d="M3.61 1.81L13.42 12 3.61 22.19c-.36-.44-.61-1.04-.61-1.74V3.55c0-.7.25-1.3.61-1.74zm.75-.62L15.1 6.88l-2.76 2.76L4.36 1.19zm11.35 5.97L17.6 8.33 5.36 22.81l7.3-7.45 3.05-3.1-.01-.01 3.05-3.1-2.44-1.17zM17.6 15.67l-2.44-1.17-3.05 3.1L5.36 22.81l9.17-4.85 3.07-2.29z"/></svg>
                      Download for Android
                    </button>
                  </a>
                </div>
                <p style={{ fontSize: ".75rem", color: "rgba(255,255,255,0.4)" }}>Free download • No credit card required</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════ PARTNER CTA (small) ═══════ */}
        <section style={{ padding: "0 24px 60px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="rv" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 20, padding: "28px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Store size={20} color="#fff" />
                </div>
                <div>
                  <h4 style={{ fontWeight: 700, fontSize: ".9rem", color: "#111" }}>Own a Restaurant?</h4>
                  <p style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                Partner with us and reach {stats.members !== null ? formatStat(stats.members) : "12K+"} health-conscious customers
              </p>
                </div>
              </div>
              <Link to="/partner/auth" style={{ textDecoration: "none" }}>
                <button className="btn-green" style={{ padding: "10px 22px", fontSize: ".8rem", borderRadius: 12 }}>Join Our Network →</button>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════ FOOTER ═══════ */}
        <footer style={{ background: "#fff", padding: "40px 24px 24px", color: "#111", borderTop: "1px solid #E5E7EB" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 20, paddingBottom: 24, borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Logo size="sm" />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
                {[
                  { label: "About", to: "/about" }, { label: "Contact", to: "/contact" },
                  { label: "FAQ", to: "/faq" }, { label: "Privacy", to: "/privacy" }, { label: "Terms", to: "/terms" },
                ].map((link) => (
                  <Link key={link.label} to={link.to} style={{ fontSize: ".82rem", color: "#6B7280", textDecoration: "none", fontWeight: 500, transition: "color .2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#111")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}
                  >{link.label}</Link>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 20 }}>
              <p style={{ fontSize: ".75rem", color: "#9CA3AF" }}>©2026 Nutrio Fuel Ltd. All Rights Reserved.</p>
              <div style={{ display: "flex", gap: 10 }}>
                {downloadButtons("sm")}
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile FAB — Download */}
      <div className="lg:hidden" style={{ position: "fixed", bottom: 24, right: 20, zIndex: 40 }}>
        <a href="#" style={{ textDecoration: "none" }}>
          <button className="btn-dark" style={{ width: 54, height: 54, borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 28px rgba(0,0,0,.35)" }}>
            <Download size={22} />
          </button>
        </a>
      </div>

      <PromoVideo />
    </div>
  );
};

export default Index;
