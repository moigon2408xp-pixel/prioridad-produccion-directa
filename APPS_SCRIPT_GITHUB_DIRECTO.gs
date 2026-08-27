/**
 * PUENTE DIRECTO PARA GITHUB PAGES
 *
 * Pega este bloque al final del Código.gs ORIGINAL y vuelve a publicar como
 * Aplicación web. Si dejaste bloques anteriores, elimina sus funciones doGet
 * y doPost para que solo exista una versión de cada una.
 *
 * La aplicación publicada en GitHub Pages usa JSONP porque Apps Script no
 * permite configurar libremente cabeceras CORS para una web estática externa.
 * El código de equipo no es una clave criptográfica: compártelo únicamente con
 * las personas que trabajarán con la cola.
 */
const GITHUB_PWA = { TEAM_CODE: 'GITHUB_PWA_TEAM_CODE' };

function configurarPwaGitHub() {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  PropertiesService.getScriptProperties().setProperty(GITHUB_PWA.TEAM_CODE, code);
  SpreadsheetApp.getUi().alert('Código del equipo', 'Comparte este código solo con el equipo de producción:\n\n' + code, SpreadsheetApp.getUi().ButtonSet.OK);
}

function doGet(e) {
  try {
    const payload = JSON.parse(decodeURIComponent((e && e.parameter && e.parameter.payload) || '{}'));
    const result = pwaGitHubDispatch_(payload);
    return pwaGitHubJsonp_(result, e && e.parameter && e.parameter.callback);
  } catch (error) {
    return pwaGitHubJsonp_({ ok: false, error: String(error && error.message ? error.message : error) }, e && e.parameter && e.parameter.callback);
  }
}

function pwaGitHubDispatch_(payload) {
  const code = PropertiesService.getScriptProperties().getProperty(GITHUB_PWA.TEAM_CODE);
  if (!code || String(payload.pin || '') !== code) return { ok: false, error: 'Código de equipo no válido.' };
  switch (payload.action) {
    case 'pwa_catalogs': return { ok: true, catalogs: obtenerCatalogos() };
    case 'pwa_list_orders': return { ok: true, orders: pwaGitHubOrders_() };
    case 'pwa_create_order': return { ok: true, result: registrarPedido(payload.form || {}) };
    case 'pwa_update_order': return { ok: true, result: pwaGitHubUpdate_(payload.id, payload.changes || {}) };
    default: return { ok: false, error: 'Acción no admitida.' };
  }
}

function pwaGitHubOrders_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CFG.PEDIDOS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 20).getValues().filter(row => row[0]).map(row => ({
    id: String(row[0]), cliente: String(row[2] || ''), tipo: String(row[3] || ''), descripcion: String(row[4] || ''), cantidad: Number(row[5] || 1), entrega: pwaGitHubDate_(row[6], row[7]), tiempoMinutos: Math.round((Number(row[8]) || 0) * 60), responsable: String(row[9] || ''), estado: String(row[10] || 'Pendiente'), urgente: String(row[11] || 'No'), diseno: String(row[12] || 'Sí'), material: String(row[13] || 'Sí'), notas: String(row[14] || ''), prioridad: String(row[15] || ''), horas: Number(row[16] || 0), score: Number(row[17] || -999), rank: Number(row[18] || 0)
  }));
}

function pwaGitHubUpdate_(id, changes) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CFG.PEDIDOS);
  if (!sheet) throw new Error('No existe la hoja Pedidos.');
  const last = sheet.getLastRow();
  const ids = sheet.getRange(2, CFG.COL.ID, Math.max(1, last - 1), 1).getDisplayValues().flat();
  const position = ids.findIndex(value => String(value).trim() === String(id).trim());
  if (position < 0) throw new Error('No se encontró el pedido.');
  const row = position + 2;
  const columns = { responsable: CFG.COL.RESP, estado: CFG.COL.ESTADO, diseno: CFG.COL.DISENO, material: CFG.COL.MATERIAL, notas: CFG.COL.NOTAS };
  Object.keys(columns).forEach(key => { if (Object.prototype.hasOwnProperty.call(changes, key)) sheet.getRange(row, columns[key], 1, 1).setValue(String(changes[key] || '')); });
  actualizarSistema();
  return { id: String(id), row: row };
}

function pwaGitHubDate_(dateValue, timeValue) {
  if (!(dateValue instanceof Date)) return null;
  const date = new Date(dateValue.getTime());
  if (timeValue instanceof Date) date.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
  else if (typeof timeValue === 'number') date.setTime(date.getTime() + Math.round(timeValue * 86400000));
  return date.toISOString();
}

function pwaGitHubJsonp_(payload, callback) {
  const valid = /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(String(callback || ''));
  const output = valid ? String(callback) + '(' + JSON.stringify(payload) + ');' : JSON.stringify(payload);
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
