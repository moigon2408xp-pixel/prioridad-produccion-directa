const FIREBASE_VERSION = "11.0.2";

export async function activatePushNotifications(onToken, onForegroundMessage) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Este navegador no permite avisos instalables.");
  const config = globalThis.PRIORIDAD_FIREBASE_CONFIG || {};
  if (!config.apiKey || !config.projectId || !config.vapidKey) throw new Error("Faltan los datos de Firebase. Sigue la guía de notificaciones antes de activar los avisos.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Los avisos no fueron autorizados en este dispositivo.");
  const [{ initializeApp }, { getMessaging, getToken, onMessage }] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging.js`),
  ]);
  const app = initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, messagingSenderId: config.messagingSenderId, appId: config.appId });
  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("No se pudo registrar el dispositivo para avisos.");
  onMessage(messaging, (payload) => onForegroundMessage(payload));
  await onToken(token);
  return token;
}
