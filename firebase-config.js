/**
 * CONFIGURACIÓN Y SERVICIO DE NOTIFICACIONES FIREBASE PUSH
 * Creaciones JJ - Ochoa & Risquez
 */
window.initFirebaseNotifications = async function () {
  if (!("Notification" in window)) {
    console.log("Este dispositivo o navegador no soporta notificaciones.");
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Permiso de notificaciones concedido.");
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(function(reg) {
          console.log('Service Worker de notificaciones registrado:', reg);
        }).catch(function(err) {
          console.warn('Error registrando Service Worker:', err);
        });
      }
      return true;
    } else {
      console.log("Permiso de notificaciones denegado.");
      return false;
    }
  } catch (err) {
    console.error("Error solicitando permisos de notificación:", err);
    return false;
  }
};
