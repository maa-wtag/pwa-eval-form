// /// <reference lib="WebWorker" />
// import { clientsClaim } from "workbox-core";
// import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
// import { registerRoute, Route } from "workbox-routing";
// import { NetworkFirst, CacheFirst, NetworkOnly } from "workbox-strategies";
// import { BackgroundSyncPlugin, Queue } from "workbox-background-sync";

// /* @vite-ignore */
// const WORKBOX_DEBUG =
//   (typeof import.meta !== "undefined" &&
//     (import.meta as any).env?.WORKBOX_DEBUG === "true") ||
//   (self as any).__WORKBOX_DEBUG__ === "true";

// if (WORKBOX_DEBUG) {
//   // eslint-disable-next-line no-console
//   console.log("[SW] Workbox debug enabled");
// }

// // --- Sentry in Service Worker (adds) ---
// /* @vite-ignore */
// const SENTRY_DSN =
//   (typeof import.meta !== "undefined" &&
//     (import.meta as any).env?.VITE_SENTRY_DSN) ||
//   (self as any).__SENTRY_DSN__ ||
//   "";
// /* @vite-ignore */
// const SENTRY_RELEASE =
//   (typeof import.meta !== "undefined" &&
//     (import.meta as any).env?.SENTRY_RELEASE) ||
//   (self as any).__SENTRY_RELEASE__ ||
//   "";

// async function initSentry() {
//   if (!SENTRY_DSN) return;
//   try {
//     // dynamic import is friendlier for SW bundling
//     const Sentry = await import(/* @vite-ignore */ "@sentry/browser");
//     Sentry.init({
//       dsn: SENTRY_DSN,
//       release: SENTRY_RELEASE || undefined,
//       environment: (self as any).registration?.scope?.includes("localhost")
//         ? "development"
//         : "production",
//       // SW-safe options
//       autoSessionTracking: false,
//       integrations: (integrations) =>
//         integrations.filter((i: any) => i.name !== "TryCatch"), // TryCatch can be noisy in SW
//     });

//     self.addEventListener("error", (e) => {
//       Sentry.captureException(
//         e.error || e.message || new Error("SW error event")
//       );
//     });
//     self.addEventListener("unhandledrejection", (e: any) => {
//       Sentry.captureException(e.reason || new Error("SW unhandledrejection"));
//     });
//     (self as any).__sentry = Sentry; // expose for later use
//   } catch (_) {
//     // no-op if sentry isn't available
//   }
// }
// initSentry();

// // self.__WB_MANIFEST is injected by VitePWA injectManifest
// declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] };

// clientsClaim();
// self.skipWaiting();

// // App shell & assets
// precacheAndRoute(self.__WB_MANIFEST);
// cleanupOutdatedCaches();

// // Broadcast helper
// const bc = new BroadcastChannel("sync-updates");
// function post(payload: any) {
//   bc.postMessage({ type: "SYNC_STATUS", payload });
// }

// // ---- Auth token retrieval (indexedDB) ----
// async function getToken(): Promise<string | null> {
//   // read from idb-keyval store used in app (default db/store names)
//   const dbReq = indexedDB.open("keyval-store", 1);
//   const token = await new Promise<string | null>((resolve) => {
//     dbReq.onsuccess = () => {
//       const db = dbReq.result;
//       const tx = db.transaction("keyval", "readonly");
//       const store = tx.objectStore("keyval");
//       const g = store.get("auth_token_v1");
//       g.onsuccess = () => resolve(g.result ?? null);
//       g.onerror = () => resolve(null);
//     };
//     dbReq.onupgradeneeded = () => resolve(null);
//     dbReq.onerror = () => resolve(null);
//   });
//   return token;
// }

// // ---- Background Sync Queue with custom behavior ----
// const queue = new Queue("api-queue", {
//   maxRetentionTime: 24 * 60, // minutes
//   onSync: async ({ queue }) => {
//     post({ syncing: true });
//     let replayed = 0;
//     let failedPermanently = 0;
//     let entry;
//     while ((entry = await queue.shiftRequest())) {
//       try {
//         // Inject freshest token before replay
//         const token = (await getToken()) ?? "";
//         const req = new Request(entry.request, {
//           headers: new Headers({
//             ...Object.fromEntries(entry.request.headers.entries()),
//             authorization: `Bearer ${token}`,
//           }),
//         });
//         const res = await fetch(req.clone());
//         if (!res.ok) {
//           // Treat 4xx/5xx as re-queue-able unless 422/400 (bad forever)
//           if ([400, 422].includes(res.status)) {
//             failedPermanently++;
//             try {
//               (self as any).__sentry?.captureMessage(
//                 `Permanent failure (${res.status}) during replay`,
//                 {
//                   level: "warning",
//                 }
//               );
//             } catch (_) {}
//             continue;
//           }
//           throw new Error("still failing");
//         }
//         replayed++;
//       } catch (err) {
//         try {
//           (self as any).__sentry?.captureException(err);
//         } catch (_) {}
//         await queue.unshiftRequest(entry);
//         break; // stop now; will retry later
//       }
//       post({
//         queueLength: (await queue.getAll()).length,
//         replayed,
//         failedPermanently,
//       });
//     }
//     post({ syncing: false });
//   },
// });

// // Helper plugin: consider any non-2xx/3xx as failure → push to queue
// const httpErrorToQueuePlugin = {
//   fetchDidSucceed: async ({ response }: any) => {
//     if (!response || response.status >= 400) {
//       throw new Error("HTTP " + (response?.status ?? "?")); // triggers queue
//     }
//     return response;
//   },
// };

// // Inject latest token at fetch time for queued & live requests
// const addTokenPlugin = {
//   requestWillFetch: async ({ request }: any) => {
//     const token = (await getToken()) ?? "";
//     const headers = new Headers(request.headers);
//     headers.set("authorization", `Bearer ${token}`);
//     return new Request(request, { headers });
//   },
// };

// // Route 1: GraphQL (POST) — use NetworkOnly + BackgroundSync
// registerRoute(
//   ({ url, request }) =>
//     url.pathname === "/graphql" && request.method === "POST",
//   new NetworkOnly({
//     plugins: [
//       addTokenPlugin,
//       new BackgroundSyncPlugin("api-queue", { maxRetentionTime: 24 * 60 }),
//       httpErrorToQueuePlugin,
//     ],
//   }),
//   "POST"
// );

// // Route 2: All write operations (/httpbin/* POST, and any /api/* writes if you add later)
// registerRoute(
//   ({ url, request }) =>
//     (url.pathname.startsWith("/httpbin/") ||
//       url.pathname.startsWith("/api/")) &&
//     ["POST", "PUT", "PATCH", "DELETE"].includes(request.method),
//   new NetworkOnly({
//     plugins: [
//       addTokenPlugin,
//       new BackgroundSyncPlugin("api-queue", { maxRetentionTime: 24 * 60 }),
//       httpErrorToQueuePlugin,
//     ],
//   })
// );

// // Route 3: GETs to GraphQL or API — cache-first (so form loads offline after 1st fetch)
// registerRoute(
//   ({ url, request }) =>
//     (url.pathname === "/graphql" && request.method === "GET") ||
//     (url.pathname.startsWith("/api/") && request.method === "GET"),
//   new NetworkFirst({ cacheName: "api-get" })
// );

// // Static resources (images, fonts)
// registerRoute(
//   ({ request }) => request.destination === "image",
//   new CacheFirst({ cacheName: "imgs" })
// );

// // src/sw.ts (already in your project)
// registerRoute(
//   ({ url, request }) =>
//     url.pathname === "/graphql" && request.method === "POST",
//   new NetworkOnly({
//     plugins: [
//       addTokenPlugin,
//       new BackgroundSyncPlugin("api-queue", { maxRetentionTime: 24 * 60 }),
//       httpErrorToQueuePlugin, // throws on 4xx/5xx so the BGS plugin enqueues
//     ],
//   }),
//   "POST"
// );

// registerRoute(
//   ({ url, request }) =>
//     (url.pathname.startsWith("/httpbin/") ||
//       url.pathname.startsWith("/api/")) &&
//     ["POST", "PUT", "PATCH", "DELETE"].includes(request.method),
//   new NetworkOnly({
//     plugins: [
//       addTokenPlugin,
//       new BackgroundSyncPlugin("api-queue", { maxRetentionTime: 24 * 60 }),
//       httpErrorToQueuePlugin,
//     ],
//   })
// );

// // Keep UI informed about queue size (initial + on push)
// (async () => {
//   const all = await (queue as any).getAll?.();
//   post({
//     queueLength: all?.length ?? 0,
//     syncing: false,
//     replayed: 0,
//     failedPermanently: 0,
//   });
// })();

// // Monkey-patch Queue.pushRequest to emit size (works with workbox queue internals)
// const _push = (queue as any).pushRequest.bind(queue as any);
// (queue as any).pushRequest = async (entry: any) => {
//   const r = await _push(entry);
//   const all = await (queue as any).getAll?.();
//   post({ queueLength: all?.length ?? 0 });
//   return r;
// };

// // Update flow: notify client there’s a new SW
// self.addEventListener("message", (event) => {
//   if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
// });

// /// <reference lib="webworker" />
// /* eslint-disable no-restricted-globals */

// // Let TS know we’re in a SW
// declare const self: ServiceWorkerGlobalScope;

// // --- Workbox imports (vite-plugin-pwa bundles these for injectManifest) ---
// import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
// import { registerRoute } from "workbox-routing";
// import { NetworkOnly } from "workbox-strategies";
// import { BackgroundSyncPlugin } from "workbox-background-sync";
// import { clientsClaim } from "workbox-core";

// // --- Precache build assets (injected by workbox) ---
// cleanupOutdatedCaches();
// precacheAndRoute(self.__WB_MANIFEST || []);

// // --- Update flow: wait for client command so the app can show a toast ---
// self.addEventListener("message", (event: any) => {
//   if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
// });
// clientsClaim();

// // --- Background Sync queue (DB appears after the first enqueue) ---
// const apiQueue = new BackgroundSyncPlugin("api-queue", {
//   maxRetentionTime: 24 * 60, // minutes
//   // (Optional) custom onSync if you want progress events
//   // onSync: async ({ queue }) => {
//   //   await queue.replayRequests();
//   // },
// });

// // Treat HTTP 4xx/5xx as failures so the BackgroundSyncPlugin enqueues them
// const httpErrorToQueuePlugin = {
//   async fetchDidSucceed({ response }: { response: Response }) {
//     if (!response || response.status >= 400) {
//       // Throw so Workbox strategy routes this to handlerDidError → enqueue
//       throw new Error(`HTTP ${response?.status}`);
//     }
//     return response;
//   },
// };

// // (Optional) If you broadcast auth tokens from the app, attach them on replay
// let bearer = "";
// const authChannel = new BroadcastChannel("auth-updates");
// authChannel.onmessage = (evt) => {
//   if (evt?.data?.type === "AUTH_TOKEN") bearer = evt.data.token || "";
// };
// const addTokenPlugin = {
//   async requestWillFetch({ request }: { request: Request }) {
//     if (!bearer) return request;
//     const headers = new Headers(request.headers);
//     headers.set("authorization", `Bearer ${bearer}`);
//     return new Request(request, { headers });
//   },
// };

// // --- Routes that should be “fire & forget” and retried later ---

// // GraphQL mutations (POST) — match /graphql or /graphql?foobar
// registerRoute(
//   ({ url, request }) =>
//     url.pathname.startsWith("/graphql") && request.method === "POST",
//   new NetworkOnly({
//     plugins: [addTokenPlugin, apiQueue, httpErrorToQueuePlugin],
//   }),
//   "POST"
// );

// // HTTPBin / other REST-y writes
// registerRoute(
//   ({ url, request }) =>
//     (url.pathname.startsWith("/httpbin/") ||
//       url.pathname.startsWith("/api/")) &&
//     ["POST", "PUT", "PATCH", "DELETE"].includes(request.method),
//   new NetworkOnly({
//     plugins: [addTokenPlugin, apiQueue, httpErrorToQueuePlugin],
//   })
// );

// // You can add more write routes here if needed

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { clientsClaim } from "workbox-core";

// ---- Precache build assets (injected) ----
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);
self.addEventListener("message", (evt: any) => {
  if (evt?.data?.type === "SKIP_WAITING") self.skipWaiting();
});
clientsClaim();

// ---- Debug helpers ----
const log = (...a: any[]) => console.log("[SW]", ...a);

// One queue for all write calls
const apiQueue = new BackgroundSyncPlugin("api-queue", {
  maxRetentionTime: 24 * 60, // minutes
});

// Match POST /graphql
registerRoute(
  ({ url, request }) => {
    const ok = url.pathname.startsWith("/graphql") && request.method === "POST";
    if (ok)
      log("route:/graphql matched", { method: request.method, href: url.href });
    return ok;
  },
  new NetworkOnly({ plugins: [apiQueue] }),
  "POST"
);

// Match POST/PUT/PATCH/DELETE /httpbin/*
registerRoute(({ url, request }) => {
  const ok =
    url.pathname.startsWith("/httpbin/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (ok)
    log("route:/httpbin matched", { method: request.method, href: url.href });
  return ok;
}, new NetworkOnly({ plugins: [apiQueue] }));

// Optional: see when sync happens
self.addEventListener("sync", (e: any) => log("sync event", e?.tag));
