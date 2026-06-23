import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = resolve("public/onboarding");
await mkdir(outDir, { recursive: true });

const dataImage = (path) => `data:image/jpeg;base64,${readFileSync(resolve(path)).toString("base64")}`;

const mealImages = {
  chicken: dataImage("public/meals/grilled-chicken-salad.jpg"),
  beef: dataImage("public/meals/beef-shawarma-bowl.jpg"),
  falafel: dataImage("public/meals/falafel-wrap.jpg"),
};

const shell = (body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 430px;
      height: 932px;
      overflow: hidden;
      background: #F6F8FB;
      color: #020617;
      font-family: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .screen {
      position: relative;
      width: 430px;
      height: 932px;
      padding: 32px 22px 18px;
      background:
        radial-gradient(circle at 10% 8%, rgba(34,199,161,.12), transparent 28%),
        radial-gradient(circle at 92% 14%, rgba(124,131,246,.12), transparent 30%),
        #F6F8FB;
    }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    .profile { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .avatar { width: 48px; height: 48px; border-radius: 18px; background: linear-gradient(135deg,#22C7A1,#38BDF8); box-shadow: 0 12px 26px rgba(2,6,23,.08); }
    .eyebrow { color: #22C7A1; font-size: 11px; line-height: 1; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    .name { margin-top: 4px; font-size: 24px; line-height: 1; font-weight: 900; letter-spacing: -.04em; }
    .iconBtn { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 18px; background: #fff; border: 1px solid #E5EAF1; color: #020617; font-weight: 900; box-shadow: 0 10px 22px rgba(2,6,23,.05); }
    .tabs { margin-top: 22px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .tab { height: 44px; display: grid; place-items: center; border-radius: 999px; border: 1px solid #E5EAF1; background: #fff; color: #64748B; font-size: 13px; font-weight: 900; }
    .tab.active { background: #020617; color: #fff; border-color: #020617; }
    .card { margin-top: 18px; border-radius: 28px; background: #fff; border: 1px solid #E5EAF1; box-shadow: 0 16px 34px rgba(2,6,23,.06); }
    .darkCard { background: #020617; color: #fff; border-color: #020617; }
    .cardInner { padding: 22px; }
    .label { font-size: 11px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; color: #94A3B8; }
    .title { margin-top: 7px; font-size: 30px; line-height: .98; font-weight: 950; letter-spacing: -.05em; }
    .sub { margin-top: 8px; color: #64748B; font-size: 14px; line-height: 1.45; font-weight: 700; }
    .pill { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; border-radius: 999px; padding: 0 12px; font-size: 12px; font-weight: 900; }
    .bottomNav { position: absolute; left: 20px; right: 20px; bottom: 18px; height: 70px; border-radius: 28px; background: #fff; border: 1px solid #E5EAF1; box-shadow: 0 16px 34px rgba(2,6,23,.08); display: grid; grid-template-columns: repeat(4,1fr); align-items: center; }
    .navItem { height: 48px; margin: 0 auto; min-width: 52px; border-radius: 18px; display: grid; place-items: center; color: #94A3B8; font-size: 20px; }
    .navItem.active { background: #020617; color: #fff; }
    .mealRow { display: flex; align-items: center; gap: 12px; min-height: 86px; border-radius: 24px; background: #F6F8FB; border: 1px solid #E5EAF1; padding: 10px; }
    .mealImg { width: 66px; height: 66px; border-radius: 20px; object-fit: cover; }
    .mealName { font-size: 16px; line-height: 1.05; font-weight: 900; }
    .muted { color: #64748B; font-size: 12px; font-weight: 800; }
    .macro { display:inline-flex; align-items:center; border-radius:999px; padding: 5px 9px; font-size: 11px; font-weight: 900; }
    .search { height: 56px; border-radius: 22px; background: #fff; border: 1px solid #E5EAF1; display:flex; align-items:center; gap:10px; padding: 0 16px; color:#94A3B8; font-weight:800; }
  </style>
</head>
<body>${body}</body>
</html>`;

const dashboard = shell(`
  <div class="screen">
    <div class="topbar">
      <div class="profile"><div class="avatar"></div><div><div class="eyebrow">Good morning</div><div class="name">Khamis</div></div></div>
      <div style="display:flex; gap:10px"><div class="iconBtn">♡</div><div class="iconBtn">🔔</div></div>
    </div>
    <div class="tabs"><div class="tab active">Today</div><div class="tab">Nutrition</div><div class="tab">Activity</div><div class="tab">Progress</div></div>
    <section class="card darkCard">
      <div class="cardInner">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div><div class="label" style="color:#7C83F6">Daily score</div><div class="title">760 kcal<br/>logged</div><p class="sub" style="color:#CBD5E1">Track meals, water, and macros in one place.</p></div>
          <div style="width:104px;height:104px;border-radius:50%;background:conic-gradient(#22C7A1 0 62%,rgba(255,255,255,.16) 62% 100%);display:grid;place-items:center;"><div style="width:76px;height:76px;border-radius:50%;background:#020617;display:grid;place-items:center;font-weight:950;font-size:24px;">62%</div></div>
        </div>
        <div style="margin-top:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          <div style="border-radius:20px;background:rgba(56,189,248,.14);padding:13px;"><div class="label" style="color:#38BDF8">Water</div><div style="font-size:24px;font-weight:950;">8</div></div>
          <div style="border-radius:20px;background:rgba(124,131,246,.16);padding:13px;"><div class="label" style="color:#7C83F6">Protein</div><div style="font-size:24px;font-weight:950;">76g</div></div>
          <div style="border-radius:20px;background:rgba(251,107,122,.14);padding:13px;"><div class="label" style="color:#FB6B7A">Fat</div><div style="font-size:24px;font-weight:950;">36g</div></div>
        </div>
      </div>
    </section>
    <section class="card"><div class="cardInner"><div class="label">Today meals</div><div style="margin-top:14px;display:grid;gap:10px;">
      <div class="mealRow"><img class="mealImg" src="${mealImages.chicken}"/><div style="flex:1"><div class="mealName">Grilled Chicken Salad</div><div class="muted" style="margin-top:5px;">Lunch • 420 kcal</div></div><span class="macro" style="background:#F3F4FF;color:#7C83F6">38g</span></div>
      <div class="mealRow"><img class="mealImg" src="${mealImages.beef}"/><div style="flex:1"><div class="mealName">Beef Shawarma Bowl</div><div class="muted" style="margin-top:5px;">Dinner • 620 kcal</div></div><span class="macro" style="background:#FFF7ED;color:#F97316">620</span></div>
    </div></div></section>
    <div class="bottomNav"><div class="navItem active">⌂</div><div class="navItem">🍴</div><div class="navItem">◫</div><div class="navItem">◌</div></div>
  </div>`);

const meals = shell(`
  <div class="screen">
    <div class="topbar"><div><div class="eyebrow" style="color:#7C83F6">Browse meals</div><div class="name">Choose your plan</div></div><div class="iconBtn">＋</div></div>
    <div style="margin-top:20px" class="search">⌕ Search meals, restaurants...</div>
    <div style="margin-top:14px;display:flex;gap:8px;overflow:hidden;"><div class="tab active" style="width:72px;flex:none;">All</div><div class="tab" style="width:104px;flex:none;">Breakfast</div><div class="tab" style="width:86px;flex:none;">Lunch</div><div class="tab" style="width:92px;flex:none;">Dinner</div></div>
    <section class="card"><div class="cardInner">
      <div style="display:flex;align-items:center;justify-content:space-between;"><div><div class="label">Recommended</div><div class="title" style="font-size:26px;">Smart picks</div></div><span class="pill" style="background:#F3F4FF;color:#7C83F6">High protein</span></div>
      <div style="margin-top:16px;display:grid;gap:12px;">
        <div class="mealRow"><img class="mealImg" src="${mealImages.chicken}"/><div style="flex:1"><div class="mealName">Grilled Chicken Salad</div><div class="muted" style="margin-top:6px;">Fresh greens and lean protein</div><div style="margin-top:8px;display:flex;gap:6px"><span class="macro" style="background:#FFF7ED;color:#F97316">420 kcal</span><span class="macro" style="background:#F3F4FF;color:#7C83F6">38g protein</span></div></div></div>
        <div class="mealRow"><img class="mealImg" src="${mealImages.falafel}"/><div style="flex:1"><div class="mealName">Falafel Wrap</div><div class="muted" style="margin-top:6px;">Plant-based daily meal</div><div style="margin-top:8px;display:flex;gap:6px"><span class="macro" style="background:#EFFFFA;color:#22C7A1">Vegan</span><span class="macro" style="background:#FFF7ED;color:#F97316">360 kcal</span></div></div></div>
        <div class="mealRow"><img class="mealImg" src="${mealImages.beef}"/><div style="flex:1"><div class="mealName">Beef Shawarma Bowl</div><div class="muted" style="margin-top:6px;">Balanced dinner option</div><div style="margin-top:8px;display:flex;gap:6px"><span class="macro" style="background:#FFF7ED;color:#F97316">620 kcal</span><span class="macro" style="background:#F3F4FF;color:#7C83F6">42g protein</span></div></div></div>
      </div>
    </div></section>
    <div class="bottomNav"><div class="navItem">⌂</div><div class="navItem active">🍴</div><div class="navItem">◫</div><div class="navItem">◌</div></div>
  </div>`);

const schedule = shell(`
  <div class="screen">
    <div class="topbar"><div><div class="eyebrow" style="color:#38BDF8">Weekly schedule</div><div class="name">Plan your week</div></div><div class="iconBtn">◫</div></div>
    <section class="card"><div class="cardInner">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:7px;">
        ${["M","T","W","T","F","S","S"].map((d,i)=>`<div style="height:58px;border-radius:18px;display:grid;place-items:center;background:${i===2?"#020617":"#F6F8FB"};color:${i===2?"#fff":"#64748B"};font-weight:950;">${d}<small style="display:block;font-size:10px;margin-top:2px;">${22+i}</small></div>`).join("")}
      </div>
    </div></section>
    <section class="card"><div class="cardInner">
      <div class="label">Scheduled meals</div>
      <div style="margin-top:14px;display:grid;gap:12px;">
        <div class="mealRow"><img class="mealImg" src="${mealImages.chicken}"/><div style="flex:1"><div class="mealName">Chicken Salad</div><div class="muted" style="margin-top:5px;">Monday • 12:30 PM</div></div><span class="macro" style="background:#EFF9FF;color:#38BDF8">Live</span></div>
        <div class="mealRow"><img class="mealImg" src="${mealImages.beef}"/><div style="flex:1"><div class="mealName">Beef Bowl</div><div class="muted" style="margin-top:5px;">Tuesday • 7:00 PM</div></div><span class="macro" style="background:#EFFFFA;color:#22C7A1">Ready</span></div>
        <div class="mealRow"><img class="mealImg" src="${mealImages.falafel}"/><div style="flex:1"><div class="mealName">Falafel Wrap</div><div class="muted" style="margin-top:5px;">Wednesday • 1:00 PM</div></div><span class="macro" style="background:#FFF7ED;color:#F97316">Fresh</span></div>
      </div>
    </div></section>
    <section class="card darkCard"><div class="cardInner" style="display:flex;align-items:center;justify-content:space-between;"><div><div class="label" style="color:#38BDF8">Next delivery</div><div style="font-size:24px;font-weight:950;margin-top:4px;">24 min</div></div><span class="pill" style="background:#fff;color:#020617">Track order</span></div></section>
    <div class="bottomNav"><div class="navItem">⌂</div><div class="navItem">🍴</div><div class="navItem active">◫</div><div class="navItem">◌</div></div>
  </div>`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
for (const [name, html] of Object.entries({
  "customer-dashboard": dashboard,
  "browse-meals": meals,
  "weekly-schedule": schedule,
})) {
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: resolve(outDir, `${name}.png`), fullPage: false });
}
await browser.close();
