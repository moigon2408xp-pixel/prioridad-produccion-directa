/**
 * SISTEMA DE PRODUCCIÓN Y API WEB DE PRIORIDAD PRODUCCIÓN
 * Versión 11.0 Definitiva - Google Apps Script Backend (Code.gs)
 * "Creaciones JJ - Ochoa & Risquez"
 * Incluye auto-sanado de filas antiguas desfasadas en Google Sheets,
 * búsqueda inteligente de teléfonos por cliente y corrección de Responsable.
 */

function doGet(e) {
  return procesarSolicitud(e);
}

function doPost(e) {
  return procesarSolicitud(e);
}

function procesarSolicitud(e) {
  try {
    var params = {};
    
    // 1. Extraer parámetros URL (GET)
    if (e && e.parameter) {
      for (var k in e.parameter) {
        params[k] = e.parameter[k];
      }
    }
    
    // 2. Extraer parámetros del cuerpo (POST JSON)
    if (e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        for (var key in body) {
          params[key] = body[key];
        }
      } catch (errJson) {
        params["rawBody"] = e.postData.contents;
      }
    }
    
    var action = (params.action || params.accion || params.type || params.act || "").toString().trim();
    var result = ppDespachar_(action, params);
    return responderJSON(result);
    
  } catch (err) {
    return responderJSON({
      ok: false,
      exito: false,
      error: err.toString(),
      mensaje: err.message || err.toString()
    });
  }
}

function responderJSON(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==== ENRUTADOR DE ACCIONES ====
function ppDespachar_(action, params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var actionLower = action.toLowerCase();
  
  // 1. INICIO DE SESIÓN
  if (actionLower === "profile_login" || actionLower === "login") {
    return ppIniciarSesion_(ss, params);
  }
  
  // 2. DASHBOARD / CARGAR DATOS / REFRESCAR
  if (actionLower === "profile_dashboard" || actionLower === "dashboard" || actionLower === "refrescarmodulo" || actionLower === "") {
    return ppDashboard_(ss, params);
  }
  
  // 3. CREAR PEDIDO
  if (actionLower === "profile_create_order" || actionLower === "crearpedido" || actionLower === "create_order") {
    return ppCrearPedido_(ss, params);
  }
  
  // 4. ACTUALIZAR PEDIDO
  if (actionLower === "profile_update_order" || actionLower === "actualizarpedido" || actionLower === "update_order" || actionLower === "cerrarordenconfotos") {
    return ppActualizarPedido_(ss, params);
  }
  
  // 5. REABRIR PEDIDO TERMINADO
  if (actionLower === "profile_reopen_order" || actionLower === "reabrirpedido") {
    return ppReabrirPedido_(ss, params);
  }

  // 6. ELIMINAR PEDIDO
  if (actionLower === "profile_delete_order" || actionLower === "eliminarpedido" || actionLower === "delete_order") {
    return ppEliminarPedido_(ss, params);
  }

  // 6b. ARCHIVAR PEDIDOS ANTIGUOS (>60 DÍAS)
  if (actionLower === "profile_archive_old_orders" || actionLower === "archivar_antiguos") {
    return ppArchivarPedidosAntiguos_(ss, params);
  }

  // 6c. COSTOS E INGRESOS (SOLO JEFES)
  if (actionLower === "profile_save_cost" || actionLower === "guardarcosto") {
    return ppGuardarCosto_(ss, params);
  }

  // 6d. HORARIOS Y TURNOS
  if (actionLower === "profile_get_schedules" || actionLower === "obtenerhorarios") {
    return { ok: true, exito: true, schedules: ppObtenerHorarios_(ss) };
  }
  if (actionLower === "profile_save_schedule" || actionLower === "guardarhorario") {
    return ppGuardarHorario_(ss, params);
  }

  // 7. GESTIÓN DE USUARIOS
  if (actionLower === "profile_create_user" || actionLower === "crearusuario") {
    return ppCrearUsuario_(ss, params);
  }
  if (actionLower === "profile_toggle_user" || actionLower === "actualizarusuario") {
    return ppToggleUsuario_(ss, params);
  }

  // 8. GESTIÓN DE CLIENTES FRECUENTES
  if (actionLower === "profile_create_client" || actionLower === "guardarcliente") {
    return ppGuardarCliente_(ss, params);
  }
  if (actionLower === "profile_delete_client" || actionLower === "eliminarcliente") {
    return ppEliminarCliente_(ss, params);
  }

  // 9. GESTIÓN DE TIPOS DE TRABAJO
  if (actionLower === "profile_create_type" || actionLower === "guardartipo") {
    return ppGuardarTipo_(ss, params);
  }
  if (actionLower === "profile_delete_type" || actionLower === "eliminartipo") {
    return ppEliminarTipo_(ss, params);
  }

  // 10. GESTIÓN DE MOTIVOS
  if (actionLower === "profile_create_motivo" || actionLower === "guardarmotivo") {
    return ppGuardarMotivo_(ss, params);
  }
  if (actionLower === "profile_delete_motivo" || actionLower === "eliminarmotivo") {
    return ppEliminarMotivo_(ss, params);
  }

  throw new Error("Acción no reconocida: " + action);
}

function normalizeNameStr_(str) {
  return String(str || "").toLowerCase().trim()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u");
}

function cleanPinStr_(val) {
  var s = String(val || "").trim();
  if (s.indexOf(".") !== -1) s = s.split(".")[0].trim();
  return s;
}

// ==== 1. INICIO DE SESIÓN ====
function ppIniciarSesion_(ss, params) {
  var userName = String(params.name || params.user || params.nombre || "").trim();
  var userPin = String(params.pin || params.clave || "").trim();
  
  if (!userName || !userPin) {
    throw new Error("Nombre de usuario y PIN son requeridos.");
  }
  
  var sheetUsr = getOrCreateSheetFlexible_(ss, "Usuarios", ["Users", "Trabajadores", "Personal"], ["Nombre", "Rol", "PIN", "Activo"]);
  var data = sheetUsr.getDataRange().getValues();
  
  var normUser = normalizeNameStr_(userName);
  var cleanInputPin = cleanPinStr_(userPin);
  var hashedPin = ppHash_(cleanInputPin);
  
  // 1. Buscar coincidencia insensible a tildes y mayúsculas
  for (var i = 1; i < data.length; i++) {
    var rName = String(data[i][0] || "").trim();
    var rRole = String(data[i][1] || "trabajador").trim().toLowerCase();
    var rawPin = String(data[i][2] || "").trim();
    var cleanRowPin = cleanPinStr_(rawPin);
    
    var rActive = data[i][3];
    var isActive = (rActive !== false && String(rActive).toUpperCase() !== "NO" && String(rActive).toUpperCase() !== "FALSE");
    
    var normRowName = normalizeNameStr_(rName);
    
    if (normRowName === normUser || (normRowName && normUser && (normRowName.indexOf(normUser) !== -1 || normUser.indexOf(normRowName) !== -1))) {
      if (cleanRowPin !== cleanInputPin && rawPin !== cleanInputPin && cleanRowPin !== hashedPin && rawPin !== hashedPin) {
        throw new Error("PIN de acceso incorrecto para " + rName + ". Revisa el PIN de 6 dígitos.");
      }
      if (!isActive) {
        throw new Error("Este perfil de usuario (" + rName + ") se encuentra desactivado.");
      }
      
      var token = Utilities.base64Encode(rName + ":" + Date.now());
      return {
        ok: true,
        exito: true,
        session: {
          name: rName,
          nombre: rName,
          role: rRole || "manager",
          rol: rRole || "manager",
          token: token
        },
        token: token
      };
    }
  }
  
  // 2. Si no existe ningún usuario registrado o el usuario es Administrador / Moises / Manager, crearlo automáticamente
  if (data.length <= 1 || normUser.indexOf("moises") !== -1 || normUser.indexOf("manager") !== -1 || normUser.indexOf("jefe") !== -1 || normUser.indexOf("jefa") !== -1 || normUser.indexOf("admin") !== -1) {
    var defaultRole = (normUser.indexOf("jefe") !== -1) ? "jefe" : ((normUser.indexOf("jefa") !== -1) ? "jefa" : "manager");
    sheetUsr.appendRow([userName, defaultRole, cleanInputPin, "Sí"]);
    
    var tokenNew = Utilities.base64Encode(userName + ":" + Date.now());
    return {
      ok: true,
      exito: true,
      session: {
        name: userName,
        nombre: userName,
        role: defaultRole,
        rol: defaultRole,
        token: tokenNew
      },
      token: tokenNew
    };
  }

  throw new Error("El usuario '" + userName + "' no se encuentra registrado en el sistema. Solicita al Jefe o Manager que cree tu perfil.");
}

// ==== AUXILIAR DE ESTRUCTURA Y ENCABEZADOS DE HOJA ====
function ensureCanonicalHeaders_(sheet) {
  var canonical = [
    "ID", "Fecha_entrada", "Cliente", "Tipo", "Motivo", "Descripcion", "Cantidad",
    "Entrega", "Hora_entrega", "Tiempo_estimado", "Responsable", "Estado",
    "Urgente", "Diseno", "Material", "Notas", "Prioridad_auto",
    "Tiempo_entregar", "Score_tecnico", "Posicion", "Cerrado",
    "Fecha_cierre", "Inicio_produccion", "Fin_produccion", "Duracion_real_min",
    "Comentario_cierre", "Fotos_Referencia", "Fotos_Evidencia", "Entregado_en", "Retraso_min",
    "Cerrado_por", "UltimaPausa", "TiempoPausadoMin", "Telefono"
  ];
  
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(canonical);
    return canonical;
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return String(h).toLowerCase().replace(/[^a-z0-9]/g, ""); });
  
  canonical.forEach(function(colName) {
    var key = colName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (headersLower.indexOf(key) === -1) {
      var nextCol = headers.length + 1;
      sheet.getRange(1, nextCol).setValue(colName);
      headers.push(colName);
      headersLower.push(key);
    }
  });
  
  return headers;
}

// ==== 2. DASHBOARD Y CARGA INTEGRAL ====
function ppDashboard_(ss, params) {
  // A. Usuarios
  var sheetUsr = getOrCreateSheetFlexible_(ss, "Usuarios", ["Users", "Trabajadores"], ["Nombre", "Rol", "PIN", "Activo"]);
  var dataUsr = sheetUsr.getDataRange().getValues();
  var users = [];
  for (var u = 1; u < dataUsr.length; u++) {
    var uName = String(dataUsr[u][0] || "").trim();
    if (!uName) continue;
    var uRole = String(dataUsr[u][1] || "trabajador").trim().toLowerCase();
    var uActiveRaw = dataUsr[u][3];
    var uActive = (uActiveRaw !== false && String(uActiveRaw).toUpperCase() !== "NO" && String(uActiveRaw).toUpperCase() !== "FALSE");
    users.push({
      name: uName,
      nombre: uName,
      role: uRole,
      rol: uRole,
      active: uActive,
      activo: uActive
    });
  }

  // B. Tipos de trabajo
  var sheetTipos = getOrCreateSheetFlexible_(ss, "Tipos", ["Tipos de Trabajo", "TiposTrabajo", "Servicios"], ["Tipo", "DiasEstimados"]);
  var dataTipos = sheetTipos.getDataRange().getValues();
  var typesSet = {};
  var typesList = [];
  for (var t = 1; t < dataTipos.length; t++) {
    var tVal = String(dataTipos[t][0] || "").trim();
    if (tVal && tVal.toLowerCase() !== "tipo" && !typesSet[tVal.toLowerCase()]) {
      typesSet[tVal.toLowerCase()] = true;
      typesList.push(tVal);
    }
  }

  // C. Clientes Frecuentes (con Delivery, Zona y Dirección)
  var sheetTel = getOrCreateSheetFlexible_(ss, "Clientes", ["Telefonos", "Teléfonos", "Directorio", "Contactos"], ["Nombre", "Telefono", "Delivery", "Zona", "Direccion"]);
  var dataTel = sheetTel.getDataRange().getValues();
  var phonesList = [];
  var clientsSet = {};
  var clientDeliveryMap = {};
  for (var p = 1; p < dataTel.length; p++) {
    var cName     = String(dataTel[p][0] || "").trim();
    var cTel      = String(dataTel[p][1] || "").trim();
    var cDelivery = String(dataTel[p][2] || "No").trim();
    var cZona     = String(dataTel[p][3] || "").trim();
    var cDirec    = String(dataTel[p][4] || "").trim();
    if (cName && cName.toLowerCase() !== "nombre" && cName.toLowerCase() !== "cliente") {
      clientsSet[cName.toLowerCase()] = cTel;
      clientDeliveryMap[cName.toLowerCase()] = { delivery: cDelivery, zona: cZona, direccion: cDirec };
      phonesList.push({
        name: cName, nombre: cName, cliente: cName,
        phone: cTel, telefono: cTel, celular: cTel,
        delivery: cDelivery, zona: cZona, direccion: cDirec
      });
    }
  }

  // C2. Motivos / Temáticas
  var sheetMotivos = getOrCreateSheetFlexible_(ss, "Motivos", ["Tematicas", "Temáticas"], ["Motivo"]);
  var dataMotivos = sheetMotivos.getDataRange().getValues();
  var motivosList = [];
  for (var mv = 1; mv < dataMotivos.length; mv++) {
    var mvVal = String(dataMotivos[mv][0] || "").trim();
    if (mvVal && mvVal.toLowerCase() !== "motivo") motivosList.push(mvVal);
  }

  // D. Pedidos
  var sheetPed = getOrCreateSheetFlexible_(ss, "Pedidos", ["Orders", "Trabajos"], []);
  var headers = ensureCanonicalHeaders_(sheetPed);
  var getCol = makeColumnGetter_(headers);
  
  var idxId = getCol(["id", "código", "codigo", "pedido"], 0);
  var idxCliente = getCol(["cliente", "client", "empresa"], 2);
  var idxTipo = getCol(["tipo", "servicio", "trabajo"], 3);
  var idxMotivo = getCol(["motivo", "temática", "tematica", "tema"], 4);
  var idxDescripcion = getCol(["descripcion", "descripción", "detalle"], 5);
  var idxCantidad = getCol(["cantidad", "cant"], 6);
  var idxEntrega = getCol(["entrega", "fecha", "deadline"], 7);
  var idxHoraEntrega = getCol(["hora_entrega", "hora"], 8);
  var idxResponsable = getCol(["responsable", "encargado", "asignado"], 10);
  var idxEstado = getCol(["estado", "status", "estatus"], 11);
  var idxDiseno = getCol(["diseno", "diseño"], 13);
  var idxMaterial = getCol(["material", "materiales"], 14);
  var idxNotas = getCol(["notas", "nota", "observaciones"], 15);
  var idxCerrado = getCol(["cerrado", "cerrada"], 20);
  var idxInicioProd = getCol(["inicioproduccion", "inicio_produccion", "inicio"], 22);
  var idxFinProd = getCol(["finproduccion", "fin_produccion", "fin"], 23);
  var idxDuracionReal = getCol(["duracionrealmin", "duracion_real_min", "duracion"], 24);
  var idxComentario = getCol(["comentariocierre", "comentario_cierre"], 25);
  var idxFotosRef = getCol(["fotosreferencia", "referencias", "fotos_referencia"], 26);
  var idxFotosEvi = getCol(["fotosevidencia", "evidencias", "evidenciasdrive", "fotos_evidencia"], 27);
  var idxUltPausa = getCol(["ultimapausa", "ultima_pausa"], 31);
  var idxTiempoPausa = getCol(["tiempopausadomin", "tiempo_pausado_min", "tiempopausa"], 32);
  var idxTelefono = getCol(["telefono", "teléfono", "phone", "celular"], 33);

  var dataPed = sheetPed.getDataRange().getValues();
  var allOrders = [];

  for (var o = 1; o < dataPed.length; o++) {
    var row = dataPed[o];
    var idVal = String(row[idxId] || "").trim();
    if (!idVal) continue;

    var orderTipo = String(row[idxTipo] || "").trim();
    if (orderTipo && !typesSet[orderTipo.toLowerCase()]) {
      typesSet[orderTipo.toLowerCase()] = true;
      typesList.push(orderTipo);
    }

    var orderCliente = String(row[idxCliente] || "").trim();
    var orderTel = String(row[idxTelefono] || "").trim();
    var respVal = String(row[idxResponsable] || "Sin asignar").trim();
    var estadoVal = String(row[idxEstado] || "Pendiente").trim();

    // AUTO-SANEAMIENTO DE FILAS DESFASADAS EN GOOGLE SHEETS
    if (respVal === "1" || !isNaN(respVal) || respVal === String(row[idxCantidad])) {
      respVal = "Valentina";
      sheetPed.getRange(o + 1, idxResponsable + 1).setValue(respVal);
    }

    if (["valentina", "jeanette", "carla", "manager", "jefa"].includes(estadoVal.toLowerCase())) {
      respVal = estadoVal;
      estadoVal = "Pendiente";
      sheetPed.getRange(o + 1, idxEstado + 1).setValue(estadoVal);
      sheetPed.getRange(o + 1, idxResponsable + 1).setValue(respVal);
    }

    // Auto-sanar número de teléfono si el cliente está registrado en directorio
    if (!orderTel && orderCliente && clientsSet[orderCliente.toLowerCase()]) {
      orderTel = clientsSet[orderCliente.toLowerCase()];
      if (orderTel) {
        sheetPed.getRange(o + 1, idxTelefono + 1).setValue(orderTel);
      }
    }

    var orderObj = {
      id: idVal,
      cliente: orderCliente,
      tipo: orderTipo,
      motivo: String(row[idxMotivo] || "").trim(),
      descripcion: String(row[idxDescripcion] || "").trim(),
      cantidad: Number(row[idxCantidad] || 1),
      entrega: parseFechaISO_(row[idxEntrega], row[idxHoraEntrega]),
      horaEntrega: String(row[idxHoraEntrega] || "").trim(),
      responsable: respVal,
      estado: estadoVal,
      diseno: String(row[idxDiseno] || "No").trim(),
      material: String(row[idxMaterial] || "No").trim(),
      notas: String(row[idxNotas] || "").trim(),
      cerrado: String(row[idxCerrado] || "No").trim(),
      inicioProduccion: row[idxInicioProd] ? parseFechaISO_(row[idxInicioProd]) : "",
      finProduccion: row[idxFinProd] ? parseFechaISO_(row[idxFinProd]) : "",
      duracionRealMin: Number(row[idxDuracionReal] || 0),
      comentarioCierre: String(row[idxComentario] || "").trim(),
      fotoReferencia: String(row[idxFotosRef] || "").trim(),
      fotoEvidencia: String(row[idxFotosEvi] || "").trim(),
      evidenciasDrive: String(row[idxFotosEvi] || "").trim(),
      ultimaPausa: row[idxUltPausa] ? parseFechaISO_(row[idxUltPausa]) : "",
      tiempoPausadoMin: Number(row[idxTiempoPausa] || 0),
      telefono: orderTel
    };

    allOrders.push(orderObj);
  }

  // E. Historial desde Proyectos_Terminados
  var sheetTerm = getOrCreateSheetFlexible_(ss, "Proyectos_Terminados", ["Historial", "Finished"], [
    "ID", "Cliente", "Tipo", "Motivo", "Responsable", "Estado", "Entrega", "Inicio_produccion", "Fin_produccion", "Duracion_real_min", "Comentario_cierre", "Fotos_Referencia", "Fotos_Evidencia", "Diseño", "Notas", "Costo"
  ]);
  ensureCanonicalTerminadosHeaders_(sheetTerm);
  var dataTerm = sheetTerm.getDataRange().getValues();

  var finishedOrdersMap = {};
  var dailyPerformance = {};
  var knownWorkers = ["valentina", "jeanette", "moises", "eloy", "camila", "jorge", "julieta", "carla"];

  for (var j = 1; j < dataTerm.length; j++) {
    var rTerm = dataTerm[j];
    var tId = String(rTerm[0] || "").trim();
    if (!tId) continue;

    var tCliente = String(rTerm[1] || "").trim();
    var tTipo = String(rTerm[2] || "").trim();
    var tMotivo = String(rTerm[3] || "").trim();
    var tResp = String(rTerm[4] || "").trim();
    var tEstado = String(rTerm[5] || "Terminado").trim();
    var tEntrega = rTerm[6] ? parseFechaISO_(rTerm[6]) : "";
    var tInicio = rTerm[7] ? parseFechaISO_(rTerm[7]) : "";
    var tFin = rTerm[8] ? parseFechaISO_(rTerm[8]) : "";
    var tDuracion = Number(rTerm[9] || 0);
    var tComentario = String(rTerm[10] || "").trim();
    var tFotosRef = String(rTerm[11] || "").trim();
    var tFotosEvi = String(rTerm[12] || "").trim();
    var tDiseno = String(rTerm[13] || "Sí").trim();
    var tNotas = String(rTerm[14] || "").trim();
    var tCosto = Number(rTerm[15] || 0);

    // AUTO-SANEAMIENTO DE COLUMNAS DESFASADAS EN PROYECTOS_TERMINADOS
    if (tResp.toLowerCase() === "mario bros" || (!knownWorkers.includes(tResp.toLowerCase()) && knownWorkers.includes(tMotivo.toLowerCase()))) {
      var realMotivo = (tResp.toLowerCase() === "mario bros") ? tResp : tMotivo;
      var realResp = knownWorkers.includes(tMotivo.toLowerCase()) ? tMotivo : "Valentina";
      tMotivo = realMotivo;
      tResp = realResp;
      tEstado = "Terminado";
      try {
        sheetTerm.getRange(j + 1, 4).setValue(tMotivo);
        sheetTerm.getRange(j + 1, 5).setValue(tResp);
        sheetTerm.getRange(j + 1, 6).setValue(tEstado);
      } catch(e) {}
    }

    if (knownWorkers.includes(tEstado.toLowerCase())) {
      tResp = tEstado;
      tEstado = "Terminado";
      try {
        sheetTerm.getRange(j + 1, 5).setValue(tResp);
        sheetTerm.getRange(j + 1, 6).setValue(tEstado);
      } catch(e) {}
    }

    if (!isNaN(tComentario) && Number(tComentario) > 0 && tDuracion === 0) {
      tDuracion = Number(tComentario);
      tComentario = "";
      try {
        sheetTerm.getRange(j + 1, 10).setValue(tDuracion);
        sheetTerm.getRange(j + 1, 11).setValue(tComentario);
      } catch(e) {}
    }

    if (!tNotas && tComentario && isNaN(tComentario)) {
      tNotas = tComentario;
      try {
        sheetTerm.getRange(j + 1, 15).setValue(tNotas);
      } catch(e) {}
    }

    if (!["terminado", "entregado", "cancelado"].includes(tEstado.toLowerCase())) {
      tEstado = "Terminado";
      try {
        sheetTerm.getRange(j + 1, 6).setValue(tEstado);
      } catch(e) {}
    }

    var fOrd = {
      id: tId,
      cliente: tCliente,
      tipo: tTipo,
      motivo: tMotivo,
      responsable: tResp,
      estado: tEstado,
      entrega: tEntrega,
      inicioProduccion: tInicio,
      finProduccion: tFin,
      duracionRealMin: tDuracion,
      comentarioCierre: tComentario,
      fotoReferencia: tFotosRef,
      fotoEvidencia: tFotosEvi,
      diseno: tDiseno,
      notas: tNotas,
      costo: tCosto,
      evidenciasDrive: tFotosEvi
    };
    finishedOrdersMap[tId] = fOrd;
  }
  
  var finishedOrders = Object.keys(finishedOrdersMap).map(function(k) { return finishedOrdersMap[k]; });
  
  var todayLocalStr = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || "GMT-4", "yyyy-MM-dd");

  for (var fIdx = 0; fIdx < finishedOrders.length; fIdx++) {
    var fOrd = finishedOrders[fIdx];
    var estLower = String(fOrd.estado || "").toLowerCase().trim();
    if (estLower === "cancelado") continue;

    var finDateStr = "";
    if (fOrd.finProduccion) {
      try {
        finDateStr = Utilities.formatDate(new Date(fOrd.finProduccion), ss.getSpreadsheetTimeZone() || "GMT-4", "yyyy-MM-dd");
      } catch (err) {
        finDateStr = String(fOrd.finProduccion).split("T")[0];
      }
    }

    if (finDateStr === todayLocalStr && fOrd.responsable) {
      var rUser = fOrd.responsable;
      if (!dailyPerformance[rUser]) {
        dailyPerformance[rUser] = { completedToday: 0, totalMinToday: 0, orders: [] };
      }
      dailyPerformance[rUser].completedToday += 1;
      dailyPerformance[rUser].totalMinToday += (fOrd.duracionRealMin || 0);
      dailyPerformance[rUser].orders.push(fOrd);
    }
  }

  var activeOrders = allOrders.filter(function(o) {
    var est = o.estado.toLowerCase().trim();
    var cer = o.cerrado.toLowerCase().trim();
    return cer !== "sí" && cer !== "si" && est !== "terminado" && est !== "entregado" && est !== "cancelado";
  });

  var maxNum = 0;
  for (var k in finishedOrdersMap) {
    var m = k.match(/PED-(\d+)/i);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  for (var a = 0; a < activeOrders.length; a++) {
    var aOrd = activeOrders[a];
    var mAct = aOrd.id.match(/PED-(\d+)/i);
    if (mAct) {
      var nA = parseInt(mAct[1], 10);
      if (nA > maxNum) maxNum = nA;
    }
  }
  var nextFreeIdNum = maxNum + 1;

  for (var cIdx = 0; cIdx < activeOrders.length; cIdx++) {
    var checkOrd = activeOrders[cIdx];
    if (finishedOrdersMap[checkOrd.id]) {
      var fixedId = "PED-" + String(nextFreeIdNum++).padStart(4, "0");
      for (var r = 1; r < dataPed.length; r++) {
        if (String(dataPed[r][idxId]).trim() === checkOrd.id) {
          sheetPed.getRange(r + 1, idxId + 1).setValue(fixedId);
          checkOrd.id = fixedId;
          break;
        }
      }
    }
  }

  var sessionUser = "";
  if (params.token) {
    try {
      sessionUser = Utilities.newBlob(Utilities.base64Decode(params.token)).getDataAsString().split(":")[0];
    } catch (eToken) {}
  }
  if (!sessionUser && params.user) sessionUser = String(params.user).trim();

  var myOrders = activeOrders.filter(function(o) {
    return sessionUser && o.responsable.toLowerCase() === sessionUser.toLowerCase();
  });

  var teamCritical = activeOrders.filter(function(o) {
    var hs = o.entrega ? (new Date(o.entrega) - Date.now()) / 3600000 : Infinity;
    return hs <= 4 || o.diseno.toLowerCase() === "no" || o.material.toLowerCase() === "no";
  });

  var struct = {
    myOrders: myOrders,
    teamCritical: teamCritical,
    allOrders: activeOrders,
    finishedOrders: finishedOrders,
    users: users,
    frequentClients: phonesList,
    clientes: phonesList,
    telefonos: phonesList,
    frequentTypes: typesList,
    tipos: typesList,
    motivos: motivosList,
    frequentMotivos: motivosList,
    dailyPerformance: dailyPerformance,
    schedules: ppObtenerHorarios_(ss),
    horarios: ppObtenerHorarios_(ss),
    waTemplate: "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega."
  };

  return {
    ok: true,
    exito: true,
    data: struct,
    ...struct
  };
}

// ==== 3. CREAR NUEVO PEDIDO MAPEADO DINÁMICAMENTE ====
function ppCrearPedido_(ss, params) {
  var sheetPed = ss.getSheetByName("Pedidos") || ss.insertSheet("Pedidos");
  var headers = ensureCanonicalHeaders_(sheetPed);
  var f = params.form || params;
  
  // Obtener el ID numérico más alto en todas las hojas para evitar duplicar correlativos
  var maxIdNum = 0;
  var sheetNamesToScan = ["Pedidos", "Proyectos_Terminados", "Proyectos_Terminados_Historico"];
  
  for (var sIdx = 0; sIdx < sheetNamesToScan.length; sIdx++) {
    var sh = ss.getSheetByName(sheetNamesToScan[sIdx]);
    if (sh && sh.getLastRow() > 1) {
      var d = sh.getDataRange().getValues();
      for (var rIdx = 1; rIdx < d.length; rIdx++) {
        var rawIdStr = String(d[rIdx][0] || "").trim();
        var idMatch = rawIdStr.match(/PED-(\d+)/i);
        if (idMatch) {
          var num = parseInt(idMatch[1], 10);
          if (!isNaN(num) && num > maxIdNum) {
            maxIdNum = num;
          }
        }
      }
    }
  }

  var nextSeqNum = maxIdNum + 1;
  var newId = "PED-" + String(nextSeqNum).padStart(4, "0");
  
  var nowIso = new Date().toISOString();
  var cliente = String(f.cliente || f.client || f.nombre || "").trim();
  var tipo = String(f.tipo || f.type || f.servicio || "").trim();
  var motivo = String(f.motivo || f.tematica || f.temática || "").trim();
  var telefono = String(f.telefono || f.phone || f.celular || "").trim();
  var fechaEntrega = f.fechaEntrega || f.entrega || "";
  var horaEntrega = f.horaEntrega || f.hora || "18:00";
  var entregaFull = parseFechaISO_(fechaEntrega, horaEntrega);
  
  var linksReferenceDrive = [];
  var refImages = f.referenceImages || params.referenceImages || [];
  if (refImages && refImages.length > 0) {
    var folder;
    var folders = DriveApp.getFoldersByName("Evidencias_Papeleria");
    folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Evidencias_Papeleria");
    
    for (var rIdx = 0; rIdx < refImages.length; rIdx++) {
      var imgObj = refImages[rIdx];
      var base64Data = imgObj.data || imgObj;
      if (typeof base64Data === "string") {
        if (base64Data.indexOf(",") > -1) base64Data = base64Data.split(",")[1];
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), imgObj.mimeType || "image/jpeg", newId + "_referencia_" + (rIdx + 1) + ".jpg");
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        linksReferenceDrive.push(file.getUrl());
      }
    }
  }
  var linksRefStr = linksReferenceDrive.join("\n");

  var fieldMap = {
    "id": newId,
    "fechaentrada": nowIso,
    "cliente": cliente,
    "tipo": tipo,
    "motivo": motivo,
    "descripcion": f.descripcion || "",
    "cantidad": Number(f.cantidad || 1),
    "entrega": entregaFull,
    "horaentrega": horaEntrega,
    "tiempoestimado": Number(f.tiempoEstimado || 1),
    "responsable": f.responsable || params.user || "Sin asignar",
    "estado": "Pendiente",
    "urgente": "No",
    "diseno": f.diseno || f.disenoListo || f.diseno_listo || "Sí",
    "material": "Sí",
    "notas": f.notas || "",
    "cerrado": "No",
    "fotosreferencia": linksRefStr,
    "tiempopausadomin": 0,
    "telefono": telefono
  };

  var newRow = new Array(headers.length).fill("");
  for (var c = 0; c < headers.length; c++) {
    var hKey = String(headers[c] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (fieldMap.hasOwnProperty(hKey)) {
      newRow[c] = fieldMap[hKey];
    }
  }
  
  sheetPed.appendRow(newRow);
  
  // Guardar cliente y teléfono en catálogo automáticamente
  if (cliente) {
    var sheetCl = ss.getSheetByName("Clientes") || ss.getSheetByName("Telefonos");
    if (sheetCl) {
      var dataC = sheetCl.getDataRange().getValues();
      var existsC = false;
      for (var cIdx = 1; cIdx < dataC.length; cIdx++) {
        if (String(dataC[cIdx][0]).toLowerCase().trim() === cliente.toLowerCase()) {
          existsC = true;
          if (telefono && !dataC[cIdx][1]) {
            sheetCl.getRange(cIdx + 1, 2).setValue(telefono);
          }
          break;
        }
      }
      if (!existsC) sheetCl.appendRow([cliente, telefono]);
    }
  }
  
  if (tipo) {
    var sheetTp = ss.getSheetByName("Tipos");
    if (sheetTp) {
      var dataT = sheetTp.getDataRange().getValues();
      var existsT = dataT.some(function(r) { return String(r[0]).toLowerCase().trim() === tipo.toLowerCase(); });
      if (!existsT) sheetTp.appendRow([tipo]);
    }
  }
  
  return { ok: true, exito: true, id: newId, mensaje: "Pedido " + newId + " creado con éxito." };
}

// ==== 4. ACTUALIZAR PEDIDO ====
function ppActualizarPedido_(ss, params) {
  var sheetPed = ss.getSheetByName("Pedidos");
  if (!sheetPed) throw new Error("No se encontró la hoja Pedidos.");
  
  var dataP = sheetPed.getDataRange().getValues();
  var headers = dataP.length > 0 ? dataP[0] : [];
  var getCol = makeColumnGetter_(headers);
  
  var idxId = getCol(["id"], 0);
  var idxCliente = getCol(["cliente"], 2);
  var idxTipo = getCol(["tipo"], 3);
  var idxMotivo = getCol(["motivo"], 4);
  var idxEntrega = getCol(["entrega"], 7);
  var idxResponsable = getCol(["responsable"], 10);
  var idxEstado = getCol(["estado"], 11);
  var idxDiseno = getCol(["diseno", "diseño"], 13);
  var idxNotas = getCol(["notas", "observaciones", "comentarios"], 14);
  var idxCerrado = getCol(["cerrado"], 20);
  var idxFechaCierre = getCol(["fechacierre", "fecha_cierre"], 21);
  var idxInicioProd = getCol(["inicioproduccion", "inicio_produccion"], 22);
  var idxFinProd = getCol(["finproduccion", "fin_produccion"], 23);
  var idxDuracionReal = getCol(["duracionrealmin", "duracion_real_min"], 24);
  var idxComentario = getCol(["comentariocierre", "comentario_cierre"], 25);
  var idxFotosRef = getCol(["fotosreferencia", "referencias"], 26);
  var idxFotosEvi = getCol(["fotosevidencia", "evidencias"], 27);
  var idxUltPausa = getCol(["ultimapausa", "ultima_pausa"], 31);
  var idxTiempoPausa = getCol(["tiempopausadomin", "tiempo_pausado_min"], 32);

  var targetId = String(params.id || "").trim();
  var changes = params.changes || params;
  var now = new Date();
  var nowIso = now.toISOString();
  var nowMs = now.getTime();
  
  for (var i = 1; i < dataP.length; i++) {
    if (String(dataP[i][idxId]).trim() === targetId) {
      var rowIdx = i + 1;
      var estadoActual = String(dataP[i][idxEstado] || "Pendiente").trim();
      var nuevoEstado = String(changes.estado || estadoActual).trim();
      
      if (changes.diseno || changes.diseño) {
        sheetPed.getRange(rowIdx, idxDiseno + 1).setValue(changes.diseno || changes.diseño);
      }

      if (changes.nota || changes.notas) {
        var oldNotas = String(dataP[i][idxNotas] || "").trim();
        var author = String(params.user || changes.user || "Usuario").trim();
        var timeStr = Utilities.formatDate(now, ss.getSpreadsheetTimeZone() || "GMT-4", "dd/MM/yyyy hh:mm a");
        var noteText = String(changes.nota || changes.notas).trim();
        var newEntry = "📌 [" + timeStr + " - " + author + "]: " + noteText;
        var updatedNotas = oldNotas ? (oldNotas + "\n" + newEntry) : newEntry;
        sheetPed.getRange(rowIdx, idxNotas + 1).setValue(updatedNotas);
      }
      
      var inicioProd = dataP[i][idxInicioProd];
      var ultPausa = dataP[i][idxUltPausa];
      var acumuladoPausadoMin = Number(dataP[i][idxTiempoPausa] || 0);
      
      if (nuevoEstado === "En proceso") {
        if (!inicioProd) {
          sheetPed.getRange(rowIdx, idxInicioProd + 1).setValue(nowIso);
          inicioProd = nowIso;
        } else if (estadoActual === "Pausado" && ultPausa) {
          var durPausaMin = (nowMs - new Date(ultPausa).getTime()) / 60000;
          acumuladoPausadoMin += durPausaMin;
          sheetPed.getRange(rowIdx, idxTiempoPausa + 1).setValue(acumuladoPausadoMin);
          sheetPed.getRange(rowIdx, idxUltPausa + 1).setValue("");
        }
      }
      
      if (nuevoEstado === "Pausado" && estadoActual !== "Pausado") {
        sheetPed.getRange(rowIdx, idxUltPausa + 1).setValue(nowIso);
      }
      
      if (["Terminado", "Entregado", "Cancelado"].includes(nuevoEstado)) {
        sheetPed.getRange(rowIdx, idxCerrado + 1).setValue("Sí");
        sheetPed.getRange(rowIdx, idxFechaCierre + 1).setValue(nowIso);
        sheetPed.getRange(rowIdx, idxFinProd + 1).setValue(nowIso);
        
        if (estadoActual === "Pausado" && ultPausa) {
          acumuladoPausadoMin += (nowMs - new Date(ultPausa).getTime()) / 60000;
          sheetPed.getRange(rowIdx, idxTiempoPausa + 1).setValue(acumuladoPausadoMin);
        }
        
        var duracionReal = 0;
        if (inicioProd) {
          var totalTranscurridoMin = (nowMs - new Date(inicioProd).getTime()) / 60000;
          duracionReal = Math.max(0, Math.round(totalTranscurridoMin - acumuladoPausadoMin));
        }
        sheetPed.getRange(rowIdx, idxDuracionReal + 1).setValue(duracionReal);
        
        var linksEviDrive = [];
        if (changes.images && changes.images.length > 0) {
          var folder;
          var folders = DriveApp.getFoldersByName("Evidencias_Papeleria");
          folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Evidencias_Papeleria");
          
          for (var imgIdx = 0; imgIdx < changes.images.length; imgIdx++) {
            var imgObj = changes.images[imgIdx];
            var base64Data = imgObj.data || imgObj;
            if (typeof base64Data === "string") {
              if (base64Data.indexOf(",") > -1) base64Data = base64Data.split(",")[1];
              var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), imgObj.mimeType || "image/jpeg", targetId + "_evidencia_" + (imgIdx + 1) + ".jpg");
              var file = folder.createFile(blob);
              file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
              linksEviDrive.push(file.getUrl());
            }
          }
        }
        
        var linksEviStr = linksEviDrive.join("\n");
        var comentario = changes.comentarioCierre ? String(changes.comentarioCierre).trim() : "";
        
        if (comentario) sheetPed.getRange(rowIdx, idxComentario + 1).setValue(comentario);
        if (linksEviStr) sheetPed.getRange(rowIdx, idxFotosEvi + 1).setValue(linksEviStr);
        
        var sheetTerm = ss.getSheetByName("Proyectos_Terminados") || ss.insertSheet("Proyectos_Terminados");
        var dataTerm = sheetTerm.getDataRange().getValues();
        var existingTermRow = -1;
        for (var t = 1; t < dataTerm.length; t++) {
          if (String(dataTerm[t][0] || "").trim() === targetId) {
            existingTermRow = t + 1;
            break;
          }
        }

        var currentDiseno = String(changes.diseno || changes.diseño || dataP[i][idxDiseno] || "Sí").trim();
        var currentNotas = String(dataP[i][idxNotas] || changes.nota || changes.notas || "").trim();

        var rowValues = [
          targetId,
          dataP[i][idxCliente] || "",
          dataP[i][idxTipo] || "",
          dataP[i][idxMotivo] || "",
          dataP[i][idxResponsable] || "",
          nuevoEstado,
          dataP[i][idxEntrega] || "",
          inicioProd || nowIso,
          nowIso,
          duracionReal,
          comentario,
          dataP[i][idxFotosRef] || "",
          linksEviStr || dataP[i][idxFotosEvi] || "",
          currentDiseno,
          currentNotas
        ];

        if (existingTermRow > 0) {
          sheetTerm.getRange(existingTermRow, 1, 1, rowValues.length).setValues([rowValues]);
        } else {
          sheetTerm.appendRow(rowValues);
        }
      }
      
      sheetPed.getRange(rowIdx, idxEstado + 1).setValue(nuevoEstado);
      if (changes.responsable !== undefined) sheetPed.getRange(rowIdx, idxResponsable + 1).setValue(changes.responsable);
      
      return { ok: true, exito: true, mensaje: "Pedido actualizado correctamente." };
    }
  }
  
  // Si no se encontró en Pedidos activos, buscar en Proyectos_Terminados (Historial)
  var sheetTerm = ss.getSheetByName("Proyectos_Terminados");
  if (sheetTerm && sheetTerm.getLastRow() > 1) {
    var dataT = sheetTerm.getDataRange().getValues();
    for (var j = 1; j < dataT.length; j++) {
      if (String(dataT[j][0] || "").trim() === targetId) {
        var rowTIdx = j + 1;
        if (changes.duracionRealMin !== undefined) {
          sheetTerm.getRange(rowTIdx, 10).setValue(Number(changes.duracionRealMin || 0));
        }
        if (changes.costo !== undefined || changes.precio !== undefined) {
          sheetTerm.getRange(rowTIdx, 16).setValue(Number(changes.costo || changes.precio || 0));
        }
        if (changes.diseno || changes.diseño) {
          sheetTerm.getRange(rowTIdx, 14).setValue(String(changes.diseno || changes.diseño));
        }
        if (changes.responsable !== undefined) {
          sheetTerm.getRange(rowTIdx, 5).setValue(String(changes.responsable));
        }
        if (changes.estado !== undefined) {
          sheetTerm.getRange(rowTIdx, 6).setValue(String(changes.estado));
        }
        if (changes.nota || changes.notas) {
          var oldNotes = String(dataT[j][14] || "").trim();
          var authorT = String(params.user || changes.user || "Usuario").trim();
          var timeStrT = Utilities.formatDate(now, ss.getSpreadsheetTimeZone() || "GMT-4", "dd/MM/yyyy hh:mm a");
          var noteTextT = String(changes.nota || changes.notas).trim();
          var newEntryT = "📌 [" + timeStrT + " - " + authorT + "]: " + noteTextT;
          var updatedNotesT = oldNotes ? (oldNotes + "\n" + newEntryT) : newEntryT;
          sheetTerm.getRange(rowTIdx, 15).setValue(updatedNotesT);
        }
        return { ok: true, exito: true, mensaje: "Proyecto histórico actualizado correctamente." };
      }
    }
  }

  throw new Error("Pedido no encontrado.");
}

// ==== 5. REABRIR PEDIDO TERMINADO Y ASIGNAR RESPONSABLE ====
function ppReabrirPedido_(ss, params) {
  var sheetPed = ss.getSheetByName("Pedidos") || ss.insertSheet("Pedidos");
  var sheetTerm = ss.getSheetByName("Proyectos_Terminados");
  var targetId = String(params.id || "").trim();
  var currentUser = String(params.user || "").trim();
  
  var foundInPed = false;
  var orderDataToRestore = null;

  if (sheetPed) {
    var dataP = sheetPed.getDataRange().getValues();
    var headers = dataP.length > 0 ? dataP[0] : [];
    var getCol = makeColumnGetter_(headers);
    var idxId = getCol(["id"], 0);
    var idxEstado = getCol(["estado"], 11);
    var idxCerrado = getCol(["cerrado"], 20);
    var idxFechaCierre = getCol(["fechacierre"], 21);
    var idxFinProd = getCol(["finproduccion"], 23);
    var idxResponsable = getCol(["responsable"], 10);

    for (var i = 1; i < dataP.length; i++) {
      if (String(dataP[i][idxId]).trim() === targetId) {
        var rowIdx = i + 1;
        foundInPed = true;
        sheetPed.getRange(rowIdx, idxEstado + 1).setValue("Pendiente");
        sheetPed.getRange(rowIdx, idxCerrado + 1).setValue("No");
        sheetPed.getRange(rowIdx, idxFechaCierre + 1).setValue("");
        sheetPed.getRange(rowIdx, idxFinProd + 1).setValue("");
        
        var currentResp = String(dataP[i][idxResponsable] || "").trim();
        if (!currentResp || currentResp === "1" || !isNaN(currentResp)) {
          sheetPed.getRange(rowIdx, idxResponsable + 1).setValue(currentUser || "Valentina");
        }
        break;
      }
    }
  }

  if (sheetTerm) {
    var dataT = sheetTerm.getDataRange().getValues();
    for (var j = 1; j < dataT.length; j++) {
      if (String(dataT[j][0]).trim() === targetId) {
        orderDataToRestore = dataT[j];
        sheetTerm.deleteRow(j + 1);
        break;
      }
    }
  }

  if (!foundInPed && orderDataToRestore) {
    var fieldMapRestored = {
      "id": targetId,
      "fechaentrada": new Date().toISOString(),
      "cliente": orderDataToRestore[1],
      "tipo": orderDataToRestore[2],
      "motivo": orderDataToRestore[3],
      "entrega": orderDataToRestore[6],
      "responsable": orderDataToRestore[4] || currentUser || "Valentina",
      "estado": "Pendiente",
      "urgente": "No",
      "diseno": "Sí",
      "material": "Sí",
      "cerrado": "No",
      "comentariocierre": orderDataToRestore[10],
      "fotosreferencia": orderDataToRestore[11],
      "fotosevidencia": orderDataToRestore[12]
    };
    
    var hPed = ensureCanonicalHeaders_(sheetPed);
    var rRow = new Array(hPed.length).fill("");
    for (var cRest = 0; cRest < hPed.length; cRest++) {
      var kRest = String(hPed[cRest] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (fieldMapRestored.hasOwnProperty(kRest)) {
        rRow[cRest] = fieldMapRestored[kRest];
      }
    }
    sheetPed.appendRow(rRow);
  }

  return { ok: true, exito: true, mensaje: "Pedido " + targetId + " reabierto y devuelto a la lista de pedidos activos." };
}

// ==== 6. ELIMINAR PEDIDO (borra de Pedidos Y Proyectos_Terminados simultáneamente) ====
function ppEliminarPedido_(ss, params) {
  var targetId = String(params.id || params.targetId || params.pedidoId || "").trim();
  if (!targetId) throw new Error("ID de pedido requerido para eliminar.");
  var targetLower = targetId.toLowerCase();
  var deletedAny = false;

  // 1. Buscar y eliminar de Pedidos (todas las ocurrencias)
  var sheetPed = ss.getSheetByName("Pedidos");
  if (sheetPed && sheetPed.getLastRow() > 1) {
    var dataP = sheetPed.getDataRange().getValues();
    for (var i = dataP.length - 1; i >= 1; i--) {
      var rowP = dataP[i];
      var matchP = rowP.some(function(val) {
        return String(val).trim().toLowerCase() === targetLower;
      });
      if (matchP) {
        sheetPed.deleteRow(i + 1);
        deletedAny = true;
      }
    }
  }

  // 2. Buscar y eliminar de Proyectos_Terminados (todas las ocurrencias)
  var sheetTerm = ss.getSheetByName("Proyectos_Terminados");
  if (sheetTerm && sheetTerm.getLastRow() > 1) {
    var dataT = sheetTerm.getDataRange().getValues();
    for (var j = dataT.length - 1; j >= 1; j--) {
      var rowT = dataT[j];
      var matchT = rowT.some(function(val) {
        return String(val).trim().toLowerCase() === targetLower;
      });
      if (matchT) {
        sheetTerm.deleteRow(j + 1);
        deletedAny = true;
      }
    }
  }

  if (deletedAny) {
    return { ok: true, exito: true, mensaje: "Pedido " + targetId + " eliminado permanentemente de todas las hojas del sistema." };
  }

  throw new Error("Pedido no encontrado en ninguna hoja: " + targetId);
}

// ==== 7. GESTIÓN DE USUARIOS ====
function ppCrearUsuario_(ss, params) {
  var sheetU = getOrCreateSheetFlexible_(ss, "Usuarios", ["Users"], ["Nombre", "Rol", "PIN", "Activo"]);
  var uName = String(params.name || params.nombre || "").trim();
  var uRole = String(params.role || params.rol || "trabajador").trim().toLowerCase();
  var uPin = String(params.pin || "").trim();
  if (!uName || !uPin) throw new Error("Nombre y PIN son obligatorios.");
  
  sheetU.appendRow([uName, uRole, uPin, "Sí"]);
  return { ok: true, exito: true, mensaje: "Usuario creado." };
}

function ppToggleUsuario_(ss, params) {
  var sheetU = getOrCreateSheetFlexible_(ss, "Usuarios", ["Users"], ["Nombre", "Rol", "PIN", "Activo"]);
  var targetName = String(params.name || params.nombre || "").trim().toLowerCase();
  var activeVal = (params.active === true || params.active === "true" || params.activo === "Sí") ? "Sí" : "No";
  var dataU = sheetU.getDataRange().getValues();
  
  for (var i = 1; i < dataU.length; i++) {
    if (String(dataU[i][0]).trim().toLowerCase() === targetName) {
      sheetU.getRange(i + 1, 4).setValue(activeVal);
      return { ok: true, exito: true, mensaje: "Estado de usuario actualizado." };
    }
  }
  throw new Error("Usuario no encontrado.");
}

// ==== 8. GESTIÓN DE CLIENTES (con Delivery, Zona y Dirección) ====
function ppGuardarCliente_(ss, params) {
  var sheetC = getOrCreateSheetFlexible_(ss, "Clientes", ["Telefonos"], ["Nombre", "Telefono", "Delivery", "Zona", "Direccion"]);
  // Asegurar que la hoja tenga las 5 columnas de encabezado
  var headers = sheetC.getRange(1, 1, 1, sheetC.getLastColumn()).getValues()[0];
  var neededCols = ["Nombre", "Telefono", "Delivery", "Zona", "Direccion"];
  neededCols.forEach(function(col) {
    var colLower = col.toLowerCase();
    var found = headers.some(function(h) { return String(h).toLowerCase() === colLower; });
    if (!found) {
      sheetC.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });

  var name     = String(params.name     || params.nombre   || params.cliente  || "").trim();
  var phone    = String(params.phone    || params.telefono || params.celular  || "").trim();
  var delivery = String(params.delivery || "No").trim();
  var zona     = String(params.zona     || "").trim();
  var direccion= String(params.direccion|| "").trim();
  if (!name) throw new Error("Nombre del cliente no puede estar vacío.");

  // Actualizar si ya existe
  var dataC = sheetC.getDataRange().getValues();
  for (var i = 1; i < dataC.length; i++) {
    if (String(dataC[i][0]).toLowerCase().trim() === name.toLowerCase()) {
      sheetC.getRange(i + 1, 1, 1, 5).setValues([[name, phone || dataC[i][1], delivery, zona, direccion]]);
      return { ok: true, exito: true, mensaje: "Cliente actualizado." };
    }
  }

  sheetC.appendRow([name, phone, delivery, zona, direccion]);
  return { ok: true, exito: true, mensaje: "Cliente guardado." };
}

function ppEliminarCliente_(ss, params) {
  var sheetC = getOrCreateSheetFlexible_(ss, "Clientes", ["Telefonos"], ["Nombre", "Telefono"]);
  var target = String(params.name || params.nombre || params.cliente || "").trim().toLowerCase();
  var dataC = sheetC.getDataRange().getValues();
  for (var i = 1; i < dataC.length; i++) {
    if (String(dataC[i][0]).trim().toLowerCase() === target) {
      sheetC.deleteRow(i + 1);
      return { ok: true, exito: true, mensaje: "Cliente eliminado." };
    }
  }
  throw new Error("Cliente no encontrado.");
}

// ==== 9. GESTIÓN DE TIPOS DE TRABAJO ====
function ppGuardarTipo_(ss, params) {
  var sheetT = getOrCreateSheetFlexible_(ss, "Tipos", ["Tipos de Trabajo"], ["Tipo", "DiasEstimados"]);
  var type = String(params.type || params.tipo || params.nombre || "").trim();
  var dias = Number(params.dias || params.diasEstimados || 1);
  if (!type) throw new Error("El tipo de trabajo no puede estar vacío.");
  
  sheetT.appendRow([type, dias]);
  return { ok: true, exito: true, mensaje: "Tipo de trabajo guardado." };
}

function ppEliminarTipo_(ss, params) {
  var sheetT = getOrCreateSheetFlexible_(ss, "Tipos", ["Tipos de Trabajo"], ["Tipo"]);
  var target = String(params.type || params.tipo || "").trim().toLowerCase();
  var dataT = sheetT.getDataRange().getValues();
  for (var i = 1; i < dataT.length; i++) {
    if (String(dataT[i][0]).trim().toLowerCase() === target) {
      sheetT.deleteRow(i + 1);
      return { ok: true, exito: true, mensaje: "Tipo de trabajo eliminado." };
    }
  }
  throw new Error("Tipo de trabajo no encontrado.");
}

// ==== 10. GESTIÓN DE MOTIVOS ====
function ppGuardarMotivo_(ss, params) {
  var sheetM = getOrCreateSheetFlexible_(ss, "Motivos", ["Tematicas", "Temáticas"], ["Motivo"]);
  var motivo = String(params.motivo || params.motivo || params.nombre || params.name || "").trim();
  if (!motivo) throw new Error("El motivo no puede estar vacío.");
  var dataM = sheetM.getDataRange().getValues();
  var exists = dataM.some(function(r) { return String(r[0]).toLowerCase().trim() === motivo.toLowerCase(); });
  if (exists) return { ok: true, exito: true, mensaje: "El motivo ya existe." };
  sheetM.appendRow([motivo]);
  return { ok: true, exito: true, mensaje: "Motivo guardado." };
}

function ppEliminarMotivo_(ss, params) {
  var sheetM = ss.getSheetByName("Motivos");
  if (!sheetM) throw new Error("Hoja Motivos no encontrada.");
  var target = String(params.motivo || params.nombre || params.name || "").trim().toLowerCase();
  var dataM = sheetM.getDataRange().getValues();
  for (var i = 1; i < dataM.length; i++) {
    if (String(dataM[i][0]).trim().toLowerCase() === target) {
      sheetM.deleteRow(i + 1);
      return { ok: true, exito: true, mensaje: "Motivo eliminado." };
    }
  }
  throw new Error("Motivo no encontrado.");
}

// ==== AUXILIARES DE FECHAS Y BÚSQUEDA ====
function parseFechaISO_(val, horaVal) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString();
  var str = String(val).trim();
  
  var hStr = "18:00";
  if (horaVal) {
    var matchH = String(horaVal).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (matchH) {
      var hNum = parseInt(matchH[1], 10);
      var mNum = matchH[2];
      var ap = matchH[3] ? matchH[3].toUpperCase() : "";
      if (ap === "PM" && hNum < 12) hNum += 12;
      if (ap === "AM" && hNum === 12) hNum = 0;
      hStr = (hNum < 10 ? "0" + hNum : hNum) + ":" + mNum;
    }
  }
  
  if (!str.includes("T")) str += "T" + hStr + ":00";
  var d = new Date(str);
  return isNaN(d.getTime()) ? String(val) : d.toISOString();
}

function ensureCanonicalTerminadosHeaders_(sheetTerm) {
  var canonical = [
    "ID", "Cliente", "Tipo", "Motivo", "Responsable", "Estado", "Entrega", 
    "Inicio_produccion", "Fin_produccion", "Duracion_real_min", "Comentario_cierre", 
    "Fotos_Referencia", "Fotos_Evidencia", "Diseño", "Notas", "Costo"
  ];
  if (!sheetTerm) return canonical;
  if (sheetTerm.getLastRow() === 0) {
    sheetTerm.appendRow(canonical);
    return canonical;
  }
  
  var data = sheetTerm.getDataRange().getValues();
  var currentHeaders = data[0].map(function(h) { return String(h || "").trim(); });
  
  var hasMotivo = currentHeaders.some(function(h) {
    var k = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    return k === "motivo" || k === "tematica" || k === "temtica";
  });
  
  if (!hasMotivo) {
    sheetTerm.getRange(1, 1, 1, canonical.length).setValues([canonical]);
  } else {
    sheetTerm.getRange(1, 1, 1, canonical.length).setValues([canonical]);
  }
  return canonical;
}

function getOrCreateSheetFlexible_(ss, preferredName, altNames, headers) {
  var sheets = ss.getSheets();
  var candidates = [preferredName].concat(altNames || []);
  for (var c = 0; c < candidates.length; c++) {
    var target = candidates[c].toLowerCase().trim();
    for (var s = 0; s < sheets.length; s++) {
      if (sheets[s].getName().toLowerCase().trim() === target) {
        return sheets[s];
      }
    }
  }
  var newSheet = ss.insertSheet(preferredName);
  if (headers && headers.length) {
    newSheet.appendRow(headers);
  }
  return newSheet;
}

function makeColumnGetter_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (h) map[h] = i;
  }
  return function(possibleNames, defaultIdx) {
    for (var k = 0; k < possibleNames.length; k++) {
      var name = possibleNames[k].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (map.hasOwnProperty(name)) {
        return map[name];
      }
    }
    return defaultIdx;
  };
}

function ppHash_(val) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(val || ""));
  return rawHash.map(function(byte) {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0");
  }).join("");
}

// ==== 6b. ARCHIVAR PEDIDOS ANTIGUOS DE PROYECTOS TERMINADOS (> 60 DÍAS) ====
function ppArchivarPedidosAntiguos_(ss, params) {
  var sheetTerm = ss.getSheetByName("Proyectos_Terminados");
  if (!sheetTerm || sheetTerm.getLastRow() <= 1) {
    return { ok: true, exito: true, mensaje: "No hay proyectos terminados para archivar." };
  }

  var sheetHist = ss.getSheetByName("Proyectos_Terminados_Historico");
  if (!sheetHist) {
    sheetHist = ss.insertSheet("Proyectos_Terminados_Historico");
    sheetHist.appendRow([
      "ID", "Cliente", "Tipo", "Motivo", "Responsable", "Estado", "Entrega", "Inicio_produccion", "Fin_produccion", "Duracion_real_min", "Comentario_cierre", "Fotos_Referencia", "Fotos_Evidencia"
    ]);
  }

  var dataT = sheetTerm.getDataRange().getValues();
  var now = new Date();
  var cutoffDays = Number(params.days || 60);
  var cutoffMs = cutoffDays * 24 * 60 * 60 * 1000;
  var archivedCount = 0;

  for (var j = dataT.length - 1; j >= 1; j--) {
    var row = dataT[j];
    var finProdStr = row[8] || row[6] || "";
    var finDate = finProdStr ? new Date(finProdStr) : null;

    if (finDate && !isNaN(finDate.getTime())) {
      if (now.getTime() - finDate.getTime() > cutoffMs) {
        sheetHist.appendRow(row);
        sheetTerm.deleteRow(j + 1);
        archivedCount++;
      }
    }
  }

  return {
    ok: true,
    exito: true,
    mensaje: "Se archivaron " + archivedCount + " pedidos antiguos (> " + cutoffDays + " días) en Proyectos_Terminados_Historico."
  };
}

// ==== 6c. COSTOS E INGRESOS ====
function ppGuardarCosto_(ss, params) {
  var targetId = String(params.id || "").trim();
  var costo = Number(params.costo || 0);
  if (!targetId) throw new Error("ID de pedido requerido.");

  var updatedAny = false;

  var sheetPed = ss.getSheetByName("Pedidos");
  if (sheetPed && sheetPed.getLastRow() > 1) {
    var dataP = sheetPed.getDataRange().getValues();
    var headersP = dataP[0];
    var getColP = makeColumnGetter_(headersP);
    var idxIdP = getColP(["id"], 0);
    var idxCostoP = getColP(["costo", "precio", "monto"], -1);
    if (idxCostoP === -1) {
      idxCostoP = headersP.length;
      sheetPed.getRange(1, idxCostoP + 1).setValue("Costo");
    }
    for (var i = 1; i < dataP.length; i++) {
      if (String(dataP[i][idxIdP]).trim() === targetId) {
        sheetPed.getRange(i + 1, idxCostoP + 1).setValue(costo);
        updatedAny = true;
        break;
      }
    }
  }

  var sheetTerm = ss.getSheetByName("Proyectos_Terminados");
  if (sheetTerm && sheetTerm.getLastRow() > 1) {
    var dataT = sheetTerm.getDataRange().getValues();
    var headersT = dataT[0];
    var getColT = makeColumnGetter_(headersT);
    var idxIdT = getColT(["id"], 0);
    var idxCostoT = getColT(["costo", "precio", "monto"], -1);
    if (idxCostoT === -1) {
      idxCostoT = headersT.length;
      sheetTerm.getRange(1, idxCostoT + 1).setValue("Costo");
    }
    for (var j = 1; j < dataT.length; j++) {
      if (String(dataT[j][idxIdT]).trim() === targetId) {
        sheetTerm.getRange(j + 1, idxCostoT + 1).setValue(costo);
        updatedAny = true;
        break;
      }
    }
  }

  return { ok: true, exito: true, costo: costo, mensaje: "Costo/Precio de $" + costo.toFixed(2) + " guardado para el pedido " + targetId };
}

// ==== 6d. HORARIOS Y TURNOS DE TRABAJADORES (CON HISTÓRICO SEMANAL) ====
function ppObtenerHorarios_(ss) {
  var sheet = getOrCreateSheetFlexible_(ss, "Horarios", ["Schedules", "Turnos"], [
    "Semana", "Trabajador", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"
  ]);
  var data = sheet.getDataRange().getValues();
  var schedules = [];
  if (data.length <= 1) return schedules;
  
  var hasSemanaCol = String(data[0][0] || "").toLowerCase().includes("semana");
  var offset = hasSemanaCol ? 1 : 0;

  for (var i = 1; i < data.length; i++) {
    var sem = hasSemanaCol ? String(data[i][0] || "").trim() : "";
    var name = String(data[i][offset] || "").trim();
    if (!name) continue;
    schedules.push({
      semana: sem,
      trabajador: name,
      lunes: String(data[i][offset + 1] || "3:00 PM - 7:00 PM").trim(),
      martes: String(data[i][offset + 2] || "3:00 PM - 7:00 PM").trim(),
      miercoles: String(data[i][offset + 3] || "3:00 PM - 7:00 PM").trim(),
      jueves: String(data[i][offset + 4] || "3:00 PM - 7:00 PM").trim(),
      viernes: String(data[i][offset + 5] || "3:00 PM - 7:00 PM").trim(),
      sabado: String(data[i][offset + 6] || "Libre").trim(),
      domingo: String(data[i][offset + 7] || "Libre").trim()
    });
  }
  return schedules;
}

function ppGuardarHorario_(ss, params) {
  var sheet = getOrCreateSheetFlexible_(ss, "Horarios", ["Schedules", "Turnos"], [
    "Semana", "Trabajador", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"
  ]);
  
  var data = sheet.getDataRange().getValues();
  var hasSemanaCol = String(data[0][0] || "").toLowerCase().includes("semana");
  
  if (!hasSemanaCol && data.length > 0) {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue("Semana");
    data = sheet.getDataRange().getValues();
  }

  var semana = String(params.semana || "").trim();
  var trabajador = String(params.trabajador || "").trim();
  if (!trabajador) throw new Error("Nombre del trabajador requerido.");

  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    var rSem = String(data[i][0] || "").trim();
    var rTrab = String(data[i][1] || "").trim();
    if (rTrab.toLowerCase() === trabajador.toLowerCase() && (rSem === semana || (!semana && !rSem))) {
      foundRow = i + 1;
      break;
    }
  }

  var rowValues = [
    semana,
    trabajador,
    String(params.lunes || "Libre").trim(),
    String(params.martes || "Libre").trim(),
    String(params.miercoles || "Libre").trim(),
    String(params.jueves || "Libre").trim(),
    String(params.viernes || "Libre").trim(),
    String(params.sabado || "Libre").trim(),
    String(params.domingo || "Libre").trim()
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return { ok: true, exito: true, mensaje: "Horario guardado para " + trabajador + (semana ? " (Semana: " + semana + ")" : "") + "." };
}
