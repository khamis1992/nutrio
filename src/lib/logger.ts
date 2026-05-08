// Lightweight logger.
//
// In dev: routes to console with [scope] prefix.
// In prod: log/debug/info are stripped at build time (vite.config terser pure_funcs).
//          warn/error are preserved so Sentry can capture them as breadcrumbs.
//
// Prefer this over raw console for new code. Existing console.* calls are also
// safe — they're handled by the same build-time stripping. Sentry browser SDK
// auto-instruments console for breadcrumbs.

const isDev = import.meta.env.DEV;

type LogFn = (...args: unknown[]) => void;

interface Logger {
  debug: LogFn;
  info: LogFn;
  log: LogFn;
  warn: LogFn;
  error: LogFn;
}

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    debug: (...args) => isDev && console.debug(prefix, ...args),
    info:  (...args) => isDev && console.info(prefix, ...args),
    log:   (...args) => isDev && console.log(prefix, ...args),
    warn:  (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

export const logger = createLogger("app");
