import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";

import type { BloodMarkerDefinition } from "@/lib/blood-markers";
import { detectUnit, normalizeHealthMarker } from "@/services/health-document-normalizer";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const FALLBACK_DEFINITIONS: BloodMarkerDefinition[] = [
  { id: "fallback-hemoglobin", marker_name: "Hemoglobin", marker_name_ar: null, unit: "g/dL", normal_min: 13.5, normal_max: 17.5, category: "blood", description: "Blood hemoglobin" },
  { id: "fallback-wbc", marker_name: "WBC", marker_name_ar: null, unit: "x10^9/L", normal_min: 4, normal_max: 11, category: "blood", description: "White blood cell count" },
  { id: "fallback-rbc", marker_name: "RBC", marker_name_ar: null, unit: "x10^12/L", normal_min: 4.5, normal_max: 5.9, category: "blood", description: "Red blood cell count" },
  { id: "fallback-hematocrit", marker_name: "Hematocrit", marker_name_ar: null, unit: "%", normal_min: 41, normal_max: 53, category: "blood", description: "Hematocrit" },
  { id: "fallback-platelets", marker_name: "Platelets", marker_name_ar: null, unit: "x10^9/L", normal_min: 150, normal_max: 450, category: "blood", description: "Platelet count" },
  { id: "fallback-glucose", marker_name: "Glucose", marker_name_ar: null, unit: "mg/dL", normal_min: 70, normal_max: 100, category: "metabolic", description: "Blood sugar level" },
  { id: "fallback-creatinine", marker_name: "Creatinine", marker_name_ar: null, unit: "mg/dL", normal_min: 0.7, normal_max: 1.3, category: "kidney", description: "Blood creatinine" },
  { id: "fallback-bun", marker_name: "BUN", marker_name_ar: null, unit: "mg/dL", normal_min: 7, normal_max: 20, category: "kidney", description: "Blood urea nitrogen" },
  { id: "fallback-alt", marker_name: "ALT", marker_name_ar: null, unit: "U/L", normal_min: 7, normal_max: 56, category: "liver", description: "Alanine aminotransferase" },
  { id: "fallback-ast", marker_name: "AST", marker_name_ar: null, unit: "U/L", normal_min: 10, normal_max: 40, category: "liver", description: "Aspartate aminotransferase" },
  { id: "fallback-alp", marker_name: "ALP", marker_name_ar: null, unit: "U/L", normal_min: 44, normal_max: 147, category: "liver", description: "Alkaline phosphatase" },
  { id: "fallback-bilirubin-total", marker_name: "Bilirubin Total", marker_name_ar: null, unit: "mg/dL", normal_min: 0.2, normal_max: 1.2, category: "liver", description: "Total bilirubin" },
  { id: "fallback-total-cholesterol", marker_name: "Total Cholesterol", marker_name_ar: null, unit: "mg/dL", normal_min: null, normal_max: 200, category: "lipid", description: "Total blood cholesterol" },
  { id: "fallback-hdl", marker_name: "HDL", marker_name_ar: null, unit: "mg/dL", normal_min: 40, normal_max: null, category: "lipid", description: "High-density lipoprotein cholesterol" },
  { id: "fallback-ldl", marker_name: "LDL", marker_name_ar: null, unit: "mg/dL", normal_min: null, normal_max: 100, category: "lipid", description: "Low-density lipoprotein cholesterol" },
  { id: "fallback-triglycerides", marker_name: "Triglycerides", marker_name_ar: null, unit: "mg/dL", normal_min: null, normal_max: 150, category: "lipid", description: "Blood triglycerides" },
];

export interface ExtractedBloodMarker {
  definition: BloodMarkerDefinition;
  value: string;
  confidence: "high" | "medium";
  sourceLine: string;
  normalizedValue: number;
  normalizedUnit: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").replace(/\uFF1A/g, ":").trim();
}

function markerKey(markerName: string) {
  return markerName.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function mergeDefinitions(definitions: BloodMarkerDefinition[]) {
  const merged = new Map<string, BloodMarkerDefinition>();

  for (const definition of FALLBACK_DEFINITIONS) {
    merged.set(markerKey(definition.marker_name), definition);
  }

  for (const definition of definitions) {
    merged.set(markerKey(definition.marker_name), definition);
  }

  return Array.from(merged.values());
}

function markerAliases(markerName: string) {
  const aliases: Record<string, string[]> = {
    Glucose: ["Blood Glucose", "Serum Glucose", "Glucose Fasting", "Glucose (Fasting)"],
    "Fasting Glucose": ["FBS", "Fasting Blood Sugar", "Fasting Blood Glucose", "Glucose (Fasting)", "Glucose Fasting"],
    HbA1c: ["A1C", "Hemoglobin A1c", "Glycated Hemoglobin"],
    "Total Cholesterol": ["Cholesterol Total", "Cholesterol"],
    Triglycerides: ["TG"],
    BUN: ["Urea", "Blood Urea Nitrogen"],
    Creatinine: ["Serum Creatinine"],
    "Vitamin D": ["25-OH Vitamin D", "25 Hydroxy Vitamin D", "Vit D"],
    "Vitamin B12": ["B12", "Cobalamin"],
    Hemoglobin: ["Hb"],
    Platelets: ["Platelet Count", "PLT"],
    Hematocrit: ["HCT"],
    "Bilirubin Total": ["Total Bilirubin"],
    HDL: ["HDL Cholesterol", "HDL-C"],
    LDL: ["LDL Cholesterol", "LDL-C"],
    WBC: ["White Blood Cells", "White Blood Cell Count"],
    RBC: ["Red Blood Cells", "Red Blood Cell Count"],
  };

  return [markerName, ...(aliases[markerName] ?? [])];
}

function extractValueFromLine(line: string, aliases: string[]) {
  for (const alias of aliases) {
    const escaped = escapeRegExp(alias);
    const pattern = new RegExp(
      `(?:^|\\b)${escaped}(?:\\b|\\s|:|-).*?(-?\\d+(?:[.,]\\d+)?)`,
      "i",
    );
    const match = line.match(pattern);
    if (match?.[1]) return match[1].replace(",", ".");
  }

  return null;
}

function extractMarkersFromLines(
  lines: string[],
  definitions: BloodMarkerDefinition[],
): ExtractedBloodMarker[] {
  const foundByMarkerName = new Map<string, ExtractedBloodMarker>();

  for (const definition of definitions) {
    const aliases = markerAliases(definition.marker_name);

    for (const line of lines) {
      const value = extractValueFromLine(line, aliases);
      if (!value) continue;

      const normalized = normalizeHealthMarker({
        name: definition.marker_name,
        value,
        unit: detectUnit(line, definition.unit),
        source: line,
      });
      foundByMarkerName.set(markerKey(definition.marker_name), {
        definition,
        value,
        confidence: line.toLowerCase().includes(definition.marker_name.toLowerCase()) ? "high" : "medium",
        sourceLine: line,
        normalizedValue: normalized.value,
        normalizedUnit: normalized.unit,
      });
      break;
    }
  }

  return Array.from(foundByMarkerName.values());
}

async function extractPdfText(file: File) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    const normalizedPageText = normalizeText(pageText);
    if (normalizedPageText) {
      lines.push(normalizedPageText);
    }

    lines.push(
      ...pageText
        .split(/\r?\n| {2,}/)
        .map(normalizeText)
        .filter(Boolean),
    );
  }

  return lines;
}

async function extractPdfOcrText(file: File) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const lines: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) continue;

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const result = await worker.recognize(canvas);
      lines.push(
        ...result.data.text
          .split(/\r?\n/)
          .map(normalizeText)
          .filter(Boolean),
      );
    }
  } finally {
    await worker.terminate();
  }

  return lines;
}

export async function extractBloodMarkersFromPdf(
  file: File,
  definitions: BloodMarkerDefinition[],
): Promise<ExtractedBloodMarker[]> {
  const extractionDefinitions = mergeDefinitions(definitions);
  const textLines = await extractPdfText(file);
  const textMatches = extractMarkersFromLines(textLines, extractionDefinitions);

  if (textMatches.length >= 3) {
    return textMatches;
  }

  const ocrLines = await extractPdfOcrText(file);
  return extractMarkersFromLines([...textLines, ...ocrLines], extractionDefinitions);
}
