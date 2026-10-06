import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Installed Node 22 supports synchronous hooks; the app's older @types/node
// declarations don't include them yet. Keep this test-only loader in JS.
export function resolveRelativeTs() {
  return registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      if (!path.extname(url.pathname) && existsSync(fileURLToPath(url) + '.ts')) {
        return next(url.href + '.ts', context);
      }
    }
    return next(specifier, context);
  } });
}
