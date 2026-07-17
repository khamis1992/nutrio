import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const API_ROOT = new URL(process.env.WGER_API_ROOT || "https://wger.de/api/v2/");
const INPUT_PATH = path.resolve("public/exercises/catalog.v1.json");
const OUTPUT_PATH = path.resolve("public/exercises/catalog.v2.json");
const SOURCE_PATH = path.resolve("public/exercises/source.v2.json");
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;
const MAX_RESPONSE_CHARS = 20 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;

if (API_ROOT.protocol !== "https:") {
  throw new Error("WGER_API_ROOT must use HTTPS");
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchJson(url, attempt = 0) {
  const target = new URL(url, API_ROOT);
  if (target.origin !== API_ROOT.origin) throw new Error("Refusing an unexpected wger pagination host");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "NutrioExerciseCatalogSync/1.0",
      },
    });
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await sleep(Math.min(10_000, Math.max(retryAfter * 1000, 500 * (2 ** attempt))));
      return fetchJson(target, attempt + 1);
    }
    if (!response.ok) throw new Error(`wger request failed (${response.status})`);

    const text = await response.text();
    if (text.length > MAX_RESPONSE_CHARS) throw new Error("wger response exceeded the size limit");
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAll(endpoint) {
  const results = [];
  let next = new URL(`${endpoint}?limit=${PAGE_LIMIT}&format=json`, API_ROOT).toString();
  let page = 0;
  while (next) {
    page += 1;
    if (page > MAX_PAGES) throw new Error("wger pagination exceeded the safety limit");
    const payload = await fetchJson(next);
    if (!Array.isArray(payload.results)) throw new Error("wger returned an invalid paginated response");
    results.push(...payload.results);
    next = typeof payload.next === "string" ? payload.next : "";
  }
  return results;
}

function repairMojibake(value) {
  if (typeof value !== "string" || !/[ÃÂ]/.test(value)) return value;
  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    return repaired.includes("�") ? value : repaired;
  } catch {
    return value;
  }
}

function decodeHtml(value) {
  return repairMojibake(String(value || ""))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function plainText(value) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/ol>|<\/ul>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function instructionsFrom(translation) {
  const html = String(translation?.description || "");
  const listItems = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => plainText(match[1]))
    .filter(Boolean);
  if (listItems.length) return listItems.slice(0, 20);

  const source = plainText(translation?.description_source || html);
  const numbered = source.split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((line, index) => index > 0 && line.length > 8);
  return numbered.slice(0, 20);
}

function descriptionFrom(translation) {
  const value = plainText(translation?.description_source || translation?.description || "");
  return value
    .split(/\n\s*(?:notes?\s*\(instructions?\)|instructions?|hinweise|notas?)\s*:?/i)[0]
    .trim()
    .slice(0, 3000);
}

function normalizedKey(value) {
  return plainText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function safeMediaUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === API_ROOT.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeExternalLink(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function translationMap(exercise, languages) {
  const output = {};
  for (const translation of Array.isArray(exercise.translations) ? exercise.translations : []) {
    const language = languages.get(translation.language);
    if (!language || !["en", "ar"].includes(language)) continue;
    const name = plainText(translation.name).slice(0, 200);
    if (!name) continue;
    output[language] = {
      name,
      description: descriptionFrom(translation),
      instructions: instructionsFrom(translation),
      aliases: unique((translation.aliases || []).map((alias) => plainText(alias.alias))).slice(0, 20),
    };
  }
  return output;
}

function normalizeWgerExercise(exercise, languages) {
  const translations = translationMap(exercise, languages);
  const primaryTranslation = translations.en || Object.values(translations)[0];
  if (!primaryTranslation?.name || typeof exercise.uuid !== "string") return null;

  const primaryMuscles = unique((exercise.muscles || []).map((muscle) =>
    plainText(muscle.name_en || muscle.name).toLowerCase()));
  const secondaryMuscles = unique((exercise.muscles_secondary || []).map((muscle) =>
    plainText(muscle.name_en || muscle.name).toLowerCase()));
  const equipmentList = unique((exercise.equipment || []).map((item) =>
    plainText(item.name).replace(/^none \(bodyweight exercise\)$/i, "body weight").toLowerCase()));
  const images = (exercise.images || []).map((image) => ({
    url: safeMediaUrl(image.image),
    thumbnail: safeMediaUrl(image.thumbnails?.medium || image.thumbnails?.small),
    isMain: image.is_main === true,
    style: image.style ? String(image.style) : null,
    aiGenerated: image.is_ai_generated === true,
  })).filter((image) => image.url);
  const videos = (exercise.videos || []).map((video) => ({
    url: safeMediaUrl(video.video),
    durationSeconds: Number.isFinite(Number(video.duration)) ? Number(video.duration) : null,
    width: Number.isFinite(Number(video.width)) ? Number(video.width) : null,
    height: Number.isFinite(Number(video.height)) ? Number(video.height) : null,
    codec: typeof video.codec === "string" ? video.codec : null,
    isMain: video.is_main === true,
    webPlayable: String(video.codec || "").toLowerCase() === "h264"
      && /\.mp4(?:$|\?)/i.test(String(video.video || "")),
  })).filter((video) => video.url);
  const aliases = unique(Object.values(translations).flatMap((translation) => translation.aliases));
  const category = plainText(exercise.category?.name || "other").toLowerCase();
  const license = {
    name: plainText(exercise.license?.short_name || exercise.license?.full_name || "wger exercise data"),
    url: safeExternalLink(exercise.license?.url),
    author: plainText(exercise.license_author || "wger contributors"),
  };

  return {
    id: `wger:${exercise.uuid}`,
    name: primaryTranslation.name,
    category,
    bodyPart: category,
    equipment: equipmentList[0] || "body weight",
    equipmentList,
    target: primaryMuscles[0] || category,
    muscleGroup: primaryMuscles[0] || category,
    primaryMuscles,
    secondaryMuscles,
    instructions: primaryTranslation.instructions,
    description: primaryTranslation.description,
    aliases,
    translations,
    image: images.find((image) => image.isMain)?.thumbnail || images[0]?.thumbnail || images[0]?.url || null,
    animationUrl: null,
    images,
    videos,
    attribution: `${license.name} • ${license.author}`,
    license,
    source: "wger",
    externalIds: { wgerId: exercise.id, wgerUuid: exercise.uuid },
    lastUpdated: exercise.last_update_global || exercise.last_update || null,
  };
}

function completeness(item) {
  const hasAnimation = Boolean(item.animationUrl);
  const hasVideo = item.videos?.some((video) => video.webPlayable) === true;
  const checks = [
    Boolean(item.name),
    Boolean(item.description),
    item.instructions?.length > 0,
    item.primaryMuscles?.length > 0,
    item.equipmentList?.length > 0,
    Boolean(item.image || item.images?.length),
    hasAnimation || hasVideo,
    Boolean(item.license?.name || item.attribution),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return {
    score,
    level: score >= 88 ? "complete" : score >= 63 ? "partial" : "basic",
    hasInstructions: checks[2],
    hasMuscleData: checks[3],
    hasEquipmentData: checks[4],
    hasImage: checks[5],
    hasVideo,
    hasAnimation,
  };
}

function mergeExercise(existing, wger) {
  const instructions = (wger.instructions?.join(" ").length || 0) >
      (existing.instructions?.join(" ").length || 0)
    ? wger.instructions
    : existing.instructions;
  const merged = {
    ...existing,
    name: repairMojibake(existing.name),
    instructions: instructions.map(repairMojibake),
    attribution: `${repairMojibake(existing.attribution)} • ${wger.attribution}`,
    description: wger.description || null,
    aliases: unique([...(existing.aliases || []), ...wger.aliases]),
    translations: wger.translations,
    equipmentList: unique([existing.equipment, ...wger.equipmentList]),
    primaryMuscles: unique([existing.target, existing.muscleGroup, ...wger.primaryMuscles]),
    secondaryMuscles: unique([...existing.secondaryMuscles, ...wger.secondaryMuscles]),
    images: wger.images,
    videos: wger.videos,
    license: wger.license,
    source: "merged",
    externalIds: wger.externalIds,
    lastUpdated: wger.lastUpdated,
  };
  return { ...merged, dataQuality: completeness(merged) };
}

const existingCatalog = JSON.parse(await readFile(INPUT_PATH, "utf8"));
const [languageRows, wgerRows] = await Promise.all([
  fetchAll("language/"),
  fetchAll("exerciseinfo/"),
]);
const languages = new Map(languageRows.map((language) => [language.id, language.short_name]));
const wgerCatalog = wgerRows.map((exercise) => normalizeWgerExercise(exercise, languages)).filter(Boolean);
const existingByName = new Map(existingCatalog.map((exercise, index) => [normalizedKey(exercise.name), index]));
const usedExisting = new Set();
const additions = [];

for (const wger of wgerCatalog) {
  const candidateNames = [wger.name, ...wger.aliases].map(normalizedKey).filter(Boolean);
  const matchIndex = candidateNames.map((name) => existingByName.get(name))
    .find((index) => index !== undefined && !usedExisting.has(index));
  if (matchIndex === undefined) {
    additions.push({ ...wger, dataQuality: completeness(wger) });
    continue;
  }
  usedExisting.add(matchIndex);
  existingCatalog[matchIndex] = mergeExercise(existingCatalog[matchIndex], wger);
}

const normalizedExisting = existingCatalog.map((exercise) => {
  if (exercise.dataQuality) return exercise;
  const normalized = {
    ...exercise,
    name: repairMojibake(exercise.name),
    attribution: repairMojibake(exercise.attribution),
    instructions: (exercise.instructions || []).map(repairMojibake),
    description: null,
    aliases: [],
    translations: {},
    equipmentList: [exercise.equipment].filter(Boolean),
    primaryMuscles: unique([exercise.target, exercise.muscleGroup]),
    images: [],
    videos: [],
    license: null,
    source: "legacy",
    externalIds: {},
    lastUpdated: null,
  };
  return { ...normalized, dataQuality: completeness(normalized) };
});
const catalog = [...normalizedExisting, ...additions.sort((a, b) => a.name.localeCompare(b.name))];

await writeFile(OUTPUT_PATH, JSON.stringify(catalog), "utf8");
await writeFile(SOURCE_PATH, JSON.stringify({
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  exerciseCount: catalog.length,
  legacyExerciseCount: existingCatalog.length,
  wgerExerciseCount: wgerCatalog.length,
  matchedWgerExercises: usedExisting.size,
  addedWgerExercises: additions.length,
  sources: [
    "https://github.com/hasaneyldrm/exercises-dataset",
    new URL("exerciseinfo/", API_ROOT).toString(),
  ],
  licenseNotice: "wger exercise content retains its per-entry Creative Commons attribution/share-alike license.",
}, null, 2), "utf8");

console.log(`Generated ${catalog.length} exercises (${usedExisting.size} enriched, ${additions.length} added from wger)`);
