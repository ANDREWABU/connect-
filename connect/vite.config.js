import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'strip-orphan-t',
      closeBundle() {
        const dir = 'dist/assets';
        try {
          const files = readdirSync(dir).filter(f => f.endsWith('.js') && !f.endsWith('.map'));
          for (const file of files) {
            const path = join(dir, file);
            let code = readFileSync(path, 'utf8');
            // unminified: standalone t; on its own line
            // minified: ...}t,(0,X.createRoot)... — strip the t,
            const fixed = code
              .replace(/\bt;\n/g, '')
              .replace(/([)}])t,(\(0,\w+\.createRoot\))/g, '$1$2');
            if (fixed !== code) {
              writeFileSync(path, fixed);
              console.log('[strip-orphan-t] Removed orphan t; from', file);
            }
          }
        } catch (e) {
          console.warn('[strip-orphan-t]', e.message);
        }
      }
    }
  ],
  server: {
    port: 3001,
    strictPort: true,
  },
});
