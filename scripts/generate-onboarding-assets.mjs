import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = resolve("public/onboarding");
await mkdir(outDir, { recursive: true });

const dataImage = (path, mime = "image/jpeg") =>
  `data:${mime};base64,${readFileSync(resolve(path)).toString("base64")}`;

const mealImages = {
  chicken: dataImage("public/meals/grilled-chicken-salad.jpg"),
  beef: dataImage("public/meals/beef-shawarma-bowl.jpg"),
  falafel: dataImage("public/meals/falafel-wrap.jpg"),
};

const logo = dataImage("public/logo.png", "image/png");

const shell = (body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 430px;
      height: 932px;
      overflow: hidden;
      background: #F6F8FB;
      color: #020617;
      font-family: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif;
    }
    .screen {
      position: relative;
      width: 430px;
      height: 932px;
      padding: 28px 20px 18px;
      background:
        radial-gradient(circle at 8% 6%, rgba(45,174,120,.14), transparent 30%),
        radial-gradient(circle at 94% 10%, rgba(255,97,29,.10), transparent 28%),
        #F6F8FB;
    }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .profile { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .avatar {
      width: 48px; height: 48px; border-radius: 16px; object-fit: cover;
      background: #fff; border: 1px solid #E5EAF1;
      box-shadow: 0 8px 20px rgba(2,6,23,.06);
    }
    .eyebrow { color: #2DAE78; font-size: 11px; line-height: 1; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    .name { margin-top: 5px; font-size: 23px; line-height: 1; font-weight: 800; letter-spacing: -.04em; }
    .iconBtn {
      width: 44px; height: 44px; display: grid; place-items: center; border-radius: 16px;
      background: #fff; border: 1px solid #E5EAF1; color: #020617; font-weight: 800;
      box-shadow: 0 1px 3px rgba(15,23,42,.04);
    }
    .tabs { margin-top: 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .tab {
      height: 42px; display: grid; place-items: center; border-radius: 999px;
      background: #fff; color: #64748B; font-size: 12px; font-weight: 800;
      box-shadow: 0 1px 3px rgba(15,23,42,.04); ring: 1px solid #E5EAF1;
      border: 1px solid #E5EAF1;
    }
    .tab.active { background: #020617; color: #fff; border-color: #020617; }
    .card {
      margin-top: 16px; border-radius: 26px; background: #fff;
      box-shadow: 0 1px 3px rgba(15,23,42,.04); border: 1px solid #E8EDF3;
    }
    .darkCard { background: #0F172A; color: #fff; border-color: #0F172A; }
    .cardInner { padding: 20px; }
    .label { font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #94A3B8; }
    .title { margin-top: 6px; font-size: 28px; line-height: .98; font-weight: 800; letter-spacing: -.04em; }
    .sub { margin-top: 8px; color: #64748B; font-size: 13px; line-height: 1.4; font-weight: 700; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px; min-height: 28px;
      border-radius: 999px; padding: 0 11px; font-size: 11px; font-weight: 800;
    }
    .bottomNav {
      position: absolute; left: 18px; right: 18px; bottom: 16px; height: 68px;
      border-radius: 26px; background: #fff; border: 1px solid #E5EAF1;
      box-shadow: 0 10px 28px rgba(2,6,23,.08);
      display: grid; grid-template-columns: repeat(4,1fr); align-items: center;
    }
    .navItem {
      height: 46px; margin: 0 auto; min-width: 50px; border-radius: 16px;
      display: grid; place-items: center; color: #94A3B8; font-size: 18px;
    }
    .navItem.active { background: #020617; color: #fff; }
    .mealRow {
      display: flex; align-items: center; gap: 12px; min-height: 84px;
      border-radius: 22px; background: #F8FAFC; border: 1px solid #E8EDF3; padding: 10px;
    }
    .mealImg { width: 64px; height: 64px; border-radius: 18px; object-fit: cover; }
    .mealName { font-size: 15px; line-height: 1.1; font-weight: 800; }
    .muted { color: #64748B; font-size: 12px; font-weight: 700; }
    .macro {
      display: inline-flex; align-items: center; border-radius: 999px;
      padding: 5px 9px; font-size: 11px; font-weight: 800;
    }
    .search {
      height: 52px; border-radius: 20px; background: #fff; border: 1px solid #E5EAF1;
      display: flex; align-items: center; gap: 10px; padding: 0 16px;
      color: #94A3B8; font-weight: 700; font-size: 14px;
    }
    .ring {
      width: 100px; height: 100px; border-radius: 50%;
      background: conic-gradient(#2DAE78 0 62%, rgba(255,255,255,.14) 62% 100%);
      display: grid; place-items: center;
    }
    .ringInner {
      width: 74px; height: 74px; border-radius: 50%; background: #0F172A;
      display: grid; place-items: center; font-weight: 800; font-size: 22px;
    }
    .stat {
      border-radius: 18px; padding: 12px;
    }
    .chipRow { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  </style>
</head>
<body>${body}</body>
</html>`;

const dashboard = shell(`
  <div class="screen">
    <div class="topbar">
      <div class="profile">
        <img class="avatar" src="${logo}" alt="" />
        <div>
          <div class="eyebrow">Good morning</div>
          <div class="name">Nutrio</div>
        </div>
      </div>
      <div style="display:flex; gap:8px">
        <div class="iconBtn">♡</div>
        <div class="iconBtn" style="position:relative">🔔
          <span style="position:absolute;top:10px;right:11px;width:8px;height:8px;border-radius:50%;background:#FF611D;border:2px solid #fff"></span>
        </div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab active">Today</div>
      <div class="tab">Nutrition</div>
      <div class="tab">Activity</div>
      <div class="tab">Progress</div>
    </div>

    <section class="card darkCard">
      <div class="cardInner">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div style="min-width:0; flex:1">
            <div class="label" style="color:#2DAE78">Daily score</div>
            <div class="title">760 kcal<br/>logged</div>
            <p class="sub" style="color:#94A3B8">Meals, water, and macros in one place.</p>
          </div>
          <div class="ring"><div class="ringInner">62%</div></div>
        </div>
        <div style="margin-top:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div class="stat" style="background:rgba(56,189,248,.14)">
            <div class="label" style="color:#38BDF8">Water</div>
            <div style="font-size:22px;font-weight:800;margin-top:4px;">8</div>
          </div>
          <div class="stat" style="background:rgba(45,174,120,.16)">
            <div class="label" style="color:#2DAE78">Protein</div>
            <div style="font-size:22px;font-weight:800;margin-top:4px;">76g</div>
          </div>
          <div class="stat" style="background:rgba(255,97,29,.14)">
            <div class="label" style="color:#FF611D">Fat</div>
            <div style="font-size:22px;font-weight:800;margin-top:4px;">36g</div>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="cardInner">
        <div class="label">Today meals</div>
        <div style="margin-top:12px;display:grid;gap:10px;">
          <div class="mealRow">
            <img class="mealImg" src="${mealImages.chicken}" alt="" />
            <div style="flex:1;min-width:0">
              <div class="mealName">Grilled Chicken Salad</div>
              <div class="muted" style="margin-top:4px;">Lunch • 420 kcal</div>
            </div>
            <span class="macro" style="background:#EAF8F1;color:#2DAE78">38g</span>
          </div>
          <div class="mealRow">
            <img class="mealImg" src="${mealImages.beef}" alt="" />
            <div style="flex:1;min-width:0">
              <div class="mealName">Beef Shawarma Bowl</div>
              <div class="muted" style="margin-top:4px;">Dinner • 620 kcal</div>
            </div>
            <span class="macro" style="background:#FFF1EA;color:#FF611D">620</span>
          </div>
        </div>
      </div>
    </section>

    <div class="bottomNav">
      <div class="navItem active">⌂</div>
      <div class="navItem">🍴</div>
      <div class="navItem">◫</div>
      <div class="navItem">◌</div>
    </div>
  </div>
`);

const meals = shell(`
  <div class="screen">
    <div class="topbar">
      <div>
        <div class="eyebrow" style="color:#FF611D">Browse meals</div>
        <div class="name">Choose your plan</div>
      </div>
      <img class="avatar" src="${logo}" alt="" />
    </div>

    <div style="margin-top:18px" class="search">⌕ Search meals, restaurants...</div>

    <div style="margin-top:12px;display:flex;gap:8px;overflow:hidden;">
      <div class="tab active" style="width:70px;flex:none;">All</div>
      <div class="tab" style="width:100px;flex:none;">Breakfast</div>
      <div class="tab" style="width:84px;flex:none;">Lunch</div>
      <div class="tab" style="width:90px;flex:none;">Dinner</div>
    </div>

    <section class="card">
      <div class="cardInner">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div class="label">Recommended</div>
            <div class="title" style="font-size:24px;">Smart picks</div>
          </div>
          <span class="pill" style="background:#EAF8F1;color:#2DAE78">High protein</span>
        </div>
        <div style="margin-top:14px;display:grid;gap:10px;">
          <div class="mealRow">
            <img class="mealImg" src="${mealImages.chicken}" alt="" />
            <div style="flex:1;min-width:0">
              <div class="mealName">Grilled Chicken Salad</div>
              <div class="muted" style="margin-top:4px;">Fresh greens and lean protein</div>
              <div class="chipRow">
                <span class="macro" style="background:#FFF1EA;color:#FF611D">420 kcal</span>
                <span class="macro" style="background:#EAF8F1;color:#2DAE78">38g protein</span>
              </div>
            </div>
          </div>
          <div class="mealRow">
            <img class="mealImg" src="${mealImages.falafel}" alt="" />
            <div style="flex:1;min-width:0">
              <div class="mealName">Falafel Wrap</div>
              <div class="muted" style="margin-top:4px;">Plant-based daily meal</div>
              <div class="chipRow">
                <span class="macro" style="background:#EAF8F1;color:#2DAE78">Vegan</span>
                <span class="macro" style="background:#FFF1EA;color:#FF611D">360 kcal</span>
              </div>
            </div>
          </div>
          <div class="mealRow">
            <img class="mealImg" src="${mealImages.beef}" alt="" />
            <div style="flex:1;min-width:0">
              <div class="mealName">Beef Shawarma Bowl</div>
              <div class="muted" style="margin-top:4px;">Balanced dinner option</div>
              <div class="chipRow">
                <span class="macro" style="background:#FFF1EA;color:#FF611D">620 kcal</span>
                <span class="macro" style="background:#EAF8F1;color:#2DAE78">42g protein</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="bottomNav">
      <div class="navItem">⌂</div>
      <div class="navItem active">🍴</div>
      <div class="navItem">◫</div>
      <div class="navItem">◌</div>
    </div>
  </div>
`);

const schedule = shell(`
  <div class="screen">
    <div class="topbar">
      <div>
        <div class="eyebrow">Weekly schedule</div>
        <div class="name">Plan your week</div>
      </div>
      <img class="avatar" src="${logo}" alt="" />
    </div>

    <section class="card">
      <div class="cardInner">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">
          ${["M", "T", "W", "T", "F", "S", "S"]
            .map(
              (d, i) => `<div style="height:56px;border-radius:16px;display:grid;place-items:center;background:${
                i === 2 ? "#020617" : "#F8FAFC"
              };color:${i === 2 ? "#fff" : "#64748B"};font-weight:800;font-size:13px;border:1px solid ${
                i === 2 ? "#020617" : "#E8EDF3"
              };">${d}<small style="display:block;font-size:10px;margin-top:2px;opacity:.85">${22 + i}</small></div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="card">
      <div class="cardInner">
        <div class="label">Scheduled meals</div>
        <div style="margin-top:12px;display:grid;gap:10px;">
          <div class="mealRow">
            <img class="mealImg" src="${mealImages.chicken}" alt="" />
            <div style="flex:1;min-width:0">
              <div class="mealName">Chicken Salad</div>
              <div class="muted" style="margin-top:4px;">Monday • 12:30 PM</div>
            </div>
            <span class="macro" style="background:#EAF8F1;color:#2DAE78">Live</span>
          </div>
          <div class="mealRow">
            <img class="mealImg" src="${mealImages.beef}" alt="" />
            <div style="flex:1;min-width:0">
              <div class="mealName">Beef Bowl</div>
              <div class="muted" style="margin-top:4px;">Tuesday • 7:00 PM</div>
            </div>
            <span class="macro" style="background:#FFF1EA;color:#FF611D">Ready</span>
          </div>
          <div class="mealRow">
            <img class="mealImg" src="${mealImages.falafel}" alt="" />
            <div style="flex:1;min-width:0">
              <div class="mealName">Falafel Wrap</div>
              <div class="muted" style="margin-top:4px;">Wednesday • 1:00 PM</div>
            </div>
            <span class="macro" style="background:#EEF2F7;color:#020617">Fresh</span>
          </div>
        </div>
      </div>
    </section>

    <section class="card darkCard">
      <div class="cardInner" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div class="label" style="color:#2DAE78">Next delivery</div>
          <div style="font-size:24px;font-weight:800;margin-top:4px;">24 min</div>
        </div>
        <span class="pill" style="background:#FF611D;color:#fff">Track order</span>
      </div>
    </section>

    <div class="bottomNav">
      <div class="navItem">⌂</div>
      <div class="navItem">🍴</div>
      <div class="navItem active">◫</div>
      <div class="navItem">◌</div>
    </div>
  </div>
`);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
});

const outputs = {
  "hero-dashboard.png": dashboard,
  "hero-meals.png": meals,
  "hero-schedule.png": schedule,
  "customer-dashboard.png": dashboard,
  "browse-meals.png": meals,
  "weekly-schedule.png": schedule,
};

for (const [name, html] of Object.entries(outputs)) {
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(outDir, name), fullPage: false });
  console.log(`wrote ${name}`);
}

await browser.close();
console.log("Onboarding UI assets generated.");
