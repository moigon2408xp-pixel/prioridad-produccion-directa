const CACHE = "prioridad-produccion-perfiles-v10";
const ASSETS = ["./","./index.html","./styles.css","./app-registrar-fix.js","./config.js?v=10","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
try {
  importScripts("./firebase-config.js");
  const config = self.PRIORIDAD_FIREBASE_CONFIG || {};
  if (config.apiKey && config.projectId) {
    importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js", "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");
    firebase.initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, messagingSenderId: config.messagingSenderId, appId: config.appId });
    firebase.messaging().onBackgroundMessage((payload) => {
      const notice = payload.notification || {};
      self.registration.showNotification(notice.title || "Prioridad Producción", { body: notice.body || "Hay una actualización de producción.", icon: "./icons/icon-192.png", data: payload.data || {} });
    });
  }
} catch (error) { /* Firebase es opcional hasta que se complete la configuración. */ }
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("prioridad-produccion-perfiles-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const path = new URL(event.request.url).pathname;
  if (path.includes("/api/") || path.endsWith("firebase-config.js")) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); cache.put(event.request, copy); return response; }))));
});
