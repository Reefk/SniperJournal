import { fileURLToPath } from 'node:url';

// Tailwind, then the fallbacks that keep the app readable in older Android
// WebViews (scripts/postcss-old-webview.mjs). Turbopack resolves plugin names
// from its own folder, so the local plugin is given by its full path.
const oldWebview = fileURLToPath(new URL('./scripts/postcss-old-webview.mjs', import.meta.url));

const config = { plugins: { '@tailwindcss/postcss': {}, [oldWebview]: {} } };
export default config;
