/**
 * PRIORIDAD PRODUCCIÓN · PERFILES PERSONALES
 *
 * Pega este bloque al final del Código.gs original.
 * Si instalaste el bloque PWA anterior, elimina solo su función doGet().
 * Debe existir una única función doGet() en todo el proyecto.
 */

const PP_PERFILES = {
  HOJA_USUARIOS: 'Usuarios',
  HOJA_AUDITORIA: 'HistorialApp',
  PREFIJO_SESION: 'PP_SESSION_',
  DURACION_SESION_MS: 1000 * 60 * 60 * 24 * 30
};

function configurarPerfilesProduccion() {
  const ss = SpreadsheetApp.getActive();
  let hoja = ss.getSheetByName(PP_PERFILES.HOJA_USUARIOS);
  if (!hoja) {
    hoja = ss.insertSheet(PP_PERFILES.HOJA_USUARIOS);
    hoja.getRange(1, 1, 1, 5).setValues([['Nombre', 'Perfil', 'PIN (hash)', 'Activo', 'Creado']]);
    hoja.setFrozenRows(1);
    hoja.hideSheet();
  }
  if (hoja.getLastRow() < 2) {
    const pinManager = String(Math.floor(100000 + Math.random() * 900000));
    hoja.appendRow(['Manager', 'manager', ppHash_(pinManager), 'Sí', new Date()]);
    ppAuditar_('CONFIGURACION', 'Se creó el perfil inicial de manager.');
    SpreadsheetApp.getUi().alert('Perfil inicial creado', 'Usuario: Manager\nPIN: ' + pinManager + '\n\nGuarda este PIN. Entra con él y crea tus perfiles personales desde Ajustes.', SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert('Perfiles listos', 'La hoja privada Usuarios ya existe. Inicia sesión con el perfil manager para administrar el equipo.', SpreadsheetApp.getUi().ButtonSet.OK);
  }
  ppCrearAuditoria_();
}

function doGet(e) {
  const callback = String(e && e.parameter && e.parameter.callback || '');
  try {
    const payload = JSON.parse(decodeURIComponent(String(e && e.parameter && e.parameter.payload || '{}')));
    return ppJsonp_(ppDespachar_(payload), callback);
  } catch (error) {
    return ppJsonp_({ ok: false, error: String(error && error.message ? error.message : error) }, callback);
  }
}

function ppDespachar_(payload) {
  switch (payload.action) {
    case 'profile_login': return ppIniciarSesion_(payload.name, payload.pin);
    case 'profile_dashboard': return ppDashboard_(ppSesion_(payload.token));
    case 'profile_create_order': return ppCrearPedido_(ppSesion_(payload.token), payload.form || {});
    case 'profile_update_order': return ppActualizarPedido_(ppSesion_(payload.token), payload.id, payload.changes || {});
    case 'profile_create_user': return ppCrearUsuario_(ppSesion_(payload.token), payload.user || {});
    case 'profile_update_user': return ppActualizarUsuario_(ppSesion_(payload.token), payload);
    default: return { ok: false, error: 'Acción no admitida.' };
  }
}

function ppIniciarSesion_(name, pin) {
  const usuario = ppUsuarioPorNombre_(name);
  if (!usuario || String(usuario.activo).toLowerCase() !== 'sí') return { ok: false, error: 'No existe un perfil activo con ese nombre.' };
  if (ppHash_(String(pin || '')) !== usuario.pinHash) return { ok: false, error: 'El PIN no es correcto.' };
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const sesion = { name: usuario.nombre, role: usuario.perfil, expiresAt: Date.now() + PP_PERFILES.DURACION_SESION_MS };
  PropertiesService.getScriptProperties().setProperty(PP_PERFILES.PREFIJO_SESION + token, JSON.stringify(sesion));
  ppAuditar_('INICIO_SESION', usuario.nombre + ' inició sesión como ' + usuario.perfil + '.');
  return { ok: true, session: { name: sesion.name, role: sesion.role, token: token } };
}

function ppSesion_(token) {
  if (!token) throw new Error('Tu sesión terminó. Inicia sesión de nuevo.');
  const key = PP_PERFILES.PREFIJO_SESION + String(token);
  const raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) throw new Error('Tu sesión terminó. Inicia sesión de nuevo.');
  const session = JSON.parse(raw);
  if (!session.expiresAt || Date.now() > Number(session.expiresAt)) {
    PropertiesService.getScriptProperties().deleteProperty(key);
    throw new Error('Tu sesión terminó. Inicia sesión de nuevo.');
  }
  return session;
}

function ppDashboard_(session) {
  const pedidos = ppPedidos_();
  const criticos = pedidos.filter(p => ppEsCritico_(p));
  const lider = ppEsLider_(session);
  return {
    ok: true,
    data: {
      myOrders: pedidos.filter(p => p.responsable === session.name),
      teamCritical: criticos,
      allOrders: lider ? pedidos : pedidos.filter(p => p.responsable === session.name || ppEsCritico_(p)),
      users: lider ? ppUsuarios_().map(u => ({ name: u.nombre, role: u.perfil, active: String(u.activo).toLowerCase() === 'sí' })) : []
    }
  };
}

function ppCrearPedido_(session, form) {
  ppExigirLider_(session);
  const responsable = String(form.responsable || '').trim();
  if (responsable && !ppUsuarioPorNombre_(responsable)) throw new Error('El responsable no tiene un perfil activo. Créalo primero en Ajustes.');
  const resultado = registrarPedido(form);
  ppAuditar_('PEDIDO_CREADO', session.name + ' creó ' + resultado.id + (responsable ? ' y lo asignó a ' + responsable : '') + '.');
  return { ok: true, result: resultado };
}

function ppActualizarPedido_(session, id, changes) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(CFG.PEDIDOS);
  if (!hoja) throw new Error('No existe la hoja Pedidos.');
  const rows = Math.max(hoja.getLastRow() - 1, 1);
  const ids = hoja.getRange(2, CFG.COL.ID, rows, 1).getDisplayValues().flat();
  const idx = ids.findIndex(v => String(v).trim() === String(id).trim());
  if (idx < 0) throw new Error('No se encontró el pedido.');
  const row = idx + 2;
  const responsableActual = String(hoja.getRange(row, CFG.COL.RESP, 1, 1).getValue() || '');
  const esLider = ppEsLider_(session);
  if (!esLider && responsableActual !== session.name) throw new Error('Solo puedes actualizar los pedidos de tu propia cola.');
  const permitidos = esLider ? ['responsable', 'diseno', 'material', 'appendNote'] : ['diseno', 'material', 'appendNote'];
  Object.keys(changes).forEach(key => { if (permitidos.indexOf(key) < 0) throw new Error('No tienes permiso para modificar ese campo.'); });
  if (Object.prototype.hasOwnProperty.call(changes, 'responsable')) {
    const nuevo = String(changes.responsable || '').trim();
    if (nuevo && !ppUsuarioPorNombre_(nuevo)) throw new Error('Ese responsable no tiene un perfil. Créalo primero en Ajustes.');
    hoja.getRange(row, CFG.COL.RESP, 1, 1).setValue(nuevo);
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'diseno')) hoja.getRange(row, CFG.COL.DISENO, 1, 1).setValue(changes.diseno === 'Sí' ? 'Sí' : 'No');
  if (Object.prototype.hasOwnProperty.call(changes, 'material')) hoja.getRange(row, CFG.COL.MATERIAL, 1, 1).setValue(changes.material === 'Sí' ? 'Sí' : 'No');
  if (Object.prototype.hasOwnProperty.call(changes, 'appendNote')) {
    const anterior = String(hoja.getRange(row, CFG.COL.NOTAS, 1, 1).getValue() || '').trim();
    const nota = String(changes.appendNote || '').trim();
    if (!nota) throw new Error('La nota no puede estar vacía.');
    hoja.getRange(row, CFG.COL.NOTAS, 1, 1).setValue([anterior, '• ' + session.name + ': ' + nota].filter(Boolean).join('\n'));
  }
  actualizarSistema();
  ppAuditar_('PEDIDO_ACTUALIZADO', session.name + ' actualizó ' + id + ': ' + Object.keys(changes).join(', ') + '.');
  return { ok: true, result: { id: String(id) } };
}

function ppCrearUsuario_(session, user) {
  ppExigirManager_(session);
  const nombre = String(user.name || '').trim();
  const perfil = String(user.role || '').trim().toLowerCase();
  const pin = String(user.pin || '').trim();
  if (!nombre) throw new Error('Indica el nombre del perfil.');
  if (['manager', 'jefa', 'trabajador'].indexOf(perfil) < 0) throw new Error('Elige un perfil válido.');
  if (!/^\d{6}$/.test(pin)) throw new Error('El PIN debe tener seis dígitos.');
  const hoja = ppHojaUsuarios_();
  if (ppUsuarioPorNombre_(nombre)) throw new Error('Ya existe un perfil con ese nombre.');
  hoja.appendRow([nombre, perfil, ppHash_(pin), 'Sí', new Date()]);
  ppAuditar_('PERFIL_CREADO', session.name + ' creó el perfil ' + nombre + ' (' + perfil + ').');
  return { ok: true };
}

function ppActualizarUsuario_(session, payload) {
  ppExigirManager_(session);
  const user = ppUsuarioPorNombre_(payload.name);
  if (!user) throw new Error('No se encontró el perfil.');
  if (user.nombre === session.name && payload.active === false) throw new Error('No puedes desactivar tu propio perfil de manager.');
  ppHojaUsuarios_().getRange(user.row, 4, 1, 1).setValue(payload.active ? 'Sí' : 'No');
  ppAuditar_('PERFIL_ACTUALIZADO', session.name + ' cambió el acceso de ' + user.nombre + '.');
  return { ok: true };
}

function ppPedidos_() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(CFG.PEDIDOS);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 20).getValues().filter(r => r[0]).map(r => ({
    id: String(r[0]), cliente: String(r[2] || ''), tipo: String(r[3] || ''), descripcion: String(r[4] || ''), cantidad: Number(r[5] || 1), entrega: ppFecha_(r[6], r[7]), tiempoMinutos: Math.round((Number(r[8]) || 0) * 60), responsable: String(r[9] || ''), estado: String(r[10] || 'Pendiente'), diseno: String(r[12] || 'Sí'), material: String(r[13] || 'Sí'), notas: String(r[14] || '')
  }));
}

function ppUsuarios_() {
  const hoja = ppHojaUsuarios_();
  if (hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 5).getValues().map((r, i) => ({ row: i + 2, nombre: String(r[0] || '').trim(), perfil: String(r[1] || '').trim().toLowerCase(), pinHash: String(r[2] || ''), activo: String(r[3] || ''), creado: r[4] })).filter(u => u.nombre);
}

function ppUsuarioPorNombre_(name) { const clave = String(name || '').trim().toLowerCase(); return ppUsuarios_().find(u => u.nombre.toLowerCase() === clave); }
function ppHojaUsuarios_() { const hoja = SpreadsheetApp.getActive().getSheetByName(PP_PERFILES.HOJA_USUARIOS); if (!hoja) throw new Error('Primero ejecuta configurarPerfilesProduccion desde Apps Script.'); return hoja; }
function ppEsLider_(session) { return session.role === 'manager' || session.role === 'jefa'; }
function ppExigirLider_(session) { if (!ppEsLider_(session)) throw new Error('Solo manager y jefa pueden realizar esta acción.'); }
function ppExigirManager_(session) { if (session.role !== 'manager') throw new Error('Solo el manager puede administrar perfiles.'); }
function ppEsCritico_(p) { if (p.estado === 'Bloqueado' || p.diseno === 'No' || p.material === 'No') return true; if (!p.entrega) return false; return new Date(p.entrega).getTime() - Date.now() <= 4 * 3600000; }
function ppFecha_(fecha, hora) { if (!(fecha instanceof Date)) return null; const d = new Date(fecha.getTime()); if (hora instanceof Date) d.setHours(hora.getHours(), hora.getMinutes(), 0, 0); else if (typeof hora === 'number') d.setTime(d.getTime() + Math.round(hora * 86400000)); return d.toISOString(); }
function ppHash_(value) { const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8); return bytes.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function ppCrearAuditoria_() { const ss = SpreadsheetApp.getActive(); let hoja = ss.getSheetByName(PP_PERFILES.HOJA_AUDITORIA); if (!hoja) { hoja = ss.insertSheet(PP_PERFILES.HOJA_AUDITORIA); hoja.getRange(1, 1, 1, 3).setValues([['Fecha', 'Evento', 'Detalle']]); hoja.setFrozenRows(1); } return hoja; }
function ppAuditar_(evento, detalle) { ppCrearAuditoria_().appendRow([new Date(), evento, detalle]); }
function ppJsonp_(payload, callback) { const valido = /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(String(callback || '')); const output = valido ? callback + '(' + JSON.stringify(payload) + ');' : JSON.stringify(payload); return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT); }
