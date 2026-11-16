"use strict";

const VERSION = "mi-compra-web-v1";
const SHELL = `${VERSION}-shell`;
const OCR = `${VERSION}-ocr`;
const FILES = ["./", "./index.html", "./styles.css", "./overrides.css", "./parser.js", "./app.js", "./manifest.webmanifest", "./icon.svg"];
const REMOTE = {
  "/vendor/tesseract.min.js": "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  "/vendor/worker.min.js": "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
  "/vendor/tesseract-core.wasm.js": "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js",
  "/vendor/tesseract-core-simd.wasm.js": "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js",
  "/vendor/tesseract-core-lstm.wasm.js": "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js",
  "/vendor/tesseract-core-simd-lstm.wasm.js": "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
  "/vendor/tesseract-core.wasm": "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm",
  "/vendor/tesseract-core-simd.wasm": "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm",
  "/vendor/tesseract-core-lstm.wasm": "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm",
  "/vendor/tesseract-core-simd-lstm.wasm": "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm",
  "/lang/spa.traineddata.gz": "https://tessdata.projectnaptha.com/4.0.0/spa.traineddata.gz"
};

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("mi-compra-web-") && key !== SHELL && key !== OCR).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  const remotePath = Object.keys(REMOTE).find(path => url.pathname.endsWith(path));
  if (remotePath) {
    event.respondWith((async () => {
      const cache = await caches.open(OCR);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(REMOTE[remotePath], { mode: "cors" });
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    })().catch(() => new Response("OCR local todavía no descargado. Conectate una vez y volvé a intentar.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(SHELL).then(cache => cache.put(event.request, response.clone()));
    return response;
  })).catch(() => caches.match("./index.html")));
});
