import { describe, expect, it } from "vitest";

import { buildCsv, escapeCsvCell } from "@/lib/csv";

describe("CSV export hardening", () => {
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK(\"x\")"])(
    "neutralizes spreadsheet formula input %s",
    (value) => {
      expect(escapeCsvCell(value)).toContain("'");
    },
  );

  it("quotes commas, quotes, and line breaks", () => {
    expect(buildCsv([["a,b", 'say "hi"', "one\ntwo"]])).toBe(
      '\uFEFF"a,b","say ""hi""","one\ntwo"',
    );
  });
});
