import process from "node:process";
import path from "path";
import replace from "@rollup/plugin-replace";
import react from "@vitejs/plugin-react";
import { defineConfig, transformWithEsbuild } from "vite";
import svgr from "vite-plugin-svgr";
import vitetsConfigPaths from "vite-tsconfig-paths";
import browserslistToEsbuild from "browserslist-to-esbuild";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { SENTRY_ORG, SENTRY_PROJECT } from "./src/util/constants/sentry.ts";

const { DEV_PUBLIC_ORIGIN } = process.env; // e.g. 'https://onsite-dev.garaio-rem.net:65535'

const pwaOptions: any = {
  // (kept your commented reference block intact)
  mode: "development",
  base: "/",
  includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],
  manifest: {
    name: "OnSite",
    short_name: "OnSite",
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone",
    orientation: "portrait",
    includeAssets: ["favicon.ico", "apple-touch-icon.png", "assets/*"],
    icons: [
      {
        src: "pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "favicons/android-chrome-36x36.png",
        sizes: "36x36",
        type: "image/png",
      },
      {
        src: "favicons/android-chrome-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "favicons/android-chrome-72x72.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: "favicons/android-chrome-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "favicons/android-chrome-144x144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: "favicons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "favicons/android-chrome-256x256.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "favicons/android-chrome-384x384.png",
        sizes: "384x384",
        type: "image/png",
      },
      {
        src: "favicons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/pwa-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
  devOptions: {
    enabled: process.env.SW_DEV === "true", // (kept your flag)
    type: "module",
    navigateFallback: "index.html",
  },
};

const replaceOptions: Record<string, string> = {
  __DATE__: new Date().toISOString(),
  __SENTRY_DSN__: JSON.stringify(process.env.VITE_SENTRY_DSN || ""),
  __SENTRY_RELEASE__: JSON.stringify(process.env.SENTRY_RELEASE || ""),
  __WORKBOX_DEBUG__: JSON.stringify(process.env.WORKBOX_DEBUG === "true"),
  preventAssignment: true,
};
const claims = process.env.CLAIMS === "true";
const reload = process.env.RELOAD_SW === "true";
const selfDestroying = process.env.SW_DESTROY === "true";

/**
 * 🔧 IMPORTANT (added):
 * If SW=true we use injectManifest with our custom Workbox SW file at src/sw.ts.
 * This enables workbox-background-sync queue logic in your app.
 */
if (process.env.SW === "true") {
  pwaOptions.srcDir = "src"; // ✅ added
  pwaOptions.filename = "sw.ts"; // ✅ added: our SW source file
  pwaOptions.strategies = "injectManifest"; // (you already hinted this – now active)
  pwaOptions.registerType = claims ? "autoUpdate" : "prompt"; // ✅ added: show update prompt when not in claims mode
  pwaOptions.manifest.name = "PWA Inject Manifest";
  pwaOptions.manifest.short_name = "PWA Inject";
  pwaOptions.injectManifest = {
    // keep your previous flags, add safe defaults
    minify: false,
    enableWorkboxModulesLogs: true,
    globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,webmanifest}"], // ✅ added (so images & webmanifest precache)
  };
}

if (claims) pwaOptions.registerType = "autoUpdate";

if (reload) {
  // @ts-expect-error just ignore
  replaceOptions.__RELOAD_SW__ = "true";
}

if (selfDestroying) pwaOptions.selfDestroying = selfDestroying;

export default defineConfig({
  // base: process.env.BASE_URL || 'https://github.com/',
  // base: "/",
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      {
        find: "modules",
        replacement: path.resolve(__dirname, "src/app/modules"),
      },
      {
        find: "features",
        replacement: path.resolve(__dirname, "src/app/features"),
      },
      { find: "routes", replacement: path.resolve(__dirname, "src/routes") },
      { find: "app", replacement: path.resolve(__dirname, "src/app") },
      { find: "util", replacement: path.resolve(__dirname, "src/util") },
      { find: "layout", replacement: path.resolve(__dirname, "src/layout") },
      {
        find: "components",
        replacement: path.resolve(__dirname, "src/components"),
      },
    ],
  },
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
  server: {
    headers: { "Document-Policy": "js-profiling" },
    port: 3000,
    host: true,
    https: false,
    origin: DEV_PUBLIC_ORIGIN || undefined,
    hmr: DEV_PUBLIC_ORIGIN
      ? {
          protocol: DEV_PUBLIC_ORIGIN.startsWith("https") ? "wss" : "ws",
          host: new URL(DEV_PUBLIC_ORIGIN).hostname,
          port: Number(
            new URL(DEV_PUBLIC_ORIGIN).port ||
              (DEV_PUBLIC_ORIGIN.startsWith("https") ? 443 : 80)
          ),
        }
      : undefined,
    open: true,
    allowedHosts: [
      "localhost",
      "host.docker.internal",
      "onsite-dev.garaio-rem.net",
      "onsite-dev.garaio-rem.net:65535",
    ],

    /**
     * ✅ ADDED: local API proxies used by the app
     * - /httpbin/* → http://localhost:8081
     * - /graphql   → http://localhost:4000
     * This avoids CORS and lets the SW intercept same-origin calls.
     */
    proxy: {
      "/httpbin": {
        target: "http://localhost:8081",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/httpbin/, ""),
      },
      "/graphql": { target: "http://localhost:4000", changeOrigin: true },
    },
  },

  preview: {
    port: 4173,
    strictPort: false,
    proxy: {
      "/httpbin": {
        target: "http://localhost:8081",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/httpbin/, ""),
      },
      "/graphql": { target: "http://localhost:4000", changeOrigin: true },
    },
  },

  build: {
    // outDir: "build",
    target: browserslistToEsbuild([">0.2%", "not dead", "not op_mini all"]),
    sourcemap: process.env.SOURCE_MAP === "true",
  },
  plugins: [
    react(),
    svgr({ svgrOptions: { icon: true }, include: ["src/**/*.svg"] }),
    vitetsConfigPaths(),

    /**
     * VitePWA stays here, now configured to use injectManifest when SW=true.
     * No removals — only additions in pwaOptions above.
     */
    VitePWA(pwaOptions),

    replace(replaceOptions),

    {
      name: "treat-js-files-as-jsx",
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) return null;
        return transformWithEsbuild(code, id, {
          loader: "jsx",
          jsx: "automatic",
        });
      },
    },

    // Sentry plugin untouched
    sentryVitePlugin({
      include: ".",
      ignore: ["node_modules", "vite.config.js"],
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: ["./build/assets/**", "./build/sw*.js.map"], // <— added SW map
      },
      release: process.env.SENTRY_RELEASE,
      uploadUnchangedSourcemaps: true,
      rewrite: true,
      cleanArtifacts: true,
      reactComponentAnnotation: { enabled: true },
    }),
  ],
  define: {
    global: "globalThis",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "src/setupTests.js",
    fakeTimers: { enableGlobally: true },
    reporters: ["default", ["junit", { outputFile: "report/junit.xml" }]],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
  },
  // esbuild: {
  //   loader: "jsx",
  //   include: [
  //     "src/**/*.jsx",
  //     "src/**/*.js",
  //     "node_modules/**/*.jsx",
  //     "node_modules/**/*.js",
  //   ],
  // },
});
