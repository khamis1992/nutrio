// Schema changes must be made through versioned migrations. This legacy entry
// point now performs a read-only schema check instead of mutating production.
await import("./check-tables.mjs");
