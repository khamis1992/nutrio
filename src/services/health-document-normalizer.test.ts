import { describe, expect, it } from "vitest";

import { canonicalizeHealthMarkerName, detectUnit, normalizeHealthMarker } from "@/services/health-document-normalizer";

describe("health document normalizer", () => {
  it("canonicalizes common laboratory aliases", () => {
    expect(canonicalizeHealthMarkerName("HDL-C")).toBe("HDL");
    expect(canonicalizeHealthMarkerName("FBS")).toBe("Fasting Glucose");
  });

  it("converts glucose mmol/L to mg/dL", () => {
    expect(normalizeHealthMarker({ name: "Blood Glucose", value: "5.5", unit: "mmol/L" })).toMatchObject({
      canonicalName: "Glucose",
      value: 99.1,
      unit: "mg/dL",
    });
  });

  it("detects units from OCR source lines", () => {
    expect(detectUnit("Creatinine 88 µmol/L", "mg/dL")).toBe("µmol/L");
  });
});
