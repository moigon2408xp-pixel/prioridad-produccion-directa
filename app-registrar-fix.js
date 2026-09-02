/**
 * SISTEMA DE PRODUCCIÓN Y API WEB DE PRIORIDAD PRODUCCIÓN
 * Versión 11.0 Definitiva - Frontend JavaScript (app-registrar-fix.js)
 * "Creaciones JJ - Ochoa & Risquez"
 * Saneamiento visual de Responsable (de "1" a Valentina/Sin asignar) y
 * autocompletado inteligente de número de teléfono mediante directorio.
 */

const $ = (selector) => document.querySelector(selector);

const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};

// ==== 1. GESTIÓN Y INYECCIÓN REACTIVA DE TEMAS Y COLORES ====
function applyTheme() {
  const currentTheme = store.get("pp_theme", "light");
  const currentAccent = store.get("pp_accent", "blue");
  const customColors = store.get("pp_custom_colors", {});
  
  document.documentElement.setAttribute("data-theme", currentTheme);
  document.documentElement.setAttribute("data-accent", currentAccent);
  
  let styleEl = $("#dynamic-theme-style");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "dynamic-theme-style";
    document.head.appendChild(styleEl);
  }
  
  let cssRules = [];
  if (customColors.primary) {
    cssRules.push(`--primary-color: ${customColors.primary} !important;`);
    cssRules.push(`--primary-hover: ${customColors.primary} !important;`);
  }
  if (customColors.cardBg) {
    cssRules.push(`--bg-card: ${customColors.cardBg} !important;`);
  }
  if (customColors.textMain) {
    cssRules.push(`--text-main: ${customColors.textMain} !important;`);
  }
  if (customColors.mainBg) {
    cssRules.push(`--bg-main: ${customColors.mainBg} !important;`);
  }
  
  if (cssRules.length > 0) {
    styleEl.textContent = `:root, [data-theme="dark"], [data-theme="light"] { ${cssRules.join(" ")} }`;
  } else {
    styleEl.textContent = "";
  }

  const icon = $("#theme-icon");
  if (icon) icon.textContent = currentTheme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const currentTheme = store.get("pp_theme", "light");
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  store.set("pp_theme", nextTheme);
  applyTheme();
}

function setAccent(color) {
  store.remove("pp_custom_colors");
  store.set("pp_accent", color);
  applyTheme();
  showToast("Tema de color cambiado.");
}

function saveCustomColor(key, value) {
  const customColors = store.get("pp_custom_colors", {});
  customColors[key] = value;
  store.set("pp_custom_colors", customColors);
  applyTheme();
}

function resetCustomTheme() {
  store.remove("pp_custom_colors");
  store.set("pp_theme", "light");
  store.set("pp_accent", "blue");
  applyTheme();
  showToast("Tema restablecido a valores por defecto.");
}

window.toggleTheme = toggleTheme;
window.setAccent = setAccent;
window.saveCustomColor = saveCustomColor;
window.resetCustomTheme = resetCustomTheme;

function cleanPhoneNumber(phone = "") {
  let num = String(phone || "").replace(/\D/g, "");
  if (!num) return "";
  if (num.startsWith("0")) num = "58" + num.slice(1);
  else if (num.length === 10 && !num.startsWith("58")) num = "58" + num;
  return num;
}

// ==== 2. FORMATEO Y PARSEO DE FECHAS ESTANDARIZADO ====
function safeParseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  let str = String(value).trim();
  if (!str) return null;
  
  if (str.includes(" - ")) str = str.split(" - ")[0];
  if (str.includes(" a las ")) str = str.split(" a las ")[0];
  
  var isoMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  var timeMatch = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  
  if (isoMatch) {
    var year = parseInt(isoMatch[1], 10);
    var month = parseInt(isoMatch[2], 10) - 1;
    var day = parseInt(isoMatch[3], 10);
    var hours = 18;
    var minutes = 0;
    
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      var ap = timeMatch[3] ? timeMatch[3].toUpperCase() : "";
      if (ap === "PM" && hours < 12) hours += 12;
      if (ap === "AM" && hours === 12) hours = 0;
    }
    
    const parsedISO = new Date(year, month, day, hours, minutes);
    if (!isNaN(parsedISO.getTime())) return parsedISO;
  }
  
  if (str.includes("/")) {
    const parts = str.split(" ")[0].split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const date = safeParseDate(value);
  if (!date) return value ? String(value) : "Sin fecha";
  try {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} a las ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  } catch (e) {
    return String(value);
  }
}

// Universal Normalizers
const normalizeClient = (c) => {
  if (!c) return { name: '', phone: '', delivery: 'No', zona: '', direccion: '' };
  if (Array.isArray(c)) {
    return {
      name: String(c[0] || '').trim(),
      phone: cleanPhoneNumber(c[1] || ''),
      delivery: String(c[2] || 'No').trim(),
      zona: String(c[3] || '').trim(),
      direccion: String(c[4] || '').trim()
    };
  }
  if (typeof c === 'object') {
    return {
      name: String(c.name || c.nombre || c.Nombre || c.cliente || c[0] || '').trim(),
      phone: cleanPhoneNumber(c.phone || c.telefono || c.Telefono || c.celular || c.tel || c[1] || ''),
      delivery: String(c.delivery || c.Delivery || 'No').trim(),
      zona: String(c.zona || c.Zona || '').trim(),
      direccion: String(c.direccion || c.Direccion || '').trim()
    };
  }
  return { name: String(c).trim(), phone: '', delivery: 'No', zona: '', direccion: '' };
};

const normalizeType = (t) => {
  if (!t) return "";
  if (Array.isArray(t)) return String(t[0] || "").trim();
  if (typeof t === "object") {
    return String(t.type || t.tipo || t.Tipo || t.nombre || t.trabajo || t.name || t[0] || "").trim();
  }
  return String(t).trim();
};

const normalizeOrder = (o) => {
  let resp = String(o.responsable || o.Responsable || "").trim();
  if (!resp || resp === "1" || !isNaN(resp)) {
    resp = "Valentina"; // Fallback a Valentina si era "1" por desfasamiento
  }

  let phone = cleanPhoneNumber(o.telefono || o.Telefono || o['Teléfono'] || o.phone || "");

  return {
    id: String(o.id || o['ID Pedido'] || o.ID || "").trim(),
    cliente: String(o.cliente || o.Cliente || "Sin cliente").trim(),
    tipo: String(o.tipo || o['Tipo de trabajo'] || o.Tipo || o.trabajo || "Sin tipo").trim(),
    motivo: String(o.motivo || o.Motivo || o['Temática'] || o.tematica || "").trim(),
    descripcion: String(o.descripcion || o.Descripción || "").trim(),
    entrega: String(o.entrega || o['Fecha entrega'] || o.Entrega || "").trim(),
    responsable: resp,
    estado: String(o.estado || o.Estado || "Pendiente").trim(),
    diseno: String(o.diseno || o.diseño || "No").trim(),
    material: String(o.material || o.Material || "No").trim(),
    notas: String(o.notas || o.Notas || o.observaciones || o.Observaciones || "").trim(),
    telefono: phone,
    comentarioCierre: String(o.comentarioCierre || o.Comentario_cierre || "").trim(),
    fotoReferencia: String(o.fotoReferencia || o.Fotos_Referencia || o.referencias || "").trim(),
    fotoEvidencia: String(o.fotoEvidencia || o.Evidencias_Drive || o.evidenciasDrive || o.foto || "").trim(),
    inicioProduccion: String(o.inicioProduccion || o.Inicio_produccion || "").trim(),
    finProduccion: String(o.finProduccion || o.Fin_produccion || "").trim(),
    duracionRealMin: Number(o.duracionRealMin || o.Duracion_real_min || 0),
    ultimaPausa: String(o.ultimaPausa || o.UltimaPausa || "").trim(),
    tiempoPausadoMin: Number(o.tiempoPausadoMin || o.TiempoPausadoMin || 0),
    cerrado: String(o.cerrado || o.Cerrado || "No").trim()
  };
};

const normalizeUser = (u) => {
  if (!u) return { name: "", role: "trabajador", active: true };
  if (Array.isArray(u)) {
    const isActArr = String(u[3] || "Sí").toLowerCase() === "sí" || u[3] === true || String(u[3]).toLowerCase() === "true";
    return { name: String(u[0] || "").trim(), role: String(u[1] || "trabajador").toLowerCase().trim(), active: isActArr };
  }
  const isAct = typeof u.active === "boolean" ? u.active : (typeof u.activo === "boolean" ? u.activo : (String(u.active || u.activo || "Sí").toLowerCase() === "sí" || String(u.active || u.activo).toLowerCase() === "true"));
  return {
    name: String(u.name || u.nombre || u.Nombre || "").trim(),
    role: String(u.role || u.rol || u.Perfil || "trabajador").toLowerCase().trim(),
    active: isAct
  };
};

const state = {
  session: store.get("pp_profile_session", null),
  frequentClients: [],
  frequentMotivos: [],
  frequentTypes: [],
  waTemplate: store.get("pp_wa_template", "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega."),
  screen: "now",
  searchQuery: "",
  perfTimeframe: "today",
  offline: false,
  data: { myOrders: [], teamCritical: [], allOrders: [], finishedOrders: [], users: [], dailyPerformance: {} },
};

const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));

// ==== 3. CÁLCULO DE PRIORIDAD Y COMPLEJIDAD ====
const getEstimatedPrepDays = (tipo = "") => {
  const t = tipo.toLowerCase();
  if (t.includes("maqueta") || t.includes("caja explosiva") || t.includes("estructura")) return 4;
  if (t.includes("piñata") || t.includes("banderín")) return 2;
  return 1;
};

const priority = (order) => {
  const deliveryDate = safeParseDate(order.entrega);
  if (!deliveryDate) return "now";
  
  const now = new Date();

  const deliveryInfo = (state.frequentClients || []).find(
    c => c.name.toLowerCase() === (order.cliente || "").toLowerCase()
  );
  const hasDelivery = deliveryInfo && deliveryInfo.delivery === "Sí";
  
  let targetDeadline = new Date(deliveryDate);
  if (hasDelivery) {
    // Para pedidos con delivery, el límite de producción es el día anterior a las 8:00 PM (fin de jornada)
    targetDeadline.setDate(targetDeadline.getDate() - 1);
    targetDeadline.setHours(20, 0, 0, 0);
  }

  if (targetDeadline < now) return "overdue";
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const checkDate = new Date(targetDeadline);
  checkDate.setHours(0, 0, 0, 0);
  
  const prepDays = getEstimatedPrepDays(order.tipo);
  const diffDays = Math.ceil((checkDate - todayStart) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0 || diffDays <= prepDays) return "now";
  if (diffDays <= prepDays + 1) return "today";
  return "later";
};

const priorityLabel = {
  overdue: "🚨 ¡RETRASADO!",
  now: "Hacer ahora",
  today: "Hacer hoy",
  later: "Programar"
};

const active = (order) => {
  const est = String(order.estado || "").toLowerCase().trim();
  const cer = String(order.cerrado || "").toLowerCase().trim();
  return cer !== "sí" && cer !== "si" && est !== "terminado" && est !== "entregado" && est !== "cancelado";
};

const operable = (order) => active(order);
const isLead = () => {
  const r = String(state.session?.role || "").toLowerCase().trim();
  return ["manager", "jefe", "jefa"].includes(r);
};

function formatRoleLabel(roleStr) {
  const r = String(roleStr || "").toLowerCase().trim();
  if (r === "jefe") return "Jefe";
  if (r === "jefa") return "Jefa";
  if (r === "manager") return "Manager";
  if (r === "trabajadora") return "Trabajadora";
  return "Trabajador";
}

function getLocalDateStr(d = new Date()) {
  const dateObj = (typeof d === "string" || typeof d === "number") ? new Date(d) : d;
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const day = dateObj.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function compressImageFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: "image/jpeg",
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = String(message || "Operación realizada");
  toast.classList.add("show");
  clearTimeout(window.ppToast);
  window.ppToast = setTimeout(() => toast.classList.remove("show"), 3200);
}

function generateTimeOptions(selectedTime = "11:00 AM") {
  const hours = [
    "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
    "07:00 PM", "08:00 PM", "09:00 PM"
  ];
  return hours.map(h => `<option value="${h}" ${h === selectedTime ? "selected" : ""}>${h}</option>`).join("");
}

// ==== 4. PEGADO MÁGICO AVANZADO PARA REPOSTERAS Y WHATSAPP ====
function parseMagicPasteText(rawText) {
  const result = {
    cliente: "",
    telefono: "",
    tipo: "",
    motivo: "",
    fechaEntrega: "",
    horaEntrega: "11:00 AM",
    descripcion: rawText.trim()
  };
  
  if (!rawText) return result;
  
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  
  // 1. Detección de Cliente / Nombre
  const clienteMatch = rawText.match(/(?:cliente|nombre|para|festejado|comprador|de)[:\s]+([^\n\r,*]+)/i);
  if (clienteMatch) {
    result.cliente = clienteMatch[1].trim();
  } else {
    // Buscar en directorio de clientes guardados
    for (const c of (state.frequentClients || [])) {
      if (c.name && rawText.toLowerCase().includes(c.name.toLowerCase())) {
        result.cliente = c.name;
        if (c.phone) result.telefono = c.phone;
        break;
      }
    }
    if (!result.cliente && lines.length > 0 && !lines[0].includes(":")) {
      result.cliente = lines[0].replace(/^(?:hola|buenas|saludos|de)\b,?\s*/i, "").trim();
    }
  }
  
  // 2. Teléfono / WhatsApp
  if (!result.telefono) {
    const phoneMatch = rawText.match(/(\+?58\s?)?0?4\d{2}[\s-]?\d{7}|\b\d{10,11}\b/);
    if (phoneMatch) {
      result.telefono = cleanPhoneNumber(phoneMatch[0]);
    }
  }
  
  // 3. Motivo / Temática
  const motivoMatch = rawText.match(/(?:motivo|temática|tematica|tema|personaje|temática\/motivo)[:\s]+([^\n\r,*]+)/i);
  if (motivoMatch) {
    result.motivo = motivoMatch[1].trim();
  } else {
    for (const m of (state.frequentMotivos || [])) {
      if (m && rawText.toLowerCase().includes(m.toLowerCase())) {
        result.motivo = m;
        break;
      }
    }
  }

  // 4. Tipo de Trabajo
  const typeMatch = rawText.match(/(?:tipo|trabajo|producto|servicio|item|pedido)[:\s]+([^\n\r,*]+)/i);
  if (typeMatch) {
    result.tipo = typeMatch[1].trim();
  } else {
    for (const t of (state.frequentTypes || [])) {
      if (t && rawText.toLowerCase().includes(t.toLowerCase())) {
        result.tipo = t;
        break;
      }
    }
    if (!result.tipo) {
      if (/topper/i.test(rawText)) result.tipo = "Topper";
      else if (/piñata|pinata/i.test(rawText)) result.tipo = "Piñata";
      else if (/maqueta/i.test(rawText)) result.tipo = "Maqueta";
      else if (/banderín|banderin/i.test(rawText)) result.tipo = "Banderín";
      else if (/caja/i.test(rawText)) result.tipo = "Caja Explosiva";
    }
  }
  
  // 5. Fecha de Entrega (Días de la semana, 'mañana', 'hoy', o fechas DD/MM/YYYY)
  const lowerText = rawText.toLowerCase();
  const today = new Date();
  
  if (/\bmañana\b/.test(lowerText)) {
    const tom = new Date(today);
    tom.setDate(tom.getDate() + 1);
    result.fechaEntrega = tom.toISOString().split("T")[0];
  } else if (/\bhoy\b/.test(lowerText)) {
    result.fechaEntrega = today.toISOString().split("T")[0];
  } else {
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado"];
    const dayMatch = rawText.match(/(?:entregar|fecha|para|el)[:\s]*([a-záéíóúñ]+)/i);
    
    if (dayMatch) {
      const matchedWord = dayMatch[1].toLowerCase();
      const dayIdx = dayNames.findIndex(d => matchedWord.includes(d));
      
      if (dayIdx !== -1) {
        const targetDayOfWeek = (dayIdx === 4) ? 3 : (dayIdx === 8 ? 6 : (dayIdx > 4 ? dayIdx - 1 : dayIdx));
        const currentDayOfWeek = today.getDay();
        
        let diff = targetDayOfWeek - currentDayOfWeek;
        if (diff <= 0) diff += 7;
        
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + diff);
        result.fechaEntrega = targetDate.toISOString().split("T")[0];
      }
    }
  }

  if (!result.fechaEntrega) {
    const dateMatch = rawText.match(/(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/);
    if (dateMatch) {
      const parsedDate = safeParseDate(dateMatch[0]);
      if (parsedDate) {
        result.fechaEntrega = parsedDate.toISOString().split("T")[0];
      }
    }
  }
  
  // 6. Hora de Entrega
  const timeMatch = rawText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    let hourNum = parseInt(timeMatch[1], 10);
    const minStr = timeMatch[2] || "00";
    const ampm = timeMatch[3].toUpperCase();
    if (hourNum < 10) hourNum = "0" + hourNum;
    result.horaEntrega = `${hourNum}:${minStr} ${ampm}`;
  }

  return result;
}

// HTTP API Fetch Handler
async function api(action, extra = {}) {
  const baseUrl = window.PRIORIDAD_CONFIG?.appsScriptUrl || "https://script.google.com/macros/s/AKfycby_mIt5VzEOZjKb6znpYXH_T0Q0jJfEqr5UB1Z8l0JpUiHfEC9CuRuK9z2s_Q3lNl6www/exec";
  const payload = { action, user: state.session?.name || "", token: state.session?.token || "", ...extra };
  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data && (data.ok || data.exito)) return data;
    throw new Error(data?.error || data?.mensaje || "Error al procesar la solicitud.");
  } catch (err) {
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error("Error de conexión con Google Sheets. Verifica tu internet.");
    }
    throw err;
  }
}

async function refresh(showMessage = true) {
  const btnRefresh = $("#refresh");
  if (btnRefresh) btnRefresh.textContent = "…";
  try {
    const response = await api("profile_dashboard");
    const rawData = response.data || response || {};
    
    const rawClients = rawData.frequentClients || rawData.clients || rawData.clientes || rawData.telefonos || [];
    const rawTypes = rawData.frequentTypes || rawData.types || rawData.tipos || rawData.tiposTrabajo || [];
    
    state.frequentClients = rawClients.map(normalizeClient).filter(c => c.name && c.name.toLowerCase() !== "nombre");
    state.frequentTypes = rawTypes.map(normalizeType).filter(t => t && t.toLowerCase() !== "tipo");
    
    const rawMotivos = rawData.motivos || rawData.frequentMotivos || [];
    state.frequentMotivos = rawMotivos.filter(m => m && m.toLowerCase() !== 'motivo');
    
    // Auto-sanar teléfonos de pedidos a través del catálogo de clientes
    const sanitizeOrderPhone = (ord) => {
      if (!ord.telefono && ord.cliente) {
        const found = state.frequentClients.find(c => c.name.toLowerCase() === ord.cliente.toLowerCase());
        if (found && found.phone) ord.telefono = found.phone;
      }
      return ord;
    };

    state.data = {
      myOrders: (rawData.myOrders || []).map(normalizeOrder).map(sanitizeOrderPhone),
      teamCritical: (rawData.teamCritical || []).map(normalizeOrder).map(sanitizeOrderPhone),
      allOrders: (rawData.allOrders || rawData.allorders || []).map(normalizeOrder).map(sanitizeOrderPhone),
      finishedOrders: (rawData.finishedOrders || rawData.pedidosTerminados || []).map(normalizeOrder).map(sanitizeOrderPhone),
      users: (rawData.allUsers || rawData.users || []).map(normalizeUser),
      dailyPerformance: rawData.dailyPerformance || {}
    };
    
    state.waTemplate = rawData.waTemplate || state.waTemplate;
    state.offline = false;
    
    store.set("pp_profile_data", state.data);
    render();
    checkAndSendPushNotifications();
    if (showMessage) showToast("Información sincronizada.");
  } catch (error) {
    console.error("Error al sincronizar:", error);
    state.offline = true;
    render();
    const errMsg = (error && error.message) ? error.message : "Modo sin conexión.";
    if (showMessage) showToast(errMsg);
  } finally {
    if (btnRefresh) btnRefresh.textContent = "↻";
  }
}
window.cargarDatos = refresh;

function checkAndSendPushNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  const currentUser = state.session ? String(state.session.name || "").toLowerCase().trim() : "";
  const all = state.data.allOrders || [];
  
  // 1. Notificar pedidos retrasados
  const overdue = all.filter(o => active(o) && priority(o) === "overdue");
  if (overdue.length > 0) {
    const key = `push_overdue_${new Date().toISOString().split('T')[0]}_${overdue.length}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      new Notification("🚨 Alerta Creaciones JJ: Pedidos Retrasados", {
        body: `¡Atención! Hay ${overdue.length} pedido(s) retrasado(s) que pasaron la hora límite en el taller.`,
        icon: "./logo_creaciones_jj.png"
      });
    }
  }
  
  // 2. Notificar al trabajador sus tareas pendientes
  if (currentUser) {
    const myPending = all.filter(o => active(o) && String(o.responsable || "").toLowerCase().trim() === currentUser);
    if (myPending.length > 0) {
      const key2 = `push_mypending_${new Date().toISOString().split('T')[0]}_${myPending.length}`;
      if (!sessionStorage.getItem(key2)) {
        sessionStorage.setItem(key2, "1");
        new Notification(`📋 Creaciones JJ: Hola ${state.session.name}`, {
          body: `Tienes ${myPending.length} pedido(s) activo(s) asignado(s) en tu cola de trabajo.`,
          icon: "./logo_creaciones_jj.png"
        });
      }
    }
  }
}

function priorityPill(order) {
  const val = priority(order);
  const isOverdue = val === "overdue";
  const bgStyle = isOverdue ? 'background-color:#d32f2f; color:white; font-weight:bold; padding:4px 8px; border-radius:4px;' : '';
  return `<span class="priority priority-${val}" style="${bgStyle}">${priorityLabel[val]}</span>`;
}

function orderCard(order, position) {
  const prio = priority(order);
  const isOverdue = prio === 'overdue';
  const isNow = prio === 'now';
  const isToday = prio === 'today';
  
  let cardClass = 'order-card-compact';
  if (isOverdue) cardClass += ' card-overdue';
  else if (isNow) cardClass += ' card-urgent';
  else if (isToday) cardClass += ' card-today';
  
  const deliveryInfo = state.frequentClients.find(
    c => c.name.toLowerCase() === order.cliente.toLowerCase()
  );
  const hasDelivery = deliveryInfo && deliveryInfo.delivery === 'Sí';
  
  const entregaDate = safeParseDate(order.entrega);
  let deadlineInterno = '';
  if (hasDelivery && entregaDate) {
    const prev = new Date(entregaDate);
    prev.setDate(prev.getDate() - 1);
    deadlineInterno = `⚠️ Listo para: ${prev.getDate().toString().padStart(2,'0')}/${(prev.getMonth()+1).toString().padStart(2,'0')} (día anterior por delivery)`;
  }
  
  const disenoVal = order.diseno || "Sí";
  let disenoBadge = '';
  if (disenoVal === "No") {
    disenoBadge = `<span style="background:#fee2e2; color:#dc2626; font-size:10px; font-weight:800; padding:1px 6px; border-radius:20px;">🎨 Diseño: PENDIENTE ❌</span>`;
  } else if (disenoVal === "En proceso") {
    disenoBadge = `<span style="background:#fef3c7; color:#d97706; font-size:10px; font-weight:800; padding:1px 6px; border-radius:20px;">🎨 Diseño: En proceso ✏️</span>`;
  } else {
    disenoBadge = `<span style="background:#dcfce7; color:#15803d; font-size:10px; font-weight:800; padding:1px 6px; border-radius:20px;">🎨 Diseño: Listo ✅</span>`;
  }

  return `<button class="${cardClass}" data-action="detail" data-id="${escapeHtml(order.id)}">
    <div class="cc-top">
      <div class="cc-left">
        <span class="cc-id">${escapeHtml(order.id)}</span>
        <span class="cc-client">${escapeHtml(order.cliente)}</span>
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:2px;">
          ${order.motivo ? `<span class="badge-motivo-sm">🎨 ${escapeHtml(order.motivo)}</span>` : ''}
          ${disenoBadge}
          ${hasDelivery ? `<span class="badge-delivery">🚚 ${escapeHtml(deliveryInfo.zona || 'Delivery')}</span>` : ''}
        </div>
      </div>
      <div class="cc-right">
        ${isOverdue ? '<span class="pill-overdue">🚨 RETRASADO</span>' : ''}
        ${isNow && !isOverdue ? '<span class="pill-urgent">⚡ Hacer ahora</span>' : ''}
        ${isToday && !isOverdue ? '<span class="pill-today">⏰ Hoy</span>' : ''}
        ${!isOverdue && !isNow && !isToday ? '<span class="pill-later">📅 Programado</span>' : ''}
      </div>
    </div>
    <div class="cc-meta">
      <span>${escapeHtml(order.tipo || 'Sin tipo')}</span>
      <span>·</span>
      <span>${escapeHtml(formatDate(order.entrega))}</span>
      <span>·</span>
      <span>${escapeHtml(order.responsable)}</span>
      ${order.telefono ? `<span>·</span><span>📞 ${escapeHtml(order.telefono)}</span>` : ''}
    </div>
    ${deadlineInterno ? `<div class="cc-delivery-warning">${deadlineInterno}</div>` : ''}
    ${order.notas ? `<div style="font-size:11px; color:#d97706; background:rgba(217,119,6,.1); border:1px solid rgba(217,119,6,.3); border-radius:4px; padding:3px 8px; margin-top:2px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📝 ${escapeHtml(order.notas.split('\n').pop() || order.notas)}</div>` : ''}
  </button>`;
}

function filterOrdersBySearch(orders = []) {
  if (!state.searchQuery.trim()) return orders;
  const q = state.searchQuery.toLowerCase().trim();
  return orders.filter(o => {
    return (
      o.id.toLowerCase().includes(q) ||
      o.cliente.toLowerCase().includes(q) ||
      o.tipo.toLowerCase().includes(q) ||
      o.motivo.toLowerCase().includes(q) ||
      o.responsable.toLowerCase().includes(q) ||
      o.descripcion.toLowerCase().includes(q) ||
      o.telefono.includes(q) ||
      formatDate(o.entrega).toLowerCase().includes(q)
    );
  });
}

function sortOrdersByUrgency(orders) {
  return orders.slice().sort((a, b) => {
    const prioOrder = { overdue: 0, now: 1, today: 2, later: 3 };
    const pA = prioOrder[priority(a)];
    const pB = prioOrder[priority(b)];
    if (pA !== pB) return pA - pB;
    const dA = safeParseDate(a.entrega) || new Date(9999, 0, 1);
    const dB = safeParseDate(b.entrega) || new Date(9999, 0, 1);
    return dA - dB;
  });
}

function getMyOpenOrders() {
  const currentUser = String(state.session?.name || "").toLowerCase().trim();
  return sortOrdersByUrgency(
    (state.data.allOrders || []).filter(o => active(o) && String(o.responsable).toLowerCase().trim() === currentUser)
  );
}

function nowView() {
  const myOpenOrders = getMyOpenOrders();
  const next = myOpenOrders[0];
  const critical = sortOrdersByUrgency(
    (state.data.allOrders || []).filter(o => active(o) && ["overdue", "now"].includes(priority(o)))
  );
  const overdueOrders = sortOrdersByUrgency(
    (state.data.allOrders || []).filter(o => active(o) && priority(o) === 'overdue')
  );
  const urgentOrders = sortOrdersByUrgency(
    (state.data.allOrders || []).filter(o => active(o) && priority(o) === 'now')
  );
  const criticalBanner = (overdueOrders.length > 0 || urgentOrders.length > 0) ? `
    <div class="critical-banner">
      <div class="critical-banner-inner">
        ${overdueOrders.length > 0 ? `<span class="banner-overdue">\ud83d\udea8 ${overdueOrders.length} RETRASADO${overdueOrders.length>1?'S':''}</span>` : ''}
        ${urgentOrders.length > 0 ? `<span class="banner-urgent">\u26a1 ${urgentOrders.length} HACER AHORA</span>` : ''}
        <span class="banner-hint">Revisa las tarjetas marcadas</span>
      </div>
    </div>` : '';

  return `${criticalBanner}${state.offline ? '<p class="offline">Mostrando informaci\u00f3n guardada localmente.</p>' : ""}
  ${next ? `<article class="hero-card" style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); box-shadow:var(--shadow-md); margin-bottom:20px;"><p class="eyebrow">TU SIGUIENTE TRABAJO PRIORITARIO (${escapeHtml(next.id)})</p>${priorityPill(next)}<h2 style="margin-top:10px;">${escapeHtml(next.cliente)}</h2><p style="color:var(--text-muted); margin-bottom:12px;">${escapeHtml(next.tipo)} ${next.motivo ? `(${escapeHtml(next.motivo)})` : ''} · Entrega: ${escapeHtml(formatDate(next.entrega))}</p><div class="actions"><button class="primary-button" data-action="detail" data-id="${escapeHtml(next.id)}">Ver detalle completo</button></div></article>` : '<div class="empty"><strong>Tu cola de trabajo está al día.</strong></div>'}
  <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-bottom:10px;">CRÍTICOS DEL EQUIPO</p>
  <div class="order-list">${critical.map(orderCard).join("") || '<div class="team-note">No hay pedidos críticos en el taller.</div>'}</div>`;
}

function queueView() {
  const list = getMyOpenOrders();
  return list.length ? `<div class="order-list">${list.map(orderCard).join("")}</div>` : '<div class="empty"><strong>No tienes pedidos asignados pendientes en tu bandeja</strong></div>';
}

function historyView() {
  const rawOrders = state.data.finishedOrders || [];
  const orders = filterOrdersBySearch(rawOrders);
  
  return `
    <div class="search-bar-container" style="margin-bottom:16px;">
      <span>🔍</span>
      <input type="text" id="history-search-input" placeholder="Buscar por cliente, teléfono, motivo, ID (PED-0001) o trabajador..." value="${escapeHtml(state.searchQuery)}">
    </div>
    ${!orders.length ? '<div class="empty"><strong>No hay proyectos terminados que coincidan con la búsqueda.</strong></div>' : `
      <div class="order-list">${orders.map((order) => {
        const refLinks = String(order.fotoReferencia || "").split("\n").filter(Boolean);
        const eviLinks = String(order.fotoEvidencia || "").split("\n").filter(Boolean);
        
        return `
          <article class="order-card">
            <div class="order-top" data-action="detail" data-id="${escapeHtml(order.id)}">
              <div>
                <h3>${escapeHtml(order.cliente)} <small style="font-size:12px; color:var(--text-muted);">(${escapeHtml(order.id)})</small></h3>
                <p>${escapeHtml(order.tipo)}</p>
                ${order.motivo ? `<span class="badge-motivo">🎨 Motivo: ${escapeHtml(order.motivo)}</span>` : ''}
              </div>
              <span class="priority" style="background:#2e7d32; color:white; padding:4px 8px; border-radius:4px;">${escapeHtml(order.estado)}</span>
            </div>
            <div class="meta" data-action="detail" data-id="${escapeHtml(order.id)}">
              Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>
              Responsable: ${escapeHtml(order.responsable)}<br/>
              ⏱️ Tiempo invertido: <strong>${order.duracionRealMin || 0} min</strong><br/>
              ${order.comentarioCierre ? `<strong>Observación:</strong> ${escapeHtml(order.comentarioCierre)}<br/>` : ""}
              ${order.notas ? `<div style="font-size:12px; color:#d97706; margin-top:4px; font-weight:600;">📝 <strong>Bitácora:</strong> ${escapeHtml(order.notas.split('\n').pop() || order.notas)}</div>` : ""}
              
              ${refLinks.length ? `
                <div style="margin-top:6px;">
                  <strong style="font-size:12px;">🖼️ Fotos de Referencia del Cliente:</strong><br/>
                  ${refLinks.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="ref-photo-badge">🖼️ Ref ${idx + 1}</a>`).join("")}
                </div>
              ` : ''}
              
              ${eviLinks.length ? `
                <div style="margin-top:6px;">
                  <strong style="font-size:12px;">📷 Fotos de Evidencia de Cierre:</strong><br/>
                  ${eviLinks.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="evi-photo-badge">📷 Evidencia ${idx + 1}</a>`).join("")}
                </div>
              ` : ''}
            </div>
            ${isLead() ? `
              <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                <button class="secondary-button" style="background:var(--primary-color); color:white; border:none; flex:1;" data-action="reopen-order" data-id="${escapeHtml(order.id)}">🔄 Reabrir Proyecto</button>
                ${order.estado !== "Entregado" ? `<button class="secondary-button" style="background:var(--success-color); color:white; border:none; flex:1;" data-action="mark-delivered" data-id="${escapeHtml(order.id)}">📦 Marcar Entregado</button>` : ''}
              </div>
            ` : ''}
          </article>
        `;
      }).join('')}</div>
    `}
  `;
}

function teamView() {
  const rawOrders = sortOrdersByUrgency((state.data.allOrders || []).filter(active));
  const orders = filterOrdersBySearch(rawOrders);
  
  return `
    ${(() => {
      const ov = sortOrdersByUrgency((state.data.allOrders||[]).filter(o=>active(o)&&priority(o)==='overdue'));
      const urg = sortOrdersByUrgency((state.data.allOrders||[]).filter(o=>active(o)&&priority(o)==='now'));
      return (ov.length > 0 || urg.length > 0) ? `
        <div class="critical-banner" style="margin-bottom:12px;">
          <div class="critical-banner-inner">
            ${ov.length > 0 ? `<span class="banner-overdue">\ud83d\udea8 ${ov.length} RETRASADO${ov.length>1?'S':''}</span>` : ''}
            ${urg.length > 0 ? `<span class="banner-urgent">\u26a1 ${urg.length} URGENTE${urg.length>1?'S':''}</span>` : ''}
          </div>
        </div>` : '';
    })()}
    <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
      <button class="primary-button" data-action="new-order">＋ Registrar pedido</button>
    </div>
    <div class="search-bar-container" style="margin-bottom:16px;">
      <span>🔍</span>
      <input type="text" id="team-search-input" placeholder="Buscar por cliente, teléfono, motivo, ID o trabajador..." value="${escapeHtml(state.searchQuery)}">
    </div>
    <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-bottom:10px;">TODOS LOS PEDIDOS ACTIVOS DEL TALLER (${orders.length})</p>
    <div class="order-list">${orders.map(orderCard).join("") || '<div class="team-note">No hay pedidos activos que coincidan con la búsqueda.</div>'}</div>
  `;
}

function computeWorkerPerformance(timeframe = "today") {
  const finished = state.data.finishedOrders || [];
  const users = (state.data.users || []).filter(u => u.active);
  const now = new Date();
  
  let filterFn = () => true;
  
  if (timeframe === "today") {
    const todayLocal = getLocalDateStr(now);
    filterFn = (o) => {
      if (!o.finProduccion) return false;
      return getLocalDateStr(o.finProduccion) === todayLocal;
    };
  } else if (timeframe === "week") {
    const day = now.getDay();
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0,0,0,0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    
    filterFn = (o) => {
      if (!o.finProduccion) return false;
      const d = new Date(o.finProduccion);
      return d >= monday && d <= sunday;
    };
  } else if (timeframe === "month") {
    const monthIso = now.toISOString().substring(0, 7);
    filterFn = (o) => {
      if (!o.finProduccion) return false;
      return String(o.finProduccion).startsWith(monthIso);
    };
  }
  
  const filtered = finished.filter(filterFn);
  const perfMap = {};
  
  users.forEach(u => {
    perfMap[u.name] = { completed: 0, totalMin: 0, orders: [] };
  });
  
  filtered.forEach(o => {
    if (String(o.estado || "").toLowerCase().trim() === "cancelado") return;
    const w = o.responsable || "Sin asignar";
    if (!perfMap[w]) {
      perfMap[w] = { completed: 0, totalMin: 0, orders: [] };
    }
    perfMap[w].completed += 1;
    perfMap[w].totalMin += Number(o.duracionRealMin || 0);
    perfMap[w].orders.push(o);
  });
  
  return perfMap;
}

function openWorkerPerfModal(workerName, timeframe) {
  const tf = timeframe || state.perfTimeframe || "today";
  const tfLabels = { today: "Hoy", week: "Esta Semana", month: "Este Mes", all: "Histórico Completo" };
  const perfMap = computeWorkerPerformance(tf);
  const workerData = perfMap[workerName] || { completed: 0, totalMin: 0, orders: [] };
  const workerOrders = workerData.orders || [];

  openModal(`
    <div class="modal-head">
      <h2>🏆 Rendimiento de ${escapeHtml(workerName)} (${tfLabels[tf] || tf})</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <div style="margin-bottom:16px; padding:12px; background:var(--bg-main); border-radius:var(--radius-md);">
      <p style="font-size:14px; font-weight:700;">Pedidos Completados: <span style="color:var(--primary-color);">${workerData.completed}</span></p>
      <p style="font-size:14px; font-weight:700;">Tiempo Total Invertido: <span style="color:var(--primary-color);">${workerData.totalMin} min</span></p>
      ${workerData.completed > 0 ? `<p style="font-size:13px; color:var(--text-muted); margin-top:4px;">⏱️ Promedio por pedido: <strong>${Math.round(workerData.totalMin / workerData.completed)} min</strong></p>` : ''}
    </div>
    <p style="font-weight:700; font-size:13px; margin-bottom:10px;">LISTA DE PROYECTOS TERMINADOS (${workerOrders.length}):</p>
    <div style="display:flex; flex-direction:column; gap:10px; max-height:350px; overflow-y:auto;">
      ${workerOrders.length ? workerOrders.map(o => `
        <div style="padding:12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
          <div style="display:flex; justify-content:space-between; font-weight:700;">
            <span>${escapeHtml(o.cliente)} (${escapeHtml(o.id)})</span>
            <span style="color:var(--success-color);">${escapeHtml(o.estado)}</span>
          </div>
          <p style="font-size:13px; color:var(--text-muted);">${escapeHtml(o.tipo || 'Sin tipo')} ${o.motivo ? `· Motivo: ${escapeHtml(o.motivo)}` : ''}</p>
          <p style="font-size:12px; margin-top:4px;">⏱️ Tiempo: <strong>${o.duracionRealMin || 0} min</strong> | 📝 Observación: ${escapeHtml(o.comentarioCierre || "Sin observación")}</p>
        </div>
      `).join("") : '<div class="team-note">No hay pedidos registrados en este período.</div>'}
    </div>
  `);
}
window.openWorkerPerfModal = openWorkerPerfModal;

function openSummaryReportModal(timeframe) {
  const tf = timeframe || state.perfTimeframe || "today";
  const tfLabels = { today: "Hoy", week: "Esta Semana", month: "Este Mes", all: "Histórico Completo" };
  const finished = state.data.finishedOrders || [];
  const now = new Date();
  
  let filterFn = () => true;
  if (tf === "today") {
    const todayLocal = getLocalDateStr(now);
    filterFn = (o) => o.finProduccion && getLocalDateStr(o.finProduccion) === todayLocal;
  } else if (tf === "week") {
    const day = now.getDay();
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    filterFn = (o) => o.finProduccion && new Date(o.finProduccion) >= monday && new Date(o.finProduccion) <= sunday;
  } else if (tf === "month") {
    const monthIso = now.toISOString().substring(0, 7);
    filterFn = (o) => o.finProduccion && String(o.finProduccion).startsWith(monthIso);
  }
  
  const orders = finished.filter(filterFn);
  const totalMin = orders.reduce((sum, o) => sum + Number(o.duracionRealMin || 0), 0);
  const totalRev = orders.reduce((sum, o) => sum + Number(o.costo || 0), 0);

  openModal(`
    <div class="modal-head">
      <h2>📋 Lista Resumida de Pedidos Cumplidos (${tfLabels[tf] || tf})</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <div style="margin-bottom:12px; padding:10px; background:var(--bg-main); border-radius:6px; font-size:13px;">
      <span>Total Pedidos: <strong>${orders.length}</strong></span> · 
      <span>Tiempo Total: <strong>${totalMin} min</strong></span>
      ${isLead() ? ` · <span style="color:#059669; font-weight:800;">Ingresos Totales: $${totalRev.toFixed(2)}</span>` : ''}
    </div>
    <div style="max-height:380px; overflow-y:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
        <thead>
          <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted);">
            <th style="padding:6px;">ID</th>
            <th style="padding:6px;">Cliente</th>
            <th style="padding:6px;">Tipo / Motivo</th>
            <th style="padding:6px;">Responsable</th>
            <th style="padding:6px;">Minutos</th>
            ${isLead() ? `<th style="padding:6px;">Costo ($)</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr style="border-bottom:1px solid var(--border-color);">
              <td style="padding:6px; font-weight:bold;">${escapeHtml(o.id)}</td>
              <td style="padding:6px;">${escapeHtml(o.cliente)}</td>
              <td style="padding:6px;">${escapeHtml(o.tipo)}${o.motivo ? ` (${escapeHtml(o.motivo)})` : ''}</td>
              <td style="padding:6px;">${escapeHtml(o.responsable)}</td>
              <td style="padding:6px;">${o.duracionRealMin || 0} min</td>
              ${isLead() ? `<td style="padding:6px; font-weight:bold; color:#059669;">$${Number(o.costo || 0).toFixed(2)}</td>` : ''}
            </tr>
          `).join('') || '<tr><td colspan="6" style="padding:12px; text-align:center; color:var(--text-muted);">No hay pedidos cumplidos en este período.</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}
window.openSummaryReportModal = openSummaryReportModal;

function openFinancialReportModal() {
  if (!isLead()) return;
  const finished = state.data.finishedOrders || [];
  const now = new Date();
  const todayLocal = getLocalDateStr(now);
  
  const todayOrders = finished.filter(o => o.finProduccion && getLocalDateStr(o.finProduccion) === todayLocal);
  
  const day = now.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  const weekOrders = finished.filter(o => o.finProduccion && new Date(o.finProduccion) >= monday && new Date(o.finProduccion) <= sunday);
  
  const monthIso = now.toISOString().substring(0, 7);
  const monthOrders = finished.filter(o => o.finProduccion && String(o.finProduccion).startsWith(monthIso));
  
  const sumRev = (arr) => arr.reduce((s, o) => s + Number(o.costo || 0), 0);

  const revToday = sumRev(todayOrders);
  const revWeek = sumRev(weekOrders);
  const revMonth = sumRev(monthOrders);
  const revAll = sumRev(finished);

  openModal(`
    <div class="modal-head">
      <h2>💵 Balance Financiero de Ingresos (Solo Jefes)</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom:16px;">
      <div style="background:rgba(16,185,129,.1); border:1px solid #059669; padding:12px; border-radius:8px; text-align:center;">
        <span style="font-size:11px; color:#059669; font-weight:800;">INGRESOS HOY</span>
        <h3 style="color:#059669; margin-top:4px;">$${revToday.toFixed(2)}</h3>
        <small style="color:var(--text-muted);">${todayOrders.length} pedidos</small>
      </div>
      <div style="background:rgba(2,132,199,.1); border:1px solid #0284c7; padding:12px; border-radius:8px; text-align:center;">
        <span style="font-size:11px; color:#0284c7; font-weight:800;">ESTA SEMANA</span>
        <h3 style="color:#0284c7; margin-top:4px;">$${revWeek.toFixed(2)}</h3>
        <small style="color:var(--text-muted);">${weekOrders.length} pedidos</small>
      </div>
      <div style="background:rgba(147,51,234,.1); border:1px solid #9333ea; padding:12px; border-radius:8px; text-align:center;">
        <span style="font-size:11px; color:#9333ea; font-weight:800;">ESTE MES</span>
        <h3 style="color:#9333ea; margin-top:4px;">$${revMonth.toFixed(2)}</h3>
        <small style="color:var(--text-muted);">${monthOrders.length} pedidos</small>
      </div>
      <div style="background:rgba(217,119,6,.1); border:1px solid #d97706; padding:12px; border-radius:8px; text-align:center;">
        <span style="font-size:11px; color:#d97706; font-weight:800;">HISTÓRICO COMPLETO</span>
        <h3 style="color:#d97706; margin-top:4px;">$${revAll.toFixed(2)}</h3>
        <small style="color:var(--text-muted);">${finished.length} pedidos</small>
      </div>
    </div>
    <p style="font-size:12px; color:var(--text-muted);">💡 Recuerda que puedes asignar o corregir el costo de cada pedido abriéndolo en la sección de Historial o Detalle del pedido.</p>
  `);
}
window.openFinancialReportModal = openFinancialReportModal;

function openEditScheduleModal(workerName = "") {
  if (!isLead()) return;
  const users = (state.data.users || []).filter(u => u.active);
  const schedules = state.data.schedules || state.data.horarios || [];
  
  const workerSched = schedules.find(s => s.trabajador.toLowerCase() === workerName.toLowerCase()) || {
    lunes: "3:00 PM - 7:00 PM", martes: "3:00 PM - 7:00 PM", miercoles: "3:00 PM - 7:00 PM",
    jueves: "3:00 PM - 7:00 PM", viernes: "3:00 PM - 7:00 PM", sabado: "Libre", domingo: "Libre"
  };

  openModal(`
    <div class="modal-head">
      <h2>✏️ Modificar Horario de Trabajador</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <form id="schedule-form" class="form-grid">
      <label class="field"><span class="field-label">SELECCIONAR TRABAJADOR</span>
        <select name="trabajador" required>
          ${users.map(u => `<option value="${escapeHtml(u.name)}" ${u.name.toLowerCase() === workerName.toLowerCase() ? "selected" : ""}>${escapeHtml(u.name)} (${formatRoleLabel(u.role)})</option>`).join('')}
        </select>
      </label>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <label class="field"><span class="field-label">LUNES</span><input name="lunes" value="${escapeHtml(workerSched.lunes || "3:00 PM - 7:00 PM")}" placeholder="Ej. 4:00 PM - 8:30 PM"></label>
        <label class="field"><span class="field-label">MARTES</span><input name="martes" value="${escapeHtml(workerSched.martes || "3:00 PM - 7:00 PM")}" placeholder="Ej. 3:00 PM - 7:00 PM"></label>
        <label class="field"><span class="field-label">MIÉRCOLES</span><input name="miercoles" value="${escapeHtml(workerSched.miercoles || "3:00 PM - 7:00 PM")}" placeholder="Ej. Medio Día 8 AM - 12 PM"></label>
        <label class="field"><span class="field-label">JUEVES</span><input name="jueves" value="${escapeHtml(workerSched.jueves || "3:00 PM - 7:00 PM")}" placeholder="Ej. 4:00 PM - 8:30 PM"></label>
        <label class="field"><span class="field-label">VIERNES</span><input name="viernes" value="${escapeHtml(workerSched.viernes || "3:00 PM - 7:00 PM")}" placeholder="Ej. 3:00 PM - 7:00 PM"></label>
        <label class="field"><span class="field-label">SÁBADO</span><input name="sabado" value="${escapeHtml(workerSched.sabado || "Libre")}" placeholder="Ej. Libre o 9 AM - 2 PM"></label>
      </div>
      <label class="field"><span class="field-label">DOMINGO</span><input name="domingo" value="${escapeHtml(workerSched.domingo || "Libre")}" placeholder="Ej. Libre"></label>
      <div class="modal-footer"><button type="submit" class="primary-button">Guardar Horario</button></div>
    </form>
  `);

  $("#schedule-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(e.target));
      await api("profile_save_schedule", data);
      closeModal();
      await refresh(false);
      showToast("Horario actualizado en Google Sheets.");
    } catch (err) {
      btn.disabled = false;
      alert(err.message);
    }
  });
}
window.openEditScheduleModal = openEditScheduleModal;
window.setPerfTimeframe = function(tf) { state.perfTimeframe = tf; render(); };

function settingsView() {
  const session = state.session || {};
  const customColors = store.get("pp_custom_colors", {});
  const tf = state.perfTimeframe || "today";
  const tfLabels = { today: "Hoy", week: "Esta Semana", month: "Este Mes", all: "Histórico Completo" };
  const perfMap = computeWorkerPerformance(tf);
  
  const fcList = state.frequentClients.map((c) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border:1px solid var(--border-color); margin-bottom:6px; border-radius:var(--radius-sm); background:var(--bg-card);">
      <div><strong>${escapeHtml(c.name)}</strong><br/><small style="color:var(--text-muted);">${escapeHtml(c.phone || "Sin teléfono")}</small></div>
      ${isLead() ? `<button class="secondary-button" style="background:#d32f2f; color:white; border:none;" data-action="delete-client" data-name="${escapeHtml(c.name)}">🗑️</button>` : ''}
    </div>
  `).join("");
  
  const ftList = state.frequentTypes.map((t) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border:1px solid var(--border-color); margin-bottom:6px; border-radius:var(--radius-sm); background:var(--bg-card);">
      <strong>${escapeHtml(t)}</strong>
      ${isLead() ? `<button class="secondary-button" style="background:#d32f2f; color:white; border:none;" data-action="delete-type" data-type="${escapeHtml(t)}">🗑️</button>` : ''}
    </div>
  `).join("");
  
  const usersList = (state.data.users || []).map((u) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border:1px solid var(--border-color); margin-bottom:6px; border-radius:var(--radius-sm); background:var(--bg-card);">
      <div><strong>${escapeHtml(u.name)}</strong> <small style="color:var(--text-muted);">(${escapeHtml(formatRoleLabel(u.role))})</small><br/><span style="color:${u.active ? 'var(--success-color)' : 'var(--danger-color)'}; font-size:12px;">${u.active ? '● Activo' : '○ Inactivo'}</span></div>
      <button class="secondary-button" data-action="toggle-user" data-name="${escapeHtml(u.name)}" data-active="${u.active}">${u.active ? 'Desactivar' : 'Activar'}</button>
    </div>
  `).join("");

  const perfRows = Object.keys(perfMap).map(uName => `
    <div class="secondary-button" style="display:flex; justify-content:space-between; width:100%; text-align:left; margin-bottom:6px; cursor:pointer;" onclick="openWorkerPerfModal('${escapeHtml(uName)}', '${tf}')">
      <span><strong>👤 ${escapeHtml(uName)}</strong></span>
      <span>🏆 <strong>${perfMap[uName].completed}</strong> pedidos (${perfMap[uName].totalMin} min) 🔍</span>
    </div>
  `).join("");

  return `
    <div class="card settings-card" style="padding:20px; border:1px solid var(--border-color); border-radius:var(--radius-md); background:var(--bg-card); margin-bottom:20px;">
      <h3 style="margin-bottom:14px;">Mi Perfil y Personalización - Creaciones JJ</h3>
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
        <div><span>NOMBRE:</span> <strong>${escapeHtml(session.name || "")}</strong></div>
        <div><span>ROL:</span> <strong>${escapeHtml(session.role || "")}</strong></div>
      </div>
      
      <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border-color);">
        <p style="font-weight:700; font-size:13px; margin-bottom:8px;">TEMAS PREESTABLECIDOS:</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
          <button class="secondary-button" onclick="setAccent('blue')">💙 Azul Real</button>
          <button class="secondary-button" onclick="setAccent('emerald')">💚 Esmeralda</button>
          <button class="secondary-button" onclick="setAccent('purple')">💜 Púrpura</button>
          <button class="secondary-button" onclick="setAccent('amber')">🧡 Ámbar</button>
        </div>

        <p style="font-weight:700; font-size:13px; margin-bottom:8px;">🎨 GENERADOR DE TEMA PROPIO (PERSONALIZADO EN VIVO):</p>
        <div class="custom-theme-picker">
          <div class="color-input-group">
            <label>Color Principal / Botones:</label>
            <input type="color" id="color-primary" onchange="saveCustomColor('primary', this.value)" value="${customColors.primary || '#1e3a8a'}">
          </div>
          <div class="color-input-group">
            <label>Fondo de Tarjetas:</label>
            <input type="color" id="color-card" onchange="saveCustomColor('cardBg', this.value)" value="${customColors.cardBg || '#ffffff'}">
          </div>
          <div class="color-input-group">
            <label>Color del Texto:</label>
            <input type="color" id="color-text" onchange="saveCustomColor('textMain', this.value)" value="${customColors.textMain || '#0f172a'}">
          </div>
          <div class="color-input-group">
            <label>Fondo de Pantalla:</label>
            <input type="color" id="color-main" onchange="saveCustomColor('mainBg', this.value)" value="${customColors.mainBg || '#f1f5f9'}">
          </div>
        </div>
        <button class="secondary-button" onclick="resetCustomTheme()" style="margin-top:10px;">🔄 Restablecer Colores por Defecto</button>
      </div>

      <div style="margin-top:20px; padding-top:14px; border-top:1px solid var(--border-color);">
        <p style="font-weight:700; font-size:13px; margin-bottom:8px;">📲 PLANTILLA DE MENSAJE WHATSAPP:</p>
        <textarea id="wa-template-input" class="field" style="width:100%; min-height:80px; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-main);">${escapeHtml(state.waTemplate)}</textarea>
        <small style="color:var(--text-muted); display:block; margin-top:4px;">Variables disponibles: {cliente}, {tipo}, {estado}, {id}</small>
        <button class="primary-button" id="save-wa-template-btn" style="margin-top:8px;">💾 Guardar Plantilla de WhatsApp</button>
      </div>

      <div style="display:flex; gap:10px; margin-top:20px; flex-wrap:wrap;">
        <button class="secondary-button" data-action="request-push-perm" style="background:#0284c7; color:white; border:none;">🔔 Activar Notificaciones de Pedidos</button>
        ${isLead() ? `<button class="secondary-button" data-action="archive-old-orders" style="background:#475569; color:white; border:none;">📦 Archivar Proyectos Antiguos (>60 días)</button>` : ''}
        <button class="secondary-button" data-action="logout">Cerrar sesión</button>
        <button class="secondary-button" data-action="clear-cache">🧹 Limpiar Caché Local</button>
      </div>
    </div>
    
    ${isLead() ? `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px; margin-top:20px;">
        <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin:0;">📊 RENDIMIENTO DE PRODUCCIÓN POR TRABAJADOR (${tfLabels[tf]})</p>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="secondary-button" style="${tf==='today'?'background:var(--primary-color); color:white; font-weight:bold;':''}" onclick="setPerfTimeframe('today')">📅 Hoy</button>
          <button type="button" class="secondary-button" style="${tf==='week'?'background:var(--primary-color); color:white; font-weight:bold;':''}" onclick="setPerfTimeframe('week')">📆 Esta Semana</button>
          <button type="button" class="secondary-button" style="${tf==='month'?'background:var(--primary-color); color:white; font-weight:bold;':''}" onclick="setPerfTimeframe('month')">🗓️ Este Mes</button>
          <button type="button" class="secondary-button" style="${tf==='all'?'background:var(--primary-color); color:white; font-weight:bold;':''}" onclick="setPerfTimeframe('all')">📊 Histórico</button>
        </div>
      </div>
      <div style="background:var(--bg-card); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:20px;">
        ${perfRows || '<div class="team-note">No se han registrado cierres de pedidos en este período.</div>'}
      </div>

      <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-bottom:10px;">GESTIÓN DE PERFILES / USUARIOS</p>
      <button class="primary-button" data-action="new-user" style="margin-bottom:12px;">＋ Crear Nuevo Perfil</button>
      <div class="user-list">${usersList || '<div class="team-note">No hay usuarios registrados.</div>'}</div>
      
      <div style="margin-top:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin:0;">📅 HORARIOS Y TURNOS DEL EQUIPO</p>
          <button type="button" class="primary-button" onclick="openEditScheduleModal()" style="padding:6px 12px; font-size:12px;">✏️ Modificar Horario</button>
        </div>
        <div style="overflow-x:auto; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-color); padding:12px; margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted);">
                <th style="padding:6px 8px;">Trabajador</th>
                <th style="padding:6px 8px;">Lun</th>
                <th style="padding:6px 8px;">Mar</th>
                <th style="padding:6px 8px;">Mié</th>
                <th style="padding:6px 8px;">Jue</th>
                <th style="padding:6px 8px;">Vie</th>
                <th style="padding:6px 8px;">Sáb</th>
                <th style="padding:6px 8px;">Dom</th>
              </tr>
            </thead>
            <tbody>
              ${(state.data.schedules || state.data.horarios || []).map(s => `
                <tr style="border-bottom:1px dashed var(--border-color);">
                  <td style="padding:6px 8px; font-weight:bold;">👤 ${escapeHtml(s.trabajador)}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.lunes || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.martes || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.miercoles || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.jueves || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.viernes || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.sabado || 'Libre')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.domingo || 'Libre')}</td>
                </tr>
              `).join('') || '<tr><td colspan="8" style="padding:10px; text-align:center; color:var(--text-muted);">No hay horarios registrados. Pulsa Modificar Horario para agregar.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div style="margin-top:24px;">
        <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-bottom:10px;">📅 MI HORARIO Y TURNOS DEL EQUIPO</p>
        <div style="overflow-x:auto; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-color); padding:12px; margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted);">
                <th style="padding:6px 8px;">Trabajador</th>
                <th style="padding:6px 8px;">Lun</th>
                <th style="padding:6px 8px;">Mar</th>
                <th style="padding:6px 8px;">Mié</th>
                <th style="padding:6px 8px;">Jue</th>
                <th style="padding:6px 8px;">Vie</th>
                <th style="padding:6px 8px;">Sáb</th>
                <th style="padding:6px 8px;">Dom</th>
              </tr>
            </thead>
            <tbody>
              ${(state.data.schedules || state.data.horarios || []).map(s => `
                <tr style="border-bottom:1px dashed var(--border-color);">
                  <td style="padding:6px 8px; font-weight:bold;">👤 ${escapeHtml(s.trabajador)}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.lunes || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.martes || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.miercoles || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.jueves || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.viernes || '3-7 PM')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.sabado || 'Libre')}</td>
                  <td style="padding:6px 8px;">${escapeHtml(s.domingo || 'Libre')}</td>
                </tr>
              `).join('') || '<tr><td colspan="8" style="padding:10px; text-align:center; color:var(--text-muted);">No hay horarios asignados aún.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `}
    
    <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-top:20px; margin-bottom:10px;">CLIENTES FRECUENTES (${state.frequentClients.length})</p>
    <button class="primary-button" data-action="new-client" style="margin-bottom:12px;">＋ Agregar Cliente Frecuente</button>
    <div class="user-list">${fcList || '<div class="team-note">No hay clientes guardados en Google Sheets.</div>'}</div>
    
    <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-top:20px; margin-bottom:10px;">TIPOS DE TRABAJO (${state.frequentTypes.length})</p>
    <button class="primary-button" data-action="new-type" style="margin-bottom:12px;">＋ Agregar Tipo de Trabajo</button>
    <div class="user-list">${ftList || '<div class="team-note">No hay tipos de trabajo guardados.</div>'}</div>
    
    <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-top:20px; margin-bottom:10px;">🎨 CATÁLOGO DE MOTIVOS / TEMÁTICAS (${(state.frequentMotivos||[]).length})</p>
    <button class="primary-button" data-action="new-motivo" style="margin-bottom:12px;">＋ Agregar Motivo / Temática</button>
    <div class="user-list">${(state.frequentMotivos||[]).map(m => `
      <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border:1px solid var(--border-color); margin-bottom:6px; border-radius:var(--radius-sm); background:var(--bg-card);">
        <strong>🎨 ${escapeHtml(m)}</strong>
        ${isLead() ? `<button class="secondary-button" style="background:#d32f2f; color:white; border:none;" data-action="delete-motivo" data-motivo="${escapeHtml(m)}">🗑️</button>` : ''}
      </div>
    `).join('') || '<div class="team-note">No hay motivos guardados. Agrega los que usas frecuentemente.</div>'}</div>
  `;
}

function render() {
  if (!state.session) {
    state.session = store.get("pp_profile_session", null);
  }
  if (!state.session) return;
  
  try {
    applyTheme();
    const screenNames = { now: "Ahora", queue: "Mi Bandeja", team: "Equipo", history: "Historial", settings: "Ajustes" };
    
    const titleEl = $("#screen-title");
    if (titleEl) titleEl.textContent = screenNames[state.screen] || "Ahora";
    
    const roleLabelEl = $("#role-label");
    if (roleLabelEl && state.session) {
      const roleStr = String(state.session.role || "trabajador").toUpperCase();
      const nameStr = String(state.session.name || "Usuario").toUpperCase();
      roleLabelEl.textContent = `CREACIONES JJ · ${roleStr} · ${nameStr}`;
    }
    
    const screenEl = $("#screen");
    if (screenEl) {
      const views = { now: nowView, queue: queueView, team: teamView, history: historyView, settings: settingsView };
      screenEl.innerHTML = (views[state.screen] || views.now)();
    }
    
    document.querySelectorAll(".nav-button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.screen === state.screen);
    });

    const backupBox = document.querySelector(".backup-container");
    if (backupBox) {
      backupBox.style.display = isLead() ? "flex" : "none";
    }

    $("#history-search-input")?.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      const filtered = filterOrdersBySearch(state.data.finishedOrders || []);
      const container = $(".order-list");
      if (container) {
        container.innerHTML = filtered.map(order => `
          <article class="order-card">
            <div class="order-top" data-action="detail" data-id="${escapeHtml(order.id)}">
              <div><h3>${escapeHtml(order.cliente)} <small style="font-size:12px; color:var(--text-muted);">(${escapeHtml(order.id)})</small></h3><p>${escapeHtml(order.tipo)}</p></div>
              <span class="priority" style="background:#2e7d32; color:white; padding:4px 8px; border-radius:4px;">${escapeHtml(order.estado)}</span>
            </div>
            <div class="meta" data-action="detail" data-id="${escapeHtml(order.id)}">
              Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>
              Responsable: ${escapeHtml(order.responsable)}<br/>
              ⏱️ Tiempo invertido: <strong>${order.duracionRealMin || 0} min</strong><br/>
            </div>
          </article>
        `).join("");
      }
    });

    $("#team-search-input")?.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      const filtered = filterOrdersBySearch(sortOrdersByUrgency((state.data.allOrders || []).filter(active)));
      const container = $(".order-list");
      if (container) container.innerHTML = filtered.map(orderCard).join("");
    });

    $("#save-wa-template-btn")?.addEventListener("click", () => {
      const val = $("#wa-template-input")?.value || "";
      state.waTemplate = val;
      store.set("pp_wa_template", val);
      showToast("Plantilla de WhatsApp guardada.");
    });
  } catch (err) {
    console.error("Error durante el renderizado:", err);
  }
}

function openModal(content) {
  const m = $("#modal");
  if (m) {
    m.innerHTML = `<div class="modal-content">${content}</div>`;
    m.showModal();
  }
}

function closeModal() {
  const m = $("#modal");
  if (m) m.close();
}

function detail(order) {
  const rawPhone = cleanPhoneNumber(order.telefono);
  const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(state.waTemplate.replace(/{cliente}/g, order.cliente).replace(/{tipo}/g, order.tipo).replace(/{estado}/g, order.estado).replace(/{id}/g, order.id))}`;
  const refLinks = String(order.fotoReferencia || "").split("\n").filter(Boolean);
  const eviLinks = String(order.fotoEvidencia || "").split("\n").filter(Boolean);

  const clientInfo = state.frequentClients.find(
    c => c.name.toLowerCase() === order.cliente.toLowerCase()
  ) || {};
  const hasDelivery = clientInfo.delivery === "Sí";

  openModal(`
    <div class="modal-head"><div><p class="eyebrow">${escapeHtml(order.id)}</p><h2>${escapeHtml(order.cliente)}</h2></div><button class="close-button" data-action="close">×</button></div>
    <div class="form-grid" style="gap:12px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">TIPO DE TRABAJO:</span>
        <strong style="color:var(--text-main);">${escapeHtml(order.tipo)}</strong>
      </div>
      
      <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">MOTIVO / TEMÁTICA:</span>
        <strong style="color:var(--text-main);">${escapeHtml(order.motivo || "Sin especificar")}</strong>
      </div>
      
      ${(active(order) || isLead()) ? `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">CAMBIAR ESTADO DE PRODUCCIÓN:</span>
          <select id="status-change-select" data-id="${escapeHtml(order.id)}" style="padding:4px 8px; border-radius:6px;">
            ${["Pendiente", "En proceso", "Pausado", "Terminado", "Entregado", "Cancelado"].map((st) => `<option value="${st}" ${order.estado === st ? "selected" : ""}>${st}</option>`).join("")}
          </select>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">CAMBIAR ESTADO DEL DISEÑO:</span>
          <select id="design-change-select" data-id="${escapeHtml(order.id)}" style="padding:4px 8px; border-radius:6px;">
            <option value="No" ${order.diseno === "No" ? "selected" : ""}>Pendiente por diseñar ❌</option>
            <option value="En proceso" ${order.diseno === "En proceso" ? "selected" : ""}>En proceso ✏️</option>
            <option value="Sí" ${(order.diseno === "Sí" || !order.diseno) ? "selected" : ""}>Listo para fabricar ✅</option>
          </select>
        </div>
      ` : `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">ESTADO DE PRODUCCIÓN:</span>
          <strong style="color:var(--success-color);">${escapeHtml(order.estado)}</strong>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">ESTADO DEL DISEÑO:</span>
          <strong style="color:var(--text-main);">${escapeHtml(order.diseno || "Sí")}</strong>
        </div>
      `}

      <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">ENTREGA SOLICITADA POR CLIENTE:</span>
        <strong style="color:var(--text-main);">${escapeHtml(formatDate(order.entrega))}</strong>
      </div>

      ${hasDelivery ? `
        <div style="display:flex; flex-direction:column; gap:4px; border:1px solid #0284c7; background:rgba(2,132,199,.1); padding:10px; border-radius:8px;">
          <span style="font-weight:800; color:#0284c7; font-size:13px;">🚚 PEDIDO CON DELIVERY A DOMICILIO</span>
          <span style="font-size:13px;"><strong>Sector / Zona:</strong> ${escapeHtml(clientInfo.zona || 'Norte / No especificada')}</span>
          <span style="font-size:13px;"><strong>Dirección exacta:</strong> ${escapeHtml(clientInfo.direccion || 'Sin dirección registrada')}</span>
          <span style="font-size:12px; color:#d97706; font-weight:800; margin-top:4px;">⚠️ El pedido DEBE estar completamente terminado el día anterior para enviarse por la mañana.</span>
        </div>
      ` : `
        <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">ENTREGA EN LOCAL / RETIRO:</span>
          <strong style="color:var(--text-main);">Cliente retira en tienda</strong>
        </div>
      `}

      <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">RESPONSABLE:</span>
        <strong style="color:var(--text-main);">${escapeHtml(order.responsable)}</strong>
      </div>
      
      <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">TELÉFONO WHATSAPP:</span>
        <strong style="color:var(--text-main);">${escapeHtml(order.telefono || "No registrado")}</strong>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">⏱️ TIEMPO INVERTIDO (MIN):</span>
        ${isLead() ? `
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="number" id="order-duration-input" value="${order.duracionRealMin || 0}" style="width:70px; padding:4px 6px; border-radius:6px; border:1px solid var(--border-color);">
            <button type="button" class="secondary-button" id="save-duration-btn" style="padding:4px 6px; font-size:11px;">💾 Min</button>
          </div>
        ` : `<strong style="color:var(--text-main);">${order.duracionRealMin || 0} min</strong>`}
      </div>

      ${isLead() ? `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px; background:rgba(16,185,129,.1); padding:8px; border-radius:6px;">
          <span style="font-weight:700; color:#059669; font-size:12px;">💵 PRECIO / COSTO COBRADO ($):</span>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="number" step="0.01" id="order-cost-input" value="${order.costo || 0}" style="width:90px; padding:4px 8px; border-radius:6px; border:1px solid #059669; font-weight:bold;">
            <button type="button" class="primary-button" id="save-cost-btn" style="padding:4px 8px; font-size:11px; background:#059669;">💾 Guardar $</button>
          </div>
        </div>
      ` : ''}
      
      <div style="display:flex; flex-direction:column; gap:4px; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">DESCRIPCIÓN / MEDIDAS:</span>
        <p style="font-size:14px; background:var(--bg-main); padding:8px; border-radius:6px; color:var(--text-main);">${escapeHtml(order.descripcion || "Sin descripción")}</p>
      </div>
      
      ${refLinks.length ? `
        <div style="margin-top:6px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">🖼️ FOTOS DE REFERENCIA DEL CLIENTE:</span>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
            ${refLinks.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="secondary-button" style="color:var(--primary-color);">🖼️ Ref ${idx + 1}</a>`).join("")}
          </div>
        </div>
      ` : ''}

      ${eviLinks.length ? `
        <div style="margin-top:6px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">📷 FOTOS DE EVIDENCIA DE CIERRE:</span>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
            ${eviLinks.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="secondary-button" style="color:var(--success-color);">📷 Evidencia ${idx + 1}</a>`).join("")}
          </div>
        </div>
      ` : ''}

      <div style="margin-top:10px; border-top:1px dashed var(--border-color); padding-top:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">📝 BITÁCORA DE NOTAS Y OBSERVACIONES:</span>
          <button type="button" class="secondary-button" id="add-note-btn" style="padding:2px 8px; font-size:11px;">＋ Añadir Nota</button>
        </div>
        <div style="background:var(--bg-main); padding:8px 12px; border-radius:6px; font-size:12px; max-height:120px; overflow-y:auto; color:var(--text-main); line-height:1.5;">
          ${order.notas ? escapeHtml(order.notas).replace(/\n/g, '<br/>') : '<em style="color:var(--text-muted);">Sin observaciones o notas registradas.</em>'}
        </div>
      </div>
    </div>
    ${rawPhone ? `<div class="actions" style="margin-top:16px;"><a href="${whatsappUrl}" target="_blank" rel="noopener" class="secondary-button" style="background:#25D366; color:white; text-align:center; display:block; width:100%;">📲 Notificar por WhatsApp</a></div>` : ""}
    ${isLead() ? `
      <div class="actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        ${!active(order) ? `<button class="secondary-button" style="background:var(--primary-color); color:white; border:none; flex:1;" data-action="reopen-order" data-id="${escapeHtml(order.id)}">🔄 Reabrir Proyecto</button>` : ''}
        ${order.estado !== "Entregado" ? `<button class="secondary-button" style="background:var(--success-color); color:white; border:none; flex:1;" data-action="mark-delivered" data-id="${escapeHtml(order.id)}">📦 Marcar Entregado</button>` : ''}
        <button class="secondary-button" style="background:#d32f2f; color:white; width:100%; border:none;" data-action="delete-order" data-id="${escapeHtml(order.id)}">🗑️ Eliminar Pedido del Sistema</button>
      </div>
    ` : ""}
  `);
  
  $("#status-change-select")?.addEventListener("change", async (e) => {
    const val = e.target.value;
    if (["Terminado", "Entregado"].includes(val)) {
      closeModal();
      openFinishModal(order, val);
    } else {
      let pauseNote = "";
      if (val === "Pausado") {
        pauseNote = prompt("Motivo de la pausa (ej: Esperando material, respuesta del cliente...):");
        if (pauseNote === null) return;
      }
      try {
        await api("profile_update_order", {
          id: order.id,
          user: state.session?.name || "Usuario",
          changes: { estado: val, nota: pauseNote }
        });
        closeModal();
        await refresh(false);
        showToast(`Estado cambiado a ${val}.`);
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    }
  });

  $("#design-change-select")?.addEventListener("change", async (e) => {
    const val = e.target.value;
    try {
      await api("profile_update_order", { id: order.id, changes: { diseno: val } });
      order.diseno = val;
      showToast(`Diseño actualizado a: ${val}`);
      await refresh(false);
    } catch (err) {
      alert(`Error al actualizar estado del diseño: ${err.message}`);
    }
  });

  $("#add-note-btn")?.addEventListener("click", async () => {
    const text = prompt("Escribe una nota u observación para este pedido:");
    if (text && text.trim()) {
      try {
        await api("profile_update_order", {
          id: order.id,
          user: state.session?.name || "Usuario",
          changes: { nota: text.trim() }
        });
        showToast("Nota añadida a la bitácora.");
        closeModal();
        await refresh(false);
      } catch (err) {
        alert(`Error al guardar la nota: ${err.message}`);
      }
    }
  });

  $("#save-cost-btn")?.addEventListener("click", async () => {
    const val = parseFloat($("#order-cost-input")?.value || 0);
    try {
      await api("profile_save_cost", { id: order.id, costo: val });
      order.costo = val;
      showToast(`Costo de $${val.toFixed(2)} guardado.`);
      await refresh(false);
    } catch (err) { alert(err.message); }
  });

  $("#save-duration-btn")?.addEventListener("click", async () => {
    const val = parseInt($("#order-duration-input")?.value || 0, 10);
    try {
      await api("profile_update_order", { id: order.id, changes: { duracionRealMin: val } });
      order.duracionRealMin = val;
      showToast(`Duración actualizada a ${val} min.`);
      await refresh(false);
    } catch (err) { alert(err.message); }
  });
}

function openFinishModal(order, targetStatus) {
  openModal(`
    <div class="modal-head"><h2>Completar Trabajo (${targetStatus})</h2><button class="close-button" data-action="close">×</button></div>
    <form id="finish-form" class="form-grid">
      <label class="field"><span class="field-label">COMENTARIO DE CIERRE / OBSERVACIÓN</span>
        <textarea name="comentarioCierre" required placeholder="Escribe un comentario sobre la elaboración o imprevistos..."></textarea>
      </label>
      <label class="field"><span class="field-label">SUBIR EVIDENCIA FOTOGRÁFICA DE CIERRE (HASTA 3 FOTOS)</span>
        <input type="file" id="evidencia-files" accept="image/*" multiple>
      </label>
      <div id="file-preview-list" style="font-size:12px; color:var(--text-muted);"></div>
      <div class="modal-footer"><button type="submit" class="primary-button">Guardar y Finalizar Pedido</button></div>
    </form>
  `);
  
  $("#finish-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "Guardando e subiendo evidencias...";
    
    const filesInput = $("#evidencia-files");
    const files = filesInput ? Array.from(filesInput.files).slice(0, 3) : [];
    const imagesData = [];
    
    for (const f of files) {
      const compressed = await compressImageFile(f);
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(compressed);
      });
      imagesData.push({ data: base64, mimeType: "image/jpeg" });
    }
    
    try {
      await api("profile_update_order", {
        id: order.id,
        changes: {
          estado: targetStatus,
          comentarioCierre: e.target.comentarioCierre.value.trim(),
          images: imagesData
        }
      });
      closeModal();
      await refresh(false);
      showToast("Pedido finalizado con éxito.");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Guardar y Finalizar Pedido";
      alert(`Error: ${err.message}`);
    }
  });
}

function formOrder() {
  const users = (state.data.users || []).filter(u => u.active);
  const clients = state.frequentClients;
  const types = state.frequentTypes;
  const motivos = state.frequentMotivos || [];
  
  openModal(`
    <div class="modal-head"><h2>Registrar Pedido - Creaciones JJ</h2><button class="close-button" data-action="close">×</button></div>
    
    <div class="magic-paste-box">
      <div class="magic-paste-title">✨ Pegado Mágico (WhatsApp / Plantillas de Reposteras)</div>
      <textarea id="magic-paste-input" class="magic-paste-textarea" placeholder="Pega aquí el mensaje del cliente (Ej: 'Medida 1kl: 14x14cm, Nombre: Yolber, Entregar: Miércoles')"></textarea>
      <button type="button" id="magic-paste-btn" class="secondary-button" style="background:var(--primary-color); color:white; border:none;">🪄 Analizar y Llenar Campos</button>
    </div>

    <form id="order-form" class="form-grid">
      ${clients.length ? `
        <label class="field"><span class="field-label">SELECCIONAR CLIENTE GUARDADO</span>
          <select id="fc-select"><option value="">-- Autocompletar datos --</option>${clients.map((c, i) => `<option value="${i}">${escapeHtml(c.name)} (${escapeHtml(c.phone || "Sin tel.")})</option>`).join("")}</select>
        </label>` : ''}
      <div id="delivery-warning" class="delivery-warning-box" style="display:none;"></div>
      <label class="field"><span class="field-label">NOMBRE DEL CLIENTE</span><input id="input-cliente" name="cliente" required placeholder="Escribe el nombre del cliente"></label>
      <label class="field"><span class="field-label">TELÉFONO WHATSAPP</span><input id="input-telefono" name="telefono" type="tel" placeholder="Ingresa o cambia el número"></label>
      
      <label class="field"><span class="field-label">TIPO DE TRABAJO</span>
        ${types.length ? `<select id="ft-select" style="margin-bottom:6px;"><option value="">-- Seleccionar existente --</option>${types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}<option value="__CUSTOM__">Escribir otro nuevo...</option></select>` : ''}
        <input id="input-tipo" name="tipo" required placeholder="Ej. Topper Acrílico, Maqueta...">
      </label>

      <label class="field"><span class="field-label">🎨 MOTIVO / TEMÁTICA</span>
        ${motivos.length ? `<select id="motivo-select" style="margin-bottom:6px;"><option value="">-- Seleccionar motivo guardado --</option>${motivos.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}<option value="__CUSTOM__">Escribir nuevo motivo...</option></select>` : ''}
        <input id="input-motivo" name="motivo" placeholder="Ej. Hello Kitty, Tarzán, Cumpleaños 15...">
      </label>

      <label class="field"><span class="field-label">🎨 ESTADO DEL DISEÑO</span>
        <select name="diseno">
          <option value="No">No ❌ (Pendiente por diseñar)</option>
          <option value="En proceso">En proceso ✏️</option>
          <option value="Sí" selected>Sí ✅ (Listo para cortar/armar)</option>
        </select>
      </label>

      <label class="field"><span class="field-label">🖼️ FOTOS DE REFERENCIA DEL CLIENTE (HASTA 3 FOTOS)</span>
        <input type="file" id="reference-files-input" accept="image/*" multiple>
      </label>

      <div class="form-inline">
        <label class="field"><span class="field-label">FECHA DE ENTREGA</span><input type="date" id="input-fecha-entrega" name="fechaEntrega" required></label>
        <label class="field"><span class="field-label">HORA DE ENTREGA (7 AM - 9 PM)</span>
          <select id="select-hora-entrega" name="horaEntrega" required>
            ${generateTimeOptions("11:00 AM")}
          </select>
        </label>
      </div>
      <label class="field"><span class="field-label">RESPONSABLE</span>
        <select name="responsable"><option value="">Sin asignar</option>${users.map(u => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join("")}</select>
      </label>
      <label class="field"><span class="field-label">DESCRIPCIÓN / MEDIDAS</span><textarea id="input-descripcion" name="descripcion" placeholder="Detalles, medidas, edad, posición..."></textarea></label>
      <div class="modal-footer"><button type="submit" class="primary-button">Guardar Pedido</button></div>
    </form>
  `);

  $("#magic-paste-btn")?.addEventListener("click", () => {
    const raw = $("#magic-paste-input")?.value || "";
    if (!raw.trim()) {
      alert("Pega un texto en la caja antes de presionar Pegado Mágico.");
      return;
    }
    const parsed = parseMagicPasteText(raw);
    
    if (parsed.cliente) $("#input-cliente").value = parsed.cliente;
    if (parsed.telefono) $("#input-telefono").value = parsed.telefono;
    if (parsed.tipo) $("#input-tipo").value = parsed.tipo;
    if (parsed.motivo) $("#input-motivo").value = parsed.motivo;
    if (parsed.fechaEntrega) $("#input-fecha-entrega").value = parsed.fechaEntrega;
    if (parsed.horaEntrega) $("#select-hora-entrega").value = parsed.horaEntrega;
    if (parsed.descripcion) $("#input-descripcion").value = parsed.descripcion;
    
    showToast("✨ Campos llenados con Pegado Mágico.");
  });

  $("#fc-select")?.addEventListener("change", (e) => {
    if (e.target.value !== "") {
      const c = clients[e.target.value];
      if (c) {
        $("#input-cliente").value = c.name || "";
        $("#input-telefono").value = c.phone || "";
        const deliveryWarn = document.getElementById("delivery-warning");
        if (deliveryWarn) {
          if (c.delivery === "Sí") {
            deliveryWarn.style.display = "block";
            deliveryWarn.innerHTML = `🚚 <strong>Cliente con DELIVERY A DOMICILIO</strong><br>📍 <strong>Sector / Zona:</strong> ${escapeHtml(c.zona || 'No especificada')}<br>🏠 <strong>Dirección:</strong> ${escapeHtml(c.direccion || 'No especificada')}<br>⚠️ <em>El pedido DEBE quedar listo el día anterior al fin de jornada.</em>`;
          } else {
            deliveryWarn.style.display = "none";
          }
        }
      }
    }
  });

  $("#motivo-select")?.addEventListener("change", (e) => {
    if (e.target.value && e.target.value !== "__CUSTOM__") {
      $("#input-motivo").value = e.target.value;
    }
  });
  
  $("#ft-select")?.addEventListener("change", (e) => {
    if (e.target.value && e.target.value !== "__CUSTOM__") {
      $("#input-tipo").value = e.target.value;
    }
  });
  
  $("#order-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "Guardando pedido y referencias...";

    const refInput = $("#reference-files-input");
    const refFiles = refInput ? Array.from(refInput.files).slice(0, 3) : [];
    const referenceImages = [];

    for (const f of refFiles) {
      const compressed = await compressImageFile(f);
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(compressed);
      });
      referenceImages.push({ data: base64, mimeType: "image/jpeg" });
    }

    try {
      await api("profile_create_order", {
        form: Object.fromEntries(new FormData(e.target)),
        referenceImages: referenceImages
      });
      closeModal();
      await refresh(false);
      showToast("Pedido guardado exitosamente.");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Guardar Pedido";
      alert(`Error: ${err.message}`);
    }
  });
}

function formNewUser() {
  openModal(`
    <div class="modal-head"><h2>Crear Perfil de Usuario</h2><button class="close-button" data-action="close">×</button></div>
    <form id="user-form" class="form-grid">
      <label class="field"><span class="field-label">NOMBRE DEL TRABAJADOR / JEFE</span><input name="name" required placeholder="Ej. Carlos / Valentina"></label>
      <label class="field"><span class="field-label">PIN DE ACCESO (6 DÍGITOS)</span><input name="pin" type="password" inputmode="numeric" required maxlength="6" placeholder="123456"></label>
      <label class="field"><span class="field-label">ROL DE USUARIO</span>
        <select name="role">
          <option value="trabajador">Trabajador (Hombre)</option>
          <option value="trabajadora">Trabajadora (Mujer)</option>
          <option value="jefe">Jefe (Administrador Hombre)</option>
          <option value="jefa">Jefa (Administradora Mujer)</option>
          <option value="manager">Manager / Jefatura General</option>
        </select>
      </label>
      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">Crear Perfil</button>
      </div>
    </form>
  `);
  
  $("#user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    try {
      await api("profile_create_user", Object.fromEntries(new FormData(e.target)));
      closeModal();
      await refresh(false);
      showToast("Perfil creado.");
    } catch (err) {
      btn.disabled = false;
      alert(`Error: ${err.message}`);
    }
  });
}

// (listeners de login, refresh y nav-button están al final del archivo)

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const act = btn.dataset.action;
  
  if (act === "close") return closeModal();
  if (act === "detail") {
    const o = [...state.data.allOrders, ...state.data.finishedOrders, ...state.data.myOrders].find(i => String(i.id) === String(btn.dataset.id));
    if (o) detail(o);
    return;
  }
  if (act === "new-order") return formOrder();
  if (act === "new-user") return formNewUser();
  if (act === "clear-cache") {
    store.remove("pp_profile_data");
    showToast("Caché borrada.");
    return refresh();
  }
  if (act === "logout") {
    store.remove("pp_profile_session");
    state.session = null;
    showLogin();
    return;
  }
  if (act === "toggle-user") {
    const userName = btn.dataset.name;
    const currentActive = btn.dataset.active === "true";
    try {
      await api("profile_toggle_user", { name: userName, active: !currentActive });
      await refresh(false);
      showToast(`Usuario ${!currentActive ? 'activado' : 'desactivado'}.`);
    } catch (err) { alert(err.message); }
    return;
  }
  if (act === "new-client") {
    openModal(`
      <div class="modal-head"><h2>➕ Registrar Cliente Frecuente</h2><button class="close-button" data-action="close">×</button></div>
      <form id="new-client-form" class="form-grid">
        <label class="field"><span class="field-label">NOMBRE DEL CLIENTE</span><input name="name" required placeholder="Ej. María González"></label>
        <label class="field"><span class="field-label">TELÉFONO / WHATSAPP</span><input name="phone" type="tel" placeholder="04XXXXXXXXX"></label>
        <label class="field"><span class="field-label">¿REQUIERE DELIVERY?</span>
          <select name="delivery">
            <option value="No">No – Retira en tienda / local</option>
            <option value="Sí">Sí – Se le envía a domicilio</option>
          </select>
        </label>
        <label class="field"><span class="field-label">ZONA / SECTOR (Ej: Norte, Los Palos Grandes)</span><input name="zona" placeholder="Ej. Norte, Sur, Este..."></label>
        <label class="field"><span class="field-label">DIRECCIÓN EXACTA DE ENTREGA</span><input name="direccion" placeholder="Ej. Calle 5 con Av. Principal, Res. Las Flores, Apto 2B"></label>
        <div class="modal-footer">
          <button type="button" class="secondary-button" data-action="close">Cancelar</button>
          <button type="submit" class="primary-button">Guardar Cliente</button>
        </div>
      </form>
    `);
    document.getElementById("new-client-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const b = ev.target.querySelector(".primary-button");
      b.disabled = true;
      try {
        await api("profile_create_client", Object.fromEntries(new FormData(ev.target)));
        closeModal();
        await refresh(false);
        showToast("Cliente guardado con éxito.");
      } catch (err) {
        b.disabled = false;
        alert(`Error: ${err.message}`);
      }
    });
    return;
  }
  if (act === "delete-client") {
    if (confirm(`¿Eliminar el cliente "${btn.dataset.name}" de Google Sheets?`)) {
      try {
        await api("profile_delete_client", { name: btn.dataset.name });
        await refresh(false);
        showToast("Cliente eliminado.");
      } catch (err) { alert(err.message); }
    }
    return;
  }
  if (act === "new-type") {
    const typeName = prompt("Ingresa el nuevo tipo de trabajo:");
    if (typeName && typeName.trim()) {
      try {
        await api("profile_create_type", { type: typeName.trim() });
        await refresh(false);
        showToast("Tipo de trabajo agregado.");
      } catch (err) { alert(err.message); }
    }
    return;
  }
  if (act === "delete-type") {
    if (confirm(`¿Eliminar el tipo de trabajo "${btn.dataset.type}" de Google Sheets?`)) {
      try {
        await api("profile_delete_type", { type: btn.dataset.type });
        await refresh(false);
        showToast("Tipo de trabajo eliminado.");
      } catch (err) { alert(err.message); }
    }
    return;
  }
  if (act === "new-motivo") {
    openModal(`
      <div class="modal-head"><h2>🎨 Registrar Motivo / Temática</h2><button class="close-button" data-action="close">×</button></div>
      <form id="new-motivo-form" class="form-grid">
        <label class="field"><span class="field-label">NOMBRE DEL MOTIVO / TEMÁTICA</span>
          <input name="motivo" required placeholder="Ej. Hello Kitty, Tarzán, Spider-Man, Cumpleaños 15...">
        </label>
        <div class="modal-footer">
          <button type="button" class="secondary-button" data-action="close">Cancelar</button>
          <button type="submit" class="primary-button">Guardar Motivo</button>
        </div>
      </form>
    `);
    document.getElementById("new-motivo-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const bm = ev.target.querySelector(".primary-button");
      bm.disabled = true;
      try {
        const val = ev.target.motivo.value.trim();
        await api("profile_create_motivo", { motivo: val });
        closeModal();
        await refresh(false);
        showToast("Motivo guardado en el catálogo.");
      } catch (err) {
        bm.disabled = false;
        alert(`Error: ${err.message}`);
      }
    });
    return;
  }
  if (act === "delete-motivo") {
    const targetM = btn.dataset.motivo;
    if (confirm(`¿Eliminar el motivo "${targetM}" del catálogo?`)) {
      try {
        await api("profile_delete_motivo", { motivo: targetM });
        await refresh(false);
        showToast("Motivo eliminado.");
      } catch (err) { alert(err.message); }
    }
    return;
  }
  if (act === "request-push-perm") {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      showToast("🔔 ¡Notificaciones activadas con éxito!");
      checkAndSendPushNotifications();
    } else {
      alert("Permiso de notificaciones no concedido. Habilítalo en la configuración del navegador.");
    }
    return;
  }
  if (act === "delete-order") {
    if (confirm(`¿Eliminar el pedido "${btn.dataset.id}" del sistema?`)) {
      try {
        await api("profile_delete_order", { id: btn.dataset.id });
        closeModal();
        await refresh(false);
        showToast("Pedido eliminado.");
      } catch (err) { alert(err.message); }
    }
    return;
  }
  if (act === "archive-old-orders") {
    if (confirm("¿Deseas mover los proyectos terminados de más de 60 días al libro histórico para acelerar la aplicación?")) {
      try {
        const res = await api("profile_archive_old_orders", { days: 60 });
        await refresh(false);
        showToast(res.mensaje || "Archivado completado.");
      } catch (err) { alert(err.message); }
    }
    return;
  }
  if (act === "reopen-order") {
    if (confirm(`¿Deseas reabrir el proyecto "${btn.dataset.id}" y devolverlo a la lista de pedidos activos?`)) {
      try {
        await api("profile_reopen_order", { id: btn.dataset.id });
        closeModal();
        await refresh(false);
        showToast("Proyecto reabierto y devuelto a la lista activa.");
      } catch (err) { alert(err.message); }
    }
    return;
  }
  if (act === "mark-delivered") {
    try {
      await api("profile_update_order", { id: btn.dataset.id, changes: { estado: "Entregado" } });
      closeModal();
      await refresh(false);
      showToast("Proyecto marcado como Entregado.");
    } catch (err) { alert(err.message); }
    return;
  }
});

// ============================================================
// INICIALIZACIÓN — siempre decide qué vista es visible
// ============================================================
function showLogin() {
  const loginEl     = document.getElementById("login-view");
  const workspaceEl = document.getElementById("workspace");
  if (loginEl)     { loginEl.style.display     = "flex"; }
  if (workspaceEl) { workspaceEl.style.display  = "none"; }
}

function showWorkspace() {
  const loginEl     = document.getElementById("login-view");
  const workspaceEl = document.getElementById("workspace");
  if (loginEl)     { loginEl.style.display     = "none"; }
  if (workspaceEl) { workspaceEl.style.display  = "flex"; }
}

// Ajustar referencia en login submit
const loginFormEl = document.getElementById("login-form");
if (loginFormEl) {
  loginFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("login-error");
    try {
      const res = await api("profile_login", {
        name: document.getElementById("login-name").value.trim(),
        pin:  document.getElementById("login-pin").value.trim()
      });
      state.session = res.session;
      store.set("pp_profile_session", state.session);
      showWorkspace();
      await refresh(false);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  });
}

document.getElementById("refresh")?.addEventListener("click", () => refresh());

document.querySelectorAll(".nav-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.screen = btn.dataset.screen || "now";
    state.searchQuery = ""; // Limpiar filtro de búsqueda al cambiar de vista
    render();
  });
});

// Aplicar tema y decidir vista inicial
applyTheme();
if (state.session) {
  showWorkspace();
  refresh(false);
} else {
  showLogin();
}
