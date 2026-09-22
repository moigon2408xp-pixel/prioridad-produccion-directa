
// Helper para obtener el equipo real activo de Creaciones JJ (sin nombres de relleno)
function getRealTeamList() {
  const users = (state.data?.users || []).filter(u => {
    const n = String(u.name || u.nombre || "").trim().toLowerCase();
    const act = u.active !== false && u.activo !== false;
    // Excluir Eloy (ya no trabaja allí) y placeholders ficticios
    return act && n !== 'eloy' && n !== 'nelson' && n !== 'yolber' && n !== 'yenny' && n !== 'andreina';
  });
  const names = users.map(u => u.name || u.nombre);
  if (names.length) return names;
  // Fallback al equipo oficial de Creaciones JJ
  return ["Moises", "Julieta", "Camila", "Jeanette", "Valentina"];
}


// Helper robusto para calcular minutos reales en mesa de trabajo
function getOrderElapsedMinutes(order) {
  if (!order) return 0;
  let startMs = NaN;
  
  if (order.inicioProduccion) {
    const parsed = new Date(order.inicioProduccion).getTime();
    if (!isNaN(parsed) && parsed <= Date.now() + 60000) {
      startMs = parsed;
    }
  }
  
  // Si no hay inicioProduccion válido o está en el futuro (error de fecha fija), buscar en notas
  if (isNaN(startMs) || startMs > Date.now()) {
    const notas = String(order.notas || "");
    const match = notas.match(/\[(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-[^\]]+\]:\s*.*(?:producción|produccion|mesa)/i);
    if (match) {
      let [_, d, m, y, hh, mm, ap] = match;
      let h = parseInt(hh, 10);
      if (ap && ap.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ap && ap.toUpperCase() === 'AM' && h === 12) h = 0;
      const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), h, parseInt(mm, 10), 0);
      if (!isNaN(dt.getTime()) && dt.getTime() <= Date.now()) {
        startMs = dt.getTime();
      }
    }
  }
  
  if (isNaN(startMs)) {
    return Number(order.duracionRealMin || 0);
  }
  
  const rawMins = Math.floor((Date.now() - startMs) / 60000);
  const pausedMins = Number(order.tiempoPausadoMin || 0);
  return Math.max(0, rawMins - pausedMins);
}

// Formatear minutos a formato humano (horas y minutos)
function formatMinutesToHuman(minutes) {
  if (!minutes || minutes <= 0) return "0 min";
  
  // Siempre mostrar en formato horas y minutos cuando es mayor a 60 minutos
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} hora${hours > 1 ? 's' : ''}`;
    }
    
    return `${hours} hora${hours > 1 ? 's' : ''} y ${remainingMinutes} min`;
  }
  
  // Solo minutos si es menos de 60
  return `${minutes} min`;
}

// Ticker global que actualiza los badges de cronómetro en vivo en el DOM cada 10 segundos (optimizado para móvil)
if (!window._stopwatchInterval) {
  window._stopwatchInterval = setInterval(() => {
    try {
      document.querySelectorAll('.live-stopwatch-badge[data-order-id]').forEach(el => {
        const id = el.getAttribute('data-order-id');
        const allTarget = (state.data?.allOrders || []).concat(state.data?.myOrders || []);
        const ord = allTarget.find(o => String(o.id) === String(id));
        if (!ord) return;
        
        const mins = getOrderElapsedMinutes(ord);
        const human = formatMinutesToHuman(mins);
        el.textContent = human;
      });
    } catch(e) {
      console.error("Error actualizando cronómetros:", e);
    }
  }, 10000); // 10 segundos para móvil (reducido de 30s)
}

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
  
  // Aplicar colores personalizados si existen
  if (customColors.primary) {
    cssRules.push(`--primary-color: ${customColors.primary} !important;`);
    cssRules.push(`--primary-hover: ${customColors.primary} !important;`);
  } else {
    // Aplicar colores preestablecidos según el accent
    const accentColors = {
      blue: "#1e3a8a",
      emerald: "#065f46", 
      purple: "#581c87",
      amber: "#78350f"
    };
    if (accentColors[currentAccent]) {
      cssRules.push(`--primary-color: ${accentColors[currentAccent]} !important;`);
      cssRules.push(`--primary-hover: ${accentColors[currentAccent]} !important;`);
    }
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

// Temas preestablecidos: los botones de Ajustes llaman a estas funciones
const PRESET_ACCENTS = ["blue", "emerald", "purple", "amber"];
const PRESET_NAMES = { blue: "Azul Real", emerald: "Esmeralda", purple: "Púrpura", amber: "Ámbar" };

function setPresetTheme(name) {
  if (PRESET_ACCENTS.indexOf(name) === -1) name = "blue";
  store.remove("pp_custom_colors");
  store.set("pp_accent", name);
  applyTheme();
  showToast("🎨 Tema aplicado: " + (PRESET_NAMES[name] || name));
}

function resetDefaultTheme() {
  resetCustomTheme();
}

window.setPresetTheme = setPresetTheme;
window.resetDefaultTheme = resetDefaultTheme;
window.setAccent = setAccent;
window.resetCustomTheme = resetCustomTheme;
window.saveCustomColor = saveCustomColor;
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
  
  // 1. Si viene como ISO (ej: 2026-09-04T13:00:00 o 2026-09-04T13:00:00.000Z)
  if (str.includes("T")) {
    const parts = str.split("T");
    const dateParts = parts[0].split("-");
    if (dateParts.length === 3) {
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      let hours = 18;
      let minutes = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(":");
        if (timeParts.length >= 2) {
          hours = parseInt(timeParts[0], 10);
          minutes = parseInt(timeParts[1], 10);
        }
      }
      const parsed = new Date(year, month, day, hours, minutes);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  
  // 2. Si viene como DD/MM/YYYY
  if (str.includes("/")) {
    const parts = str.split(" ")[0].split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      let hours = 18;
      let minutes = 0;
      const timeMatch = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const ap = timeMatch[3] ? timeMatch[3].toUpperCase() : "";
        if (ap === "PM" && hours < 12) hours += 12;
        if (ap === "AM" && hours === 12) hours = 0;
      }
      const parsed = new Date(year, month, day, hours, minutes);
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
    cerrado: String(o.cerrado || o.Cerrado || "No").trim(),
    costo: Number(o.costo || o.Costo || o.precio || o.monto || 0),
    colaboradores: o.colaboradores || o.Colaboradores || "",
    waNotificado: String(o.waNotificado || o.WhatsApp_Notificado || o.wanotificado || "No").trim()
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
  frequentClients: store.get("pp_profile_clients", []),
  frequentMotivos: store.get("pp_profile_motivos", []),
  frequentTypes: store.get("pp_profile_types", []),
  schedules: store.get("pp_profile_schedules", []),
  waTemplate: store.get("pp_wa_template", "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega."),
  screen: "now",
  searchQuery: "",
  perfTimeframe: "today",
  offline: false,
  systemErrors: [],
  activeAlerts: [],
  data: store.get("pp_profile_data", { myOrders: [], teamCritical: [], allOrders: [], finishedOrders: [], users: [], dailyPerformance: {} }),
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
  today: "Hacer próximamente",
  later: "Programado"
};

const active = (order) => {
  const est = String(order.estado || "").toLowerCase().trim();
  const cer = String(order.cerrado || "").toLowerCase().trim();
  return cer !== "sí" && cer !== "si" && est !== "terminado" && est !== "entregado" && est !== "cancelado";
};

const operable = (order) => active(order);
const isLead = () => {
  const r = String(state.session?.role || "").toLowerCase().trim();
  return ["manager", "jefe", "jefa", "recepcionista"].includes(r);
};

const canSeeOrderAlert = (order) => {
  const r = String(state.session?.role || "").toLowerCase().trim();
  const currentUser = String(state.session?.name || "").toLowerCase().trim();
  const orderResp = String(order.responsable || "").toLowerCase().trim();
  
  console.log("canSeeOrderAlert check:", { role: r, currentUser, orderResp, match: currentUser === orderResp });
  
  // Gerencia, jefes y recepcionistas ven todas las alertas
  if (["manager", "jefe", "jefa", "recepcionista"].includes(r)) {
    console.log("User is lead, can see all alerts");
    return true;
  }
  
  // Trabajadores solo ven alertas de sus propios pedidos
  if (r === "trabajador" || r === "trabajadora") {
    const canSee = currentUser === orderResp;
    console.log("Worker can see alert:", canSee);
    return canSee;
  }
  
  console.log("User role not recognized, hiding alerts");
  return false;
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
  
  // 1. Detección de Cliente / Nombre (soporte formal e informal)
  const clienteMatch = rawText.match(/(?:cliente|nombre|para|festejado|comprador|de|del|la)[:\s]+([^\n\r,*]+)/i);
  if (clienteMatch) {
    result.cliente = clienteMatch[1].trim();
  } else {
    // Buscar en directorio de clientes guardados (coincidencia parcial mejorada)
    let bestMatch = null;
    let bestScore = 0;
    
    for (const c of (state.frequentClients || [])) {
      if (!c.name) continue;
      
      const clientName = c.name.toLowerCase();
      const lowerText = rawText.toLowerCase();
      
      // Coincidencia exacta
      if (lowerText.includes(clientName)) {
        bestMatch = c;
        bestScore = 100;
        break;
      }
      
      // Coincidencia de palabras (split por espacios)
      const clientWords = clientName.split(/\s+/);
      const textWords = lowerText.split(/\s+/);
      let matchCount = 0;
      
      for (const cWord of clientWords) {
        if (cWord.length > 2 && textWords.some(tWord => tWord.includes(cWord) || cWord.includes(tWord))) {
          matchCount++;
        }
      }
      
      const score = (matchCount / clientWords.length) * 100;
      if (score > bestScore && score > 50) {
        bestMatch = c;
        bestScore = score;
      }
    }
    
    if (bestMatch) {
      result.cliente = bestMatch.name;
      if (bestMatch.phone) result.telefono = bestMatch.phone;
      console.log("Cliente encontrado por coincidencia parcial:", bestMatch.name, "Score:", bestScore);
    } else if (lines.length > 0 && !lines[0].includes(":")) {
      result.cliente = lines[0].replace(/^(?:hola|buenas|saludos|de|la|el|un|una)\b,?\s*/i, "").trim();
    }
  }
  
  // Validar que el cliente exista en la lista de clientes frecuentes
  if (result.cliente) {
    const clientExists = state.frequentClients?.some(c => c.name.toLowerCase() === result.cliente.toLowerCase());
    if (!clientExists) {
      console.log("Cliente no encontrado en lista frecuente:", result.cliente);
    }
  }
  
  // 2. Teléfono / WhatsApp
  if (!result.telefono) {
    const phoneMatch = rawText.match(/(\+?58\s?)?0?4\d{2}[\s-]?\d{7}|\b\d{10,11}\b/);
    if (phoneMatch) {
      result.telefono = cleanPhoneNumber(phoneMatch[0]);
    }
  }
  
  // 3. Motivo / Temática (soporte formal e informal)
  const motivoMatch = rawText.match(/(?:motivo|temática|tematica|tema|personaje|de|del|con|para|con)[:\s]+([^\n\r,*]+)/i);
  if (motivoMatch) {
    result.motivo = motivoMatch[1].trim();
  } else {
    // Buscar coincidencia parcial mejorada en motivos frecuentes
    let bestMotivoMatch = null;
    let bestMotivoScore = 0;
    
    for (const m of (state.frequentMotivos || [])) {
      if (!m) continue;
      
      const motivoName = m.toLowerCase();
      const lowerText = rawText.toLowerCase();
      
      // Coincidencia exacta
      if (lowerText.includes(motivoName)) {
        bestMotivoMatch = m;
        bestMotivoScore = 100;
        break;
      }
      
      // Coincidencia de palabras
      const motivoWords = motivoName.split(/\s+/);
      const textWords = lowerText.split(/\s+/);
      let matchCount = 0;
      
      for (const mWord of motivoWords) {
        if (mWord.length > 2 && textWords.some(tWord => tWord.includes(mWord) || mWord.includes(tWord))) {
          matchCount++;
        }
      }
      
      const score = (matchCount / motivoWords.length) * 100;
      if (score > bestMotivoScore && score > 50) {
        bestMotivoMatch = m;
        bestMotivoScore = score;
      }
    }
    
    if (bestMotivoMatch) {
      result.motivo = bestMotivoMatch;
      console.log("Motivo encontrado por coincidencia parcial:", bestMotivoMatch, "Score:", bestMotivoScore);
    } else {
      // Detección informal: "de Barbie", "de Avengers", "de Frozen"
      const informalMatch = rawText.match(/(?:de|del|con|para)\s+([A-Z][a-zÁÉÍÓÚÑáéíóúñ]+)/i);
      if (informalMatch && !result.motivo) {
        result.motivo = informalMatch[1].trim();
        console.log("Motivo detectado informalmente:", result.motivo);
      }
    }
  }

  // 4. Tipo de Trabajo
  const typeMatch = rawText.match(/(?:tipo|trabajo|producto|servicio|item|pedido)[:\s]+([^\n\r,*]+)/i);
  if (typeMatch) {
    result.tipo = typeMatch[1].trim();
  } else {
    // Buscar en tipos frecuentes con coincidencia parcial mejorada
    let bestTypeMatch = null;
    let bestTypeScore = 0;
    
    for (const t of (state.frequentTypes || [])) {
      if (!t) continue;
      
      const typeName = t.toLowerCase();
      const lowerText = rawText.toLowerCase();
      
      // Coincidencia exacta
      if (lowerText.includes(typeName)) {
        bestTypeMatch = t;
        bestTypeScore = 100;
        break;
      }
      
      // Coincidencia de palabras
      const typeWords = typeName.split(/\s+/);
      const textWords = lowerText.split(/\s+/);
      let matchCount = 0;
      
      for (const tWord of typeWords) {
        if (tWord.length > 2 && textWords.some(tWord => tWord.includes(tWord) || tWord.includes(tWord))) {
          matchCount++;
        }
      }
      
      const score = (matchCount / typeWords.length) * 100;
      if (score > bestTypeScore && score > 50) {
        bestTypeMatch = t;
        bestTypeScore = score;
      }
    }
    
    if (bestTypeMatch) {
      result.tipo = bestTypeMatch;
      console.log("Tipo encontrado por coincidencia parcial:", bestTypeMatch, "Score:", bestTypeScore);
    } else {
      // Fallback a detección de palabras clave
      if (/topper/i.test(rawText)) result.tipo = "Topper";
      else if (/piñata|pinata/i.test(rawText)) result.tipo = "Piñata";
      else if (/maqueta/i.test(rawText)) result.tipo = "Maqueta";
      else if (/banderín|banderin/i.test(rawText)) result.tipo = "Banderín";
      else if (/caja/i.test(rawText)) result.tipo = "Caja Explosiva";
    }
  }
  
  // Validar que el tipo exista en la lista de tipos frecuentes
  if (result.tipo) {
    const typeExists = state.frequentTypes?.some(t => t.toLowerCase() === result.tipo.toLowerCase());
    if (!typeExists) {
      console.log("Tipo no encontrado en lista frecuente:", result.tipo);
    }
  }
  
  // 5. Fecha de Entrega (Días de la semana, 'mañana', 'hoy', 'pasado mañana', o fechas DD/MM/YYYY)
  const lowerText = rawText.toLowerCase();
  const today = new Date();
  
  if (/\bmañana\b/.test(lowerText)) {
    const tom = new Date(today);
    tom.setDate(tom.getDate() + 1);
    result.fechaEntrega = tom.toISOString().split("T")[0];
    console.log("Fecha detectada: mañana =", result.fechaEntrega);
  } else if (/\bhoy\b/.test(lowerText)) {
    result.fechaEntrega = today.toISOString().split("T")[0];
    console.log("Fecha detectada: hoy =", result.fechaEntrega);
  } else if (/\bpasado mañana\b/.test(lowerText)) {
    const tom = new Date(today);
    tom.setDate(tom.getDate() + 2);
    result.fechaEntrega = tom.toISOString().split("T")[0];
    console.log("Fecha detectada: pasado mañana =", result.fechaEntrega);
  } else {
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado"];
    const dayMatch = rawText.match(/(?:entregar|fecha|para|el|el dia|día|el día)[:\s]*([a-záéíóúñ]+)/i);
    
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
        console.log("Fecha detectada por día de semana:", matchedWord, "=", result.fechaEntrega);
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
    
    if (ampm === 'PM' && hourNum < 12) hourNum += 12;
    if (ampm === 'AM' && hourNum === 12) hourNum = 0;
    
    result.horaEntrega = `${hourNum.toString().padStart(2, '0')}:${minStr} ${ampm}`;
  }

  return result;
}

// HTTP API Fetch Handler con tiempo límite anti-congelamiento
async function api(action, extra = {}, timeoutMs = null) {
  const baseUrl = window.PRIORIDAD_CONFIG?.appsScriptUrl || "https://script.google.com/macros/s/AKfycby_mIt5VzEOZjKb6znpYXH_T0Q0jJfEqr5UB1Z8l0JpUiHfEC9CuRuK9z2s_Q3lNl6www/exec";
  const payload = { action, user: state.session?.name || "", userTipo: state.session?.tipo || "taller", token: state.session?.token || "", ...extra };
  
  // Timeout extendido para creación, fotos, actualización o eliminación (GAS + Drive suelen tardar 15-30s)
  const isHeavy = ["profile_create_order", "profile_update_order", "profile_delete_order", "profile_archive_old_orders"].includes(action) || extra.referenceImages || extra.images;
  const finalTimeout = timeoutMs || (isHeavy ? 60000 : 35000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), finalTimeout);

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (data && (data.ok || data.exito)) return data;
    throw new Error(data?.error || data?.mensaje || "Error al procesar la solicitud.");
  } catch (err) {
    clearTimeout(timeoutId);
    state.systemErrors = state.systemErrors || [];
    // El re-login silencioso en segundo plano no debe llenar el panel de alertas
    if (action !== "profile_login") {
      state.systemErrors.unshift({
        action: action,
        error: err.message || String(err),
        time: new Date().toLocaleTimeString()
      });
      if (state.systemErrors.length > 20) state.systemErrors.pop();
    }
    if (window.checkTallerAlertas) setTimeout(window.checkTallerAlertas, 100);
    if (err.name === 'AbortError') {
      throw new Error("La conexión con Google Sheets tardó demasiado. Revisa tu internet o vuelve a intentar.");
    }
    if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
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

    const rawSchedules = rawData.schedules || rawData.horarios || [];
    state.schedules = rawSchedules;

    state.data = {
      myOrders: (rawData.myOrders || []).map(normalizeOrder).map(sanitizeOrderPhone),
      teamCritical: (rawData.teamCritical || []).map(normalizeOrder).map(sanitizeOrderPhone),
      allOrders: (rawData.allOrders || rawData.allorders || []).map(normalizeOrder).map(sanitizeOrderPhone),
      finishedOrders: (rawData.finishedOrders || rawData.pedidosTerminados || []).map(normalizeOrder).map(sanitizeOrderPhone),
      users: (rawData.allUsers || rawData.users || []).map(normalizeUser),
      dailyPerformance: rawData.dailyPerformance || {},
      schedules: rawSchedules,
      horarios: rawSchedules,
      inventory: rawData.inventory || [],
      workshopPrices: rawData.workshopPrices || [],
      geminiApiKey: rawData.geminiApiKey || ""
    };
    
    // Si hay API key del backend, usarla (prioridad sobre local)
    if (rawData.geminiApiKey) {
      window.setGeminiApiKey(rawData.geminiApiKey);
    }
    
    state.waTemplate = rawData.waTemplate || state.waTemplate;
    state.offline = false;
    
    store.set("pp_profile_data", state.data);
    store.set("pp_profile_clients", state.frequentClients);
    store.set("pp_profile_types", state.frequentTypes);
    store.set("pp_profile_motivos", state.frequentMotivos);
    store.set("pp_profile_schedules", rawSchedules);

    // Detección de orden de actualización forzada por el Manager
    const serverVer = String(rawData.appVersion || rawData.version || "");
    const localVer = store.get("pp_app_version", "");
    console.log("Version check - Server:", serverVer, "Local:", localVer);
    
    if (serverVer && localVer && serverVer !== localVer) {
      store.set("pp_app_version", serverVer);
      console.log("Version mismatch detected, forcing reload");
      
      // Mostrar modal de actualización forzada
      const updateModal = document.createElement('div');
      updateModal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); display:flex; justify-content:center; align-items:center; z-index:99999;';
      updateModal.innerHTML = `
        <div style="background:var(--bg-card); border-radius:16px; padding:32px; max-width:420px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
          <div style="font-size:48px; margin-bottom:16px;">🚀</div>
          <h2 style="margin:0 0 12px 0; color:#0ea5e9; font-size:24px;">Actualización Forzada</h2>
          <p style="margin:0 0 20px 0; color:var(--text-main); font-size:15px; line-height:1.5;">
            Gerencia ha enviado una actualización obligatoria del sistema.
          </p>
          <p style="margin:0 0 24px 0; color:var(--text-muted); font-size:13px;">
            La página se recargará automáticamente en <span id="countdown">5</span> segundos...
          </p>
          <div style="width:100%; height:4px; background:var(--border-color); border-radius:2px; overflow:hidden;">
            <div id="progress-bar" style="width:0%; height:100%; background:#0ea5e9; transition:width 1s linear;"></div>
          </div>
        </div>
      `;
      document.body.appendChild(updateModal);
      
      let countdown = 5;
      const countdownEl = document.getElementById('countdown');
      const progressEl = document.getElementById('progress-bar');
      
      const updateInterval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = countdown;
        if (progressEl) progressEl.style.width = ((5 - countdown) / 5 * 100) + '%';
        
        if (countdown <= 0) {
          clearInterval(updateInterval);
          window.location.reload(true);
        }
      }, 1000);
      
      return;
    }
    if (serverVer) {
      store.set("pp_app_version", serverVer);
    }

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

  // 3. Notificar a Jefes / Managers sobre pedidos terminados pendientes de revisión o entrega
  if (isLead()) {
    const finished = state.data.finishedOrders || [];
    const pendingReview = finished.filter(o => {
      const est = String(o.estado || "").toLowerCase().trim();
      return est === "terminado"; // terminado por el trabajador pero aún no entregado
    });

    let notifiedIds = {};
    try {
      notifiedIds = JSON.parse(localStorage.getItem("pp_notified_finished_orders") || "{}");
    } catch(e) {}

    let newlyNotified = false;
    pendingReview.forEach(o => {
      if (!notifiedIds[o.id]) {
        notifiedIds[o.id] = Date.now();
        newlyNotified = true;
        new Notification(`🔔 Pedido Terminado: ${o.id} – ${o.cliente}`, {
          body: `¡${o.responsable || 'Un trabajador'} terminó el pedido (${o.tipo}${o.motivo ? ' · ' + o.motivo : ''})! Pulsa para revisar evidencias y marcar como Entregado.`,
          icon: "./logo_creaciones_jj.png"
        });
      }
    });

    if (newlyNotified) {
      try {
        localStorage.setItem("pp_notified_finished_orders", JSON.stringify(notifiedIds));
      } catch(e) {}
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

  // Detectar si tiene foto/factura física adjunta
  const hasPhysicalInvoice = !!(order.fotoReferencia || order.referencias || order.fotoEvidencia || order.evidenciasDrive);

  return `<button class="${cardClass}" data-action="detail" data-id="${escapeHtml(order.id)}" style="display:flex; flex-direction:column; text-align:left; width:100%; box-sizing:border-box; overflow-wrap:anywhere; word-break:break-word; white-space:normal;">
    <div class="cc-top" style="width:100%; box-sizing:border-box;">
      <div class="cc-left" style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span class="cc-id" style="font-family:monospace; font-weight:800; color:var(--text-muted);">${escapeHtml(order.id)}</span>
          <span class="cc-client" style="font-weight:800; font-size:14px; color:var(--text-main);">${escapeHtml(order.cliente)}</span>
        </div>
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:3px;">
          ${order.motivo ? `<span class="badge-motivo-sm">🎨 ${escapeHtml(order.motivo)}</span>` : ''}
          ${disenoBadge}
          ${(() => {
            // Prioridad: mostrar tiempo en vivo si está en proceso, o tiempo finalizado si está terminado
            if (order.estado === 'En proceso' && order.inicioProduccion) {
              const startMs = new Date(order.inicioProduccion).getTime();
              if (!isNaN(startMs)) {
                const elMin = Math.max(0, Math.round((Date.now() - startMs) / 60000) - (Number(order.tiempoPausadoMin) || 0));
                return `<span class="live-stopwatch-badge" data-order-id="${escapeHtml(order.id)}"><i class="fas fa-stopwatch"></i> ${elMin} min en mesa</span>`;
              }
            } else if (order.estado === 'Pausado') {
              return `<span style="background:rgba(245,158,11,0.15); color:#d97706; padding:2px 7px; border-radius:12px; font-size:10px; font-weight:800;"><i class="fas fa-pause-circle"></i> Pausado</span>`;
            } else if (order.duracionRealMin && Number(order.duracionRealMin) > 0) {
              console.log("Mostrando duracionRealMin en tarjeta:", order.id, order.duracionRealMin);
              return `<span style="background:rgba(16,185,129,0.15); color:#10b981; padding:2px 7px; border-radius:12px; font-size:10px; font-weight:800;"><i class="fas fa-stopwatch"></i> ${order.duracionRealMin} min</span>`;
            } else if (order.inicioProduccion && !order.duracionRealMin) {
              // Si está terminado pero no tiene duraciónRealMin, calcular del inicioProduccion
              const startMs = new Date(order.inicioProduccion).getTime();
              if (!isNaN(startMs)) {
                const elMin = Math.max(0, Math.round((Date.now() - startMs) / 60000) - (Number(order.tiempoPausadoMin) || 0));
                return `<span style="background:rgba(16,185,129,0.15); color:#10b981; padding:2px 7px; border-radius:12px; font-size:10px; font-weight:800;"><i class="fas fa-stopwatch"></i> ${elMin} min</span>`;
              }
            }
            return '';
          })()}
          ${(() => {
            let subs = [];
            try {
              subs = Array.isArray(order.subItems) ? order.subItems : (typeof order.subItems === 'string' && order.subItems ? JSON.parse(order.subItems) : []);
            } catch(e) {}
            if (Array.isArray(subs) && subs.length > 0) {
              const doneCount = subs.filter(s => s.completado || s.done).length;
              return `<span style="background:rgba(14,165,233,0.12); color:#0284c7; font-size:10px; font-weight:800; padding:2px 7px; border-radius:20px;"><i class="fas fa-layer-group"></i> ${subs.length} trabajos (${doneCount}/${subs.length})</span>`;
            }
            return '';
          })()}
          ${hasPhysicalInvoice ? `<span style="background:rgba(245,158,11,0.15); color:#d97706; font-size:10px; font-weight:800; padding:2px 7px; border-radius:12px;"><i class="fas fa-file-invoice"></i> Nota/Factura</span>` : ''}
          ${hasDelivery ? `<span class="badge-delivery">🚚 ${escapeHtml(deliveryInfo.zona || 'Delivery')}</span>` : ''}
          ${(() => {
            let colabs = [];
            try { colabs = typeof order.colaboradores === 'string' ? JSON.parse(order.colaboradores) : order.colaboradores; } catch(e) {}
            if (Array.isArray(colabs) && colabs.length > 0) {
              const prevW = colabs[colabs.length - 1].trabajador;
              return `<span style="background:rgba(79,70,229,0.12); color:#4f46e5; font-size:10px; font-weight:800; padding:1px 6px; border-radius:20px;">👥 En equipo (${escapeHtml(prevW)} ➔ ${escapeHtml(order.responsable)})</span>`;
            }
            return '';
          })()}
        </div>
      </div>
      <div class="cc-right" style="flex-shrink:0;">
        ${isOverdue ? '<span class="pill-overdue">🚨 RETRASADO</span>' : ''}
        ${isNow && !isOverdue ? '<span class="pill-urgent">⚡ Hacer ahora</span>' : ''}
        ${isToday && !isOverdue ? '<span class="pill-today">⏳ Hacer próximamente</span>' : ''}
        ${!isOverdue && !isNow && !isToday ? '<span class="pill-later">📅 Programado</span>' : ''}
      </div>
    </div>
    <div class="cc-meta" style="width:100%; box-sizing:border-box; overflow-wrap:anywhere; word-break:break-word; white-space:normal; margin-top:4px;">
      <span>${escapeHtml(order.tipo || 'Sin tipo')}</span>
      <span>·</span>
      <span>${escapeHtml(formatDate(order.entrega))}</span>
      <span>·</span>
      <span>${escapeHtml(order.responsable)}</span>
      ${order.telefono ? `<span>·</span><span>📞 ${escapeHtml(order.telefono)}</span>` : ''}
    </div>
    ${deadlineInterno ? `<div class="cc-delivery-warning">${deadlineInterno}</div>` : ''}
    ${order.notas ? `
      <div style="font-size:11px; color:#d97706; background:rgba(217,119,6,.1); border:1px solid rgba(217,119,6,.3); border-radius:6px; padding:4px 8px; margin-top:4px; font-weight:600; line-height:1.4; overflow-wrap:anywhere; word-break:break-word; width:100%; box-sizing:border-box;">
        📝 ${escapeHtml(order.notas.split('\n').pop() || order.notas)}
      </div>
    ` : ''}
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
    (state.data.allOrders || []).filter(o => active(o) && priority(o) === 'overdue' && canSeeOrderAlert(o))
  );
  const urgentOrders = sortOrdersByUrgency(
    (state.data.allOrders || []).filter(o => active(o) && priority(o) === 'now' && canSeeOrderAlert(o))
  );
  // Solo mostrar banner crítico a gerencia/jefes (no a trabajadores)
  const showCriticalBanner = isLead();
  const criticalBanner = showCriticalBanner && (overdueOrders.length > 0 || urgentOrders.length > 0) ? `
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
  const rawOrders = (state.data.finishedOrders || []).slice().sort((a, b) => {
    const dA = safeParseDate(a.finProduccion || a.entrega) || new Date(0);
    const dB = safeParseDate(b.finProduccion || b.entrega) || new Date(0);
    if (dA.getTime() !== dB.getTime()) return dB.getTime() - dA.getTime();
    const numA = parseInt((a.id.match(/\d+/) || [0])[0], 10);
    const numB = parseInt((b.id.match(/\d+/) || [0])[0], 10);
    return numB - numA;
  });
  const orders = filterOrdersBySearch(rawOrders);
  
  const pendingWa = orders.filter(o => o.telefono && o.waNotificado !== "Sí" && String(o.estado).toLowerCase() !== "cancelado");
  
  return `
    ${(isLead() && pendingWa.length > 0) ? `
      <div style="background:rgba(37,211,102,0.12); border:1px solid #25D366; border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <strong style="color:#15803d; font-size:13px;">📲 ${pendingWa.length} PEDIDO(S) LISTO(S) PENDIENTES DE AVISAR POR WHATSAPP</strong>
          <p style="margin:2px 0 0; font-size:12px; color:var(--text-muted);">Pulsa el botón verde en cada pedido desde el celular corporativo para avisar al cliente con un toque.</p>
        </div>
      </div>
    ` : ''}
    <div class="search-bar-container" style="margin-bottom:16px;">
      <span>🔍</span>
      <input type="text" id="history-search-input" placeholder="Buscar por cliente, teléfono, motivo, ID (PED-0001) o trabajador..." value="${escapeHtml(state.searchQuery)}">
    </div>
    ${!orders.length ? '<div class="empty"><strong>No hay proyectos terminados que coincidan con la búsqueda.</strong></div>' : `
      <div class="order-list">${orders.map((order) => {
        const refLinks = String(order.fotoReferencia || "").split("\n").filter(Boolean);
        const eviLinks = String(order.fotoEvidencia || "").split("\n").filter(Boolean);
        const isDelivered = String(order.estado).toLowerCase().trim() === "entregado";
        const isWaSent = String(order.waNotificado).toLowerCase().trim() === "sí" || String(order.waNotificado).toLowerCase().trim() === "si";
        const waBadge = isWaSent
          ? `<span style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:2px 8px; border-radius:12px;">✅ WhatsApp Enviado</span>`
          : (order.telefono ? `<span style="background:#fef3c7; color:#d97706; font-size:11px; font-weight:700; padding:2px 8px; border-radius:12px;">⚠️ WhatsApp Pendiente</span>` : '');
        
        return `
          <article class="order-card">
            <div class="order-top" data-action="detail" data-id="${escapeHtml(order.id)}" data-scope="finished">
              <div>
                <h3>${escapeHtml(order.cliente)} <small style="font-size:12px; color:var(--text-muted);">(${escapeHtml(order.id)})</small></h3>
                <p>${escapeHtml(order.tipo)}</p>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                  ${order.motivo ? `<span class="badge-motivo">🎨 Motivo: ${escapeHtml(order.motivo)}</span>` : ''}
                  ${waBadge}
                </div>
              </div>
              <span class="priority" style="background:${isDelivered ? '#059669' : '#2e7d32'}; color:white; padding:4px 8px; border-radius:4px;">${escapeHtml(order.estado)}</span>
            </div>
            <div class="meta" data-action="detail" data-id="${escapeHtml(order.id)}" data-scope="finished">
              Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>
              ${order.finProduccion ? `🏁 <strong>Terminado:</strong> <span style="color:#059669; font-weight:700;">${escapeHtml(formatDate(order.finProduccion))}</span><br/>` : ''}
              Responsable: ${escapeHtml(order.responsable)}<br/>
              ${order.telefono ? `📞 Teléfono: <strong>${escapeHtml(order.telefono)}</strong><br/>` : ''}
              ⏱️ Tiempo invertido: <strong>${order.duracionRealMin || 0} min</strong><br/>
              ${isLead() ? `<span style="color:#059669; font-weight:bold;">💵 Costo registrado: $${Number(order.costo || 0).toFixed(2)}</span><br/>` : ''}
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
                ${!isDelivered ? `<button class="secondary-button" style="background:var(--success-color); color:white; border:none; flex:1;" data-action="mark-delivered" data-id="${escapeHtml(order.id)}">📦 Marcar Entregado</button>` : ''}
                ${order.telefono ? `
                  <button class="secondary-button" style="background:#25D366; color:white; border:none; flex:1; display:flex; align-items:center; justify-content:center; gap:6px;" data-action="notify-wa-corporate" data-id="${escapeHtml(order.id)}" data-phone="${escapeHtml(order.telefono)}" data-client="${escapeHtml(order.cliente)}" data-type="${escapeHtml(order.tipo)}" data-motivo="${escapeHtml(order.motivo || '')}">
                    📲 ${isWaSent ? 'Reenviar WhatsApp' : 'Avisar WhatsApp (Corporativo)'}
                  </button>
                ` : ''}
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

    ${(() => {
      const readyOrders = (state.data.finishedOrders || []).filter(o => {
        const est = String(o.estado || "").toLowerCase().trim();
        return est === "terminado";
      });
      if (!readyOrders.length) return '';
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding:14px 18px; background:rgba(46,125,50,0.08); border:1px solid #2e7d32; border-radius:var(--radius-md); flex-wrap:wrap; gap:10px;">
          <div>
            <strong style="color:#1b5e20; font-size:14px;">📦 ${readyOrders.length} PEDIDO(S) TERMINADOS LISTOS EN TALLER</strong>
            <p style="margin:2px 0 0; font-size:12px; color:var(--text-muted);">Completados por los trabajadores, listos para revisión, entrega al cliente o aviso por WhatsApp.</p>
          </div>
          <button type="button" class="secondary-button" style="background:#2e7d32; color:white; border:none; padding:8px 14px; font-weight:bold; cursor:pointer;" onclick="state.screen='history'; render();">
            Ver en Historial (${readyOrders.length}) ➔
          </button>
        </div>
      `;
    })()}
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
  
  filtered.forEach(o => {
    if (String(o.estado || "").toLowerCase().trim() === "cancelado") return;
    const w = o.responsable || "Sin asignar";
    
    // Si tiene colaboradores previos por reasignación:
    let colabs = [];
    if (o.colaboradores) {
      try {
        colabs = typeof o.colaboradores === "string" ? JSON.parse(o.colaboradores) : o.colaboradores;
      } catch(e) {}
    }
    
    let totalColabMin = 0;
    if (Array.isArray(colabs) && colabs.length > 0) {
      colabs.forEach(c => {
        const cWorker = c.trabajador || "Colaborador";
        const cMin = Number(c.tiempoMin || 0);
        totalColabMin += cMin;
        
        if (!perfMap[cWorker]) {
          perfMap[cWorker] = { completed: 0, assisted: 0, totalMin: 0, orders: [] };
        }
        perfMap[cWorker].totalMin += cMin;
        perfMap[cWorker].assisted = (perfMap[cWorker].assisted || 0) + 1;
        perfMap[cWorker].orders.push({
          ...o,
          rolEnPedido: `Colaboración (${cMin} min - ${c.motivo || 'Reasignado'})`,
          tiempoAportado: cMin
        });
      });
    }
    
    if (!perfMap[w]) {
      perfMap[w] = { completed: 0, assisted: 0, totalMin: 0, orders: [] };
    }
    perfMap[w].completed += 1;
    const finalWorkerMin = Math.max(0, Number(o.duracionRealMin || 0) - totalColabMin);
    perfMap[w].totalMin += (totalColabMin > 0 ? finalWorkerMin : Number(o.duracionRealMin || 0));
    perfMap[w].orders.push({
      ...o,
      rolEnPedido: totalColabMin > 0 ? `Cierre (${finalWorkerMin} min / en equipo)` : 'Completado completo',
      tiempoAportado: (totalColabMin > 0 ? finalWorkerMin : Number(o.duracionRealMin || 0))
    });
  });
  
  return perfMap;
}

function openWorkerPerfModal(workerName, timeframe) {
  const tf = timeframe || state.perfTimeframe || "today";
  const tfLabels = { today: "Hoy", week: "Esta Semana", month: "Este Mes", all: "Histórico Completo" };
  const perfMap = computeWorkerPerformance(tf);
  const workerData = perfMap[workerName] || { completed: 0, assisted: 0, totalMin: 0, orders: [] };
  const workerOrders = workerData.orders || [];

  openModal(`
    <div class="modal-head">
      <h2>🏆 Rendimiento de ${escapeHtml(workerName)} (${tfLabels[tf] || tf})</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <div style="margin-bottom:16px; padding:12px; background:var(--bg-main); border-radius:var(--radius-md);">
      <p style="font-size:14px; font-weight:700;">Pedidos Cumplidos: <span style="color:var(--primary-color);">${workerData.completed}</span> ${workerData.assisted ? `<span style="color:#6366f1; font-size:12px; margin-left:6px;">(+${workerData.assisted} colaboraciones)</span>` : ''}</p>
      <p style="font-size:14px; font-weight:700;">Tiempo Total Invertido: <span style="color:var(--primary-color);">${workerData.totalMin} min</span></p>
      ${workerData.completed > 0 ? `<p style="font-size:13px; color:var(--text-muted); margin-top:4px;">⏱️ Promedio por pedido: <strong>${Math.round(workerData.totalMin / Math.max(1, workerData.completed))} min</strong></p>` : ''}
    </div>
    <p style="font-weight:700; font-size:13px; margin-bottom:10px;">LISTA DE PROYECTOS Y PARTICIPACIONES (${workerOrders.length}):</p>
    <div style="display:flex; flex-direction:column; gap:10px; max-height:350px; overflow-y:auto;">
      ${workerOrders.length ? workerOrders.map(o => `
        <div style="padding:12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
          <div style="display:flex; justify-content:space-between; font-weight:700;">
            <span>${escapeHtml(o.cliente)} (${escapeHtml(o.id)})</span>
            <span style="color:var(--success-color);">${escapeHtml(o.estado)}</span>
          </div>
          <p style="font-size:13px; color:var(--text-muted);">${escapeHtml(o.tipo || 'Sin tipo')} ${o.motivo ? `· Motivo: ${escapeHtml(o.motivo)}` : ''}</p>
          <p style="font-size:12px; margin-top:4px;">⏱️ Tiempo aportado: <strong>${o.tiempoAportado || o.duracionRealMin || 0} min</strong> ${o.rolEnPedido ? `· <span style="color:#6366f1; font-weight:bold;">${escapeHtml(o.rolEnPedido)}</span>` : ''}</p>
          ${o.comentarioCierre ? `<p style="font-size:12px; color:var(--text-muted);">📝 Observación: ${escapeHtml(o.comentarioCierre)}</p>` : ''}
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

function getWeekDetails(offsetWeeks = 0) {
  const now = new Date();
  now.setDate(now.getDate() + (offsetWeeks * 7));
  const day = now.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0,0,0,0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  
  const pad = (n) => n.toString().padStart(2, '0');
  const dMon = `${pad(monday.getDate())}/${pad(monday.getMonth()+1)}`;
  const dSun = `${pad(sunday.getDate())}/${pad(sunday.getMonth()+1)}/${sunday.getFullYear()}`;
  
  const semanaId = `${monday.getFullYear()}-W${pad(Math.ceil((((monday - new Date(monday.getFullYear(),0,1))/86400000)+new Date(monday.getFullYear(),0,1).getDay()+1)/7))}`;
  const semanaLabel = `Semana del ${dMon} al ${dSun}`;
  
  return { monday, sunday, semanaId, semanaLabel, isCurrent: offsetWeeks === 0 };
}

window.changeScheduleWeek = function(delta) {
  state.selectedWeekOffset = (state.selectedWeekOffset || 0) + delta;
  render();
};

window.resetScheduleWeek = function() {
  state.selectedWeekOffset = 0;
  render();
};

function openEditScheduleModal(workerName = "", targetSemanaId = "", targetSemanaLabel = "") {
  if (!isLead()) return;
  const users = (state.data.users || []).filter(u => u.active);
  const schedules = state.data.schedules || state.data.horarios || [];
  
  const curWeek = getWeekDetails(state.selectedWeekOffset || 0);
  const semId = targetSemanaId || curWeek.semanaId;
  const semLabel = targetSemanaLabel || curWeek.semanaLabel;

  const defaultUser = workerName || (users[0]?.name || "");

  const daysList = [
    { key: "lunes", label: "Lunes" },
    { key: "martes", label: "Martes" },
    { key: "miercoles", label: "Miércoles" },
    { key: "jueves", label: "Jueves" },
    { key: "viernes", label: "Viernes" },
    { key: "sabado", label: "Sábado" },
    { key: "domingo", label: "Domingo" }
  ];

  const presets = [
    { label: "🔵 Completo A (8-1 / 3-7 PM)", val: "8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM" },
    { label: "🟣 Completo B (8-1 / 4-8:30 PM)", val: "8:00 AM - 1:00 PM / 4:00 PM - 8:30 PM" },
    { label: "🟡 Completo Extendido (8-1 / 3-8:30 PM)", val: "8:00 AM - 1:00 PM / 3:00 PM - 8:30 PM" },
    { label: "🟢 Solo Mañana (8-1 PM)", val: "8:00 AM - 1:00 PM" },
    { label: "🟠 Solo Tarde A (3-7 PM)", val: "3:00 PM - 7:00 PM" },
    { label: "🔴 Solo Tarde B (4-8:30 PM)", val: "4:00 PM - 8:30 PM" },
    { label: "🏖️ Vacaciones", val: "Vacaciones" },
    { label: "⚪ Día Libre", val: "Libre" }
  ];

  const getWorkerSched = (uName) => {
    return schedules.find(s => s.trabajador.toLowerCase() === uName.toLowerCase() && (s.semana === semId || !s.semana)) || schedules.find(s => s.trabajador.toLowerCase() === uName.toLowerCase()) || {
      lunes: "8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM", martes: "8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM", miercoles: "8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM",
      jueves: "8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM", viernes: "8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM", sabado: "8:00 AM - 1:00 PM", domingo: "Libre",
      horasExtras: 0, notaExtras: ""
    };
  };

  const initialSched = getWorkerSched(defaultUser);

  const renderDayRow = (d, curVal) => {
    const isStandard = presets.some(p => p.val === curVal);
    return `
      <div style="background:var(--bg-main); padding:10px; border-radius:8px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:13px; text-transform:uppercase;">📅 ${d.label}</strong>
        </div>
        <select id="sched-select-${d.key}" onchange="handleDaySelectChange('${d.key}', this.value)" style="padding:6px; border-radius:6px; border:1px solid var(--border-color); font-size:12px; font-weight:600;">
          ${presets.map(p => `<option value="${escapeHtml(p.val)}" ${p.val === curVal ? 'selected' : ''}>${p.label}</option>`).join('')}
          <option value="__CUSTOM__" ${!isStandard ? 'selected' : ''}>✏️ Horario Personalizado...</option>
        </select>
        <input id="sched-${d.key}" name="${d.key}" value="${escapeHtml(curVal)}" style="padding:6px; border-radius:6px; border:1px solid var(--border-color); font-size:12px; ${isStandard ? 'display:none;' : 'display:block;'}">
      </div>
    `;
  };

  openModal(`
    <div class="modal-head">
      <h2>✏️ Modificar Horario de Trabajador</h2>
      <button class="close-button" data-action="close">×</button>
    </div>

    <div style="background:rgba(2,132,199,.1); border:1px solid #0284c7; padding:10px 12px; border-radius:8px; margin-bottom:12px; font-size:13px; color:#0284c7; font-weight:bold;">
      🗓️ Asignando para: ${escapeHtml(semLabel)} ${curWeek.isCurrent ? '(Semana en Curso)' : ''}
    </div>

    <div style="background:var(--bg-card); padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid var(--border-color);">
      <p style="font-weight:700; font-size:12px; margin-bottom:6px;">⚡ APLICAR PLANTILLA RÁPIDA A TODA LA SEMANA (LUN-SÁB):</p>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="secondary-button" style="font-size:11px;" onclick="applySchedPreset('8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM')">🔵 Completo A</button>
        <button type="button" class="secondary-button" style="font-size:11px;" onclick="applySchedPreset('8:00 AM - 1:00 PM / 4:00 PM - 8:30 PM')">🟣 Completo B</button>
        <button type="button" class="secondary-button" style="font-size:11px; background:#eab308; color:#000; font-weight:bold; border:none;" onclick="applySchedPreset('8:00 AM - 1:00 PM / 3:00 PM - 8:30 PM')">🟡 Extendido (8-1 / 3-8:30 PM)</button>
        <button type="button" class="secondary-button" style="font-size:11px;" onclick="applySchedPreset('8:00 AM - 1:00 PM')">🟢 Solo Mañana</button>
        <button type="button" class="secondary-button" style="font-size:11px;" onclick="applySchedPreset('3:00 PM - 7:00 PM')">🟠 Solo Tarde A</button>
        <button type="button" class="secondary-button" style="font-size:11px;" onclick="applySchedPreset('4:00 PM - 8:30 PM')">🔴 Solo Tarde B</button>
        <button type="button" class="secondary-button" style="font-size:11px; background:#f59e0b; color:white; border:none;" onclick="applySchedPreset('Vacaciones')">🏖️ Vacaciones</button>
        <button type="button" class="secondary-button" style="font-size:11px;" onclick="applySchedPreset('Libre')">⚪ Libre</button>
      </div>
    </div>

    <form id="schedule-form" class="form-grid">
      <input type="hidden" name="semana" value="${escapeHtml(semId)}">
      <label class="field"><span class="field-label">SELECCIONAR TRABAJADOR</span>
        <select id="worker-select-modal" name="trabajador" onchange="handleWorkerChangeModal(this.value)" required>
          ${users.map(u => `<option value="${escapeHtml(u.name)}" ${u.name.toLowerCase() === defaultUser.toLowerCase() ? "selected" : ""}>${escapeHtml(u.name)} (${formatRoleLabel(u.role)})</option>`).join('')}
        </select>
      </label>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; margin-top:8px;">
        ${daysList.map(d => renderDayRow(d, initialSched[d.key] || (d.key === 'domingo' ? 'Libre' : '8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM'))).join('')}
      </div>

      <div style="background:rgba(217,119,6,.1); border:1px solid #d97706; padding:12px; border-radius:8px; margin-top:14px;">
        <strong style="color:#d97706; font-size:13px; display:block; margin-bottom:8px;">⏱️ REGISTRO DE HORAS EXTRAS DE LA SEMANA (PAGO ADICIONAL)</strong>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; align-items:center;">
          <label class="field" style="margin:0;"><span class="field-label">HORAS EXTRAS TOTALES</span>
            <input type="number" step="0.5" min="0" name="horasExtras" id="sched-horas-extras" value="${initialSched.horasExtras || 0}" style="font-weight:bold;">
          </label>
          <label class="field" style="margin:0;"><span class="field-label">DETALLE / MOTIVO DE HORAS EXTRAS</span>
            <input type="text" name="notaExtras" id="sched-nota-extras" placeholder="Ej. 2.5h el jueves por alta demanda de piñatas" value="${escapeHtml(initialSched.notaExtras || '')}">
          </label>
        </div>
      </div>

      <div class="modal-footer" style="margin-top:16px;">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">💾 Guardar Horario de esta Semana</button>
      </div>
    </form>
  `);

  window.handleDaySelectChange = function(dayKey, val) {
    const input = document.getElementById("sched-" + dayKey);
    if (!input) return;
    if (val === "__CUSTOM__") {
      input.style.display = "block";
      input.focus();
    } else {
      input.value = val;
      input.style.display = "none";
    }
  };

  window.handleWorkerChangeModal = function(uName) {
    const ws = getWorkerSched(uName);
    daysList.forEach(d => {
      const val = ws[d.key] || (d.key === 'domingo' ? 'Libre' : '8:00 AM - 1:00 PM / 3:00 PM - 7:00 PM');
      const sel = document.getElementById("sched-select-" + d.key);
      const inp = document.getElementById("sched-" + d.key);
      if (inp) inp.value = val;
      if (sel) {
        const isStandard = presets.some(p => p.val === val);
        sel.value = isStandard ? val : "__CUSTOM__";
        if (inp) inp.style.display = isStandard ? "none" : "block";
      }
    });
    const extraInp = document.getElementById("sched-horas-extras");
    const extraNota = document.getElementById("sched-nota-extras");
    if (extraInp) extraInp.value = ws.horasExtras || 0;
    if (extraNota) extraNota.value = ws.notaExtras || "";
  };

  window.applySchedPreset = function(presetText) {
    daysList.forEach(d => {
      if (d.key === "domingo" && presetText !== "Libre" && presetText !== "Vacaciones") return;
      const sel = document.getElementById("sched-select-" + d.key);
      const inp = document.getElementById("sched-" + d.key);
      if (sel) sel.value = presetText;
      if (inp) {
        inp.value = presetText;
        inp.style.display = "none";
      }
    });
  };

  $("#schedule-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "⏳ Guardando...";
    try {
      const data = Object.fromEntries(new FormData(e.target));
      await api("profile_save_schedule", data);
      closeModal();
      await refresh(false);
      showToast("Horario guardado en Google Sheets para esta semana.");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "💾 Guardar Horario de esta Semana";
      alert(err.message);
    }
  });
}
window.openEditScheduleModal = openEditScheduleModal;
window.setPerfTimeframe = function(tf) { state.perfTimeframe = tf; render(); };


// =========================================================
// SICS 2026: HUB PRINCIPAL DE MÓDULOS (BENTO GRID)
// =========================================================
function getGreetingTime() {
  const h = new Date().getHours();
  if (h < 12) return "días";
  if (h < 19) return "tardes";
  return "noches";
}

function modulesView() {
  const allOrders = state.data?.allOrders || [];
  const activeOrders = allOrders.filter(active);
  const overdueOrders = activeOrders.filter(o => priority(o) === 'overdue' && canSeeOrderAlert(o));
  const finishedOrders = state.data?.finishedOrders || [];
  const myActiveOrders = (state.data?.myOrders || []).filter(active);
  const userName = state.session?.nombre || state.session?.name || state.session?.username || 'Colaborador';
  const leadUser = isLead();

  // Alerta de deudas vencidas para gerencia
  let debtAlert = '';
  if (leadUser) {
    const invoices = getStoredProvidersData();
    const hoy = new Date();
    const overdueDebts = invoices.filter(inv => {
      const vence = new Date(inv.fechaVencimiento);
      const diasParaVencer = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
      // Alertar si: vencida, o vence en 5 días o menos, o tiene abono parcial y vence pronto
      return (diasParaVencer <= 5 && inv.saldoPendiente > 0) || (inv.abonado > 0 && diasParaVencer <= 2);
    });
    
    if (overdueDebts.length > 0) {
      debtAlert = `
        <div style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color:white; padding:12px 16px; border-radius:12px; margin-bottom:16px; animation: pulse-alert 2s infinite; box-shadow:0 4px 20px rgba(239,68,68,0.4);">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="font-size:24px;">🚨</div>
            <div style="flex:1;">
              <div style="font-weight:bold; font-size:14px;">¡ALERTA DE DEUDAS VENCIDAS!</div>
              <div style="font-size:12px; opacity:0.9;">Tienes ${overdueDebts.length} cuenta(s) por pagar vencida(s), próximas a vencer o con abonos parciales pendientes.</div>
            </div>
            <button type="button" onclick="navigate('providers')" style="background:white; color:#ef4444; border:none; padding:6px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">Ver Deudas</button>
          </div>
        </div>
      `;
    }
  }

  return `
    <div class="sics-hub-container">
      ${debtAlert}
      <div class="sics-hub-hero">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <h1>Buenas ${getGreetingTime()}, ${escapeHtml(userName)} ⛅</h1>
            <p>Panel principal de operaciones, producción física y gestión de Creaciones JJ.</p>
          </div>
          <button type="button" class="primary-button" onclick="openExpressOrderModal()" style="background:#f59e0b; border:none; padding:10px 18px; border-radius:30px; font-weight:800; font-size:13px; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(245,158,11,0.35);">
            <i class="fas fa-bolt"></i> + Pedido Rápido Mostrador
          </button>
        </div>

        <div class="sics-hub-metrics">
          <div class="sics-metric-chip" onclick="navigate('team')" style="cursor:pointer;" title="Ver bandeja activa">
            <i class="fas fa-inbox" style="color:#0ea5e9;"></i>
            <span>Bandeja Activa: <strong>${activeOrders.length}</strong></span>
          </div>
          <div class="sics-metric-chip" onclick="navigate('reports')" style="cursor:pointer; ${overdueOrders.length ? 'border-color:#ef4444; color:#ef4444;' : ''}" title="Ver rezagados">
            <i class="fas fa-exclamation-triangle" style="color:${overdueOrders.length ? '#ef4444' : '#10b981'};"></i>
            <span>${overdueOrders.length ? `Casos Rezagados: <strong>${overdueOrders.length}</strong>` : 'Cero Rezagados (Al Día)'}</span>
          </div>
          <div class="sics-metric-chip" onclick="navigate('now')" style="cursor:pointer;" title="Ir a mesa de trabajo">
            <i class="fas fa-stopwatch" style="color:#f59e0b;"></i>
            <span>En Mi Mesa: <strong>${myActiveOrders.length}</strong></span>
          </div>
          <div class="sics-metric-chip" onclick="navigate('history')" style="cursor:pointer;" title="Ver historial">
            <i class="fas fa-check-circle" style="color:#10b981;"></i>
            <span>Entregados: <strong>${finishedOrders.length}</strong></span>
          </div>
          <div class="sics-metric-chip" onclick="navigate('workshopPrices')" style="cursor:pointer;" title="Ver precios y medidas">
            <i class="fas fa-dollar-sign" style="color:#10b981;"></i>
            <span>Precios & Medidas</span>
          </div>
          ${leadUser ? `
            <div class="sics-metric-chip" onclick="navigate('providers')" style="cursor:pointer; border-color:#10b981;" title="Cuentas por pagar">
              <i class="fas fa-truck-loading" style="color:#10b981;"></i>
              <span>Proveedores &amp; Deudas</span>
            </div>
          ` : ''}
          <div class="sics-metric-chip">
            <i class="fas fa-circle" style="color:#10b981; font-size:8px;"></i>
            <span>Creaciones JJ Operativo</span>
          </div>
        </div>
      </div>

      <div class="sics-bento-grid">
        <!-- 1: Bandeja de Operaciones -->
        <div class="sics-bento-card" onclick="navigate('team')">
          <div>
            <div class="sics-bento-icon" style="background:rgba(14,165,233,0.12); color:#0ea5e9;">
              <i class="fas fa-clipboard-list"></i>
            </div>
            <div class="sics-bento-title">Bandeja de Operaciones</div>
            <div class="sics-bento-desc">
              Control de pedidos activos, filtrado por cliente o urgencia y gestión de cola de órdenes en taller.
            </div>
          </div>
          <div class="sics-bento-action">
            <span>Entrar al Área</span> <i class="fas fa-arrow-right"></i>
          </div>
        </div>

        <!-- 2: Mesa de Producción (Ahora) -->
        <div class="sics-bento-card" onclick="navigate('now')">
          <div>
            <div class="sics-bento-icon" style="background:rgba(245,158,11,0.12); color:#f59e0b;">
              <i class="fas fa-stopwatch"></i>
            </div>
            <div class="sics-bento-title">Mesa de Trabajo &amp; Cronómetro</div>
            <div class="sics-bento-desc">
              Órdenes asignadas en proceso, medición de tiempos en vivo, pausas justificadas y traspaso de equipo.
            </div>
          </div>
          <div class="sics-bento-action">
            <span>Entrar al Taller</span> <i class="fas fa-arrow-right"></i>
          </div>
        </div>

        <!-- 3: Reportes y Avance -->
        <div class="sics-bento-card" onclick="navigate('reports')">
          <div>
            <div class="sics-bento-icon" style="background:rgba(139,92,246,0.12); color:#8b5cf6;">
              <i class="fas fa-chart-line"></i>
            </div>
            <div class="sics-bento-title">Reportes, Avance &amp; Rezagados</div>
            <div class="sics-bento-desc">
              Detección de casos rezagados, métricas operativas por trabajador y balance de entregas a tiempo.
            </div>
          </div>
          <div class="sics-bento-action">
            <span>Ver Métricas</span> <i class="fas fa-arrow-right"></i>
          </div>
        </div>

        <!-- 4: Control de Proveedores y Cuentas por Pagar (Solo Jefes) -->
        ${leadUser ? `
          <div class="sics-bento-card" onclick="navigate('providers')" style="border-color:rgba(16,185,129,0.35); background:radial-gradient(circle at top right, rgba(16,185,129,0.08), transparent 70%);">
            <div>
              <div class="sics-bento-icon" style="background:rgba(16,185,129,0.15); color:#10b981;">
                <i class="fas fa-truck-loading"></i>
              </div>
              <div class="sics-bento-title" style="color:#10b981;">Proveedores &amp; Cuentas por Pagar</div>
              <div class="sics-bento-desc">
                Notas de entrega (Americas, Blindac, Prodimarca, Patiño), vencimientos, abonos y conversión oficial a Tasa BCV.
              </div>
            </div>
            <div class="sics-bento-action" style="color:#10b981;">
              <span>Gestionar Pagos</span> <i class="fas fa-arrow-right"></i>
            </div>
          </div>
        ` : ''}

        <!-- 5: Cierre de Caja y Arqueo Diario (Solo Jefes) -->
        ${leadUser ? `
          <div class="sics-bento-card" onclick="navigate('cash')" style="border-color:rgba(245,158,11,0.35); background:radial-gradient(circle at top right, rgba(245,158,11,0.08), transparent 70%);">
            <div>
              <div class="sics-bento-icon" style="background:rgba(245,158,11,0.15); color:#f59e0b;">
                <i class="fas fa-cash-register"></i>
              </div>
              <div class="sics-bento-title" style="color:#f59e0b;">Cierre de Caja &amp; Arqueo Diario</div>
              <div class="sics-bento-desc">
                Arqueo de turnos (1:00 PM y 8:00 PM): Punto, Pago Móvil con referencia, efectivo en Bs y $, tasas y foto de respaldo.
              </div>
            </div>
            <div class="sics-bento-action" style="color:#f59e0b;">
              <span>Abrir Cierre de Caja</span> <i class="fas fa-arrow-right"></i>
            </div>
          </div>
        ` : ''}

        <!-- 6: Mini Inventario & Faltantes de Taller -->
        <div class="sics-bento-card" onclick="navigate('inventory')">
          <div>
            <div class="sics-bento-icon" style="background:rgba(6,182,212,0.12); color:#06b6d4;">
              <i class="fas fa-boxes"></i>
            </div>
            <div class="sics-bento-title">Mini Inventario &amp; Faltantes</div>
            <div class="sics-bento-desc">
              Control de silicones, pegas, cartulinas y consumibles. Genera la lista mensual para comprar a proveedores.
            </div>
          </div>
          <div class="sics-bento-action">
            <span>Ver Insumos</span> <i class="fas fa-arrow-right"></i>
          </div>
        </div>

        <!-- 7: Precios y Medidas del Taller -->
        <div class="sics-bento-card" onclick="navigate('workshopPrices')">
          <div>
            <div class="sics-bento-icon" style="background:rgba(16,185,129,0.12); color:#10b981;">
              <i class="fas fa-dollar-sign"></i>
            </div>
            <div class="sics-bento-title">Precios &amp; Medidas</div>
            <div class="sics-bento-desc">
              Presupuestos rápidos, especificaciones DTF, medidas de toppers. Solo gerencia edita.
            </div>
          </div>
          <div class="sics-bento-action">
            <span>Ver Tabla</span> <i class="fas fa-arrow-right"></i>
          </div>
        </div>

        <!-- 8: Horarios y Guardias -->
        <div class="sics-bento-card" onclick="navigate('schedules')">
          <div>
            <div class="sics-bento-icon" style="background:rgba(16,185,129,0.12); color:#10b981;">
              <i class="fas fa-calendar-alt"></i>
            </div>
            <div class="sics-bento-title">Horarios &amp; Guardias del Equipo</div>
            <div class="sics-bento-desc">
              Turnos rotativos por semana, descansos programados y horas extras filtradas por cargo del taller.
            </div>
          </div>
          <div class="sics-bento-action">
            <span>Consultar Turnos</span> <i class="fas fa-arrow-right"></i>
          </div>
        </div>

        <!-- 8: Historial y Archivo -->
        <div class="sics-bento-card" onclick="navigate('history')">
          <div>
            <div class="sics-bento-icon" style="background:rgba(99,102,241,0.12); color:#6366f1;">
              <i class="fas fa-history"></i>
            </div>
            <div class="sics-bento-title">Historial &amp; Archivo de Cierres</div>
            <div class="sics-bento-desc">
              Búsqueda de pedidos completados, fotos de evidencia, notas fiscales asociadas y bitácoras de entrega.
            </div>
          </div>
          <div class="sics-bento-action">
            <span>Ver Archivo</span> <i class="fas fa-arrow-right"></i>
          </div>
        </div>

        <!-- 9: Ajustes y Sistema -->
        <div class="sics-bento-card" onclick="navigate('settings')">
          <div>
            <div class="sics-bento-icon" style="background:rgba(100,116,139,0.15); color:#94a3b8;">
              <i class="fas fa-sliders-h"></i>
            </div>
            <div class="sics-bento-title">Ajustes del Sistema</div>
            <div class="sics-bento-desc">
              Personalización de temas, catálogo de motivos, gestión de usuarios, plantilla de WhatsApp y mantenimiento.
            </div>
          </div>
          <div class="sics-bento-action">
            <span>Configuración</span> <i class="fas fa-arrow-right"></i>
          </div>
        </div>
      </div>
    </div>
  `;
}


function reportsView() {
  const allOrders = state.data?.allOrders || [];
  const activeOrders = allOrders.filter(active);
  const finishedOrders = state.data?.finishedOrders || [];
  const overdueOrders = activeOrders.filter(o => priority(o) === 'overdue');

  // Filtro de tipo de vista (default: completed)
  const viewType = state.reportsViewType || 'completed'; // 'completed' | 'active' | 'overdue' | 'all'

  // Filtro de fecha seleccionado para reportes (default: mes)
  const currentFilter = state.reportsDateFilter || 'month';

  // Helper de filtrado por fecha
  const filterByPeriod = (orderList) => {
    const now = new Date();
    return orderList.filter(o => {
      const rawDate = o.fechaCierre || o.entrega || o.creado || "";
      const d = safeParseDate(rawDate);
      if (!d) return true;
      if (currentFilter === 'today') {
        return d.toDateString() === now.toDateString();
      } else if (currentFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
        return d >= oneWeekAgo && d <= now;
      } else if (currentFilter === 'month') {
        // Reconocer órdenes de septiembre 2026
        return (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) ||
               String(rawDate).includes("-09-") || String(rawDate).includes("/09/") || String(rawDate).includes("/9/");
      } else if (currentFilter === 'last_month') {
        const lastM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === lastM && d.getFullYear() === lastY;
      } else if (currentFilter === 'custom') {
        const from = state.reportsDateFrom ? safeParseDate(state.reportsDateFrom) : null;
        const to = state.reportsDateTo ? safeParseDate(state.reportsDateTo) : null;
        if (from && d < from) return false;
        if (to) {
          const toEnd = new Date(to.getTime());
          toEnd.setHours(23, 59, 59, 999);
          if (d > toEnd) return false;
        }
        return from || to;
      }
      return true; // 'all'
    });
  };

  const periodFinishedOrders = filterByPeriod(finishedOrders);

  // Casos del período seleccionado (activos + completados del filtro vigente)
  const periodActiveOrders = filterByPeriod(activeOrders);
  const casesThisPeriod = periodActiveOrders.length + periodFinishedOrders.length;

  // Cumplimiento a tiempo - Mejorado para usar finProduccion cuando fechaCierre no está disponible
  const onTimeFinished = periodFinishedOrders.filter(o => {
    const ent = safeParseDate(o.entrega);
    // Usar fechaCierre si está disponible, sino usar finProduccion
    const cie = safeParseDate(o.fechaCierre) || safeParseDate(o.finProduccion);
    
    // Si no tiene fecha de entrega, no se puede medir cumplimiento
    if (!ent) return false;
    
    // Si no tiene fecha de cierre/finProducción, no cuenta como entregado a tiempo
    if (!cie) return false;
    
    // Compara fecha de cierre con fecha de entrega
    return cie <= ent;
  });
  const complianceRate = periodFinishedOrders.length ? Math.round((onTimeFinished.length / periodFinishedOrders.length) * 100) : 100;

  // Promedio en mesa
  const durations = periodFinishedOrders.map(o => Number(o.duracionRealMin || 0)).filter(d => d > 0);
  const avgMins = durations.length ? Math.round(durations.reduce((a,b)=>a+b, 0) / durations.length) : 0;

  // Trabajadores reales + cualquier responsable con pedidos en el período
  // (incluye ex-personal como Eloy: solo aparece si tiene pedidos en el filtro de fecha)
  const realTeam = getRealTeamList();
  const observedWorkers = [...new Set([...activeOrders, ...periodFinishedOrders]
    .map(o => String(o.responsable || "").trim())
    .filter(Boolean))];
  const allWorkers = [...new Set([...realTeam, ...observedWorkers])];
  const workerStats = {};
  allWorkers.forEach(w => {
    workerStats[w] = { name: w, active: 0, finished: 0, overdue: 0, totalMins: 0, finishedCount: 0 };
  });

  activeOrders.forEach(o => {
    const resp = String(o.responsable || "").trim();
    if (workerStats[resp]) {
      workerStats[resp].active++;
      if (priority(o) === 'overdue') workerStats[resp].overdue++;
    }
  });

  periodFinishedOrders.forEach(o => {
    const resp = String(o.responsable || "").trim();
    if (workerStats[resp]) {
      workerStats[resp].finished++;
      if (o.duracionRealMin) {
        workerStats[resp].totalMins += Number(o.duracionRealMin);
        workerStats[resp].finishedCount++;
      }
    }
  });

  return `
    <div style="max-width:1100px; margin:0 auto; padding-bottom:30px;">
      <!-- Filtros de Tipo de Vista y Fecha -->
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        <button type="button" class="secondary-button" onclick="window.setReportsViewType('completed')" style="background:${viewType === 'completed' ? '#10b981; color:white;' : 'var(--bg-card)'}; font-weight:bold; font-size:12px; padding:6px 12px;">
          <i class="fas fa-check-circle"></i> Completados (${periodFinishedOrders.length})
        </button>
        <button type="button" class="secondary-button" onclick="window.setReportsViewType('active')" style="background:${viewType === 'active' ? '#3b82f6; color:white;' : 'var(--bg-card)'}; font-weight:bold; font-size:12px; padding:6px 12px;">
          <i class="fas fa-bolt"></i> Activos (${periodActiveOrders.length})
        </button>
        <button type="button" class="secondary-button" onclick="window.setReportsViewType('overdue')" style="background:${viewType === 'overdue' ? '#ef4444; color:white;' : 'var(--bg-card)'}; font-weight:bold; font-size:12px; padding:6px 12px;">
          <i class="fas fa-exclamation-circle"></i> Rezagados (${overdueOrders.length})
        </button>
        <button type="button" class="secondary-button" onclick="window.setReportsViewType('all')" style="background:${viewType === 'all' ? '#8b5cf6; color:white;' : 'var(--bg-card)'}; font-weight:bold; font-size:12px; padding:6px 12px;">
          <i class="fas fa-layer-group"></i> Todos (${casesThisPeriod})
        </button>
        
        <!-- Botón de imprimir/descargar PDF -->
        <button type="button" class="secondary-button" onclick="window.printReport()" style="background:#6366f1; color:white; font-weight:bold; font-size:12px; padding:6px 12px; margin-left:auto;">
          <i class="fas fa-print"></i> Imprimir PDF
        </button>
        
        <!-- Filtro de Fecha Personalizado -->
        <div style="display:flex; gap:4px; align-items:center;">
          <select id="reports-date-filter" onchange="window.setReportsDateFilter(this.value)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:12px;">
            <option value="today" ${currentFilter === 'today' ? 'selected' : ''}>Hoy</option>
            <option value="week" ${currentFilter === 'week' ? 'selected' : ''}>Esta semana</option>
            <option value="month" ${currentFilter === 'month' ? 'selected' : ''}>Este mes</option>
            <option value="last_month" ${currentFilter === 'last_month' ? 'selected' : ''}>Mes anterior</option>
            <option value="custom" ${currentFilter === 'custom' ? 'selected' : ''}>Rango personalizado</option>
            <option value="all" ${currentFilter === 'all' ? 'selected' : ''}>Todo el historial</option>
          </select>
        </div>
      </div>

      ${currentFilter === 'custom' ? `
        <div style="background:var(--bg-main); padding:12px; border-radius:8px; border:1px solid var(--border-color); margin-bottom:16px;">
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <div style="flex:1;">
              <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">Desde:</label>
              <input type="date" id="custom-date-from" value="${state.reportsDateFrom || ''}" onchange="window.setCustomDateFrom(this.value)" style="padding:4px 6px; border-radius:6px; border:1px solid var(--border-color); width:100%;">
            </div>
            <div style="flex:1;">
              <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">Hasta:</label>
              <input type="date" id="custom-date-to" value="${state.reportsDateTo || ''}" onchange="window.setCustomDateTo(this.value)" style="padding:4px 6px; border-radius:6px; border:1px solid var(--border-color); width:100%;">
            </div>
            <button type="button" class="primary-button" onclick="window.applyCustomDateFilter()" style="padding:6px 12px; font-size:12px;">Aplicar Filtro</button>
          </div>
        </div>
      ` : ''}

      <!-- KPIs Superiores Interactivos -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px;">
        <div class="sics-metric-card">
          <div style="font-size:11px; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:4px;">
            <i class="fas fa-calendar-check"></i> CASOS DEL PERÍODO
          </div>
          <div style="font-size:28px; font-weight:900; color:var(--text-main);">${casesThisPeriod}</div>
          <div style="font-size:11px; color:var(--text-muted);">${activeOrders.length} activos + ${periodFinishedOrders.length} completados</div>
        </div>

        <div class="sics-metric-card">
          <div style="font-size:11px; font-weight:700; color:#10b981; text-transform:uppercase; margin-bottom:4px;">
            <i class="fas fa-check-double"></i> CUMPLIMIENTO A TIEMPO
          </div>
          <div style="font-size:28px; font-weight:900; color:#10b981;">${complianceRate}%</div>
          <div style="font-size:11px; color:var(--text-muted);">${onTimeFinished.length} de ${periodFinishedOrders.length} entregados en fecha</div>
        </div>

        <div class="sics-metric-card" onclick="window.filterOverdueDirect()" style="cursor:pointer; border-color:${overdueOrders.length ? '#ef4444' : 'var(--border-color)'}; box-shadow:${overdueOrders.length ? '0 0 16px rgba(239,68,68,0.2)' : 'none'};" title="Clic para ver pedidos rezagados">
          <div style="font-size:11px; font-weight:700; color:#ef4444; text-transform:uppercase; margin-bottom:4px;">
            <i class="fas fa-exclamation-circle"></i> CASOS REZAGADOS
          </div>
          <div style="font-size:28px; font-weight:900; color:${overdueOrders.length ? '#ef4444' : '#10b981'};">
            ${overdueOrders.length} <i class="fas fa-arrow-right" style="font-size:14px; opacity:0.6;"></i>
          </div>
          <div style="font-size:11px; color:${overdueOrders.length ? '#ef4444' : 'var(--text-muted)'}; font-weight:bold;">
            ${overdueOrders.length ? '⚠️ Requieren atención prioritaria (Clic)' : '¡Al día! Cero retrasos'}
          </div>
        </div>

        <div class="sics-metric-card">
          <div style="font-size:11px; font-weight:700; color:#f59e0b; text-transform:uppercase; margin-bottom:4px;">
            <i class="fas fa-stopwatch"></i> PROMEDIO EN MESA
          </div>
          <div style="font-size:28px; font-weight:900; color:var(--text-main);">${avgMins} <span style="font-size:14px; font-weight:bold; color:var(--text-muted);">min</span></div>
          <div style="font-size:11px; color:var(--text-muted);">Por orden física finalizada</div>
        </div>
      </div>

      <!-- Detalles de Pedidos según Filtro -->
      <div class="sics-table-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
          <div>
            <h3 style="margin:0; font-size:16px; color:var(--text-main);">
              ${viewType === 'completed' ? '✅ Pedidos Completados' : 
                viewType === 'active' ? '⚡ Pedidos Activos' : 
                viewType === 'overdue' ? '🚨 Pedidos Rezagados' : '📋 Todos los Pedidos'}
            </h3>
            <div style="font-size:11.5px; color:var(--text-muted);">
              ${viewType === 'completed' ? `Órdenes finalizadas en el período seleccionado (${periodFinishedOrders.length})` :
                viewType === 'active' ? `Órdenes actualmente en producción (${periodActiveOrders.length})` :
                viewType === 'overdue' ? `Órdenes con entrega vencida (${overdueOrders.length})` :
                `Todos los casos del período (${casesThisPeriod})`}
            </div>
          </div>
          <button type="button" class="secondary-button" onclick="window.toggleReportOrdersCollapse()" style="font-size:11px; padding:4px 8px;">
            <i class="fas fa-chevron-${state.reportOrdersCollapsed ? 'up' : 'down'}" id="report-collapse-icon"></i> <span id="report-collapse-text">${state.reportOrdersCollapsed ? 'Mostrar lista' : 'Ocultar lista'}</span>
          </button>
        </div>

        <div id="report-orders-list" style="overflow-x:auto; display:${state.reportOrdersCollapsed ? 'none' : 'block'};">
          <table class="sics-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Responsable</th>
                <th>Entrega</th>
                <th>Estado</th>
                <th>Tiempo</th>
              </tr>
            </thead>
            <tbody>
              ${(viewType === 'completed' ? periodFinishedOrders : 
                 viewType === 'active' ? periodActiveOrders : 
                 viewType === 'overdue' ? overdueOrders : 
                 [...periodActiveOrders, ...periodFinishedOrders]).map(o => `
                <tr onclick="navigate('team'); setTimeout(() => document.querySelector('[data-id="${escapeHtml(o.id)}"]')?.click(), 100);" style="cursor:pointer;">
                  <td style="font-family:monospace; font-weight:bold;">${escapeHtml(o.id)}</td>
                  <td style="font-weight:bold;">${escapeHtml(o.cliente)}</td>
                  <td>${escapeHtml(o.tipo)}</td>
                  <td>${escapeHtml(o.responsable)}</td>
                  <td>${escapeHtml(formatDate(o.entrega))}</td>
                  <td>
                    <span style="padding:2px 8px; border-radius:10px; font-size:10.5px; font-weight:bold; background:${o.estado === 'Terminado' || o.estado === 'Entregado' ? 'rgba(16,185,129,0.2); color:#10b981;' : o.estado === 'En proceso' ? 'rgba(59,130,246,0.2); color:#3b82f6;' : 'rgba(245,158,11,0.2); color:#f59e0b;'}">
                      ${escapeHtml(o.estado)}
                    </span>
                  </td>
                  <td style="font-weight:bold;">${o.duracionRealMin ? o.duracionRealMin + ' min' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alerta Operativa si hay Rezagados (solo gerencia/jefes) -->
      ${isLead() && overdueOrders.length ? `
        <div style="background:rgba(239,68,68,0.08); border:1.5px solid #ef4444; border-radius:12px; padding:16px; margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px; cursor:pointer;" onclick="window.toggleOverdueList()">
            <div style="font-size:13px; font-weight:800; color:#ef4444; display:flex; align-items:center; gap:8px;">
              <i class="fas fa-bell fa-bounce"></i> CASOS REZAGADOS QUE REQUIEREN ATENCIÓN (${overdueOrders.length})
              <i class="fas fa-chevron-down" id="overdue-chevron" style="font-size:11px; margin-left:8px;"></i>
            </div>
            <span style="font-size:10.5px; background:#ef4444; color:white; padding:2px 8px; border-radius:10px; font-weight:bold;">ALERTA OPERATIVA</span>
          </div>
          <div id="overdue-list-container" style="display:none; display:flex; flex-direction:column; gap:8px;">
            ${overdueOrders.map(o => `
              <div style="background:rgba(0,0,0,0.3); border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                  <strong style="color:var(--text-main);">${escapeHtml(o.id)} - ${escapeHtml(o.cliente)}</strong>
                  <span style="color:#ef4444; font-size:11px; font-weight:bold; margin-left:8px;">⏳ Vencido</span>
                  <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                    ${escapeHtml(o.motivo || o.tipo)} | Entrega: ${escapeHtml(o.entrega || 'No definida')} | Resp: <strong>${escapeHtml(o.responsable || 'Sin asignar')}</strong>
                  </div>
                </div>
                <button type="button" class="primary-button" onclick="window.openOrderDetail('${escapeHtml(o.id)}')" style="background:#ef4444; color:white; border:none; padding:5px 12px; font-size:11px; font-weight:800; border-radius:6px; cursor:pointer;">
                  Ver Detalle
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Métricas Operativas por Trabajador -->
      <div class="sics-table-card">
        <div style="margin-bottom:14px;">
          <h3 style="margin:0; font-size:16px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
            <i class="fas fa-users-cog" style="color:#8b5cf6;"></i> Métricas Operativas por Trabajador
          </h3>
          <div style="font-size:11.5px; color:var(--text-muted);">Rendimiento individual del equipo en el período seleccionado</div>
        </div>
        <div style="overflow-x:auto;">
          <table class="sics-data-table">
            <thead>
              <tr>
                <th style="text-align:left;">Colaborador</th>
                <th style="text-align:center;">Órdenes Activas</th>
                <th style="text-align:center;">Rezagados</th>
                <th style="text-align:center;">Completados</th>
                <th style="text-align:center;">Promedio en Mesa</th>
                <th style="text-align:center;">Tiempo Total</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(workerStats).map(w => `
                <tr>
                  <td style="font-weight:bold;">${escapeHtml(w.name)}</td>
                  <td style="text-align:center;">
                    ${w.active > 0 ? `<button type="button" onclick="window.openWorkerOrdersModal('${escapeHtml(w.name)}','active')" style="background:#0ea5e9; color:white; border:none; border-radius:12px; padding:2px 10px; font-weight:bold; font-size:11px; cursor:pointer;" title="Ver órdenes activas">${w.active} <i class="fas fa-external-link-alt" style="font-size:9px;"></i></button>` : '<span style="color:var(--text-muted);">-</span>'}
                  </td>
                  <td style="text-align:center;">
                    ${w.overdue > 0 ? `<button type="button" onclick="window.openWorkerOrdersModal('${escapeHtml(w.name)}','overdue')" style="background:#ef4444; color:white; border:none; border-radius:12px; padding:2px 10px; font-weight:bold; font-size:11px; cursor:pointer;" title="Ver rezagados">${w.overdue} <i class="fas fa-external-link-alt" style="font-size:9px;"></i></button>` : '<span style="color:var(--text-muted);">-</span>'}
                  </td>
                  <td style="text-align:center;">
                    ${w.finished > 0 ? `
                      <button type="button" onclick="window.openWorkerCompletedModal('${escapeHtml(w.name)}')" style="background:rgba(99,102,241,0.15); color:#818cf8; border:1px solid rgba(99,102,241,0.3); border-radius:12px; padding:2px 10px; font-weight:bold; font-size:11px; cursor:pointer;" title="Clic para ver detalle de pedidos">
                        ${w.finished} <i class="fas fa-external-link-alt" style="font-size:9px;"></i>
                      </button>
                    ` : '<span style="color:var(--text-muted);">0</span>'}
                  </td>
                  <td style="text-align:center; color:var(--text-muted); font-size:12px;">
                    ${w.finishedCount ? Math.round(w.totalMins / w.finishedCount) + ' min' : '-'}
                  </td>
                  <td style="text-align:center; color:var(--text-muted); font-size:12px;">
                    ${w.totalMins + ' min'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

window.setReportsPeriod = function(period) {
  state.reportsDateFilter = period;
  if (typeof render === "function") render();
};

window.applyCustomRange = function() {
  state.reportsDateFrom = document.getElementById("reports-date-from")?.value || "";
  state.reportsDateTo = document.getElementById("reports-date-to")?.value || "";
  if (!state.reportsDateFrom && !state.reportsDateTo) {
    showToast("Selecciona al menos una fecha del rango.");
    return;
  }
  state.reportsDateFilter = "custom";
  if (typeof render === "function") render();
  showToast("📊 Filtro aplicado: " + (state.reportsDateFrom || 'inicio') + " → " + (state.reportsDateTo || 'hoy'));
};

window.openWorkerOrdersModal = function(workerName, mode) {
  const allOrders = state.data?.allOrders || [];
  const isActiveOrder = (o) => !(o.cerrado === "Sí" || ["Terminado", "Entregado", "Cancelado"].includes(String(o.estado || "")));
  const list = allOrders
    .filter(o => String(o.responsable || "").trim().toLowerCase() === String(workerName).toLowerCase())
    .filter(o => mode === 'overdue' ? (isActiveOrder(o) && priority(o) === 'overdue') : isActiveOrder(o));

  const title = mode === 'overdue'
    ? `⏳ Pedidos Rezagados de ${escapeHtml(workerName)}`
    : `🔧 Órdenes Activas de ${escapeHtml(workerName)}`;
  const subtitle = mode === 'overdue'
    ? `${list.length} pedido(s) vencido(s) que requieren atención.`
    : `${list.length} orden(es) en mesa de trabajo o bandeja.`;

  openModal(`
    <div class="modal-head">
      <div>
        <h2 style="margin:0;">${title}</h2>
        <div style="font-size:12px; color:var(--text-muted);">${subtitle}</div>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>
    <div style="max-height:420px; overflow-y:auto; margin-top:12px; display:flex; flex-direction:column; gap:8px;">
      ${list.length ? list.map(o => `
        <div style="background:var(--bg-main); border:1px solid ${mode === 'overdue' ? 'rgba(239,68,68,0.4)' : 'var(--border-color)'}; border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <strong style="color:var(--text-main); font-size:13px;">${escapeHtml(o.id)} - ${escapeHtml(o.cliente)}</strong>
            ${mode === 'overdue' ? '<span style="color:#ef4444; font-size:11px; font-weight:bold; margin-left:8px;">⏳ Vencido</span>' : ''}
            <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(o.tipo || o.motivo || '')} ${o.motivo && o.motivo !== o.tipo ? '| ' + escapeHtml(o.motivo) : ''}</div>
            <div style="font-size:11px; color:${mode === 'overdue' ? '#ef4444' : '#38bdf8'};">Entrega: ${escapeHtml(o.entrega || 'No definida')}</div>
          </div>
          <button type="button" class="secondary-button" onclick="closeModal(); window.openOrderDetail('${escapeHtml(o.id)}')" style="font-size:10.5px; padding:2px 8px;">Ver Ficha</button>
        </div>
      `).join('') : `<div style="text-align:center; padding:20px; color:var(--text-muted);">Sin pedidos en esta categoría para ${escapeHtml(workerName)}.</div>`}
    </div>
  `);
};

window.filterOverdueDirect = function() {
  state.screen = "team";
  state.searchQuery = "overdue";
  if (typeof render === "function") render();
};

window.openWorkerCompletedModal = function(workerName) {
  const finishedOrders = state.data?.finishedOrders || [];
  const workerOrders = finishedOrders.filter(o => String(o.responsable || "").trim().toLowerCase() === workerName.toLowerCase());

  openModal(`
    <div class="modal-head">
      <div>
        <h2 style="margin:0;">Pedidos Completados por ${escapeHtml(workerName)}</h2>
        <div style="font-size:12px; color:var(--text-muted);">${workerOrders.length} orden(es) finalizada(s) en historial.</div>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>
    <div style="max-height:400px; overflow-y:auto; margin-top:12px; display:flex; flex-direction:column; gap:8px;">
      ${workerOrders.length ? workerOrders.map(o => `
        <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:var(--text-main); font-size:13px;">${escapeHtml(o.id)} - ${escapeHtml(o.cliente)}</strong>
            <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(o.tipo)} | Motivo: <strong>${escapeHtml(o.motivo || 'General')}</strong></div>
            <div style="font-size:11px; color:#10b981;">Finalizado: ${escapeHtml(o.fechaCierre || o.entrega || 'N/A')}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:12px; font-weight:bold; color:#f59e0b;">⏱️ ${o.duracionRealMin || 0} min</span>
            <div><button type="button" class="secondary-button" onclick="closeModal(); window.openOrderDetail('${escapeHtml(o.id)}')" style="font-size:10.5px; padding:2px 8px; margin-top:4px;">Ver Ficha</button></div>
          </div>
        </div>
      `).join('') : '<div style="text-align:center; padding:20px; color:var(--text-muted);">No hay pedidos completados registrados para este trabajador en el período.</div>'}
    </div>
  `);
};


function schedulesView() {
  const allSchedules = state.data.schedules || state.schedules || state.data.horarios || [];
  const offset = state.selectedWeekOffset || 0;
  const wk = getWeekDetails(offset);
  const selectedRole = state.selectedScheduleRole || "todos";
  const onlyMySchedule = state.onlyMySchedule || false;
  const currentUserName = (state.session?.nombre || state.session?.username || "").toLowerCase().trim();

  let schedules = allSchedules.filter(s => {
    if (s.semana) {
      const sSem = String(s.semana).trim().toLowerCase();
      return sSem === wk.semanaId.toLowerCase() || 
             sSem === wk.semanaLabel.toLowerCase() ||
             sSem.includes(wk.semanaId.toLowerCase()) ||
             wk.semanaLabel.toLowerCase().includes(sSem);
    }
    return wk.isCurrent;
  });

  if (onlyMySchedule && currentUserName) {
    schedules = schedules.filter(s => String(s.colaborador || s.nombre || '').toLowerCase().includes(currentUserName));
  }

  if (selectedRole !== "todos") {
    schedules = schedules.filter(s => {
      const cargo = String(s.cargo || s.rol || '').toLowerCase();
      return cargo.includes(selectedRole.toLowerCase());
    });
  }

  const formatShiftCell = (val) => {
    const shift = String(val || 'Descanso').trim();
    const sLower = shift.toLowerCase();
    if (sLower === 'vacaciones') {
      return '<span class="sics-shift-pill shift-vacaciones">🏖️ Vacaciones</span>';
    }
    if (sLower === 'descanso' || sLower === 'libre') {
      return '<span class="sics-shift-pill shift-descanso">Descanso</span>';
    }
    return `<span class="sics-shift-pill shift-operativo">${escapeHtml(shift)}</span>`;
  };

  const roles = [
    { id: "todos", label: "Todos los Cargos" },
    { id: "diseño", label: "Diseño Gráfico" },
    { id: "corte", label: "Corte / Plotter" },
    { id: "armado", label: "Armado / Taller" },
    { id: "mostrador", label: "Mostrador / Atención" }
  ];

  return `
    <div style="max-width:1200px; margin:0 auto; padding:20px 16px; animation:sicsFadeIn 0.3s ease-out;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div>
          <button type="button" class="secondary-button" onclick="navigate('modules')" style="padding:5px 12px; font-size:12px; margin-bottom:8px; border-radius:20px;">
            <i class="fas fa-arrow-left"></i> Volver a Módulos
          </button>
          <h2 style="margin:0; font-size:22px;">📅 Horarios y Guardias del Equipo (SICS)</h2>
          <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">
            Turnos rotativos semanales filtrados por cargo y asignación personal.
          </p>
        </div>
        ${isLead() ? `
          <button type="button" class="primary-button" onclick="openEditScheduleModal('', '${wk.semanaId}', '${wk.semanaLabel}')" style="font-size:12px;">
            ✏️ Modificar Horario (${wk.isCurrent ? 'Esta Semana' : wk.semanaLabel})
          </button>
        ` : ''}
      </div>

      <!-- Filtros SICS: Cargo y Mi Horario -->
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:12px 16px; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; font-weight:700; color:var(--text-muted);">Filtrar Cargo:</span>
          <select id="sics-role-filter" onchange="state.selectedScheduleRole = this.value; render();" style="background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px; padding:5px 10px; font-size:12px;">
            ${roles.map(r => `<option value="${r.id}" ${selectedRole === r.id ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </div>

        <button type="button" class="secondary-button" onclick="state.onlyMySchedule = !state.onlyMySchedule; render();" style="font-size:12px; padding:5px 12px; border-radius:20px; background:${onlyMySchedule ? '#0ea5e9' : 'transparent'}; color:${onlyMySchedule ? '#fff' : 'var(--text-main)'}; border:1px solid var(--border-color);">
          ${onlyMySchedule ? '👤 Viendo Mi Horario' : '👥 Ver Solo Mi Horario'}
        </button>

        <div style="margin-left:auto; display:flex; gap:6px;">
          <button type="button" class="secondary-button" onclick="changeWeekOffset(-1)" style="font-size:11.5px; padding:4px 10px;">◀ Anterior</button>
          <button type="button" class="secondary-button" onclick="changeWeekOffset(0)" style="font-size:11.5px; padding:4px 10px; font-weight:700;">Semana Actual</button>
          <button type="button" class="secondary-button" onclick="changeWeekOffset(1)" style="font-size:11.5px; padding:4px 10px;">Siguiente ▶</button>
        </div>
      </div>

      <!-- Tabla de Horarios -->
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px; padding:16px; box-shadow:var(--shadow-sm); overflow-x:auto;">
        <div style="font-size:13px; font-weight:800; margin-bottom:10px; color:#0284c7;">
          <i class="fas fa-calendar-week"></i> ${wk.semanaLabel}
        </div>
        <table class="sics-schedule-table">
          <thead>
            <tr>
              <th style="text-align:left; min-width:140px;">Colaborador</th>
              <th>Lunes</th>
              <th>Martes</th>
              <th>Miércoles</th>
              <th>Jueves</th>
              <th>Viernes</th>
              <th>Sábado</th>
              <th>Domingo</th>
              ${isLead() ? '<th>Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${schedules.length ? schedules.map(s => {
              const cargo = s.cargo || 'Taller';
              return `
                <tr>
                  <td style="text-align:left; font-weight:700;">
                    <div style="font-size:9.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${escapeHtml(cargo)}</div>
                    <div style="font-size:13px;">👤 ${escapeHtml(s.colaborador || s.nombre)}</div>
                  </td>
                  <td>${formatShiftCell(s.lunes)}</td>
                  <td>${formatShiftCell(s.martes)}</td>
                  <td>${formatShiftCell(s.miercoles)}</td>
                  <td>${formatShiftCell(s.jueves)}</td>
                  <td>${formatShiftCell(s.viernes)}</td>
                  <td>${formatShiftCell(s.sabado)}</td>
                  <td>${formatShiftCell(s.domingo)}</td>
                  ${isLead() ? `
                    <td>
                      <button type="button" class="secondary-button" onclick="openEditScheduleModal('${escapeHtml(s.colaborador || s.nombre)}', '${wk.semanaId}', '${wk.semanaLabel}')" style="padding:3px 7px; font-size:11px;">
                        ✏️
                      </button>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="9" style="padding:24px; color:var(--text-muted);">
                  No hay turnos registrados para el filtro seleccionado en esta semana.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function financesView() {
  if (!isLead()) {
    return `<div class="empty"><strong>Acceso Restringido: Este módulo solo está disponible para Jefes y Managers.</strong></div>`;
  }
  
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

  return `
    <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); box-shadow:var(--shadow-md);">
      <div style="margin-bottom:16px;">
        <h2 style="margin:0;">💵 Control Financiero y Registro de Ingresos</h2>
        <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">Panel confidencial de Jefatura para auditar montos cobrados y rendimiento económico.</p>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px;">
        <div style="background:rgba(16,185,129,.1); border:1px solid #059669; padding:16px; border-radius:10px; text-align:center;">
          <span style="font-size:12px; color:#059669; font-weight:800;">INGRESOS HOY</span>
          <h2 style="color:#059669; margin:6px 0 0 0;">$${revToday.toFixed(2)}</h2>
          <small style="color:var(--text-muted);">${todayOrders.length} trabajos</small>
        </div>
        <div style="background:rgba(2,132,199,.1); border:1px solid #0284c7; padding:16px; border-radius:10px; text-align:center;">
          <span style="font-size:12px; color:#0284c7; font-weight:800;">ESTA SEMANA</span>
          <h2 style="color:#0284c7; margin:6px 0 0 0;">$${revWeek.toFixed(2)}</h2>
          <small style="color:var(--text-muted);">${weekOrders.length} trabajos</small>
        </div>
        <div style="background:rgba(147,51,234,.1); border:1px solid #9333ea; padding:16px; border-radius:10px; text-align:center;">
          <span style="font-size:12px; color:#9333ea; font-weight:800;">ESTE MES</span>
          <h2 style="color:#9333ea; margin:6px 0 0 0;">$${revMonth.toFixed(2)}</h2>
          <small style="color:var(--text-muted);">${monthOrders.length} trabajos</small>
        </div>
        <div style="background:rgba(217,119,6,.1); border:1px solid #d97706; padding:16px; border-radius:10px; text-align:center;">
          <span style="font-size:12px; color:#d97706; font-weight:800;">HISTÓRICO COMPLETO</span>
          <h2 style="color:#d97706; margin:6px 0 0 0;">$${revAll.toFixed(2)}</h2>
          <small style="color:var(--text-muted);">${finished.length} trabajos</small>
        </div>
      </div>

      <h3 style="font-size:15px; margin-bottom:12px;">DESGLOSE DE PROYECTOS CON COBRO REGISTRADO (${finished.length})</h3>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted);">
              <th style="padding:8px;">ID</th>
              <th style="padding:8px;">Cliente</th>
              <th style="padding:8px;">Tipo</th>
              <th style="padding:8px;">Motivo</th>
              <th style="padding:8px;">Responsable</th>
              <th style="padding:8px;">Duración</th>
              <th style="padding:8px;">Monto Cobrado ($)</th>
            </tr>
          </thead>
          <tbody>
            ${finished.map(o => `
              <tr style="border-bottom:1px solid var(--border-color); cursor:pointer;" data-action="detail" data-id="${escapeHtml(o.id)}" data-scope="finished">
                <td style="padding:8px; font-weight:bold;">${escapeHtml(o.id)}</td>
                <td style="padding:8px;">${escapeHtml(o.cliente)}</td>
                <td style="padding:8px;">${escapeHtml(o.tipo)}</td>
                <td style="padding:8px;">${escapeHtml(o.motivo || '-')}</td>
                <td style="padding:8px;">${escapeHtml(o.responsable)}</td>
                <td style="padding:8px;">${o.duracionRealMin || 0} min</td>
                <td style="padding:8px; font-weight:bold; color:#059669;">$${Number(o.costo || 0).toFixed(2)}</td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="padding:16px; text-align:center; color:var(--text-muted);">No hay trabajos finalizados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
window.setPerfTimeframe = function(tf) { state.perfTimeframe = tf; render(); };

function exportPerformancePDF(tf) {
  const tfLabels = { today: "Hoy", week: "Esta Semana", month: "Este Mes", all: "Histórico Completo" };
  const perfMap = computeWorkerPerformance(tf);
  const now = new Date();
  const nowStr = now.toLocaleDateString('es-VE', { dateStyle: 'long' });

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert("Permite las ventanas emergentes en tu navegador para imprimir el PDF.");
    return;
  }

  // Filtrar órdenes completadas en este período para el desglose detallado
  const finished = state.data.finishedOrders || [];
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

  const periodOrders = finished.filter(filterFn);

  // Conteo de motivos
  const motivosCount = {};
  periodOrders.forEach(o => {
    const m = String(o.motivo || "Sin motivo específico").trim();
    motivosCount[m] = (motivosCount[m] || 0) + 1;
  });

  const activeWorkers = Object.keys(perfMap).filter(uName => perfMap[uName] && perfMap[uName].completed > 0);
  const rowsWorkerHtml = activeWorkers.map(uName => {
    const data = perfMap[uName];
    const avgMin = data.completed > 0 ? Math.round(data.totalMin / data.completed) : 0;
    return `
      <tr>
        <td style="padding:8px 12px; border:1px solid #cbd5e1; font-weight:bold;">👤 ${escapeHtml(uName)}</td>
        <td style="padding:8px 12px; border:1px solid #cbd5e1; text-align:center;">${data.completed}</td>
        <td style="padding:8px 12px; border:1px solid #cbd5e1; text-align:center;">${data.totalMin} min</td>
        <td style="padding:8px 12px; border:1px solid #cbd5e1; text-align:center;">${avgMin} min/pedido</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="4" style="padding:16px; text-align:center; color:#666;">No hay pedidos completados en este período.</td></tr>';

  const rowsOrdersHtml = periodOrders.map(o => `
    <tr>
      <td style="padding:6px 10px; border:1px solid #e2e8f0; font-weight:bold;">${escapeHtml(o.id)}</td>
      <td style="padding:6px 10px; border:1px solid #e2e8f0;">${escapeHtml(o.cliente)}</td>
      <td style="padding:6px 10px; border:1px solid #e2e8f0;">${escapeHtml(o.tipo || '-')}</td>
      <td style="padding:6px 10px; border:1px solid #e2e8f0; font-weight:600; color:#1e3a8a;">🎨 ${escapeHtml(o.motivo || 'Sin temática')}</td>
      <td style="padding:6px 10px; border:1px solid #e2e8f0;">${escapeHtml(o.responsable)}</td>
      <td style="padding:6px 10px; border:1px solid #e2e8f0; text-align:center;">${o.duracionRealMin || 0} min</td>
      <td style="padding:6px 10px; border:1px solid #e2e8f0; text-align:right; font-weight:bold; color:#059669;">$${Number(o.costo || 0).toFixed(2)}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="padding:16px; text-align:center; color:#666;">No hay pedidos registrados en este período.</td></tr>';

  const motivosSummaryHtml = Object.keys(motivosCount).map(m => `
    <span style="display:inline-block; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:3px 8px; border-radius:12px; font-size:11px; margin:2px 4px; font-weight:700;">
      🎨 ${escapeHtml(m)}: <strong>${motivosCount[m]}</strong>
    </span>
  `).join('') || '<span style="color:#666; font-size:12px;">Sin temáticas registradas.</span>';

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Producción y Rendimiento - Creaciones JJ</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 25px; color: #1e293b; font-size: 13px; line-height: 1.4; }
        .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
        .logo-box { display: flex; align-items: center; gap: 12px; }
        .logo-box h1 { margin: 0; color: #1e3a8a; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
        .logo-box p { margin: 2px 0 0 0; color: #64748b; font-size: 12px; font-weight: 600; }
        .meta-header { text-align: right; font-size: 12px; color: #475569; }
        h2 { font-size: 15px; color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 8px; margin: 18px 0 8px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
        th { background: #1e3a8a; color: white; padding: 8px 10px; border: 1px solid #1e3a8a; text-align: left; }
        .signatures { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-box { width: 42%; text-align: center; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 11px; color: #64748b; font-weight: bold; }
        @media print {
          button { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <div class="logo-box">
          <div style="background:#1e3a8a; color:#fff; width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:900;">JJ</div>
          <div>
            <h1>CREACIONES JJ · OCHOA & RISQUEZ</h1>
            <p>Papelería Creativa, Toppers & Decoración · Reporte Oficial de Producción</p>
          </div>
        </div>
        <div class="meta-header">
          <div><strong>Período:</strong> ${tfLabels[tf] || tf}</div>
          <div><strong>Fecha de emisión:</strong> ${nowStr}</div>
        </div>
      </div>

      <h2>1. RENDIMIENTO DE PRODUCCIÓN POR TRABAJADOR</h2>
      <table>
        <thead>
          <tr>
            <th>Trabajador</th>
            <th style="text-align:center;">Pedidos Completados</th>
            <th style="text-align:center;">Tiempo Invertido</th>
            <th style="text-align:center;">Promedio por Pedido</th>
          </tr>
        </thead>
        <tbody>
          ${rowsWorkerHtml}
        </tbody>
      </table>

      <h2>2. TEMÁTICAS Y MOTIVOS MÁS ELABORADOS EN EL PERÍODO</h2>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:16px;">
        ${motivosSummaryHtml}
      </div>

      <h2>3. DESGLOSE DE PROYECTOS CUMPLIDOS (${periodOrders.length})</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Motivo / Temática</th>
            <th>Responsable</th>
            <th style="text-align:center;">Duración</th>
            <th style="text-align:right;">Monto ($)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsOrdersHtml}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">Firma del Manager / Jefatura de Taller</div>
        <div class="sig-box">Sello Oficial Creaciones JJ</div>
      </div>

      <div style="text-align:center; margin-top:25px;">
        <button onclick="window.print()" style="padding:10px 24px; background:#1e3a8a; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; box-shadow:0 2px 8px rgba(30,58,138,0.3);">🖨️ Imprimir / Guardar como PDF</button>
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
}
window.exportPerformancePDF = exportPerformancePDF;

function settingsView() {
  const motivos = state.frequentMotivos || [];
  const types = state.frequentTypes || ["Topper", "Stickers", "Taza Sublimada", "Invitación Digital", "Letras 3D", "Pendón", "Caja Sorpresa", "Maqueta"];
  const users = (state.data?.users || []).length ? state.data.users : getRealTeamList().map(n => ({ name: n, nombre: n, role: n === 'Moises' ? 'manager' : (n === 'Julieta' ? 'jefe' : 'trabajador'), active: true }));

  return `
    <div style="max-width:960px; margin:0 auto; padding-bottom:40px;">
      <div style="margin-bottom:18px;">
        <h1 style="font-size:20px; margin:0 0 6px 0;">⚙️ Configuración y Ajustes de Creaciones JJ</h1>
        <p style="font-size:12.5px; color:var(--text-muted); margin:0;">Personaliza temas, catálogo de motivos, tipos de trabajo y gestión de usuarios en acordeones desplegables.</p>
      </div>

      <div class="jj-accordion-group">

        <!-- 1. CATÁLOGO DE MOTIVOS Y TEMÁTICAS -->
        <div class="jj-accordion-item" id="acc-motivos">
          <div class="jj-accordion-header" onclick="window.toggleAccordion('acc-motivos')">
            <div class="jj-accordion-title-wrap">
              <div class="jj-accordion-icon" style="background:rgba(14,165,233,0.15); color:#0ea5e9;">
                <i class="fas fa-palette"></i>
              </div>
              <div>
                <h3 class="jj-accordion-title">Catálogo de Motivos y Temáticas</h3>
                <div class="jj-accordion-sub">${motivos.length} motivos registrados para autocompletado rápido</div>
              </div>
            </div>
            <i class="fas fa-chevron-down jj-accordion-chevron"></i>
          </div>
          <div class="jj-accordion-body">
            <div style="display:flex; gap:8px; margin-bottom:12px;">
              <input type="text" id="search-motivo-input" placeholder="🔍 Buscar motivo..." oninput="window.filterMotivosChips(this.value)" style="flex:1; padding:6px 10px; font-size:12px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px;">
              <div style="display:flex; gap:6px; flex:1;">
                <input type="text" id="new-motivo-input" placeholder="+ Nuevo motivo (ej: Stitch, Sonic)" style="flex:1; padding:6px 10px; font-size:12px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px;">
                <button type="button" class="primary-button" onclick="window.addMotivoFromSettings()" style="padding:6px 12px; font-size:11.5px; font-weight:bold;">Añadir</button>
              </div>
            </div>
            <div id="motivos-chips-container" style="display:flex; flex-wrap:wrap; gap:6px; max-height:220px; overflow-y:auto; padding:6px; background:rgba(0,0,0,0.2); border-radius:8px;">
              ${motivos.map(m => `
                <span class="motivo-tag-chip" data-motivo="${escapeHtml(m.toLowerCase())}" style="background:rgba(14,165,233,0.12); color:#38bdf8; border:1px solid rgba(14,165,233,0.25); border-radius:14px; padding:3px 10px; font-size:11.5px; display:inline-flex; align-items:center; gap:6px;">
                  ${escapeHtml(m)}
                  <button type="button" onclick="window.deleteMotivoFromSettings('${escapeHtml(m)}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:10px; padding:0;">✕</button>
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 2. TIPOS DE TRABAJO Y SERVICIOS -->
        <div class="jj-accordion-item" id="acc-tipos">
          <div class="jj-accordion-header" onclick="window.toggleAccordion('acc-tipos')">
            <div class="jj-accordion-title-wrap">
              <div class="jj-accordion-icon" style="background:rgba(245,158,11,0.15); color:#f59e0b;">
                <i class="fas fa-cubes"></i>
              </div>
              <div>
                <h3 class="jj-accordion-title">Tipos de Trabajo y Servicios</h3>
                <div class="jj-accordion-sub">${types.length} servicios tipificados en taller</div>
              </div>
            </div>
            <i class="fas fa-chevron-down jj-accordion-chevron"></i>
          </div>
          <div class="jj-accordion-body">
            <div style="display:flex; gap:6px; margin-bottom:12px;">
              <input type="text" id="new-tipo-input" placeholder="+ Nuevo tipo de trabajo" style="flex:1; padding:6px 10px; font-size:12px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px;">
              <button type="button" class="primary-button" onclick="window.addTipoFromSettings()" style="padding:6px 12px; font-size:11.5px; font-weight:bold;">Añadir</button>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${types.map(t => `
                <span style="background:rgba(245,158,11,0.12); color:#fbbf24; border:1px solid rgba(245,158,11,0.25); border-radius:14px; padding:4px 10px; font-size:11.5px; display:inline-flex; align-items:center; gap:6px;">
                  ${escapeHtml(t)}
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 3. GESTIÓN DE USUARIOS Y ROLES -->
        <div class="jj-accordion-item" id="acc-usuarios">
          <div class="jj-accordion-header" onclick="window.toggleAccordion('acc-usuarios')">
            <div class="jj-accordion-title-wrap">
              <div class="jj-accordion-icon" style="background:rgba(139,92,246,0.15); color:#8b5cf6;">
                <i class="fas fa-user-shield"></i>
              </div>
              <div>
                <h3 class="jj-accordion-title">Gestión de Perfiles y Trabajadores</h3>
                <div class="jj-accordion-sub">Equipo oficial y control de accesos</div>
              </div>
            </div>
            <i class="fas fa-chevron-down jj-accordion-chevron"></i>
          </div>
          <div class="jj-accordion-body">
            <!-- Botón directo para que el usuario logueado cambie su PIN -->
            <div style="background:linear-gradient(135deg, rgba(56,189,248,0.1), rgba(14,165,233,0.05)); border:1.5px solid #0284c7; border-radius:10px; padding:12px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div>
                <strong style="color:#0284c7; font-size:13px; display:flex; align-items:center; gap:6px;">
                  <i class="fas fa-key"></i> Mi Contraseña / PIN de Acceso
                </strong>
                <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                  Sesión activa: <strong>${escapeHtml(state.session?.name || state.session?.nombre || '')}</strong> · Puedes personalizar tu PIN de 6 dígitos
                </div>
              </div>
              <button type="button" class="primary-button" onclick="window.openChangePinModal()" style="font-size:11.5px; padding:6px 14px; background:#0284c7; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                🔑 Cambiar Mi PIN
              </button>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span style="font-size:12px; color:var(--text-muted);">Equipo real de Creaciones JJ</span>
              ${isLead() ? `
                <button type="button" class="secondary-button" onclick="formNewUser()" style="font-size:11px; padding:4px 10px; background:#10b981; color:white; border:none;">
                  + Crear Nuevo Perfil
                </button>
              ` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${users.map(u => {
                const isActive = u.active !== false && u.activo !== false;
                return `
                <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <strong style="color:var(--text-main);">${escapeHtml(u.name || u.nombre)}</strong>
                    <span style="font-size:11px; margin-left:8px; padding:2px 7px; border-radius:10px; background:rgba(99,102,241,0.15); color:#818cf8; text-transform:capitalize;">
                      ${escapeHtml(u.role || u.rol || 'Trabajador')}
                    </span>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:11px; ${isActive ? 'color:#10b981;' : 'color:#ef4444;'} font-weight:bold;">
                      ${isActive ? '● Activo' : '○ Inactivo'}
                    </span>
                    ${isLead() ? `
                      <button type="button" class="secondary-button" onclick="window.toggleUserStatus('${escapeHtml(u.name || u.nombre)}', ${isActive})" style="font-size:10px; padding:3px 8px; background:${isActive ? '#f59e0b' : '#10b981'}; color:white; border:none; border-radius:4px; cursor:pointer;">
                        ${isActive ? '⏸️ Desactivar' : '▶️ Activar'}
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 4. TEMAS Y COLORES -->
        <div class="jj-accordion-item" id="acc-temas">
          <div class="jj-accordion-header" onclick="window.toggleAccordion('acc-temas')">
            <div class="jj-accordion-title-wrap">
              <div class="jj-accordion-icon" style="background:rgba(16,185,129,0.15); color:#10b981;">
                <i class="fas fa-brush"></i>
              </div>
              <div>
                <h3 class="jj-accordion-title">Personalización y Temas Visuales</h3>
                <div class="jj-accordion-sub">Paletas de color y estética del taller</div>
              </div>
            </div>
            <i class="fas fa-chevron-down jj-accordion-chevron"></i>
          </div>
          <div class="jj-accordion-body">
            <div style="margin-bottom:14px;">
              <span style="font-size:12px; font-weight:bold; color:var(--text-main); display:block; margin-bottom:8px;">TEMAS PREESTABLECIDOS:</span>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="secondary-button" onclick="setPresetTheme('blue')" style="font-size:11px; padding:6px 12px; background:#1e3a8a; color:white; border:none;">💙 Azul Real</button>
                <button type="button" class="secondary-button" onclick="setPresetTheme('emerald')" style="font-size:11px; padding:6px 12px; background:#065f46; color:white; border:none;">💚 Esmeralda</button>
                <button type="button" class="secondary-button" onclick="setPresetTheme('purple')" style="font-size:11px; padding:6px 12px; background:#581c87; color:white; border:none;">💜 Púrpura</button>
                <button type="button" class="secondary-button" onclick="setPresetTheme('amber')" style="font-size:11px; padding:6px 12px; background:#78350f; color:white; border:none;">🧡 Ámbar</button>
              </div>
            </div>
            <button type="button" class="secondary-button" onclick="resetDefaultTheme()" style="font-size:11px; padding:5px 10px;">
              🔄 Restablecer Colores por Defecto
            </button>
          </div>
        </div>

        <!-- 5. PLANTILLA DE WHATSAPP -->
        <div class="jj-accordion-item" id="acc-whatsapp">
          <div class="jj-accordion-header" onclick="window.toggleAccordion('acc-whatsapp')">
            <div class="jj-accordion-title-wrap">
              <div class="jj-accordion-icon" style="background:rgba(37,211,102,0.15); color:#25d366;">
                <i class="fab fa-whatsapp"></i>
              </div>
              <div>
                <h3 class="jj-accordion-title">Plantilla de Mensaje WhatsApp</h3>
                <div class="jj-accordion-sub">Notificación automática al cliente cuando su pedido está listo</div>
              </div>
            </div>
            <i class="fas fa-chevron-down jj-accordion-chevron"></i>
          </div>
          <div class="jj-accordion-body">
            <textarea id="setting-whatsapp-template" rows="3" style="width:100%; padding:8px 10px; font-size:12px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; box-sizing:border-box;">${escapeHtml(store.get(`pp_whatsapp_template_${state.session?.name || state.session?.nombre || 'default'}`, 'Hola {cliente}, tu pedido de {tipo} ({motivo}) ya se encuentra listo para entrega en Creaciones JJ.'))}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
              <span style="font-size:11px; color:var(--text-muted);">Variables: {cliente}, {tipo}, {motivo}, {id}</span>
              <button type="button" class="primary-button" onclick="window.saveWhatsAppTemplate()" style="padding:6px 14px; font-size:11.5px; background:#10b981; border:none;">
                💾 Guardar Plantilla
              </button>
            </div>
          </div>
        </div>

        <!-- 5b. INTELIGENCIA ARTIFICIAL & TRANSCRIPCIÓN DE FOTOS -->
        <div class="jj-accordion-item" id="acc-ia">
          <div class="jj-accordion-header" onclick="window.toggleAccordion('acc-ia')">
            <div class="jj-accordion-title-wrap">
              <div class="jj-accordion-icon" style="background:rgba(16,185,129,0.15); color:#10b981;">
                <i class="fas fa-robot"></i>
              </div>
              <div>
                <h3 class="jj-accordion-title">Inteligencia Artificial & Transcripción de Fotos</h3>
                <div class="jj-accordion-sub">Gemini Flash para lectura instantánea de recibos y arqueos</div>
              </div>
            </div>
            <i class="fas fa-chevron-down jj-accordion-chevron"></i>
          </div>
          <div class="jj-accordion-body">
            <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px; line-height:1.5;">
              Al tomar o subir fotos de comandas de <strong>JJ Express</strong> o planillas de <strong>Cierre de Caja</strong>, el sistema utiliza <strong>Google Gemini Flash</strong> para transcribir automáticamente los datos manuscritos y montos para que no tengas que copiarlos a mano.
            </p>
            <div class="field" style="margin-bottom:12px;">
              <span class="field-label">CLAVE DE API GOOGLE GEMINI (GRATUITA):</span>
              <div style="display:flex; gap:8px;">
                <input type="password" id="settings-gemini-key" placeholder="AIzaSy..." value="${escapeHtml(window.getGeminiApiKey ? window.getGeminiApiKey() : '')}" style="flex:1;">
                <button type="button" class="secondary-button" id="toggle-gemini-key-vis" style="padding:6px 10px;" onclick="const inp=document.getElementById('settings-gemini-key'); inp.type = inp.type==='password'?'text':'password';">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
              <small style="color:var(--text-muted); font-size:11px; margin-top:4px; display:block;">
                ¿No tienes clave? Obtén una 100% gratis en: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:#0ea5e9; text-decoration:underline; font-weight:bold;">Google AI Studio (1 minuto)</a>
              </small>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="primary-button" onclick="window.saveGeminiKeyFromSettings()" style="background:#10b981; border:none; padding:8px 16px; font-weight:bold; cursor:pointer;">
                💾 Guardar Clave de IA
              </button>
              <button type="button" class="secondary-button" onclick="window.testGeminiConnection()" style="padding:8px 14px; font-weight:bold; cursor:pointer;">
                🧪 Probar Conexión
              </button>
            </div>
            <div id="gemini-test-result" style="margin-top:10px; font-size:12px;"></div>
          </div>
        </div>

        <!-- 6. GESTIÓN DE PROVEEDORES -->
        <div class="jj-accordion-item" id="acc-proveedores">
          <div class="jj-accordion-header" onclick="window.toggleAccordion('acc-proveedores')">
            <div class="jj-accordion-title-wrap">
              <div class="jj-accordion-icon" style="background:rgba(16,185,129,0.15); color:#10b981;">
                <i class="fas fa-truck"></i>
              </div>
              <div>
                <h3 class="jj-accordion-title">Gestión de Proveedores</h3>
                <div class="jj-accordion-sub">Lista de proveedores para OCR de notas de entrega</div>
              </div>
            </div>
            <i class="fas fa-chevron-down jj-accordion-chevron"></i>
          </div>
          <div class="jj-accordion-body">
            <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px; line-height:1.5;">
              Agrega o edita proveedores en la lista para que el OCR pueda identificar automáticamente a qué proveedor corresponde cada nota de entrega.
            </p>
            <div class="field" style="margin-bottom:12px;">
              <span class="field-label">AGREGAR NUEVO PROVEEDOR:</span>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <input type="text" id="new-provider-input" placeholder="Ej. Proveedor XYZ C.A." style="flex:1; min-width:150px;">
                <button type="button" class="primary-button" onclick="window.addProvider()" style="background:#10b981; border:none; padding:8px 16px; font-weight:bold; cursor:pointer; white-space:nowrap;">
                  ➕ Agregar
                </button>
              </div>
            </div>
            <div style="margin-top:12px;">
              <span class="field-label">LISTA DE PROVEEDORES:</span>
              <div id="providers-list" style="margin-top:8px; max-height:200px; overflow-y:auto;">
                ${getProviderList().map(p => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:var(--bg-main); border-radius:6px; margin-bottom:4px; border:1px solid var(--border-color);">
                    <span style="font-size:12px;">${escapeHtml(p)}</span>
                    <button type="button" onclick="window.removeProvider('${escapeHtml(p)}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">
                      🗑️
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- 7. MANTENIMIENTO Y HERRAMIENTAS -->
        <div class="jj-accordion-item" id="acc-mantenimiento">
          <div class="jj-accordion-header" onclick="window.toggleAccordion('acc-mantenimiento')">
            <div class="jj-accordion-title-wrap">
              <div class="jj-accordion-icon" style="background:rgba(239,68,68,0.15); color:#ef4444;">
                <i class="fas fa-tools"></i>
              </div>
              <div>
                <h3 class="jj-accordion-title">Mantenimiento y Respaldo del Sistema</h3>
                <div class="jj-accordion-sub">Sincronización, caché y copias de seguridad</div>
              </div>
            </div>
            <i class="fas fa-chevron-down jj-accordion-chevron"></i>
          </div>
          <div class="jj-accordion-body">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              ${isLead() ? `
                <button type="button" class="primary-button" onclick="window.forzarActualizacionGlobal()" style="background:#ef4444; border:none; padding:8px 14px; font-size:11.5px;">
                  🚀 Forzar Actualización a Todo el Equipo
                </button>
                <button type="button" class="secondary-button" onclick="window.archivarAntiguos()" style="font-size:11.5px; padding:8px 14px;">
                  📦 Archivar Pedidos Antiguos (>60 días)
                </button>
                <button type="button" class="secondary-button" onclick="window.exportarBackup()" style="font-size:11.5px; padding:8px 14px;">
                  💾 Descargar Copia Backup
                </button>
                <label style="font-size:11.5px; padding:8px 14px; border:1px solid var(--border-color); border-radius:6px; cursor:pointer; background:var(--bg-main); color:var(--text-main);">
                  📥 Importar Copia Backup
                  <input type="file" id="settings-import-input" accept=".json" onchange="window.importarBackupDesdeAjustes(event)" style="display:none;">
                </label>
              ` : ''}
              <button type="button" class="secondary-button" onclick="window.limpiarCacheLocal()" style="font-size:11.5px; padding:8px 14px;">
                🧹 Limpiar Caché Local
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

window.toggleAccordion = function(id) {
  const item = document.getElementById(id);
  if (!item) return;
  item.classList.toggle('is-open');
};

window.filterMotivosChips = function(query) {
  const q = String(query || "").trim().toLowerCase();
  document.querySelectorAll('#motivos-chips-container .motivo-tag-chip').forEach(el => {
    const m = el.getAttribute('data-motivo') || "";
    el.style.display = (!q || m.includes(q)) ? 'inline-flex' : 'none';
  });
};

window.addMotivoFromSettings = function() {
  const inp = document.getElementById('new-motivo-input');
  const val = inp?.value.trim();
  if (!val) return;
  let list = state.frequentMotivos || [];
  if (!list.map(m=>m.toLowerCase()).includes(val.toLowerCase())) {
    list.push(val);
    state.frequentMotivos = list;
    store.set('pp_frequent_motivos', list);
    showToast(`✅ Motivo "${val}" añadido.`);
  }
  if (inp) inp.value = "";
  if (typeof render === "function") render();
};

window.deleteMotivoFromSettings = function(motivo) {
  let list = state.frequentMotivos || [];
  list = list.filter(m => m.toLowerCase() !== motivo.toLowerCase());
  state.frequentMotivos = list;
  store.set('pp_frequent_motivos', list);
  showToast(`Eliminado: ${motivo}`);
  if (typeof render === "function") render();
};

window.addTipoFromSettings = function() {
  const inp = document.getElementById('new-tipo-input');
  const val = inp?.value.trim();
  if (!val) return;
  let list = state.frequentTypes || [];
  if (!list.map(t=>t.toLowerCase()).includes(val.toLowerCase())) {
    list.push(val);
    state.frequentTypes = list;
    store.set('pp_frequent_types', list);
    showToast(`✅ Tipo "${val}" añadido.`);
  }
  if (inp) inp.value = "";
  if (typeof render === "function") render();
};

window.saveWhatsAppTemplate = function() {
  const val = document.getElementById('setting-whatsapp-template')?.value.trim();
  if (val) {
    const userKey = state.session?.name || state.session?.nombre || 'default';
    store.set(`pp_whatsapp_template_${userKey}`, val);
    showToast("💾 Plantilla de WhatsApp guardada para tu usuario.");
  }
};

window.importarBackupDesdeAjustes = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!isLead()) {
    alert("Solo gerencia puede importar copias de seguridad.");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      // Aquí se puede agregar lógica para procesar el backup
      showToast("✅ Copia de seguridad importada exitosamente.");
    } catch (err) {
      alert("Error al importar archivo: formato inválido.");
    }
  };
  reader.readAsText(file);
};


function render() {
  if (!state.session) {
    state.session = store.get("pp_profile_session", null);
  }
  if (!state.session) return;
  
  try {
    applyTheme();
    const screenNames = {
      modules: "Módulos de Producción",
      now: "Mesa Activa & Cronómetro", queue: "Mi Bandeja", team: "Bandeja Global de Operaciones",
      reports: "Reportes & Avance",
      providers: "Proveedores & Cuentas por Pagar (Solo Jefes)",
      cash: "Cierre de Caja & Arqueo Diario (Solo Jefes)",
      inventory: "Mini Inventario & Faltantes",
      workshopPrices: "Precios y Medidas del Taller",
      history: "Historial & Archivo", schedules: "Horarios del Equipo",
      finances: "Control Financiero (Solo Jefes)", settings: "Ajustes del Sistema"
    };
    
    const titleEl = $("#screen-title");
    if (titleEl) titleEl.textContent = screenNames[state.screen] || "Ahora";
    
    const roleLabelEl = $("#role-label");
    if (roleLabelEl && state.session) {
      const roleStr = formatRoleLabel(state.session.role).toUpperCase();
      const nameStr = String(state.session.name || "Usuario").toUpperCase();
      roleLabelEl.textContent = `CREACIONES JJ · ${roleStr} · ${nameStr}`;
    }
    
    const navLeadBtn = document.querySelector(".nav-lead-only");
    if (navLeadBtn) navLeadBtn.style.display = isLead() ? "inline-flex" : "none";

    const screenEl = $("#screen");
    if (screenEl) {
      const views = {
        modules: modulesView,
        now: nowView, queue: queueView, team: teamView,
        reports: reportsView,
        providers: providersView,
        cash: cashView,
        inventory: inventoryView,
        workshopPrices: workshopPricesView,
        history: historyView, schedules: schedulesView,
        finances: financesView, settings: settingsView
      };
      screenEl.innerHTML = (views[state.screen] || views.modules)();

      // Sincronizar fichas de navegación SICS y contadores en vivo
      document.querySelectorAll(".sics-tab-btn").forEach((btn) => {
        const s = btn.dataset.screen;
        btn.classList.toggle("active", s === state.screen);
        if (btn.classList.contains("manager-only-tab")) {
          btn.style.display = isLead() ? "inline-flex" : "none";
        }
      });
      const nowCount = (state.data?.myOrders || []).filter(active).length;
      const teamCount = (state.data?.allOrders || []).filter(active).length;
      const bNow = document.getElementById("tabBadgeNow");
      if (bNow) bNow.textContent = nowCount;
      const bTeam = document.getElementById("tabBadgeTeam");
      if (bTeam) bTeam.textContent = teamCount;
    }
    
    document.querySelectorAll(".nav-button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.screen === state.screen);
    });



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

    // Actualizar User Pill y Alertas estilo SICS 2026
    const userPill = document.getElementById("userPillName");
    if (userPill && state.session) {
      userPill.textContent = `${state.session.name || 'Usuario'} (${formatRoleLabel(state.session.role)})`;
    }
    if (window.checkTallerAlertas) window.checkTallerAlertas();
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
  state.selectedOrder = order;
  const rawPhone = cleanPhoneNumber(order.telefono);
  const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(state.waTemplate.replace(/{cliente}/g, order.cliente).replace(/{tipo}/g, order.tipo).replace(/{estado}/g, order.estado).replace(/{id}/g, order.id))}`;
  const refLinks = String(order.fotoReferencia || "").split("\n").filter(Boolean);
  const eviLinks = String(order.fotoEvidencia || "").split("\n").filter(Boolean);

  const clientInfo = state.frequentClients.find(
    c => c.name.toLowerCase() === order.cliente.toLowerCase()
  ) || {};
  const hasDelivery = clientInfo.delivery === "Sí";

  // Cálculo de tiempo transcurrido en vivo si está en proceso
  let liveTimerNotice = '';
  if (order.estado === 'En proceso') {
    const elMin = getOrderElapsedMinutes(order);
    liveTimerNotice = `
      <div style="background:rgba(16,185,129,0.12); border:1.5px solid #10b981; border-radius:10px; padding:12px 16px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <strong style="color:#10b981; font-size:13px; display:block;"><i class="fas fa-stopwatch fa-spin"></i> CRONÓMETRO EN VIVO:</strong>
          <span style="font-size:12px; color:var(--text-main);">Llevas <strong id="modal-live-stopwatch-text">${elMin} minutos</strong> de trabajo físico en mesa.</span>
        </div>
        <span class="live-stopwatch-badge live-stopwatch-active" id="modal-live-stopwatch-badge" data-order-id="${escapeHtml(order.id)}" style="font-size:13px; padding:6px 12px;">⏱️ ${elMin} min</span>
      </div>
    `;
  }

  // AVISO / MODAL LIMITANTE DE PRIMERA APERTURA (Para TODOS los trabajadores y Managers como Sra. Julieta)
  let gatekeeperBanner = '';
  if (active(order) && (order.estado === 'Pendiente' || !order.inicioProduccion)) {
    gatekeeperBanner = `
      <div style="background:linear-gradient(135deg, rgba(14,165,233,0.1), rgba(139,92,246,0.1)); border:2px solid #0ea5e9; border-radius:14px; padding:14px; margin-bottom:16px;">
        <div style="font-weight:900; color:#0284c7; font-size:14px; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-bolt" style="color:#0ea5e9;"></i> PASO OBLIGATORIO: ¿EN QUÉ FASE COMENZARÁS ESTE PEDIDO?
        </div>
        <p style="font-size:12px; color:var(--text-muted); margin:6px 0 12px 0;">
          Para registrar las métricas exactas de tiempo y evitar confusiones en el taller, indica la etapa en que iniciarás:
        </p>
        <div class="gatekeeper-card-grid">
          <div class="gatekeeper-choice-card diseno" onclick="setOrderPhase('${escapeHtml(order.id)}', 'diseno')">
            <i class="fas fa-palette" style="font-size:1.8rem; color:#8b5cf6;"></i>
            <strong style="color:#7c3aed; font-size:13px;">Fase de Diseño Gráfico</strong>
            <span style="font-size:11px; color:var(--text-muted);">Elaboración previa en PC. No consume tiempo de mesa de producción.</span>
          </div>
          <div class="gatekeeper-choice-card produccion" onclick="setOrderPhase('${escapeHtml(order.id)}', 'produccion')">
            <i class="fas fa-tools" style="font-size:1.8rem; color:#10b981;"></i>
            <strong style="color:#059669; font-size:13px;">Fase de Producción en Mesa</strong>
            <span style="font-size:11px; color:var(--text-muted);">Corte, armado, sublimación, stickers. ⏱️ <strong>Inicia cronómetro en vivo</strong>.</span>
          </div>
        </div>
      </div>
    `;
  }

  // Renderizado de Sub-Ítems / Lista de Trabajos dentro del Pedido
  let subItems = [];
  try {
    subItems = Array.isArray(order.subItems) ? order.subItems : (typeof order.subItems === 'string' && order.subItems ? JSON.parse(order.subItems) : []);
  } catch(e) {}

  let subItemsChecklistHtml = '';
  if (Array.isArray(subItems) && subItems.length > 0) {
    subItemsChecklistHtml = `
      <div style="border:1.5px solid rgba(14,165,233,0.4); background:rgba(14,165,233,0.03); border-radius:12px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="color:#0284c7; font-size:13px; display:flex; align-items:center; gap:6px;">
            <i class="fas fa-tasks"></i> TRABAJOS DE ESTE PEDIDO (${subItems.length} ÍTEMS):
          </strong>
          <button type="button" class="secondary-button" style="padding:2px 8px; font-size:11px; border-radius:6px;" onclick="addSubItemToOrder('${escapeHtml(order.id)}')">
            ➕ Agregar Otro
          </button>
        </div>
        <div class="subitems-checklist">
          ${subItems.map((item, sIdx) => {
            const isDone = Boolean(item.completado || item.done);
            return `
              <div class="subitem-check-item ${isDone ? 'completed' : ''}">
                <label class="subitem-check-left" onclick="toggleSubItemDone('${escapeHtml(order.id)}', ${sIdx})">
                  <input type="checkbox" ${isDone ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
                  <span class="item-name" style="font-weight:700; color:var(--text-main);">
                    ${item.cantidad ? `(${item.cantidad}) ` : ''}${escapeHtml(item.tipo || item.name || 'Trabajo')}
                  </span>
                  ${item.detalles ? `<small style="color:var(--text-muted); font-size:11px;">- ${escapeHtml(item.detalles)}</small>` : ''}
                </label>
                <span style="font-size:11px; font-weight:800; padding:2px 6px; border-radius:10px; ${isDone ? 'background:#dcfce7; color:#15803d;' : 'background:#fef3c7; color:#d97706;'}">
                  ${isDone ? '✅ Listo' : '⏳ Pendiente'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  openModal(`
    <div class="modal-head"><div><p class="eyebrow">${escapeHtml(order.id)}</p><h2>${escapeHtml(order.cliente)}</h2></div><button class="close-button" data-action="close">×</button></div>
    ${gatekeeperBanner}
    ${liveTimerNotice}
    ${subItemsChecklistHtml}
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
            ${(isLead() ? ["Pendiente", "En proceso", "Pausado", "Terminado", "Entregado", "Cancelado"] : ["Pendiente", "En proceso", "Pausado", "Terminado", "Cancelado"]).map((st) => `<option value="${st}" ${order.estado === st ? "selected" : ""}>${st}</option>`).join("")}
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

      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">ENTREGA SOLICITADA POR CLIENTE:</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="color:var(--text-main);">${escapeHtml(formatDate(order.entrega))}</strong>
          ${isLead() ? `<button type="button" class="secondary-button" style="background:#0284c7; color:white; border:none; padding:3px 8px; font-size:11px; font-weight:700; border-radius:6px; cursor:pointer;" onclick="openEditDeliveryDateModal('${escapeHtml(order.id)}')">✏️ Modificar Fecha</button>` : ''}
        </div>
      </div>

      ${order.finProduccion ? `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px; background:rgba(5,150,105,0.08); padding:8px 10px; border-radius:6px; margin:4px 0;">
          <span style="font-weight:700; color:#059669; font-size:12px;">🏁 FECHA DE FINALIZACIÓN REAL:</span>
          <strong style="color:#059669;">${escapeHtml(formatDate(order.finProduccion))}</strong>
        </div>
      ` : ''}

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

      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">RESPONSABLE:</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="color:var(--text-main);">${escapeHtml(order.responsable)}</strong>
          ${active(order) ? `<button type="button" class="secondary-button" style="background:#4f46e5; color:white; border:none; padding:4px 10px; font-size:12px; font-weight:700; border-radius:6px; cursor:pointer;" data-action="reassign-order" data-id="${escapeHtml(order.id)}" onclick="openReassignModal('${escapeHtml(order.id)}')">👥 Reasignar</button>` : ''}
        </div>
      </div>

      ${(() => {
        let colabs = [];
        try {
          colabs = typeof order.colaboradores === 'string' ? JSON.parse(order.colaboradores) : order.colaboradores;
        } catch(e) {}
        if (!Array.isArray(colabs) || !colabs.length) return '';
        return `
          <div style="background:rgba(79,70,229,0.08); border:1px solid #818cf8; border-radius:8px; padding:8px 12px; margin-top:2px; margin-bottom:6px;">
            <strong style="color:#4338ca; font-size:12px; display:block; margin-bottom:4px;">👥 TRABAJO EN EQUIPO / REASIGNACIONES PREVIAS:</strong>
            ${colabs.map(c => `
              <div style="font-size:12px; color:var(--text-main); margin-bottom:4px; padding-bottom:4px; border-bottom:1px dashed rgba(79,70,229,0.2);">
                👤 <strong>${escapeHtml(c.trabajador)}:</strong> ${c.tiempoMin || 0} min aportados ${c.motivo ? `· <em>${escapeHtml(c.motivo)}</em>` : ''} ${c.nota ? `· "${escapeHtml(c.nota)}"` : ''} <small style="color:var(--text-muted);">(${escapeHtml(c.fecha || '')})</small>
              </div>
            `).join('')}
          </div>
        `;
      })()}
      
      <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">TELÉFONO WHATSAPP:</span>
        <strong style="color:var(--text-main);">${escapeHtml(order.telefono || "No registrado")}</strong>
      </div>

      ${isLead() ? `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px; background:rgba(2,132,199,.1); padding:8px; border-radius:6px;">
          <span style="font-weight:700; color:#0284c7; font-size:12px;">📅 FECHA/HORA ENTREGA:</span>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="date" id="order-entrega-input" value="${order.entrega ? new Date(order.entrega).toISOString().split('T')[0] : ''}" style="padding:4px 6px; border-radius:6px; border:1px solid #0284c7;">
            <button type="button" class="secondary-button" id="save-entrega-btn" onclick="saveOrderEntrega('${escapeHtml(order.id)}')" data-action="save-entrega" data-id="${escapeHtml(order.id)}" style="padding:4px 6px; font-size:11px; background:#0284c7;">💾 Guardar</button>
          </div>
        </div>
      ` : ''}

      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">⏱️ TIEMPO INVERTIDO (MIN):</span>
        ${isLead() ? `
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="number" id="order-duration-input" value="${order.duracionRealMin || 0}" style="width:70px; padding:4px 6px; border-radius:6px; border:1px solid var(--border-color);">
            <button type="button" class="secondary-button" id="save-duration-btn" onclick="saveOrderDuration('${escapeHtml(order.id)}')" data-action="save-duration" data-id="${escapeHtml(order.id)}" style="padding:4px 6px; font-size:11px;">💾 Min</button>
          </div>
        ` : `<strong style="color:var(--text-main);">${order.duracionRealMin || 0} min</strong>`}
      </div>

      ${isLead() ? `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:6px; background:rgba(16,185,129,.1); padding:8px; border-radius:6px;">
          <span style="font-weight:700; color:#059669; font-size:12px;">💵 PRECIO / COSTO COBRADO ($):</span>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="number" step="0.01" id="order-cost-input" value="${order.costo || 0}" style="width:90px; padding:4px 8px; border-radius:6px; border:1px solid #059669; font-weight:bold;">
            <button type="button" class="primary-button" id="save-cost-btn" onclick="saveOrderCost('${escapeHtml(order.id)}')" data-action="save-cost" data-id="${escapeHtml(order.id)}" style="padding:4px 8px; font-size:11px; background:#059669;">💾 Guardar $</button>
          </div>
        </div>
      ` : ''}
      
      <div style="display:flex; flex-direction:column; gap:4px; border-bottom:1px dashed var(--border-color); padding-bottom:6px;">
        <span style="font-weight:700; color:var(--text-muted); font-size:12px;">DESCRIPCIÓN / MEDIDAS:</span>
        <p style="font-size:14px; background:var(--bg-main); padding:8px; border-radius:6px; color:var(--text-main);">${escapeHtml(order.descripcion || "Sin descripción")}</p>
      </div>
      
      <div style="margin-top:6px; border-bottom:1px dashed var(--border-color); padding-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-weight:700; color:var(--text-muted); font-size:12px;">🖼️ FOTOS DE REFERENCIA:</span>
          <button type="button" class="secondary-button" style="padding:3px 8px; font-size:11px; background:#0284c7; color:white; border:none; border-radius:6px; cursor:pointer;" onclick="openAddRefImagesModal('${escapeHtml(order.id)}')">📷 Añadir Fotos de Referencia</button>
        </div>
        ${refLinks.length ? `
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
            ${refLinks.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="secondary-button" style="color:var(--primary-color);">🖼️ Ref ${idx + 1}</a>`).join("")}
          </div>
        ` : `<p style="font-size:12px; color:var(--text-muted); margin:4px 0 0 0;">Sin fotos de referencia adjuntas. Puedes añadirlas ahora.</p>`}
      </div>

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
          <button type="button" class="secondary-button" id="add-note-btn" style="padding:3px 8px; font-size:11px; background:var(--primary-color); color:white; border:none;">＋ Añadir Nota</button>
        </div>
        <div style="background:var(--bg-main); padding:10px 12px; border-radius:6px; font-size:12px; max-height:140px; overflow-y:auto; color:var(--text-main); line-height:1.6; border:1px solid var(--border-color);">
          ${order.notas ? order.notas.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            return `<div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px dashed var(--border-color); word-break:break-word;">${escapeHtml(trimmed)}</div>`;
          }).join('') : '<em style="color:var(--text-muted);">Sin observaciones o notas registradas.</em>'}
        </div>
      </div>
    </div>
    ${rawPhone ? `<div class="actions" style="margin-top:16px;"><button type="button" class="secondary-button" style="background:#25D366; color:white; text-align:center; display:block; width:100%; font-weight:bold; padding:10px; border:none;" data-action="notify-wa-corporate" data-id="${escapeHtml(order.id)}" data-phone="${escapeHtml(order.telefono)}" data-client="${escapeHtml(order.cliente)}" data-type="${escapeHtml(order.tipo)}" data-motivo="${escapeHtml(order.motivo || '')}">📲 Notificar por WhatsApp</button></div>` : ""}
    ${isLead() ? `
      <div class="actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        ${!active(order) ? `<button class="secondary-button" style="background:var(--primary-color); color:white; border:none; flex:1;" data-action="reopen-order" data-id="${escapeHtml(order.id)}">🔄 Reabrir Proyecto</button>` : ''}
        ${order.estado !== "Entregado" ? `<button class="secondary-button" style="background:var(--success-color); color:white; border:none; flex:1;" data-action="mark-delivered" data-id="${escapeHtml(order.id)}">📦 Marcar Entregado</button>` : ''}
        <button class="secondary-button" style="background:#0ea5e9; color:white; border:none; flex:1;" data-action="add-evidence-photos" data-id="${escapeHtml(order.id)}">📷 Añadir Fotos de Evidencia</button>
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
}

window.saveOrderCost = async function(orderId) {
  const input = document.getElementById("order-cost-input");
  const btn = document.getElementById("save-cost-btn");
  const val = parseFloat(input?.value || 0);
  if (isNaN(val) || val < 0) {
    alert("Por favor ingresa un monto válido en dólares.");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Guardando...";
  }
  try {
    await api("profile_save_cost", { id: orderId, costo: val });
    const allTarget = [...(state.data.finishedOrders || []), ...(state.data.allOrders || []), ...(state.data.myOrders || [])];
    allTarget.forEach(o => {
      if (String(o.id).trim() === String(orderId).trim()) o.costo = val;
    });
    showToast(`💵 Precio de $${val.toFixed(2)} guardado.`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✅ Guardado";
      setTimeout(() => { if (btn) btn.textContent = "💾 Guardar $"; }, 2000);
    }
    await refresh(false);
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "💾 Guardar $";
    }
    alert(`Error al guardar costo: ${err.message}`);
  }
};

window.saveOrderDuration = async function(orderId) {
  const input = document.getElementById("order-duration-input");
  const btn = document.getElementById("save-duration-btn");
  const val = parseInt(input?.value || 0, 10);
  if (isNaN(val) || val < 0) {
    alert("Por favor ingresa una cantidad válida de minutos.");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Guardando...";
  }
  try {
    await api("profile_update_order", { id: orderId, changes: { duracionRealMin: val } });
    const allTarget = [...(state.data.finishedOrders || []), ...(state.data.allOrders || []), ...(state.data.myOrders || [])];
    allTarget.forEach(o => {
      if (String(o.id).trim() === String(orderId).trim()) o.duracionRealMin = val;
    });
    showToast(`⏱️ Duración actualizada a ${val} min.`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✅ Guardado";
      setTimeout(() => { if (btn) btn.textContent = "💾 Min"; }, 2000);
    }
    await refresh(false);
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "💾 Min";
    }
    alert(`Error al guardar duración: ${err.message}`);
  }
};

window.saveOrderEntrega = async function(orderId) {
  const input = document.getElementById("order-entrega-input");
  const btn = document.getElementById("save-entrega-btn");
  const val = input?.value;
  if (!val) {
    alert("Por favor selecciona una fecha de entrega válida.");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Guardando...";
  }
  try {
    await api("profile_update_order", { id: orderId, changes: { entrega: val } });
    const allTarget = [...(state.data.finishedOrders || []), ...(state.data.allOrders || []), ...(state.data.myOrders || [])];
    allTarget.forEach(o => {
      if (String(o.id).trim() === String(orderId).trim()) o.entrega = val;
    });
    showToast(`📅 Fecha de entrega actualizada a ${val}.`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✅ Guardado";
      setTimeout(() => { if (btn) btn.textContent = "💾 Guardar"; }, 2000);
    }
    await refresh(false);
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "💾 Guardar";
    }
    alert(`Error al guardar fecha de entrega: ${err.message}`);
  }
};

let activeMediaStream = null;

function stopActiveCamera() {
  if (activeMediaStream) {
    try {
      activeMediaStream.getTracks().forEach(t => t.stop());
    } catch(e) {}
    activeMediaStream = null;
  }
}

function openLiveCameraModal(onCaptureCallback) {
  openModal(`
    <div class="modal-head">
      <h2>📸 Cámara Directa de Producción</h2>
      <button class="close-button" data-action="close" onclick="stopActiveCamera()">×</button>
    </div>
    <div class="live-camera-box">
      <video id="live-cam-video" class="live-camera-video" autoplay playsinline muted></video>
      <div class="camera-controls-bar">
        <button type="button" class="secondary-button" onclick="stopActiveCamera(); closeModal();" style="border:none; background:#475569; color:white;">Cancelar</button>
        <button type="button" id="cam-snap-btn" class="camera-capture-btn" title="Tomar Foto">📸</button>
      </div>
    </div>
    <p style="text-align:center; font-size:12px; color:var(--text-muted); margin-top:8px;">
      🔒 <strong>Propiedad Intelectual:</strong> La foto se captura directamente en memoria para subirla a la orden sin guardarse en la galería de tu celular personal.
    </p>
  `);

  const video = document.getElementById("live-cam-video");
  const snapBtn = document.getElementById("cam-snap-btn");

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    }).then(stream => {
      activeMediaStream = stream;
      if (video) {
        video.srcObject = stream;
        video.play();
      }
    }).catch(err => {
      alert("No se pudo acceder a la cámara directa (" + err.message + "). Por favor usa la opción de 'Elegir de Archivos'.");
      closeModal();
    });
  } else {
    alert("Tu navegador o dispositivo no soporta acceso directo a cámara. Usa la opción de 'Elegir de Archivos'.");
    closeModal();
  }

  snapBtn?.addEventListener("click", () => {
    if (!video || !video.videoWidth) {
      alert("Esperando señal de video...");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1];
    stopActiveCamera();
    closeModal();
    if (onCaptureCallback) onCaptureCallback(base64, dataUrl);
  });
}
window.openLiveCameraModal = openLiveCameraModal;

function openFinishModal(order, targetStatus) {
  let capturedEvidences = [];

  const renderEviThumbs = () => {
    const listEl = document.getElementById("finish-evi-thumbs");
    if (!listEl) return;
    if (!capturedEvidences.length) {
      listEl.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Sin fotos adjuntas aún.</span>';
      return;
    }
    listEl.innerHTML = capturedEvidences.map((img, idx) => `
      <div style="position:relative; display:inline-block; border-radius:6px; overflow:hidden; border:1px solid var(--border-color);">
        <img src="data:image/jpeg;base64,${img.data}" style="width:65px; height:65px; object-fit:cover; display:block;">
        <button type="button" onclick="removeFinishEvi(${idx})" style="position:absolute; top:2px; right:2px; background:rgba(220,38,38,0.85); color:white; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>
      </div>
    `).join("");
  };

  window.removeFinishEvi = function(idx) {
    capturedEvidences.splice(idx, 1);
    renderEviThumbs();
  };

  openModal(`
    <div class="modal-head"><h2>Completar Trabajo (${targetStatus})</h2><button class="close-button" data-action="close">×</button></div>
    <form id="finish-form" class="form-grid">
      <div style="background:var(--bg-main); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:13px;">
        <div>📦 <strong>Pedido:</strong> ${escapeHtml(order.id)} – ${escapeHtml(order.cliente)}</div>
        <div style="margin-top:2px; font-size:12px; color:var(--text-muted);">Tipo: ${escapeHtml(order.tipo)} ${order.motivo ? `· Motivo: ${escapeHtml(order.motivo)}` : ''}</div>
      </div>

      ${(() => {
        let calcElapsed = 0;
        if (order.inicioProduccion) {
          const sMs = new Date(order.inicioProduccion).getTime();
          if (!isNaN(sMs)) {
            calcElapsed = Math.max(0, Math.round((Date.now() - sMs) / 60000) - (Number(order.tiempoPausadoMin) || 0));
          }
        }
        // Si el cronómetro está en 0 pero ya había un tiempo guardado, usar ese valor
        if (calcElapsed <= 0 && Number(order.duracionRealMin) > 0) {
          calcElapsed = Number(order.duracionRealMin);
        }
        // Guardar el valor calculado en un atributo data para recuperarlo si el usuario lo borra
        const storedElapsed = calcElapsed;
        
        // Validación: si el diseño está en proceso, advertir al usuario
        const designWarning = (order.diseno && (order.diseno.toLowerCase() === 'no' || order.diseno === 'En proceso' || order.diseno === 'en proceso')) ? 
          `<div style="background:rgba(245,158,11,0.15); border:1px solid #f59e0b; border-radius:8px; padding:10px; margin-bottom:12px; font-size:12px; color:#d97706;">
            <strong>⚠️ ADVERTENCIA:</strong> El estado del diseño aún está en proceso. Se recomienda marcar el diseño como "Listo para fabricar" antes de terminar el pedido.
          </div>` : '';
        
        return `
          ${designWarning}
          <div style="background:rgba(16,185,129,0.08); border:1.5px solid #10b981; border-radius:10px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-size:12.5px; font-weight:800; color:#059669; display:block;">⏱️ TIEMPO REAL INVERTIDO EN MESA:</span>
              <span style="font-size:11px; color:var(--text-muted);">
                ${calcElapsed > 0 ? `Calculado por el cronómetro: <strong>${formatMinutesToHuman(calcElapsed)}</strong>` : `⚠️ Cronómetro no iniciado o en 0. Confirma los minutos reales.`}
              </span>
            </div>
            <input type="number" id="finish-duracion-manual" name="duracionManualMin" value="${calcElapsed > 0 ? calcElapsed : ''}" placeholder="${calcElapsed > 0 ? calcElapsed : 'Minutos'}" min="0" data-stored-value="${calcElapsed}" ${calcElapsed > 0 ? '' : 'required'} style="width:85px; padding:6px 8px; border-radius:6px; border:1.5px solid #10b981; font-weight:bold; font-size:14px; text-align:center;">
          </div>
        `;
      })()}

      <label class="field"><span class="field-label">COMENTARIO DE CIERRE / OBSERVACIÓN</span>
        <textarea name="comentarioCierre" required placeholder="Escribe un comentario sobre la elaboración, materiales usados o imprevistos..."></textarea>
      </label>

      <div style="margin:4px 0;">
        <span class="field-label" style="display:block; margin-bottom:6px;">📷 FOTOS DE EVIDENCIA (HASTA 3 FOTOS):</span>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
          <button type="button" class="secondary-button" id="finish-open-cam-btn" style="background:#0284c7; color:white; border:none; display:flex; align-items:center; gap:6px; font-size:12px; padding:8px 12px; font-weight:bold;">
            📸 Tomar Foto con Cámara Directa
          </button>
          <label class="secondary-button" style="cursor:pointer; display:flex; align-items:center; gap:6px; font-size:12px; padding:8px 12px; margin:0;">
            📁 Elegir de Archivos
            <input type="file" id="evidencia-files" accept="image/*" multiple style="display:none;">
          </label>
        </div>
        <div id="finish-evi-thumbs" style="display:flex; gap:8px; flex-wrap:wrap; min-height:40px; align-items:center; background:var(--bg-main); padding:8px; border-radius:6px; border:1px dashed var(--border-color);">
          <span style="color:var(--text-muted); font-size:12px;">Sin fotos adjuntas aún.</span>
        </div>
      </div>

      <div class="modal-footer"><button type="submit" class="primary-button" style="background:#059669; border:none;">Guardar y Finalizar Pedido</button></div>
    </form>
  `);

  document.getElementById("finish-open-cam-btn")?.addEventListener("click", () => {
    if (capturedEvidences.length >= 3) {
      alert("Ya has alcanzado el límite de 3 fotos de evidencia.");
      return;
    }
    openLiveCameraModal((base64) => {
      capturedEvidences.push({ data: base64, mimeType: "image/jpeg" });
      openFinishModal(order, targetStatus);
      renderEviThumbs();
    });
  });

  document.getElementById("evidencia-files")?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      if (capturedEvidences.length >= 3) break;
      const compressed = await compressImageFile(f);
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(compressed);
      });
      capturedEvidences.push({ data: base64, mimeType: "image/jpeg" });
    }
    renderEviThumbs();
  });

  $("#finish-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "⏳ Guardando y subiendo evidencias...";

    const commentVal = e.target.comentarioCierre.value.trim() || "Completado sin observaciones adicionales.";
    const manualVal = e.target.duracionManualMin?.value?.trim();
    // Si el usuario no ingresó manualmente, usar el valor calculado o almacenado
    const finalDuration = manualVal ? Number(manualVal) : calcElapsed;

    try {
      console.log("Guardando orden con duración:", finalDuration, "minutos");
      
      await api("profile_update_order", {
        id: order.id,
        user: state.session?.name || "Usuario",
        role: state.session?.role || "trabajador",
        changes: {
          estado: targetStatus,
          comentarioCierre: commentVal,
          duracionManualMin: finalDuration,
          duracionRealMin: finalDuration,
          images: capturedEvidences
        }
      }, 60000);
      closeModal();
      await refresh(false);
      console.log("Pedido finalizado. duracionRealMin guardado:", Number(e.target.duracionManualMin?.value || 0));
      showToast("Pedido finalizado con éxito.");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Guardar y Finalizar Pedido";
      alert(`Error: ${err.message}`);
    }
  });
}

function openEditDeliveryDateModal(orderOrId) {
  let order = orderOrId;
  if (typeof order === "string") {
    order = [...(state.data.allOrders || []), ...(state.data.myOrders || []), ...(state.data.finishedOrders || [])].find(o => String(o.id).trim() === orderOrId.trim());
  }
  if (!order) return;

  const curDate = safeParseDate(order.entrega) || new Date();
  const curDateIso = curDate.toISOString().split("T")[0];
  let curHour = curDate.getHours();
  const curMin = curDate.getMinutes().toString().padStart(2, "0");
  const curAmpm = curHour >= 12 ? "PM" : "AM";
  curHour = curHour % 12 || 12;
  const curHourStr = `${curHour.toString().padStart(2, "0")}:${curMin} ${curAmpm}`;

  openModal(`
    <div class="modal-head">
      <h2>🗓️ Modificar Fecha de Entrega (${escapeHtml(order.id)})</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <form id="edit-delivery-form" class="form-grid">
      <div style="background:var(--bg-main); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:13px;">
        <div>📦 <strong>Pedido:</strong> ${escapeHtml(order.id)} – ${escapeHtml(order.cliente)}</div>
        <div style="margin-top:4px;">⏰ <strong>Fecha actual:</strong> ${escapeHtml(formatDate(order.entrega))}</div>
      </div>

      <div class="form-inline">
        <label class="field"><span class="field-label">NUEVA FECHA DE ENTREGA</span>
          <input type="date" name="fechaEntrega" value="${curDateIso}" required>
        </label>
        <label class="field"><span class="field-label">NUEVA HORA DE ENTREGA</span>
          <select name="horaEntrega" required>
            ${generateTimeOptions(curHourStr)}
          </select>
        </label>
      </div>

      <label class="field"><span class="field-label">📝 MOTIVO DEL CAMBIO DE FECHA</span>
        <input type="text" name="motivoCambio" placeholder="Ej: Cliente solicitó aplazar entrega para el lunes" required>
      </label>

      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button" style="background:#0284c7; border:none;">💾 Guardar Nueva Fecha</button>
      </div>
    </form>
  `);

  $("#edit-delivery-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "💾 Guardando fecha...";

    const formData = new FormData(e.target);
    const nFecha = formData.get("fechaEntrega");
    const nHora = formData.get("horaEntrega");
    const nMotivo = formData.get("motivoCambio") || "Cambio de fecha acordado";

    try {
      await api("profile_update_order", {
        id: order.id,
        user: state.session?.name || "Manager",
        changes: {
          fechaEntrega: nFecha,
          horaEntrega: nHora,
          entrega: nFecha,
          nota: `🗓️ Fecha de entrega modificada al ${nFecha} a las ${nHora}. Motivo: ${nMotivo}`
        }
      }, 45000);

      // Actualización optimista inmediata en memoria
      const allLists = [state.data.allOrders || [], state.data.myOrders || [], state.data.finishedOrders || []];
      for (const list of allLists) {
        const found = list.find(o => String(o.id).trim() === String(order.id).trim());
        if (found) {
          found.entrega = `${nFecha}T18:00:00`;
          found.horaEntrega = nHora;
        }
      }

      closeModal();
      await refresh(false);
      showToast("✅ Fecha de entrega actualizada.");
    } catch(err) {
      btn.disabled = false;
      btn.textContent = "💾 Guardar Nueva Fecha";
      alert(`Error al actualizar fecha: ${err.message}`);
    }
  });
}
window.openEditDeliveryDateModal = openEditDeliveryDateModal;

function openAddRefImagesModal(orderOrId) {
  let order = orderOrId;
  if (typeof order === "string") {
    order = [...(state.data.allOrders || []), ...(state.data.myOrders || []), ...(state.data.finishedOrders || [])].find(o => String(o.id).trim() === orderOrId.trim());
  }
  if (!order) return;

  let capturedImages = [];

  const updateThumbs = () => {
    const listEl = document.getElementById("ref-thumbs-list");
    if (!listEl) return;
    if (!capturedImages.length) {
      listEl.innerHTML = '<p style="color:var(--text-muted); font-size:12px; margin:4px 0;">No hay fotos seleccionadas todavía.</p>';
      return;
    }
    listEl.innerHTML = capturedImages.map((img, idx) => `
      <div style="position:relative; display:inline-block; border-radius:6px; overflow:hidden; border:1px solid var(--border-color);">
        <img src="data:image/jpeg;base64,${img.data}" style="width:70px; height:70px; object-fit:cover; display:block;">
        <button type="button" onclick="removeRefThumb(${idx})" style="position:absolute; top:2px; right:2px; background:rgba(220,38,38,0.85); color:white; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>
      </div>
    `).join("");
  };

  window.removeRefThumb = function(idx) {
    capturedImages.splice(idx, 1);
    updateThumbs();
  };

  openModal(`
    <div class="modal-head">
      <h2>📷 Añadir Fotos de Referencia (${escapeHtml(order.id)})</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <form id="add-ref-form" class="form-grid">
      <div style="background:var(--bg-main); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:13px;">
        <div>📦 <strong>Pedido:</strong> ${escapeHtml(order.id)} – ${escapeHtml(order.cliente)}</div>
        <p style="font-size:12px; color:var(--text-muted); margin:4px 0 0 0;">Adjunta imágenes de referencia recibidas posteriormente por WhatsApp o tomadas en taller.</p>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin:8px 0;">
        <button type="button" class="secondary-button" id="open-cam-ref-btn" style="background:#0284c7; color:white; border:none; display:flex; align-items:center; gap:6px; padding:8px 12px; font-weight:bold;">
          📸 Tomar con Cámara Directa
        </button>
        <label class="secondary-button" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:8px 12px; margin:0;">
          📁 Elegir de Archivos / Galería
          <input type="file" id="extra-ref-files" accept="image/*" multiple style="display:none;">
        </label>
      </div>

      <div id="ref-thumbs-list" style="display:flex; gap:8px; flex-wrap:wrap; min-height:40px; align-items:center; background:var(--bg-card); padding:8px; border-radius:6px; border:1px dashed var(--border-color);">
        <p style="color:var(--text-muted); font-size:12px; margin:4px 0;">No hay fotos seleccionadas todavía.</p>
      </div>

      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button" style="background:#059669; border:none;">💾 Subir Fotos a Google Drive</button>
      </div>
    </form>
  `);

  document.getElementById("open-cam-ref-btn")?.addEventListener("click", () => {
    openLiveCameraModal((base64) => {
      capturedImages.push({ data: base64, mimeType: "image/jpeg" });
      openAddRefImagesModal(order);
      updateThumbs();
    });
  });

  document.getElementById("extra-ref-files")?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const compressed = await compressImageFile(f);
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(compressed);
      });
      capturedImages.push({ data: base64, mimeType: "image/jpeg" });
    }
    updateThumbs();
  });

  $("#add-ref-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!capturedImages.length) {
      alert("Por favor toma o selecciona al menos una foto de referencia.");
      return;
    }
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "Subiendo fotos a Drive...";

    try {
      await api("profile_add_reference_images", {
        id: order.id,
        images: capturedImages
      });
      closeModal();
      await refresh(false);
      showToast("✅ Fotos de referencia añadidas correctamente.");
    } catch(err) {
      btn.disabled = false;
      btn.textContent = "💾 Subir Fotos a Google Drive";
      alert(`Error al subir fotos: ${err.message}`);
    }
  });
}
window.openAddRefImagesModal = openAddRefImagesModal;

function openEditClientModal(client) {
  openModal(`
    <div class="modal-head">
      <h2>✏️ Editar Cliente Frecuente</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <form id="edit-client-form" class="form-grid">
      <input type="hidden" name="originalName" value="${escapeHtml(client.name)}">
      <label class="field"><span class="field-label">NOMBRE DEL CLIENTE</span>
        <input name="name" required value="${escapeHtml(client.name)}">
      </label>
      <label class="field"><span class="field-label">TELÉFONO / WHATSAPP</span>
        <input name="phone" type="tel" value="${escapeHtml(client.phone || '')}" placeholder="04XXXXXXXXX">
      </label>
      <label class="field"><span class="field-label">¿REQUIERE DELIVERY?</span>
        <select name="delivery">
          <option value="No" ${client.delivery !== 'Sí' ? 'selected' : ''}>No – Retira en tienda</option>
          <option value="Sí" ${client.delivery === 'Sí' ? 'selected' : ''}>Sí – Se le lleva a domicilio</option>
        </select>
      </label>
      <label class="field"><span class="field-label">ZONA / SECTOR (Ej: Norte, Los Palos Grandes)</span>
        <input name="zona" value="${escapeHtml(client.zona || '')}" placeholder="Ej. Norte, Sur...">
      </label>
      <label class="field"><span class="field-label">DIRECCIÓN DE ENTREGA</span>
        <input name="direccion" value="${escapeHtml(client.direccion || '')}" placeholder="Ej. Calle 5...">
      </label>
      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">💾 Guardar Cambios</button>
      </div>
    </form>
  `);

  $("#edit-client-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    try {
      await api("profile_edit_client", Object.fromEntries(new FormData(e.target)));
      closeModal();
      await refresh(false);
      showToast("✅ Cliente actualizado con éxito.");
    } catch(err) {
      btn.disabled = false;
      alert(`Error al editar cliente: ${err.message}`);
    }
  });
}
window.openEditClientModal = openEditClientModal;

function openLearningGuideModal() {
  const isManager = state.session && (state.session.role === 'manager' || state.session.role === 'jefe' || state.session.role === 'jefa');
  
  const workerModules = `
      <!-- MÓDULO 1 -->
      <div class="guide-card">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number">1</span> Flujo de Estados y Conteo de Tiempo Real
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          El sistema mide la productividad del taller automáticamente calculando los minutos que trabajas. Para que tu rendimiento sea exacto:
        </p>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px; font-size:12px;">
          <div><span class="guide-badge-pill" style="background:#fee2e2; color:#dc2626;">🔴 Pendiente</span> Pedido nuevo en cola. Nadie lo está armando aún (Tiempo: 0 min).</div>
          <div><span class="guide-badge-pill" style="background:#fef3c7; color:#d97706;">🟡 En proceso</span> <strong>¡Aquí empieza a correr el cronómetro!</strong> Pásalo a este estado cuando comiences a cortar, armar o pegar físicamente en la mesa.</div>
          <div><span class="guide-badge-pill" style="background:#e0f2fe; color:#0284c7;">⏸️ Pausado</span> Si debes detenerte (esperando cartulina, plotter o respuesta del cliente), ponlo en pausa para que no se sume tiempo inactivo.</div>
          <div><span class="guide-badge-pill" style="background:#dcfce7; color:#15803d;">🟢 Terminado</span> <strong>Completado al 100%.</strong> Te pedirá foto de evidencia y comentario. Tu tiempo se cierra y suma a tus estadísticas del día.</div>
          <div><span class="guide-badge-pill" style="background:#059669; color:white;">📦 Entregado</span> <strong>Exclusivo de Jefes / Managers.</strong> Cuando el cliente retira o se va con el delivery.</div>
        </div>
      </div>

      <!-- MÓDULO 2 -->
      <div class="guide-card">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number">2</span> Pedido Rápido Mostrador (JJ Express)
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Para registrar pedidos de mostrador en segundos:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Presiona el botón ⚡ <strong>Mostrador Rápido</strong> en el header.</li>
          <li>Completa: cliente, teléfono, tipo, motivo, cantidad, costo, anticipo, método de pago.</li>
          <li><strong>OCR:</strong> Toma foto de la comanda física para transcripción automática.</li>
          <li>Botón rápido para entregas a las 7:30 PM.</li>
          <li>Sube fotos de referencia que el cliente envió por WhatsApp.</li>
        </ul>
      </div>

      <!-- MÓDULO 3 -->
      <div class="guide-card">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number">3</span> Asistente de Voz (JJ-Bot)
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Dicta pedidos por voz sin escribir:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Presiona el botón del robot 🤖 en la esquina inferior derecha.</li>
          <li>Presiona el micrófono 🎙️ y dicta: <em>"Pedido para María de un topper de Spiderman para el lunes"</em></li>
          <li>El sistema entiende lenguaje natural venezolano.</li>
          <li>Si el micrófono falla, usa <strong>Win + H</strong> para dictado nativo de Windows.</li>
        </ul>
      </div>

      <!-- MÓDULO 4 -->
      <div class="guide-card">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number">4</span> Buscador Spotlight (Ctrl + K)
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Busca cualquier cosa instantáneamente:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Presiona <strong>Ctrl + K</strong> o el botón 🔍 en el header.</li>
          <li>Busca pedidos por ID, cliente, tipo o motivo.</li>
          <li>Busca clientes por nombre o teléfono.</li>
          <li>Busca acciones: "crear pedido", "mi bandeja", "historial".</li>
          <li>Navega con flechas ↑↓, Enter para seleccionar, Esc para cerrar.</li>
        </ul>
      </div>

      <!-- MÓDULO 5 -->
      <div class="guide-card">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number">5</span> Reasignaciones y Trabajo en Equipo
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Si un pedido no se puede terminar hoy:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Pulsa el botón morado <strong>👥 Reasignar</strong> en el detalle del pedido.</li>
          <li>Ingresa los minutos que invertiste (ej: 45 min) y el avance.</li>
          <li>Tus minutos quedan reconocidos en tu reporte.</li>
          <li>El compañero recibe el pedido sin perder el avance.</li>
        </ul>
      </div>

      <!-- MÓDULO 6 -->
      <div class="guide-card">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number">6</span> Reportes y Estadísticas
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Revisa tu rendimiento en la pestaña "Reportes & Avance":
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li><strong>Pedidos Completados Hoy:</strong> Conteo de trabajos terminados.</li>
          <li><strong>Tiempo Promedio:</strong> Duración media por pedido.</li>
          <li><strong>Rezagados:</strong> Clic para filtrar pedidos demorados.</li>
          <li><strong>Filtros:</strong> Mes en curso, mes anterior, o personalizado.</li>
          <li><strong>Clic en tu contador:</strong> Modal con tus pedidos del día.</li>
        </ul>
      </div>

      <!-- MÓDULO 7 -->
      <div class="guide-card">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number">7</span> Cambiar tu PIN Personal
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Gestiona tu seguridad:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Presiona el botón de llave 🔙 en el header.</li>
          <li>Ingresa tu PIN actual y el nuevo PIN (4-6 dígitos).</li>
          <li>El cambio se guarda automáticamente.</li>
        </ul>
      </div>

      <!-- MÓDULO 8 -->
      <div class="guide-card">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number">8</span> Reportar Problemas
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Si encuentras un error:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Presiona el botón rojo 🐛 "Reportar Problema" en el header.</li>
          <li>Describe el problema detalladamente.</li>
          <li>Selecciona la sección donde ocurrió.</li>
          <li>Adjunta captura de pantalla si es posible.</li>
          <li>Gerencia revisará y corregirá el problema.</li>
        </ul>
      </div>
  `;

  const managerModules = `
      <!-- MÓDULO GERENCIA 1 -->
      <div class="guide-card" style="border-left: 4px solid #f59e0b;">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number" style="background:#f59e0b;">G1</span> Gestión de Proveedores
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Control de cuentas por pagar:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Ve a la pestaña "Proveedores".</li>
          <li>Registra notas de entrega con fotos (1-3+ hojas).</li>
          <li>Conversión automática a tasa BCV.</li>
          <li>Registra abonos parciales con fecha y referencia.</li>
          <li>Alertas de vencimiento (5 días).</li>
        </ul>
      </div>

      <!-- MÓDULO GERENCIA 2 -->
      <div class="guide-card" style="border-left: 4px solid #f59e0b;">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number" style="background:#f59e0b;">G2</span> Cierre de Caja
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Arqueo diario por turnos:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Ve a la pestaña "Cierre Caja".</li>
          <li>Turno 1 (1:00 PM) y Turno 2 (8:00 PM).</li>
          <li>Control de fondo inicial, POS, Pago Móvil, efectivo.</li>
          <li>Conversión automática a tasa BCV.</li>
          <li><strong>OCR:</strong> Toma foto de la planilla física para transcripción automática.</li>
          <li>Foto de respaldo de planilla firmada.</li>
        </ul>
      </div>

      <!-- MÓDULO GERENCIA 3 -->
      <div class="guide-card" style="border-left: 4px solid #f59e0b;">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number" style="background:#f59e0b;">G3</span> Control de Costos
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Gestión financiera:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Asigna costo a pedidos (visible solo para gerencia).</li>
          <li>Edita costos en pedidos terminados.</li>
          <li>Revisa reportes financieros en "Reportes & Avance".</li>
          <li>Filtra por período, trabajador o tipo de trabajo.</li>
        </ul>
      </div>

      <!-- MÓDULO GERENCIA 4 -->
      <div class="guide-card" style="border-left: 4px solid #f59e0b;">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number" style="background:#f59e0b;">G4</span> Gestión de Usuarios
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Control de accesos:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Ve a "Ajustes" → "Gestión de Usuarios".</li>
          <li>Crea nuevos usuarios con nombre, rol y PIN.</li>
          <li>Activa/desactiva usuarios (preserva historial).</li>
          <li>Cambia roles: trabajador ↔ jefe/jefa ↔ manager.</li>
          <li>Resetea PIN de usuarios si olvidan su clave.</li>
        </ul>
      </div>

      <!-- MÓDULO GERENCIA 5 -->
      <div class="guide-card" style="border-left: 4px solid #f59e0b;">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number" style="background:#f59e0b;">G5</span> Configuración del Sistema
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Ajustes globales:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li><strong>Tasa BCV:</strong> Actualiza diariamente en "Ajustes".</li>
          <li><strong>API Keys:</strong> Configura Gemini Vision para OCR.</li>
          <li><strong>Forzar Actualización:</strong> Transmite cambios a todos los dispositivos.</li>
          <li><strong>Copias de Seguridad:</strong> Exporta/importa datos locales.</li>
          <li><strong>Archivar:</strong> Mueve pedidos antiguos (>60 días) a histórico.</li>
        </ul>
      </div>

      <!-- MÓDULO GERENCIA 6 -->
      <div class="guide-card" style="border-left: 4px solid #f59e0b;">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:var(--text-main); font-size:15px;">
          <span class="guide-step-number" style="background:#f59e0b;">G6</span> Sugerencias del Equipo
        </h3>
        <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">
          Canal de comunicación:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6;">
          <li>Ve a "Ajustes" → "Sugerencias del Equipo".</li>
          <li>Revisa sugerencias enviadas por trabajadores.</li>
          <li>Cambia estado: Pendiente → Revisada → Implementada.</li>
          <li>Responde a sugerencias para notificar al usuario.</li>
        </ul>
      </div>
  `;

  openModal(`
    <div class="modal-head">
      <div>
        <p class="eyebrow" style="color:var(--primary-color); margin:0;">CREACIONES JJ · MANUAL OFICIAL v78</p>
        <h2 style="margin:2px 0 0 0;">🎓 Guía Completa del Sistema</h2>
        <p style="font-size:12px; color:var(--text-muted); margin:4px 0 0 0;">
          ${isManager ? '👔 Acceso de Gerencia' : '👷 Acceso de Trabajador'}
        </p>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>

    <div style="display:flex; flex-direction:column; gap:14px; max-height:70vh; overflow-y:auto; padding-right:4px;">
      
      ${workerModules}

      ${isManager ? managerModules : ''}

      <!-- MÓDULO FINAL -->
      <div class="guide-card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white;">
        <h3 style="display:flex; align-items:center; margin-bottom:8px; color:white; font-size:15px;">
          <span class="guide-step-number" style="background:rgba(255,255,255,0.3); color:white;">💡</span> Recursos Adicionales
        </h3>
        <p style="font-size:13px; color:rgba(255,255,255,0.9); line-height:1.5;">
          Para más información detallada, consulta los manuales completos:
        </p>
        <ul style="font-size:12px; margin-left:20px; margin-top:6px; line-height:1.6; color:rgba(255,255,255,0.9);">
          <li>📖 <strong>MANUAL_TRABAJADORES.md</strong> - Guía completa para taller</li>
          ${isManager ? '<li>🏢 <strong>MANUAL_GERENCIA.md</strong> - Guía exclusiva para gerencia</li>' : ''}
          <li>🔧 <strong>SETUP_MANUAL.md</strong> - Guía de instalación</li>
          <li>📊 <strong>README.md</strong> - Lista completa de funcionalidades</li>
        </ul>
      </div>

    </div>

    <div class="modal-footer" style="margin-top:10px;">
      <button type="button" class="primary-button" data-action="close">¡Entendido!</button>
    </div>
  `);
}
window.openLearningGuideModal = openLearningGuideModal;

function openReassignModal(orderOrId) {
  let order = orderOrId;
  if (typeof order === "string") {
    const all = [...(state.data.allOrders || []), ...(state.data.myOrders || []), ...(state.data.finishedOrders || [])];
    order = all.find(o => String(o.id).trim().toLowerCase() === String(orderOrId).trim().toLowerCase());
  }
  if (!order) order = state.selectedOrder;
  if (!order) {
    alert("No se pudo cargar el pedido para reasignar.");
    return;
  }
  state.selectedOrder = order;

  const users = (state.data.users || []).filter(u => u.active && u.name.toLowerCase() !== String(order.responsable || "").toLowerCase());
  const currentResp = order.responsable || "Sin asignar";
  const currentMin = Number(order.duracionRealMin || 0);

  openModal(`
    <div class="modal-head">
      <h2>👥 Reasignar Pedido a Otro Trabajador</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <form id="reassign-form" class="form-grid">
      <div style="background:var(--bg-main); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:13px;">
        <div>📦 <strong>Pedido:</strong> ${escapeHtml(order.id)} – ${escapeHtml(order.cliente)}</div>
        <div style="margin-top:4px;">👤 <strong>Responsable actual:</strong> <strong style="color:var(--primary-color);">${escapeHtml(currentResp)}</strong></div>
      </div>

      <label class="field">
        <span class="field-label">⏱️ MINUTOS DEDICADOS POR ${escapeHtml(currentResp).toUpperCase()} HASTA AHORA:</span>
        <input type="number" name="timeSpent" min="0" value="${currentMin}" required placeholder="Minutos que dedicó el trabajador saliente">
        <small style="color:var(--text-muted); font-size:11px;">Este tiempo se acreditará al trabajador actual en sus métricas de rendimiento.</small>
      </label>

      <label class="field">
        <span class="field-label">👤 NUEVO RESPONSABLE ASIGNADO:</span>
        <select name="newWorker" required>
          <option value="">-- Seleccionar nuevo responsable --</option>
          ${users.map(u => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)} (${formatRoleLabel(u.role)})</option>`).join('')}
        </select>
      </label>

      <label class="field">
        <span class="field-label">📋 MOTIVO DE LA REASIGNACIÓN:</span>
        <select name="motivoSelect" id="reassign-motivo-select" onchange="if (this.value==='__CUSTOM__'){document.getElementById('reassign-custom-motivo').style.display='block';}else{document.getElementById('reassign-custom-motivo').style.display='none';}">
          <option value="Vacaciones del trabajador">🏖️ Vacaciones del trabajador</option>
          <option value="Fin de jornada / turno">⏰ Fin de jornada / turno</option>
          <option value="Alta demanda / apoyo en taller">⚡ Alta demanda / apoyo en taller</option>
          <option value="Cambio de técnica / especialidad">🎨 Cambio de técnica / especialidad</option>
          <option value="__CUSTOM__">✏️ Otro motivo...</option>
        </select>
        <input type="text" id="reassign-custom-motivo" name="customMotivo" placeholder="Escribe el motivo..." style="display:none; margin-top:6px;">
      </label>

      <label class="field">
        <span class="field-label">📝 AVANCE DEJADO / INDICACIONES PARA EL NUEVO COMPAÑERO:</span>
        <textarea name="nota" placeholder="Ej: Diseño listo y cortado en plotter. Falta armar capas de foami y pegar..."></textarea>
      </label>

      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button" style="background:#4f46e5; border:none;">Transferir y Guardar Reasignación</button>
      </div>
    </form>
  `);

  $("#reassign-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "Reasignando pedido...";

    const formData = new FormData(e.target);
    const newWorker = formData.get("newWorker");
    const timeSpent = Number(formData.get("timeSpent") || 0);
    const motSel = formData.get("motivoSelect");
    const motivo = (motSel === "__CUSTOM__") ? (formData.get("customMotivo") || "Reasignado") : motSel;
    const nota = formData.get("nota") || "";

    try {
      await api("profile_reassign_order", {
        id: order.id,
        prevWorker: currentResp,
        newWorker: newWorker,
        timeSpent: timeSpent,
        motivo: motivo,
        nota: nota,
        user: state.session?.name || "Manager"
      });
      closeModal();
      await refresh(false);
      showToast(`✅ Pedido reasignado a ${newWorker}. Se reconoció el tiempo de ${currentResp}.`);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Transferir y Guardar Reasignación";
      alert(`Error al reasignar pedido: ${err.message}`);
    }
  });
}
window.openReassignModal = openReassignModal;

function openWhatsAppModal(orderData) {
  const cleanTel = cleanPhoneNumber(orderData.phone || "");
  const idOrd = orderData.id;
  const clientName = orderData.client || "Cliente";
  const tipoOrd = orderData.type || "Pedido";
  const motivoOrd = orderData.motivo ? ` (${orderData.motivo})` : "";
  const userKey = state.session?.name || state.session?.nombre || 'default';
  const tmpl = store.get(`pp_whatsapp_template_${userKey}`, "Hola {cliente}, tu pedido de {tipo} en Creaciones JJ ya se encuentra listo para retirar.");
  const msg = tmpl
    .replace(/{cliente}/g, clientName)
    .replace(/{tipo}/g, tipoOrd + motivoOrd)
    .replace(/{id}/g, idOrd);

  const waWebUrl = `https://web.whatsapp.com/send?phone=${cleanTel}&text=${encodeURIComponent(msg)}`;
  const waAppUrl = `https://api.whatsapp.com/send?phone=${cleanTel}&text=${encodeURIComponent(msg)}`;

  openModal(`
    <div class="modal-head">
      <h2>📲 Notificar por WhatsApp (${escapeHtml(idOrd)})</h2>
      <button class="close-button" data-action="close">×</button>
    </div>
    <div class="form-grid">
      <div style="background:var(--bg-main); padding:12px; border-radius:8px; border:1px solid var(--border-color); font-size:13px;">
        <div>👤 <strong>Cliente:</strong> ${escapeHtml(clientName)}</div>
        <div style="margin-top:4px;">📞 <strong>Teléfono:</strong> <strong style="color:var(--primary-color);">${escapeHtml(cleanTel || 'No registrado')}</strong></div>
        <div style="margin-top:10px; font-weight:700; font-size:12px; color:var(--text-muted);">MENSAJE AUTOMÁTICO:</div>
        <div id="wa-modal-text" style="background:var(--bg-card); padding:10px; border-radius:6px; margin-top:4px; font-size:12px; border:1px dashed var(--border-color); line-height:1.5; color:var(--text-main); white-space:pre-wrap;">${escapeHtml(msg)}</div>
      </div>

      <p style="font-size:12px; color:var(--text-muted); margin:4px 0;">Opciones de envío compatibles con Opera GX, Chrome y Celular:</p>

      <div style="display:flex; flex-direction:column; gap:8px;">
        <a href="${waWebUrl}" target="_blank" rel="noopener" class="primary-button" style="background:#25D366; color:white; text-decoration:none; text-align:center; padding:10px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="markOrderWaNotified('${escapeHtml(idOrd)}')">
          🌐 Abrir WhatsApp Web (Opera GX / Chrome)
        </a>

        <a href="${waAppUrl}" target="_blank" rel="noopener" class="secondary-button" style="background:#128C7E; color:white; border:none; text-decoration:none; text-align:center; padding:10px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="markOrderWaNotified('${escapeHtml(idOrd)}')">
          📱 Abrir WhatsApp Móvil / App de Escritorio
        </a>

        <button type="button" class="secondary-button" style="background:#0284c7; color:white; border:none; padding:10px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="copyWaTextAndNotify('${escapeHtml(idOrd)}', '${escapeHtml(cleanTel)}', '${escapeHtml(encodeURIComponent(msg))}')">
          📋 Copiar Mensaje (Para pegar en WhatsApp lateral de Opera GX)
        </button>
      </div>

      <div class="modal-footer" style="margin-top:10px;">
        <button type="button" class="secondary-button" data-action="close">Cerrar</button>
      </div>
    </div>
  `);
}
window.openWhatsAppModal = openWhatsAppModal;

window.openAddEvidenceModal = function(orderId) {
  let capturedEvidences = [];
  
  const renderEviThumbs = () => {
    const container = document.getElementById("evidence-thumbs-container");
    if (!container) return;
    container.innerHTML = capturedEvidences.map((evi, idx) => `
      <div style="position:relative; display:inline-block; margin:4px; border:2px solid #10b981; border-radius:8px; overflow:hidden;">
        <img src="${evi.data.startsWith('data:') ? evi.data : `data:image/jpeg;base64,${evi.data}`}" style="width:80px; height:80px; object-fit:cover; display:block;">
        <button type="button" onclick="window.removeFinishEvi(${idx})" style="position:absolute; top:2px; right:2px; background:rgba(211,47,47,0.9); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px;">×</button>
      </div>
    `).join('');
  };

  window.removeFinishEvi = function(idx) {
    capturedEvidences.splice(idx, 1);
    renderEviThumbs();
  };

  openModal(`
    <div class="modal-head"><h2>📷 Añadir Fotos de Evidencia</h2><button class="close-button" data-action="close">×</button></div>
    <div style="padding:16px;">
      <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">
        Agrega fotos de evidencia adicionales para el pedido <strong>${escapeHtml(orderId)}</strong>.
      </p>
      
      <div style="margin-bottom:16px;">
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:6px;">📸 Tomar Foto con Cámara</label>
        <input type="file" id="evidence-camera-input" accept="image/*" capture="environment" style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
      </div>
      
      <div style="margin-bottom:16px;">
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:6px;">📁 Elegir de Archivos</label>
        <input type="file" id="evidence-file-input" accept="image/*" multiple style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
      </div>
      
      <div id="evidence-thumbs-container" style="min-height:60px; margin-bottom:16px;"></div>
      
      <button type="button" class="primary-button" id="save-evidence-btn" style="width:100%; padding:12px; font-weight:bold;">💾 Guardar Fotos</button>
    </div>
  `);

  document.getElementById("evidence-camera-input")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 800, 0.7);
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(compressed);
      });
      capturedEvidences.push({ data: base64, mimeType: "image/jpeg" });
      renderEviThumbs();
    } catch (err) {
      alert("Error al procesar la foto: " + err.message);
    }
  });

  document.getElementById("evidence-file-input")?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const compressed = await compressImage(file, 800, 0.7);
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
          reader.readAsDataURL(compressed);
        });
        capturedEvidences.push({ data: base64, mimeType: "image/jpeg" });
      } catch (err) {
        console.error("Error procesando archivo:", err);
      }
    }
    renderEviThumbs();
  });

  document.getElementById("save-evidence-btn")?.addEventListener("click", async () => {
    if (capturedEvidences.length === 0) {
      alert("Por favor selecciona al menos una foto.");
      return;
    }
    const btn = document.getElementById("save-evidence-btn");
    btn.disabled = true;
    btn.textContent = "⏳ Guardando...";
    
    try {
      await api("profile_add_reference_images", {
        id: orderId,
        images: capturedEvidences
      });
      closeModal();
      await refresh(false);
      showToast("✅ Fotos de evidencia añadidas correctamente.");
    } catch (err) {
      alert("Error al guardar fotos: " + err.message);
      btn.disabled = false;
      btn.textContent = "💾 Guardar Fotos";
    }
  });
};

window.markOrderWaNotified = async function(idOrd) {
  try {
    await api("profile_update_order", { id: idOrd, changes: { waNotificado: "Sí" } });
    const targetOrd = (state.data.finishedOrders || []).find(o => String(o.id) === String(idOrd));
    if (targetOrd) targetOrd.waNotificado = "Sí";
    const actOrd = (state.data.allOrders || []).find(o => String(o.id) === String(idOrd));
    if (actOrd) actOrd.waNotificado = "Sí";
    showToast("✅ Marcado como notificado por WhatsApp.");
    render();
  } catch(e) {
    console.warn("Error guardando waNotificado:", e);
  }
};

window.copyWaTextAndNotify = async function(idOrd, tel, encMsg) {
  const decodedMsg = decodeURIComponent(encMsg);
  try {
    await navigator.clipboard.writeText(decodedMsg);
    showToast("📋 ¡Mensaje copiado! Pégalo en tu WhatsApp de Opera GX.");
  } catch(e) {
    prompt("Copia el mensaje:", decodedMsg);
  }
  await window.markOrderWaNotified(idOrd);
};

function formOrder() {
  const users = (state.data.users || []).filter(u => u.active);
  const clients = state.frequentClients;
  const types = state.frequentTypes;
  const motivos = state.frequentMotivos || [];
  
  openModal(`
    <div class="modal-head"><h2>Registrar Pedido - Creaciones JJ</h2><button class="close-button" data-action="close">×</button></div>
    
    <!-- Atajo Mostrador Rápido -->
    <div style="background:linear-gradient(135deg, rgba(245,158,11,0.12), rgba(14,165,233,0.12)); border:1px solid #f59e0b; border-radius:12px; padding:10px 14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:12.5px; font-weight:800; color:#d97706; display:flex; align-items:center; gap:8px;">
        <i class="fas fa-bolt"></i> ¿CLIENTE EN MOSTRADOR?
      </div>
      <button type="button" class="primary-button" style="background:#f59e0b; border:none; padding:5px 12px; font-size:11px; border-radius:20px; font-weight:800; cursor:pointer;" onclick="closeModal(); openExpressOrderModal();">
        ⚡ Abrir Pedido Rápido Mostrador
      </button>
    </div>

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
      <label class="field"><span class="field-label">NOMBRE DEL CLIENTE</span>
        <div style="display:flex; gap:6px;">
          <input id="input-cliente" name="cliente" required placeholder="Escribe el nombre del cliente" style="flex:1;">
          <button type="button" class="mic-action-btn" id="standard-mic-btn" onclick="startVoiceDictationForStandard()" title="Dictar pedido por voz">
            <i class="fas fa-microphone"></i>
          </button>
        </div>
      </label>
      <label class="field"><span class="field-label">TELÉFONO WHATSAPP</span><input id="input-telefono" name="telefono" type="tel" placeholder="Ingresa o cambia el número"></label>
      
      <label class="field"><span class="field-label">TIPO DE TRABAJO</span>
        ${types.length ? `<select id="ft-select" style="margin-bottom:6px;"><option value="">-- Seleccionar existente --</option>${types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}<option value="__CUSTOM__">Escribir otro nuevo...</option></select>` : ''}
        <input id="input-tipo" name="tipo" required placeholder="Ej. Topper Acrílico, Maqueta...">
      </label>

      <label class="field"><span class="field-label">🎨 MOTIVO / TEMÁTICA</span>
        ${motivos.length ? `<select id="motivo-select" style="margin-bottom:6px;"><option value="">-- Seleccionar motivo guardado --</option>${motivos.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}<option value="__CUSTOM__">Escribir nuevo motivo...</option></select>` : ''}
        <input id="input-motivo" name="motivo" placeholder="Ej. Hello Kitty, Tarzán, Cumpleaños 15...">
      </label>

      <!-- SECCIÓN MULTI-TRABAJO (Opcional - colapsable) -->
      <div class="subitems-builder-box" style="border:1px dashed var(--border-color); border-radius:8px; padding:12px; margin-top:16px;">
        <div class="subitems-builder-title" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="toggleSubitemsSection()">
          <span style="font-size:12px; font-weight:bold; color:var(--text-muted);">
            <i class="fas fa-cubes"></i> + ¿Añadir múltiples trabajos a este pedido? (Opcional)
          </span>
          <i class="fas fa-chevron-down" id="subitems-chevron" style="font-size:12px; color:var(--text-muted);"></i>
        </div>
        <div id="subitems-content" style="display:none; margin-top:12px;">
          <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">
            La mayoría de pedidos son de un solo trabajo. Usa esta sección solo si necesitas combinar varios ítems (ej: Topper + Stickers + Taza).
          </p>
          <!-- Chips rápidos para formulario estándar -->
          <div class="subitems-chips-bar">
            <span style="font-size:11px; color:var(--text-muted); align-self:center;">+ Rápido:</span>
            <button type="button" class="subitem-chip-btn" onclick="addStandardSubItem('Topper', 1, '')">+ Topper</button>
            <button type="button" class="subitem-chip-btn" onclick="addStandardSubItem('Stickers', 1, 'Pliego')">+ Stickers</button>
            <button type="button" class="subitem-chip-btn" onclick="addStandardSubItem('Taza Sublimada', 1, '')">+ Taza</button>
            <button type="button" class="subitem-chip-btn" onclick="addStandardSubItem('Invitación Digital', 1, '')">+ Invitación</button>
            <button type="button" class="subitem-chip-btn" onclick="addStandardSubItem('Letras 3D', 1, '')">+ Letras 3D</button>
            <button type="button" class="subitem-chip-btn" onclick="addStandardSubItem('Maqueta', 1, '')">+ Maqueta</button>
          </div>
          <div id="subitems-form-list" style="width:100%; box-sizing:border-box;">
            <!-- Solo se muestra si el usuario expande la sección -->
          </div>
          <button type="button" class="secondary-button" id="form-add-subitem-btn" style="margin-top:8px; padding:4px 10px; font-size:11px; font-weight:bold; border-radius:6px; background:#0ea5e9; color:white; border:none; cursor:pointer;">
            ➕ Agregar Otro Trabajo
          </button>
        </div>
      </div>

      <label class="field"><span class="field-label">🎨 ESTADO DEL DISEÑO</span>
        <select name="diseno">
          <option value="No">No ❌ (Pendiente por diseñar)</option>
          <option value="En proceso">En proceso ✏️</option>
          <option value="Sí" selected>Sí ✅ (Listo para cortar/armar)</option>
        </select>
      </label>

      <div class="field">
        <span class="field-label">🖼️ FOTOS DE REFERENCIA DEL CLIENTE (HASTA 3 FOTOS):</span>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
          <button type="button" class="secondary-button" id="form-cam-ref-btn" style="background:#0284c7; color:white; border:none; display:flex; align-items:center; gap:6px; font-size:12px; padding:6px 10px; font-weight:bold;">
            📸 Tomar con Cámara Directa
          </button>
          <label class="secondary-button" style="cursor:pointer; display:flex; align-items:center; gap:6px; font-size:12px; padding:6px 10px; margin:0;">
            📁 Elegir de Archivos
            <input type="file" id="reference-files-input" accept="image/*" multiple style="display:none;">
          </label>
        </div>
        <div id="form-ref-thumbs" style="display:flex; gap:6px; flex-wrap:wrap; min-height:36px; align-items:center; background:var(--bg-main); padding:6px; border-radius:6px; border:1px dashed var(--border-color);">
          <span style="color:var(--text-muted); font-size:12px;">Sin fotos de referencia seleccionadas.</span>
        </div>
      </div>

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

  let formCapturedImages = [];

  const updateFormRefThumbs = () => {
    const listEl = document.getElementById("form-ref-thumbs");
    if (!listEl) return;
    if (!formCapturedImages.length) {
      listEl.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Sin fotos de referencia seleccionadas.</span>';
      return;
    }
    listEl.innerHTML = formCapturedImages.map((img, idx) => `
      <div style="position:relative; display:inline-block; border-radius:6px; overflow:hidden; border:1px solid var(--border-color);">
        <img src="data:image/jpeg;base64,${img.data}" style="width:55px; height:55px; object-fit:cover; display:block;">
        <button type="button" onclick="removeFormRefThumb(${idx})" style="position:absolute; top:2px; right:2px; background:rgba(220,38,38,0.85); color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:9px; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>
      </div>
    `).join("");
  };

  window.removeFormRefThumb = function(idx) {
    formCapturedImages.splice(idx, 1);
    updateFormRefThumbs();
  };

  document.getElementById("form-cam-ref-btn")?.addEventListener("click", () => {
    if (formCapturedImages.length >= 3) {
      alert("Límite de 3 fotos de referencia alcanzado.");
      return;
    }
    openLiveCameraModal((base64) => {
      formCapturedImages.push({ data: base64, mimeType: "image/jpeg" });
      formOrder();
      updateFormRefThumbs();
    });
  });

  document.getElementById("reference-files-input")?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      if (formCapturedImages.length >= 3) break;
      const compressed = await compressImageFile(f);
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(compressed);
      });
      formCapturedImages.push({ data: base64, mimeType: "image/jpeg" });
    }
    updateFormRefThumbs();
  });

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
    $("#input-descripcion").value = parsed.descripcion || raw.trim();
    
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
  
  let isSubmittingOrder = false;
  // Botón agregar sub-ítem dinámico
  $("#form-add-subitem-btn")?.addEventListener("click", () => {
    const list = document.getElementById("subitems-form-list");
    if (!list) return;
    const row = document.createElement("div");
    row.className = "subitem-row";
    row.innerHTML = `
      <input type="text" class="subitem-form-tipo" placeholder="Tipo (ej: Stickers)" required>
      <input type="number" class="subitem-form-cant" value="1" min="1" placeholder="Cant." style="text-align:center;">
      <input type="text" class="subitem-form-det" placeholder="Detalles / Medidas">
      <button type="button" class="subitem-del-btn" onclick="this.closest('.subitem-row').remove()">🗑️</button>
    `;
    list.appendChild(row);
  });

  $("#order-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmittingOrder) return;
    isSubmittingOrder = true;

    // 1. Extraer los datos del formulario ANTES de deshabilitar los campos
    const formDataObj = Object.fromEntries(new FormData(e.target));

    // Recolectar Sub-Ítems dinámicos
    const subItemsList = [];
    document.querySelectorAll("#subitems-form-list .subitem-row").forEach(row => {
      const sTipo = row.querySelector(".subitem-form-tipo")?.value.trim();
      const sCant = parseInt(row.querySelector(".subitem-form-cant")?.value || "1", 10);
      const sDet = row.querySelector(".subitem-form-det")?.value.trim();
      if (sTipo) {
        subItemsList.push({ tipo: sTipo, cantidad: sCant, detalles: sDet, completado: false });
      }
    });

    if (subItemsList.length > 0) {
      formDataObj.subItems = subItemsList;
      if (!formDataObj.tipo || formDataObj.tipo === "Topper") {
        formDataObj.tipo = subItemsList.map(s => `${s.cantidad}x ${s.tipo}`).join(" + ");
      }
      const breakdownText = `[TRABAJOS DEL PEDIDO]:\n` + subItemsList.map((s, idx) => `${idx+1}. ${s.cantidad}x ${s.tipo} ${s.detalles ? '('+s.detalles+')' : ''}`).join('\n');
      formDataObj.descripcion = formDataObj.descripcion ? `${breakdownText}\n\n${formDataObj.descripcion}` : breakdownText;
    }
    
    // Extracción explícita de respaldo para garantizar captura 100% fiel
    if (!formDataObj.cliente && $("#input-cliente")?.value) formDataObj.cliente = $("#input-cliente").value.trim();
    if (!formDataObj.telefono && $("#input-telefono")?.value) formDataObj.telefono = $("#input-telefono").value.trim();
    if (!formDataObj.tipo && $("#input-tipo")?.value) formDataObj.tipo = $("#input-tipo").value.trim();
    if (!formDataObj.motivo && $("#input-motivo")?.value) formDataObj.motivo = $("#input-motivo").value.trim();
    if (!formDataObj.fechaEntrega && $("#input-fecha-entrega")?.value) formDataObj.fechaEntrega = $("#input-fecha-entrega").value;
    if (!formDataObj.horaEntrega && $("#select-hora-entrega")?.value) formDataObj.horaEntrega = $("#select-hora-entrega").value;
    const respSelect = e.target.querySelector('select[name="responsable"]');
    if (respSelect) formDataObj.responsable = respSelect.value;
    const disenoSelect = e.target.querySelector('select[name="diseno"]');
    if (disenoSelect) formDataObj.diseno = disenoSelect.value;
    if (!formDataObj.descripcion && $("#input-descripcion")?.value) {
      formDataObj.descripcion = $("#input-descripcion").value.trim();
    }
    formDataObj.clientRequestId = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    // 2. Ahora sí deshabilitar el botón y los campos visualmente
    const btn = e.target.querySelector(".primary-button");
    const allInputs = e.target.querySelectorAll("input, select, textarea, button");
    allInputs.forEach(el => el.disabled = true);
    btn.textContent = "⏳ Guardando pedido y referencias... Por favor espera.";

    try {
      await api("profile_create_order", {
        form: formDataObj,
        referenceImages: formCapturedImages
      }, 60000);
      closeModal();
      await refresh(false);
      showToast("Pedido guardado exitosamente.");
    } catch (err) {
      isSubmittingOrder = false;
      allInputs.forEach(el => el.disabled = false);
      btn.textContent = "Guardar Pedido";
      alert(`Error: ${err.message}`);
    } finally {
      isSubmittingOrder = false;
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
          <option value="recepcionista">Recepcionista (Atención al cliente)</option>
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
    const scope = btn.dataset.scope;
    const targetId = String(btn.dataset.id || "").trim();
    let o;
    if (scope === "finished") {
      o = (state.data.finishedOrders || []).find(i => String(i.id).trim() === targetId);
    } else if (scope === "active") {
      o = [...(state.data.allOrders || []), ...(state.data.myOrders || [])].find(i => String(i.id).trim() === targetId);
    }
    if (!o) {
      o = [...(state.data.finishedOrders || []), ...(state.data.allOrders || []), ...(state.data.myOrders || [])].find(i => String(i.id).trim() === targetId);
    }
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
  if (act === "edit-client") {
    const targetName = btn.dataset.name;
    const clientObj = state.frequentClients.find(c => c.name.toLowerCase() === (targetName || "").toLowerCase());
    if (clientObj) {
      openEditClientModal(clientObj);
    }
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
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = "🗑️ Eliminando...";
      try {
        await api("profile_delete_order", { id: btn.dataset.id }, 45000);
        closeModal();
        await refresh(false);
        showToast("Pedido eliminado permanentemente.");
      } catch (err) {
        btn.disabled = false;
        btn.textContent = oldText;
        alert(err.message);
      }
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
  if (act === "force-update") {
    console.log("Iniciando force-update modal");
    // Mostrar modal de confirmación mejorado
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:10000;';
    modal.innerHTML = `
      <div style="background:var(--bg-card); border-radius:12px; padding:24px; max-width:400px; box-shadow:0 10px 40px rgba(0,0,0,0.4);">
        <h3 style="margin:0 0 12px 0; color:#ef4444; font-size:18px;">
          <i class="fas fa-rocket"></i> Forzar Actualización Global
        </h3>
        <p style="margin:0 0 16px 0; color:var(--text-main); font-size:14px; line-height:1.5;">
          ¿Deseas forzar la actualización inmediata en todas las sesiones y teléfonos activos del taller?
        </p>
        <p style="margin:0 0 20px 0; color:var(--text-muted); font-size:12px; line-height:1.4;">
          <strong>⚠️ Todos los dispositivos del equipo recargarán automáticamente la versión más reciente.</strong><br>
          Los trabajadores verán una notificación y sus pantallas se actualizarán.
        </p>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button id="cancel-force-update" style="padding:8px 16px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-main); cursor:pointer; font-size:13px;">
            Cancelar
          </button>
          <button id="confirm-force-update" style="padding:8px 16px; border-radius:6px; border:none; background:#ef4444; color:white; cursor:pointer; font-size:13px; font-weight:bold;">
            <i class="fas fa-check"></i> Confirmar Actualización
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    console.log("Modal de force-update agregado al DOM");
    
    document.getElementById('cancel-force-update').onclick = () => {
      document.body.removeChild(modal);
      showToast("⏸️ Actualización cancelada por el usuario.");
    };
    
    document.getElementById('confirm-force-update').onclick = async () => {
      document.body.removeChild(modal);
      showToast("🔄 Iniciando actualización global del equipo...");
      try {
        const newVer = "v_" + Date.now();
        await api("profile_force_update", { version: newVer });
        store.set("pp_app_version", newVer);
        showToast("✅ Orden de actualización global enviada a todo el equipo exitosamente.");
        showToast("📱 Los dispositivos del equipo recargarán automáticamente.");
        await refresh(false);
      } catch (err) { 
        showToast("❌ Error al forzar actualización: " + err.message);
        alert(`Error al forzar actualización: ${err.message}`); 
      }
    };
    return;
  }
  if (act === "mark-delivered") {
    if (!isLead()) {
      alert("Solo el Jefe o Manager tiene permiso para marcar un pedido como Entregado.");
      return;
    }
    try {
      await api("profile_update_order", {
        id: btn.dataset.id,
        role: state.session?.role || "trabajador",
        changes: { estado: "Entregado" }
      });
      closeModal();
      await refresh(false);
      showToast("Proyecto marcado como Entregado.");
    } catch (err) { alert(err.message); }
    return;
  }
  if (act === "add-evidence-photos") {
    if (!isLead()) {
      alert("Solo el Jefe o Manager tiene permiso para añadir fotos de evidencia.");
      return;
    }
    openAddEvidenceModal(btn.dataset.id);
    return;
  }
  if (act === "reassign-order") {
    openReassignModal(btn.dataset.id || state.selectedOrder);
    return;
  }
  if (act === "notify-wa-corporate") {
    openWhatsAppModal({
      id: btn.dataset.id,
      phone: btn.dataset.phone,
      client: btn.dataset.client,
      type: btn.dataset.type,
      motivo: btn.dataset.motivo
    });
    return;
  }
});

window.clearAllCache = function() {
  if (confirm("¿Estás seguro de limpiar toda la caché y datos guardados? Esto eliminará tu sesión guardada y cualquier dato local.")) {
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
  }
};

// ============================================================
// INICIALIZACIÓN — siempre decide qué vista es visible
// ============================================================
function showLogin(clearFields = true) {
  const loginEl     = document.getElementById("login-view");
  const workspaceEl = document.getElementById("workspace");
  if (loginEl)     { loginEl.style.setProperty("display", "flex", "important"); }
  if (workspaceEl) { workspaceEl.style.setProperty("display", "none", "important"); }

  // Solo limpiar campos si se solicita explícitamente (evita resetear mientras el usuario escribe)
  if (clearFields) {
    const nameInput = document.getElementById("login-name");
    const pinInput = document.getElementById("login-pin");
    const btnEl = document.getElementById("login-btn-manual");
    const errEl = document.getElementById("login-error");

    console.log("showLogin() llamado, limpiando campos");

    if (nameInput) {
      nameInput.value = "";
      nameInput.autocomplete = "off";
    }
    if (pinInput) {
      pinInput.value = "";
      pinInput.autocomplete = "off";
    }
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = "Iniciar sesión";
    }
    if (errEl) {
      errEl.textContent = "";
    }
  }
}

function showWorkspace() {
  const loginEl     = document.getElementById("login-view");
  const workspaceEl = document.getElementById("workspace");
  if (loginEl)     { loginEl.style.setProperty("display", "none", "important"); }
  if (workspaceEl) { workspaceEl.style.setProperty("display", "flex", "important"); }
}

function doLogin(e) {
  if (e) {
    try { e.preventDefault(); e.stopPropagation(); } catch (errEv) {}
  }
  
  const nameInput = document.getElementById("login-name");
  const pinInput  = document.getElementById("login-pin");
  const errEl     = document.getElementById("login-error");
  const btnEl     = document.getElementById("login-btn-manual");
  
  const nameVal = (nameInput?.value || "").trim();
  const pinVal  = (pinInput?.value || "").trim();
  
  console.log("Intentando login con:", { name: nameVal, pinLength: pinVal.length });

  if (!nameVal || !pinVal) {
    if (errEl) errEl.textContent = "Ingresa tu nombre y tu PIN personal.";
    return false;
  }

  // Deshabilitar botón durante la verificación
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = "Verificando...";
  }

  // Verificar primero con el backend antes de permitir acceso
  console.log("Enviando solicitud al backend...");
  api("profile_login", { name: nameVal, pin: pinVal }).then((res) => {
    console.log("Respuesta del login:", res);
    if (res && res.session) {
      state.session = res.session;
      store.set("pp_profile_session", res.session);
      console.log("Sesión guardada:", res.session);
      showWorkspace();
      render();
      refresh(false);
    } else {
      throw new Error("No se pudo iniciar sesión. Respuesta inválida del servidor.");
    }
  }).catch((err) => {
    console.error("Error de autenticación:", err);
    if (errEl) {
      errEl.textContent = "❌ Error: " + (err.message || "No se puede conectar al servidor. Verifica que el script de Google Apps Script esté deployado correctamente.");
      errEl.style.color = "#ef4444";
    }
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = "Iniciar sesión";
    }
  });

  return false;
}
window.doLogin = doLogin;

// Event listener del formulario de login
document.getElementById("login-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  e.stopPropagation();
  doLogin(e);
  return false;
});

// Event listener del botón manual (backup)
document.getElementById("login-btn-manual")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  doLogin(e);
  return false;
});

document.addEventListener("click", (e) => {
  const target = e.target;
  if (target && (target.id === "login-btn-manual" || target.classList.contains("login-submit-btn"))) {
    e.preventDefault();
    doLogin(e);
  }
});

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

// Verificar si hay sesión guardada y limpiarla si es de un usuario diferente
const savedSession = store.get("pp_profile_session", null);
if (savedSession && savedSession.name) {
  console.log("Sesión guardada encontrada:", savedSession.name);
  // Si la sesión guardada no es la que queremos, limpiarla
  if (savedSession.name.toLowerCase() === "camila") {
    console.log("Limpiando sesión de Camila del localStorage");
    store.remove("pp_profile_session");
    state.session = null;
  }
}

if (state.session) {
  showWorkspace();
  render();
  refresh(false);
} else {
  showLogin();
}

// Latido periódico en segundo plano (cada 60 segundos, optimizado para móvil) para sincronizar pedidos y detectar actualizaciones forzadas
setInterval(() => {
  if (state.session && !document.hidden) {
    refresh(false);
  }
}, 60000);


/* =========================================================
   SICS 2026 - MÓDULOS DE CONTROL, VOZ, ALERTAS Y SPOTLIGHT
   CREACIONES JJ · OCHOA & RISQUEZ
   ========================================================= */

// =========================================================
// 1. AVISO / MODAL LIMITANTE DE PRIMERA APERTURA (GATEKEEPER)
// =========================================================
window.setOrderPhase = async function(orderId, phase) {
  try {
    const isDark = document.body.getAttribute("data-theme") === "dark";
    if (phase === "diseno") {
      await api("profile_update_order", {
        id: orderId,
        user: state.session?.name || "Usuario",
        changes: {
          diseno: "En proceso",
          estado: "Pendiente",
          nota: "🎨 Inició fase de diseño gráfico en computadora."
        }
      });
      showToast("🎨 Orden marcada en fase de Diseño. El tiempo de mesa no se computa.");
    } else if (phase === "produccion") {
      const nowIso = new Date().toISOString();
      await api("profile_update_order", {
        id: orderId,
        user: state.session?.name || "Usuario",
        changes: {
          estado: "En proceso",
          inicioProduccion: nowIso,
          nota: "✂️ Inició fase de producción física en mesa de trabajo."
        }
      });
      showToast("⚡ Fase de Producción iniciada. ⏱️ Cronómetro en vivo activado.");
    }
    closeModal();
    await refresh(false);
  } catch (err) {
    if (window.Swal) {
      Swal.fire({
        title: "Error",
        text: err.message || String(err),
        icon: "error"
      });
    } else {
      alert(`Error: ${err.message}`);
    }
  }
};

// =========================================================
// 2. CHECKLIST INTERACTIVO DE SUB-TRABAJOS
// =========================================================
window.toggleSubItemDone = async function(orderId, subIndex) {
  const allTarget = [...(state.data.allOrders || []), ...(state.data.myOrders || []), ...(state.data.finishedOrders || [])];
  const order = allTarget.find(o => String(o.id).trim() === String(orderId).trim());
  if (!order) return;

  let subs = [];
  try {
    subs = Array.isArray(order.subItems) ? order.subItems : JSON.parse(order.subItems || "[]");
  } catch(e) { subs = []; }

  if (!subs[subIndex]) return;
  subs[subIndex].completado = !subs[subIndex].completado;
  order.subItems = subs;

  try {
    await api("profile_update_order", {
      id: orderId,
      user: state.session?.name || "Usuario",
      changes: { subItems: subs }
    });
    showToast(`Ítem "${subs[subIndex].tipo || 'Trabajo'}" actualizado: ${subs[subIndex].completado ? '✅ Listo' : '⏳ Pendiente'}`);
    detail(order);
  } catch(err) {
    console.error("Error actualizando sub-ítem:", err);
  }
};

window.addSubItemToOrder = async function(orderId) {
  const allTarget = [...(state.data.allOrders || []), ...(state.data.myOrders || [])];
  const order = allTarget.find(o => String(o.id).trim() === String(orderId).trim());
  if (!order) return;

  if (window.Swal) {
    const isDark = document.body.getAttribute("data-theme") === "dark";
    const { value: formValues } = await Swal.fire({
      title: "Añadir Trabajo a esta Orden",
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      html: `
        <div style="text-align:left;">
          <label style="font-size:12px; font-weight:bold;">Tipo de Trabajo:</label>
          <input id="swal-sub-tipo" class="swal2-input" placeholder="Ej: Stickers circulares, Topper shaker, etc." style="margin-top:4px; margin-bottom:12px;">
          <label style="font-size:12px; font-weight:bold;">Cantidad:</label>
          <input id="swal-sub-cant" type="number" class="swal2-input" value="1" min="1" style="margin-top:4px; margin-bottom:12px;">
          <label style="font-size:12px; font-weight:bold;">Detalles / Medidas:</label>
          <input id="swal-sub-det" class="swal2-input" placeholder="Ej: 5cm diámetro, vinil mate" style="margin-top:4px;">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "➕ Agregar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0ea5e9",
      preConfirm: () => {
        const tipo = document.getElementById("swal-sub-tipo").value.trim();
        const cant = parseInt(document.getElementById("swal-sub-cant").value || "1", 10);
        const det = document.getElementById("swal-sub-det").value.trim();
        if (!tipo) {
          Swal.showValidationMessage("Debes ingresar el tipo de trabajo");
          return false;
        }
        return { tipo, cantidad: cant, detalles: det, completado: false };
      }
    });

    if (formValues) {
      let subs = [];
      try {
        subs = Array.isArray(order.subItems) ? order.subItems : JSON.parse(order.subItems || "[]");
      } catch(e) { subs = []; }
      subs.push(formValues);
      order.subItems = subs;

      try {
        await api("profile_update_order", {
          id: orderId,
          user: state.session?.name || "Usuario",
          changes: { subItems: subs }
        });
        showToast("Trabajo añadido a la orden exitosamente.");
        detail(order);
        refresh(false);
      } catch(err) {
        Swal.fire("Error", err.message, "error");
      }
    }
  }
};

// =========================================================
// 3. DASHBOARD DE ALERTAS & MONITOREO REMOTO (ESTILO SICS)
// =========================================================
window.checkTallerAlertas = function() {
  const bellBadge = document.getElementById("bellBadge");
  const bellIcon = document.getElementById("bellIcon");
  const notifDropdown = document.getElementById("notifDropdown");
  const notifList = document.getElementById("notifList");
  const notifCountText = document.getElementById("notifCountText");

  if (!bellBadge || !notifList) return;

  const allOrders = state.data.allOrders || [];
  const now = new Date();
  const nowMs = now.getTime();
  const alerts = [];

  // A0. Sugerencias pendientes del equipo (visibles para gerencia)
  (state.data?.sugerencias || []).filter(s => s.estado === "Pendiente").slice(0, 5).forEach(s => {
    alerts.push({
      tipo: "sugerencia",
      icono: '💡',
      titulo: `Sugerencia de ${s.usuario || 'equipo'}`,
      desc: s.comentario,
      meta: String(s.fecha || '').slice(0, 10) + (s.fotoUrl ? ' · 📷 captura adjunta' : ''),
      urgencia: "media"
    });
  });

  // A. Errores de API / Sistema registrados
  (state.systemErrors || []).forEach(errItem => {
    alerts.push({
      tipo: "error_tecnico",
      icono: '<i class="fas fa-exclamation-triangle" style="color:#ef4444; width:16px;"></i>',
      titulo: `Falla técnica: ${errItem.action}`,
      desc: errItem.error,
      meta: `Hora: ${errItem.time}`,
      urgencia: "alta"
    });
  });

  // B. Detección de anomalías en pedidos activos
  allOrders.forEach(o => {
    if (o.cerrado === "Sí" || ["Terminado", "Entregado", "Cancelado"].includes(o.estado)) return;

    const entregaDate = safeParseDate(o.entrega);
    if (entregaDate) {
      const diffMs = entregaDate.getTime() - nowMs;
      // 1. Pedido Retrasado
      if (diffMs < 0) {
        const retrasoHoras = Math.abs(Math.round(diffMs / 3600000));
        alerts.push({
          tipo: "retrasado",
          icono: '<i class="fas fa-skull-crossbones" style="color:#ef4444; width:16px;"></i>',
          titulo: `🚨 RETRASADO: ${o.id} – ${o.cliente}`,
          desc: `${o.tipo} · Responsable: ${o.responsable}`,
          meta: `Venció hace ${retrasoHoras > 0 ? retrasoHoras + ' hora(s)' : 'minutos'}`,
          orderId: o.id,
          urgencia: "alta"
        });
      }
      // 2. Pedido en Riesgo Inminente (Menos de 2 horas)
      else if (diffMs <= 2 * 3600000 && o.estado !== "En proceso") {
        const minsLeft = Math.round(diffMs / 60000);
        alerts.push({
          tipo: "en_riesgo",
          icono: '<i class="fas fa-clock" style="color:#f59e0b; width:16px;"></i>',
          titulo: `⚠️ ENTREGA EN RIESGO: ${o.id} (${minsLeft} min)`,
          desc: `Cliente: ${o.cliente} · Aún en estado: ${o.estado}`,
          meta: `Entrega solicitada: ${formatDate(o.entrega)}`,
          orderId: o.id,
          urgencia: "media"
        });
      }
    }

    // 3. Anomalía Operativa: Pedido en proceso por más de 4 horas continuas
    if (o.estado === "En proceso" && o.inicioProduccion) {
      const startMs = new Date(o.inicioProduccion).getTime();
      if (!isNaN(startMs)) {
        const elapsedHoras = (nowMs - startMs) / 3600000;
        if (elapsedHoras >= 4) {
          alerts.push({
            tipo: "tiempo_excesivo",
            icono: '<i class="fas fa-stopwatch" style="color:#8b5cf6; width:16px;"></i>',
            titulo: `⏱️ TIEMPO PROLONGADO: ${o.id}`,
            desc: `Lleva más de ${Math.round(elapsedHoras)} horas continuas en mesa de trabajo sin pausa.`,
            meta: `Responsable: ${o.responsable}`,
            orderId: o.id,
            urgencia: "baja"
          });
        }
      }
    }
  });

  state.activeAlerts = alerts;
  const count = alerts.length;

  if (count > 0) {
    bellBadge.innerText = count > 99 ? "99+" : count;
    bellBadge.style.display = "block";
    if (bellIcon) bellIcon.classList.add("ringing");
    if (notifCountText) notifCountText.innerText = `${count} activas`;

    let html = SUGGESTION_BTN_HTML;
    alerts.forEach(al => {
      html += `
        <div class="notif-item" onclick="${al.orderId ? `detailById('${al.orderId}')` : ''}">
          ${al.orderId ? `<button class="notif-btn-action"><i class="fas fa-eye"></i> Atender</button>` : ''}
          <div style="font-weight:800; margin-bottom:4px; color:var(--text-main); font-size:12.5px;">
            ${al.icono} ${escapeHtml(al.titulo)}
          </div>
          <div style="color:var(--text-muted); font-size:11.5px; margin-bottom:3px;">
            ${escapeHtml(al.desc)}
          </div>
          <div style="color:#64748b; font-size:10.5px; font-weight:600;">
            ${escapeHtml(al.meta)}
          </div>
        </div>
      `;
    });
    notifList.innerHTML = html;
  } else {
    bellBadge.style.display = "none";
    if (bellIcon) bellIcon.classList.remove("ringing");
    if (notifCountText) notifCountText.innerText = `0 activas`;
    notifList.innerHTML = `
      <div style="padding:22px; text-align:center; color:var(--text-muted); font-size:12px;">
        <i class="fas fa-check-circle" style="color:#10b981; font-size:2.2rem; margin-bottom:8px;"></i><br/>
        <strong>Bandeja en calma.</strong> No hay alertas de retraso ni fallas técnicas en este momento.
      </div>
      ${SUGGESTION_BTN_HTML}
    `;
  }
};

// Botón flotante del canal de sugerencias dentro del panel de notificaciones
const SUGGESTION_BTN_HTML = `
  <div style="padding:10px; border-top:1px solid var(--border-color); text-align:center;">
    <button type="button" onclick="window.openSuggestionModal()" style="background:rgba(139,92,246,0.15); color:#a78bfa; border:1px solid rgba(139,92,246,0.4); border-radius:8px; padding:6px 14px; font-size:11.5px; font-weight:bold; cursor:pointer; width:100%;">
      💡 Sugerir una mejora al sistema
    </button>
  </div>
`;

// MODAL: CANAL DE SUGERENCIAS PARA TODO EL EQUIPO
window.openSuggestionModal = function() {
  const userName = state.session?.name || state.session?.nombre || "Equipo";
  const notifDropdown = document.getElementById("notifDropdown");
  if (notifDropdown) notifDropdown.style.display = "none";

  openModal(`
    <div class="modal-head">
      <div>
        <h2 style="margin:0;">💡 Sugerir una Mejora</h2>
        <div style="font-size:12px; color:var(--text-muted);">Tu idea llega directo a gerencia. Enviando como: <strong>${escapeHtml(userName)}</strong></div>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>
    <form id="suggestion-form" class="form-grid" style="margin-top:12px;">
      <label class="field">
        <span class="field-label">¿QUÉ MEJORARÍAS O QUÉ NO FUNCIONA?:</span>
        <textarea id="suggestion-text" rows="4" placeholder="Ej: En la pantalla de pedidos los botones se ven muy pequeños en mi teléfono..." style="resize:vertical;"></textarea>
      </label>
      <div class="physical-invoice-box" style="margin-bottom:10px;">
        <div class="physical-invoice-header">
          <span style="font-size:11px; font-weight:800; color:#a78bfa; text-transform:uppercase;">📷 Captura de pantalla (opcional):</span>
          <label class="secondary-button" style="background:var(--bg-main); border:1px solid var(--border-color); padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
            📁 Adjuntar
            <input type="file" id="suggestion-file" accept="image/*" style="display:none;">
          </label>
        </div>
        <div id="suggestion-preview" style="display:none; margin-top:8px; align-items:center; gap:8px;">
          <img id="suggestion-thumb" src="" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid #a78bfa;">
          <span style="font-size:11px; color:#10b981; font-weight:bold;">Captura adjunta ✓</span>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="secondary-button" data-action="close" style="flex:1;">Cancelar</button>
        <button type="submit" class="primary-button" id="suggestion-submit-btn" style="flex:2; background:#8b5cf6; color:white; font-weight:800; border:none;">📨 Enviar a Gerencia</button>
      </div>
    </form>
  `);

  let sugBase64 = "";
  const fileInp = document.getElementById("suggestion-file");
  if (fileInp) {
    fileInp.addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        sugBase64 = ev.target.result;
        const thumb = document.getElementById("suggestion-thumb");
        const prev = document.getElementById("suggestion-preview");
        if (thumb) thumb.src = sugBase64;
        if (prev) prev.style.display = "flex";
      };
      r.readAsDataURL(f);
    });
  }

  const form = document.getElementById("suggestion-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const comment = document.getElementById("suggestion-text")?.value.trim() || "";
      if (!comment && !sugBase64) {
        showToast("Escribe un comentario o adjunta una captura.");
        return;
      }
      const btn = document.getElementById("suggestion-submit-btn");
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }
      try {
        let fotoFinal = sugBase64;
        if (fotoFinal && window.compressImageForOcr) {
          try { fotoFinal = await window.compressImageForOcr(fotoFinal, 1200, 0.7); } catch (eC) {}
        }
        await api("profile_create_suggestion", {
          user: userName,
          comentario: comment,
          fotoBase64: fotoFinal
        });
        closeModal();
        if (window.Swal) {
          Swal.fire({ title: "¡Gracias! 💡", text: "Tu sugerencia fue enviada a gerencia.", icon: "success", confirmButtonColor: "#8b5cf6" });
        } else {
          showToast("✅ Sugerencia enviada a gerencia.");
        }
      } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = "📨 Enviar a Gerencia"; }
        showToast("⚠️ " + err.message);
      }
    });
  }
};

window.detailById = function(orderId) {
  const allTarget = [...(state.data.allOrders || []), ...(state.data.myOrders || []), ...(state.data.finishedOrders || [])];
  const order = allTarget.find(o => String(o.id).trim() === String(orderId).trim());
  if (order) detail(order);
  const notifDropdown = document.getElementById("notifDropdown");
  if (notifDropdown) notifDropdown.style.display = "none";
};

// Manejo del click de la campanita
document.addEventListener("DOMContentLoaded", () => {
  const bellContainer = document.getElementById("bellContainer");
  const bellIconBtn = document.getElementById("bellIconBtn");
  const notifDropdown = document.getElementById("notifDropdown");

  if (bellIconBtn && notifDropdown) {
    bellIconBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notifDropdown.style.display = (notifDropdown.style.display === "block" ? "none" : "block");
      window.checkTallerAlertas();
    });

    window.addEventListener("click", () => {
      if (notifDropdown) notifDropdown.style.display = "none";
    });

    notifDropdown.addEventListener("click", (e) => e.stopPropagation());
  }
});

// =========================================================
// 4. MODO MOSTRADOR RÁPIDO / PEDIDO EXPRESS
// =========================================================
window.openExpressOrderModal = function() {
  const clients = state.data?.clients || state.frequentClients || [];
  const types = state.frequentTypes || ["Topper", "Stickers", "Taza Sublimada", "Invitación Digital", "Letras 3D", "Pendón", "Caja Sorpresa", "Maqueta"];
  const motivos = state.frequentMotivos || [];
  let expressInvoiceBase64 = "";
  let expressRefBase64 = "";

  openModal(`
    <div class="modal-head">
      <div>
        <span class="pill-urgent" style="font-size:11px;">⚡ ATENCIÓN INMEDIATA</span>
        <h2 style="margin:4px 0 0 0;">Pedido Rápido de Mostrador (JJ Express)</h2>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>

    <div style="background:rgba(245,158,11,0.08); border-left:4px solid #f59e0b; padding:10px 14px; border-radius:8px; margin-bottom:14px; font-size:12px; line-height:1.4;">
      ⚡ Diseñado para mostrador y atención presencial. Selecciona cliente frecuente o dicta por voz para llenar en segundos.
    </div>

    <form id="express-order-form" class="form-grid" style="max-width:100%; box-sizing:border-box; overflow-x:hidden;">
      <!-- Cliente -->
      <label class="field">
        <span class="field-label">CLIENTE DEL LOCAL:</span>
        ${clients.length ? `
          <select id="express-client-select" style="margin-bottom:6px; font-size:12px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; padding:6px 8px;">
            <option value="">-- Seleccionar cliente guardado o tipear abajo --</option>
            ${clients.map(c => `<option value="${escapeHtml(c.name || c.nombre)}" data-phone="${escapeHtml(c.phone || c.telefono || '')}">${escapeHtml(c.name || c.nombre)} ${c.phone || c.telefono ? `(${escapeHtml(c.phone || c.telefono)})` : ''}</option>`).join('')}
          </select>
        ` : ''}
        <div style="display:flex; gap:6px;">
          <input type="text" id="express-cliente" name="cliente" required placeholder="Nombre del cliente en mostrador" style="flex:1;">
          <button type="button" class="mic-action-btn" id="express-mic-btn" onclick="startVoiceDictationForExpress()" title="Dictar pedido por voz">
            <i class="fas fa-microphone"></i>
          </button>
        </div>
      </label>

      <!-- Teléfono -->
      <label class="field">
        <span class="field-label">TELÉFONO / WHATSAPP:</span>
        <input type="tel" id="express-telefono" name="telefono" placeholder="Ej. 04141234567">
      </label>

      <!-- Motivo / Temática Explícito -->
      <label class="field">
        <span class="field-label">MOTIVO / TEMÁTICA DEL DISEÑO:</span>
        <input type="text" id="express-motivo" name="motivo" placeholder="Ej. Spiderman, Barbie, Rapunzel, Flores, 15 Años..." required style="border-color:#38bdf8;">
      </label>

      <!-- Sub-Ítems dinámicos para el mostrador -->
      <div class="subitems-builder-box">
        <div class="subitems-builder-title">
          <span><i class="fas fa-cubes"></i> TRABAJOS SOLICITADOS</span>
          <button type="button" class="secondary-button" id="express-toggle-multiple" onclick="window.toggleExpressMultiple()" style="padding:3px 8px; font-size:11px; background:#f59e0b; color:white; border:none; border-radius:6px; cursor:pointer;">
            📁 Mostrar/Ocultar
          </button>
          <button type="button" class="secondary-button" id="express-add-item-btn" style="padding:3px 8px; font-size:11px; background:#0ea5e9; color:white; border:none; border-radius:6px; cursor:pointer;">
            ➕ Otro Trabajo
          </button>
        </div>
        <div id="express-multiple-container" style="display:none;">
        <!-- Chips rápidos -->
        <div class="subitems-chips-bar">
          <span style="font-size:11px; color:var(--text-muted); align-self:center;">+ Rápido:</span>
          <button type="button" class="subitem-chip-btn" onclick="addExpressSubItem('Topper', 1, '')">+ Topper</button>
          <button type="button" class="subitem-chip-btn" onclick="addExpressSubItem('Stickers', 1, 'Pliego')">+ Stickers</button>
          <button type="button" class="subitem-chip-btn" onclick="addExpressSubItem('Taza Sublimada', 1, '')">+ Taza</button>
          <button type="button" class="subitem-chip-btn" onclick="addExpressSubItem('Invitación Digital', 1, '')">+ Invitación</button>
          <button type="button" class="subitem-chip-btn" onclick="addExpressSubItem('Letras 3D', 1, '')">+ Letras 3D</button>
          <button type="button" class="subitem-chip-btn" onclick="addExpressSubItem('Pendón', 1, '')">+ Pendón</button>
        </div>

        <div id="express-items-list" style="width:100%; box-sizing:border-box;">
          <div class="subitem-row">
            <input type="text" list="subitem-tipos-list" class="swal-item-tipo" placeholder="Tipo de trabajo (ej: Topper)" value="Topper" required>
            <input type="number" class="swal-item-cant" value="1" min="1" placeholder="Cant." style="text-align:center;">
            <input type="text" class="swal-item-det subitem-det-col" placeholder="Detalles / Medidas (ej: 15cm, Spiderman)">
            <button type="button" class="subitem-del-btn" onclick="this.closest('.subitem-row').remove()">🗑️</button>
          </div>
        </div>
      </div>
    </div>

      <!-- Selección Rápida de Entrega -->
      <div class="field">
        <span class="field-label">TIEMPO DE ENTREGA REQUERIDO:</span>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
          <button type="button" class="secondary-button express-time-btn" data-hours="1" style="font-size:11px; padding:4px 10px;">⚡ En 1 Hora</button>
          <button type="button" class="secondary-button express-time-btn" data-hours="3" style="font-size:11px; padding:4px 10px;">⚡ En 3 Horas</button>
          <button type="button" class="secondary-button express-time-btn" data-time="17:30" style="font-size:11px; padding:4px 10px;">📅 Hoy final tarde (5:30pm)</button>
          <button type="button" class="secondary-button express-time-btn" data-time="19:30" style="font-size:11px; padding:4px 10px; background:rgba(139,92,246,0.15); color:#a78bfa; border:1px solid rgba(139,92,246,0.3);">🌙 En la noche (7:30pm)</button>
          <button type="button" class="secondary-button express-time-btn" data-day="tomorrow" style="font-size:11px; padding:4px 10px;">📅 Mañana en la mañana</button>
        </div>
        <div class="form-inline" style="gap:8px;">
          <input type="date" id="express-fecha" name="fechaEntrega" required style="flex:1;">
          <input type="time" id="express-hora" name="horaEntrega" value="17:30" required style="flex:1;">
        </div>
      </div>

      <!-- DATOS DE COBRO Y PAGO (Plantilla de Recibo Físico Creaciones JJ) -->
      <div class="physical-invoice-box" style="border-color:#10b981; background:rgba(16,185,129,0.05); margin-bottom:12px;">
        <div style="font-size:11.5px; font-weight:800; color:#10b981; text-transform:uppercase; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <span>💰 Datos de Cobro / Mostrador (Plantilla JJ):</span>
          <span id="express-payment-badge" style="font-size:10px; padding:2px 8px; border-radius:10px; background:#f59e0b; color:white; font-weight:bold;">Pendiente</span>
        </div>
        <div class="form-inline" style="gap:8px; margin-bottom:8px;">
          <label class="field" style="flex:1;">
            <span class="field-label">TOTAL A COBRAR ($):</span>
            <input type="number" id="express-costo" name="costo" step="0.01" min="0" placeholder="0.00" value="0.00" oninput="window.recalcExpressPayment()">
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">ANTICIPO / ABONÓ ($):</span>
            <input type="number" id="express-anticipo" name="anticipo" step="0.01" min="0" placeholder="0.00" value="0.00" oninput="window.recalcExpressPayment()">
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">RESTA / SALDO ($):</span>
            <input type="number" id="express-resta" name="resta" step="0.01" placeholder="0.00" value="0.00" readonly style="background:rgba(0,0,0,0.3); font-weight:800; color:#ef4444;">
          </label>
        </div>
        <div class="form-inline" style="gap:8px;">
          <label class="field" style="flex:1;">
            <span class="field-label">MÉTODO DE PAGO:</span>
            <select id="express-metodo-pago" name="metodoPago" style="font-size:12px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; padding:6px 8px;">
              <option value="Efectivo USD">Efectivo ($ Dólares)</option>
              <option value="Efectivo Bs">Efectivo (Bs Bolívares)</option>
              <option value="Pago Móvil">Pago Móvil</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Punto de Venta">Punto de Venta</option>
              <option value="Mixto">Mixto (Efectivo + Transferencia)</option>
              <option value="Sin Pagar">Sin Pagar / Por Cobrar</option>
            </select>
          </label>
          <label class="field" style="flex:1.5;">
            <span class="field-label">NOTAS DE PAGO / VUELTO:</span>
            <input type="text" id="express-nota-pago" name="notaPago" placeholder="Ej. Falta dar 3$ de vuelto en físico">
          </label>
        </div>
      </div>

      <!-- FOTO DE REFERENCIA DEL CLIENTE -->
      <div class="physical-invoice-box" id="express-ref-box" style="margin-bottom:12px; border-color:#0ea5e9;">
        <div class="physical-invoice-header">
          <span style="font-size:11px; font-weight:800; color:#0ea5e9; text-transform:uppercase;">
            🖼️ Fotos de Referencia del Cliente (Diseño):
          </span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="secondary-button" id="express-cam-ref-btn" style="background:#0ea5e9; color:white; border:none; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
              📸 Tomar Foto
            </button>
            <label class="secondary-button" style="background:var(--bg-main); border:1px solid var(--border-color); padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
              📁 Subir Archivo
              <input type="file" id="express-file-ref" accept="image/*" style="display:none;">
            </label>
          </div>
        </div>
        <div id="express-ref-preview-wrap" style="display:none;" class="physical-invoice-preview">
          <img id="express-ref-img" class="physical-invoice-thumb" src="" alt="Referencia Cliente">
          <div style="flex:1; font-size:11.5px;">
            <strong style="color:#0ea5e9;"><i class="fas fa-check-circle"></i> Referencia Adjunta</strong>
            <div style="color:var(--text-muted); font-size:10.5px;">Visible directamente para diseñadores y armadores en taller.</div>
          </div>
          <button type="button" class="subitem-del-btn" id="express-ref-del-btn" title="Eliminar foto">🗑️</button>
        </div>
      </div>

      <!-- FACTURA FÍSICA / NOTA MANUSCRITA -->
      <div class="physical-invoice-box" id="express-invoice-box" style="margin-bottom:12px;">
        <div class="physical-invoice-header">
          <span style="font-size:11px; font-weight:800; color:#d97706; text-transform:uppercase;">
            🧾 Nota Física Manuscrita de Mostrador:
          </span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="secondary-button" id="express-cam-invoice-btn" style="background:#f59e0b; color:white; border:none; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
              📸 Tomar Foto
            </button>
            <label class="secondary-button" style="background:var(--bg-main); border:1px solid var(--border-color); padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
              📁 Subir Archivo
              <input type="file" id="express-file-invoice" accept="image/*" style="display:none;">
            </label>
          </div>
        </div>
        <div id="express-invoice-preview-wrap" style="display:none;" class="physical-invoice-preview">
          <img id="express-invoice-img" class="physical-invoice-thumb" src="" alt="Factura Física">
          <div style="flex:1; font-size:11.5px;">
            <strong style="color:#10b981;"><i class="fas fa-check-circle"></i> Nota Física Adjunta</strong>
            <div style="color:var(--text-muted); font-size:10.5px;">Se respaldará junto con el pedido en Google Drive.</div>
          </div>
          <button type="button" class="subitem-del-btn" id="express-invoice-del-btn" title="Eliminar foto">🗑️</button>
        </div>
      </div>

      <!-- Responsable Asignado -->
      <div class="field">
        <span class="field-label">RESPONSABLE ASIGNADO:</span>
        <select id="express-responsable" name="responsable" required style="background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; padding:6px 8px;">
          ${getRealTeamList().map(r => `
            <option value="${escapeHtml(r)}" ${state.session && state.session.name && state.session.name.toLowerCase() === r.toLowerCase() ? 'selected' : ''}>${escapeHtml(r)}</option>
          `).join('')}
        </select>
      </div>

      <!-- Aviso de Confirmación Visual -->
      <div id="express-visual-confirm" class="visual-confirm-box" style="display:none;">
        <div class="visual-confirm-title"><i class="fas fa-check-circle"></i> ¡Datos interpretados correctamente!</div>
        <div id="express-confirm-summary" style="font-size:12px; line-height:1.4;"></div>
      </div>

      <div class="modal-foot" style="margin-top:10px; display:flex; gap:8px;">
        <button type="button" class="secondary-button" data-action="close" style="flex:1;">Cancelar</button>
        <button type="submit" class="primary-button" id="express-submit-btn" style="flex:2; background:#f59e0b; color:white; font-weight:800; border:none; box-shadow:0 4px 12px rgba(245,158,11,0.3);">
          ⚡ Crear Pedido JJ Express
        </button>
      </div>
    </form>
  `);

  // Default fecha hoy
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const fechaInput = document.getElementById("express-fecha");
  if (fechaInput) fechaInput.value = `${y}-${m}-${day}`;

  // Helper de cálculo de saldo
  window.recalcExpressPayment = function() {
    const total = parseFloat(document.getElementById("express-costo")?.value || 0);
    const anticipo = parseFloat(document.getElementById("express-anticipo")?.value || 0);
    const restaEl = document.getElementById("express-resta");
    const badgeEl = document.getElementById("express-payment-badge");
    const resta = Math.max(0, total - anticipo);
    if (restaEl) restaEl.value = resta.toFixed(2);
    if (badgeEl) {
      if (total <= 0) {
        badgeEl.textContent = "Sin Costo";
        badgeEl.style.background = "#64748b";
      } else if (resta <= 0.01) {
        badgeEl.textContent = "Pagado Completo";
        badgeEl.style.background = "#10b981";
      } else if (anticipo > 0) {
        badgeEl.textContent = "Abonó Anticipo";
        badgeEl.style.background = "#0ea5e9";
      } else {
        badgeEl.textContent = "Pendiente por Pagar";
        badgeEl.style.background = "#ef4444";
      }
    }
  };
  window.recalcExpressPayment();

  // Cliente frecuente select
  const selCli = document.getElementById("express-client-select");
  if (selCli) {
    selCli.addEventListener("change", (e) => {
      const opt = selCli.options[selCli.selectedIndex];
      if (opt && opt.value) {
        document.getElementById("express-cliente").value = opt.value;
        const ph = opt.getAttribute("data-phone");
        if (ph) document.getElementById("express-telefono").value = ph;
      }
    });
  }

  // Atajos de entrega
  document.querySelectorAll(".express-time-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const now = new Date();
      if (btn.dataset.hours) {
        const hrs = parseInt(btn.dataset.hours, 10);
        now.setHours(now.getHours() + hrs);
        document.getElementById("express-hora").value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        document.getElementById("express-fecha").value = now.toISOString().split('T')[0];
      } else if (btn.dataset.time) {
        document.getElementById("express-hora").value = btn.dataset.time;
        document.getElementById("express-fecha").value = now.toISOString().split('T')[0];
      } else if (btn.dataset.day === "tomorrow") {
        now.setDate(now.getDate() + 1);
        document.getElementById("express-fecha").value = now.toISOString().split('T')[0];
        document.getElementById("express-hora").value = "10:00";
      }
    });
  });

  // Agregar subítem
  const addBtn = document.getElementById("express-add-item-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      window.addExpressSubItem("Topper", 1, "");
    });
  }

  // FOTO NOTA FÍSICA
  const fileInp = document.getElementById("express-file-invoice");
  const camBtn = document.getElementById("express-cam-invoice-btn");
  const previewWrap = document.getElementById("express-invoice-preview-wrap");
  const previewImg = document.getElementById("express-invoice-img");
  const delBtn = document.getElementById("express-invoice-del-btn");

  if (fileInp) {
    fileInp.addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        expressInvoiceBase64 = ev.target.result;
        previewImg.src = expressInvoiceBase64;
        previewWrap.style.display = "flex";
        if (typeof triggerOcrForExpressInvoice === "function") {
          triggerOcrForExpressInvoice(expressInvoiceBase64);
        }
      };
      r.readAsDataURL(f);
    });
  }

  if (camBtn) {
    camBtn.addEventListener("click", async () => {
      const streamInp = document.createElement("input");
      streamInp.type = "file";
      streamInp.accept = "image/*";
      streamInp.capture = "environment";
      streamInp.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => {
          expressInvoiceBase64 = ev.target.result;
          previewImg.src = expressInvoiceBase64;
          previewWrap.style.display = "flex";
          if (typeof window.triggerOcrForExpressInvoice === "function") {
            window.triggerOcrForExpressInvoice(expressInvoiceBase64);
          }
        };
        r.readAsDataURL(f);
      };
      streamInp.click();
    });
  }

  if (delBtn) {
    delBtn.addEventListener("click", () => {
      expressInvoiceBase64 = "";
      previewImg.src = "";
      previewWrap.style.display = "none";
      if (fileInp) fileInp.value = "";
    });
  }

  // FOTO REFERENCIA CLIENTE
  const fileRefInp = document.getElementById("express-file-ref");
  const camRefBtn = document.getElementById("express-cam-ref-btn");
  const previewRefWrap = document.getElementById("express-ref-preview-wrap");
  const previewRefImg = document.getElementById("express-ref-img");
  const delRefBtn = document.getElementById("express-ref-del-btn");

  if (fileRefInp) {
    fileRefInp.addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        expressRefBase64 = ev.target.result;
        previewRefImg.src = expressRefBase64;
        previewRefWrap.style.display = "flex";
      };
      r.readAsDataURL(f);
    });
  }

  if (camRefBtn) {
    camRefBtn.addEventListener("click", () => {
      const streamInp = document.createElement("input");
      streamInp.type = "file";
      streamInp.accept = "image/*";
      streamInp.capture = "environment";
      streamInp.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => {
          expressRefBase64 = ev.target.result;
          previewRefImg.src = expressRefBase64;
          previewRefWrap.style.display = "flex";
        };
        r.readAsDataURL(f);
      };
      streamInp.click();
    });
  }

  if (delRefBtn) {
    delRefBtn.addEventListener("click", () => {
      expressRefBase64 = "";
      previewRefImg.src = "";
      previewRefWrap.style.display = "none";
      if (fileRefInp) fileRefInp.value = "";
    });
  }

  // Envío del Formulario
  const form = document.getElementById("express-order-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("express-submit-btn");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`;

      try {
        const cliente = document.getElementById("express-cliente").value.trim();
        const telefono = document.getElementById("express-telefono").value.trim();
        const motivo = document.getElementById("express-motivo").value.trim() || "General";
        const fecha = document.getElementById("express-fecha").value;
        const hora = document.getElementById("express-hora").value || "17:30";
        const responsable = document.getElementById("express-responsable").value;
        const costo = parseFloat(document.getElementById("express-costo").value || 0);
        const anticipo = parseFloat(document.getElementById("express-anticipo").value || 0);
        const resta = Math.max(0, costo - anticipo);
        const metodoPago = document.getElementById("express-metodo-pago").value;
        const notaPago = document.getElementById("express-nota-pago").value.trim();

        // Extraer sub-ítems
        const rows = document.querySelectorAll("#express-items-list .subitem-row");
        const subItems = [];
        rows.forEach(r => {
          const t = r.querySelector(".swal-item-tipo")?.value.trim();
          const c = parseInt(r.querySelector(".swal-item-cant")?.value || 1, 10);
          const d = r.querySelector(".swal-item-det")?.value.trim() || motivo;
          if (t) {
            subItems.push({ tipo: t, cantidad: c, detalles: d, completado: false });
          }
        });

        if (!subItems.length) {
          subItems.push({ tipo: "Topper", cantidad: 1, detalles: motivo, completado: false });
        }

        const primaryTipo = subItems[0].tipo || "Topper";
        const itemsSummary = subItems.map(s => `${s.cantidad}x ${s.tipo}${s.detalles ? ` (${s.detalles})` : ''}`).join(', ');

        let notasIniciales = `⚡ [Pedido JJ Express - Mostrador]: ${itemsSummary}`;
        if (costo > 0 || anticipo > 0 || notaPago) {
          notasIniciales += `\n💰 Cobro: Total $${costo.toFixed(2)} | Anticipo: $${anticipo.toFixed(2)} | Saldo: $${resta.toFixed(2)} | ${metodoPago}${notaPago ? ` | Nota: ${notaPago}` : ''}`;
        }

        const payload = {
          cliente: cliente,
          telefono: telefono,
          tipo: primaryTipo,
          motivo: motivo,
          fechaEntrega: fecha,
          horaEntrega: hora,
          responsable: responsable,
          costo: costo,
          anticipo: anticipo,
          saldoPendiente: resta,
          metodoPago: metodoPago,
          notaPago: notaPago,
          subItems: JSON.stringify(subItems),
          notas: notasIniciales,
          fotoNotaFisica: expressInvoiceBase64,
          fotosReferencia: expressRefBase64 ? JSON.stringify([expressRefBase64]) : "[]"
        };

        const res = await api("profile_create_order", payload);
        if (res && (res.ok || res.exito)) {
          showToast(`✅ Pedido ${res.id || ''} registrado con éxito en Mostrador.`);
          closeModal();
          await refresh(true);
        } else {
          throw new Error(res?.mensaje || res?.error || "Error al registrar el pedido exprés");
        }
      } catch(err) {
        console.error(err);
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "error",
            title: "Error al registrar",
            text: err.message || String(err)
          });
        } else {
          alert(`Error: ${err.message}`);
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `⚡ Crear Pedido JJ Express`;
      }
    });
  }
};

window.addExpressSubItem = function(tipo, cant, det) {
  const list = document.getElementById("express-items-list");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "subitem-row";
  const motivoVal = document.getElementById("express-motivo")?.value.trim() || "";
  row.innerHTML = `
    <input type="text" list="subitem-tipos-list" class="swal-item-tipo" placeholder="Tipo de trabajo (ej: Topper)" value="${escapeHtml(tipo)}" required>
    <input type="number" class="swal-item-cant" value="${cant || 1}" min="1" placeholder="Cant." style="text-align:center;">
    <input type="text" class="swal-item-det subitem-det-col" placeholder="Detalles / Medidas" value="${escapeHtml(det || motivoVal)}">
    <button type="button" class="subitem-del-btn" onclick="this.closest('.subitem-row').remove()">🗑️</button>
  `;
  list.appendChild(row);
};

window.parseAndFillExpressForm = function(text) {
  const p = window.parseOrderNaturalLanguage(text);
  if (p.cliente) {
    const cliEl = document.getElementById("express-cliente");
    if (cliEl) cliEl.value = p.cliente;
  }
  if (p.telefono) {
    const tlfEl = document.getElementById("express-telefono");
    if (tlfEl) tlfEl.value = p.telefono;
  }
  if (p.motivo) {
    const motEl = document.getElementById("express-motivo");
    if (motEl) motEl.value = p.motivo;
  }
  if (p.fechaEntrega) {
    const fEl = document.getElementById("express-fecha");
    if (fEl) fEl.value = p.fechaEntrega;
  }
  if (p.entregaHora) {
    const hEl = document.getElementById("express-hora");
    if (hEl) hEl.value = p.entregaHora;
  }

  // Llenar trabajos en la lista
  if (p.items && p.items.length) {
    const list = document.getElementById("express-items-list");
    if (list) {
      list.innerHTML = "";
      p.items.forEach(it => {
        window.addExpressSubItem(it.tipo, it.cant, it.det || p.motivo);
      });
    }
  }

  // Mostrar caja de confirmación visual
  const confirmBox = document.getElementById("express-visual-confirm");
  const summaryBox = document.getElementById("express-confirm-summary");
  if (confirmBox && summaryBox) {
    summaryBox.innerHTML = `
      <div><strong>Cliente:</strong> ${escapeHtml(p.cliente || 'Detectado')}</div>
      ${p.motivo ? `<div><strong>Motivo:</strong> ${escapeHtml(p.motivo)}</div>` : ''}
      <div><strong>Trabajos:</strong> ${p.items.map(i => `${i.cant}x ${i.tipo}`).join(', ')}</div>
      <div><strong>Entrega:</strong> ${p.fechaEntrega} a las ${p.entregaHora}</div>
    `;
    confirmBox.style.display = "block";
  }
};

window.initVoiceAssistant = function() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("SpeechRecognition no disponible en este navegador.");
    return null;
  }
  const recognizer = new SpeechRecognition();
  recognizer.lang = navigator.language || "es-419";
  recognizer.continuous = false;
  recognizer.interimResults = false;
  return recognizer;
};

window.toggleSpeechRecognition = function() {
  const micBtn = document.getElementById("jj-mic-btn");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Detectar Opera específicamente
  const isOpera = navigator.userAgent.includes('OPR') || navigator.userAgent.includes('Opera');

  if (!SpeechRecognition || isOpera) {
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "warning",
        title: "Voz no disponible",
        html: isOpera 
          ? "El navegador Opera no soporta el reconocimiento de voz nativo. Te recomendamos usar Google Chrome o Microsoft Edge para la función de dictado por voz."
          : "El reconocimiento por voz no es soportado por este navegador. Te recomendamos usar Google Chrome o Microsoft Edge."
      });
    } else {
      alert(isOpera 
        ? "Opera no soporta reconocimiento de voz. Usa Google Chrome o Microsoft Edge."
        : "El dictado por voz no es soportado por este navegador. Usa Google Chrome o Microsoft Edge.");
    }
    return;
  }

  // Verificar contexto seguro HTTPS
  if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "warning",
        title: "Conexión no segura",
        text: "El micrófono requiere conexión segura HTTPS. Google Apps Script Web Apps se ejecutan en HTTPS por defecto."
      });
    } else {
      alert("El micrófono requiere conexión segura HTTPS o localhost.");
    }
    return;
  }

  if (!speechRecognitionInstance) {
    speechRecognitionInstance = window.initVoiceAssistant();
  }

  if (!speechRecognitionInstance) return;

  if (isRecognizingSpeech) {
    try { speechRecognitionInstance.stop(); } catch(e) {}
    isRecognizingSpeech = false;
    if (micBtn) micBtn.classList.remove("listening");
    return;
  }

  speechRecognitionInstance.onstart = () => {
    isRecognizingSpeech = true;
    if (micBtn) micBtn.classList.add("listening");
    showToast("🎙️ Escuchando... Dicta el pedido claramente.");
  };

  speechRecognitionInstance.onresult = (event) => {
    isRecognizingSpeech = false;
    if (micBtn) micBtn.classList.remove("listening");
    const transcript = event.results[0][0].transcript;
    const input = document.getElementById("jj-bot-input");
    if (input) input.value = transcript;
    
    // Intentar encontrar cliente en contactos frecuentes
    const clients = state.data?.frequentClients || [];
    let matchedClient = null;
    
    clients.forEach(c => {
      if (transcript.toLowerCase().includes(c.name.toLowerCase())) {
        matchedClient = c;
      }
    });
    
    if (matchedClient) {
      showToast(`👤 Cliente detectado: ${matchedClient.name}`);
    }
    
    window.processVoiceTranscript(transcript);
  };

  speechRecognitionInstance.onerror = (event) => {
    isRecognizingSpeech = false;
    if (micBtn) micBtn.classList.remove("listening");
    console.error("Speech recognition error:", event.error);
    if (event.error === "not-allowed" || event.error === "permission-denied") {
      showToast("❌ Permiso de micrófono denegado. Habilítalo en los ajustes del navegador.");
    } else if (event.error === "no-speech") {
      showToast("⚠️ No se escuchó ninguna voz. Intenta nuevamente.");
    } else if (event.error === "network") {
      showToast("⚠️ Error de conexión con el servicio de voz.");
    } else {
      showToast(`Error de voz: ${event.error}`);
    }
  };

  speechRecognitionInstance.onend = () => {
    isRecognizingSpeech = false;
    if (micBtn) micBtn.classList.remove("listening");
  };

  try {
    speechRecognitionInstance.start();
  } catch(e) {
    console.error("Error iniciando voz:", e);
    isRecognizingSpeech = false;
    if (micBtn) micBtn.classList.remove("listening");
    showToast("⚠️ No se pudo activar el micrófono.");
  }
};

window.printReport = function() {
  window.print();
};

window.toggleOverdueList = function() {
  const container = document.getElementById("overdue-list-container");
  const chevron = document.getElementById("overdue-chevron");
  if (container) {
    const isHidden = container.style.display === "none";
    container.style.display = isHidden ? "flex" : "none";
    if (chevron) {
      chevron.className = isHidden ? "fas fa-chevron-up" : "fas fa-chevron-down";
    }
  }
};

window.toggleExpressMultiple = function() {
  const container = document.getElementById("express-multiple-container");
  if (container) {
    container.style.display = container.style.display === "none" ? "block" : "none";
  }
};

window.startVoiceDictationForStandard = function() {
  const micBtn = document.getElementById("standard-mic-btn");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edge/.test(navigator.userAgent);
    
    if (isChrome || isEdge) {
      alert("El reconocimiento de voz debería funcionar en este navegador. Verifica que tengas permisos de micrófono habilitados.");
    } else {
      alert("El dictado por voz no es soportado por este navegador. Te recomendamos usar Google Chrome o Microsoft Edge para esta función.");
    }
    return;
  }

  try {
    if (window._standardSpeechRec) {
      try { window._standardSpeechRec.abort(); } catch(e){}
    }
    const rec = new SpeechRecognition();
    window._standardSpeechRec = rec;
    rec.lang = "es-419";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      if (micBtn) micBtn.classList.add("listening");
      showToast("🎙️ Escuchando... Dicta cliente, trabajo, motivo y fecha.");
    };

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      
      // Intentar encontrar cliente en contactos frecuentes
      const clients = state.data?.frequentClients || [];
      let matchedClient = null;
      
      clients.forEach(c => {
        if (transcript.toLowerCase().includes(c.name.toLowerCase())) {
          matchedClient = c;
        }
      });
      
      const parsed = parseMagicPasteText(transcript);
      
      // Usar contacto frecuente si se encontró
      if (matchedClient) {
        $("#input-cliente").value = matchedClient.name;
        $("#input-telefono").value = matchedClient.phone || "";
        showToast(`👤 Cliente detectado: ${matchedClient.name}`);
      } else if (parsed.cliente) {
        $("#input-cliente").value = parsed.cliente;
      }
      
      if (parsed.telefono && !matchedClient) $("#input-telefono").value = parsed.telefono;
      if (parsed.tipo) $("#input-tipo").value = parsed.tipo;
      if (parsed.motivo) $("#input-motivo").value = parsed.motivo;
      if (parsed.fechaEntrega) $("#input-fecha-entrega").value = parsed.fechaEntrega;
      if (parsed.horaEntrega) $("#select-hora-entrega").value = parsed.horaEntrega;
      
      // Si hay múltiples trabajos detectados, no colapsar
      if (parsed.multipleItems) {
        const container = document.getElementById("multiple-work-container");
        if (container) container.style.display = "block";
      }
      
      showToast("✅ Dictado completado y campos llenados.");
    };

    rec.onerror = (event) => {
      console.error("Error en reconocimiento de voz:", event.error);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        showToast("❌ Permiso de micrófono denegado. Habilítalo en los ajustes del navegador.");
      } else {
        showToast("⚠️ Error en reconocimiento de voz: " + event.error);
      }
    };

    rec.onend = () => {
      if (micBtn) micBtn.classList.remove("listening");
    };

    rec.start();
  } catch(e) {
    console.error("Error al iniciar reconocimiento de voz:", e);
    showToast("⚠️ No se pudo activar el micrófono. Verifica los permisos del navegador.");
  }
};

window.startVoiceDictationForExpress = function() {
  const micBtn = document.getElementById("express-mic-btn");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Detectar Opera específicamente
  const isOpera = navigator.userAgent.includes('OPR') || navigator.userAgent.includes('Opera');

  if (!SpeechRecognition || isOpera) {
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: isOpera ? "warning" : "info",
        title: isOpera ? "Voz no disponible en Opera" : "Dictado por Voz",
        html: isOpera 
          ? `<p>El navegador Opera no soporta el reconocimiento de voz nativo.</p>
             <p style="font-size:12px; color:#9ca3af; margin-top:8px;">Te recomendamos usar Google Chrome o Microsoft Edge para la función de dictado por voz.</p>`
          : `<p>En tu navegador puedes usar el atajo de Windows <strong>Win + H</strong> para dictar directamente con tu voz en el campo de texto.</p>
             <p style="font-size:12px; color:#9ca3af; margin-top:8px;">Google Chrome y Edge también soportan el micrófono web nativo.</p>`
      });
    } else {
      alert(isOpera 
        ? "Opera no soporta reconocimiento de voz. Usa Google Chrome o Microsoft Edge."
        : "Dictado por voz: Usa Win + H en Windows para dictar directamente en el campo de texto.");
    }
    return;
  }

  try {
    if (window._expressSpeechRec) {
      try { window._expressSpeechRec.abort(); } catch(e){}
    }
    const rec = new SpeechRecognition();
    window._expressSpeechRec = rec;
    rec.lang = "es-419";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      if (micBtn) micBtn.classList.add("listening");
      showToast("🎙️ Escuchando... Dicta cliente, trabajo, motivo y fecha.");
    };

    rec.onresult = (e) => {
      if (micBtn) micBtn.classList.remove("listening");
      const text = e.results[0][0].transcript;
      
      // Intentar encontrar cliente en contactos frecuentes
      const clients = state.data?.frequentClients || [];
      let matchedClient = null;
      
      clients.forEach(c => {
        if (text.toLowerCase().includes(c.name.toLowerCase())) {
          matchedClient = c;
        }
      });
      
      // Usar contacto frecuente si se encontró
      if (matchedClient) {
        $("#express-cliente").value = matchedClient.name;
        $("#express-telefono").value = matchedClient.phone || "";
        showToast(`👤 Cliente detectado: ${matchedClient.name}`);
      }
      
      showToast(`Capturado: "${text}"`);
      window.parseAndFillExpressForm(text);
    };

    rec.onerror = (e) => {
      if (micBtn) micBtn.classList.remove("listening");
      console.warn("Speech recognition warning:", e.error);
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        showToast("⚠️ Micrófono bloqueado. Recuerda que puedes pulsar Win + H para dictar.");
      } else if (e.error === "no-speech") {
        showToast("⚠️ No se escuchó voz. Intenta nuevamente.");
      } else {
        showToast("💡 Tip: Presiona Win + H en tu teclado para dictar en el campo.");
      }
    };

    rec.onend = () => {
      if (micBtn) micBtn.classList.remove("listening");
    };

    rec.start();
  } catch(e) {
    console.warn("Speech init error:", e);
    if (micBtn) micBtn.classList.remove("listening");
    showToast("💡 Tip: Presiona Win + H en tu teclado para dictar por voz en el campo.");
  }
};

window.parseOrderNaturalLanguage = function(text) {
  const result = {
    cliente: "",
    telefono: "",
    items: [],
    motivo: "",
    entregaHora: "17:30",
    fechaEntrega: new Date().toISOString().split('T')[0]
  };

  if (!text) return result;
  const lower = text.toLowerCase().trim();

  // A. Búsqueda de cliente en la base de datos de clientes frecuentes
  const knownClients = (state.data?.clients || state.data?.frequentClients || state.frequentClients || []);
  for (const c of knownClients) {
    const cName = String(c.name || c.nombre || "").trim();
    if (cName && lower.includes(cName.toLowerCase())) {
      result.cliente = cName;
      result.telefono = c.phone || c.telefono || "";
      break;
    }
  }

  // Si no se encontró por coincidencia exacta de cliente guardado, extraer del texto
  if (!result.cliente) {
    const clientMatch = lower.match(/(?:pedido para|para|cliente|a nombre de)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/i);
    if (clientMatch) {
      let rawName = clientMatch[1].trim();
      // Eliminar preposiciones o artículos finales pegados accidentalmente (ej: "Miriam de" -> "Miriam")
      rawName = rawName.replace(/\s+(?:de|con|un|una|el|la|para)$/i, "").trim();
      result.cliente = rawName.replace(/(?:^|\s)\S/g, l => l.toUpperCase());
    }
  }

  // B. Extraer motivo / temática (ej: "con temática de Spiderman", "motivo Rapunzel", "de Barbie")
  const motivoMatch = lower.match(/(?:con\s+tem[aá]tica\s+de|tem[aá]tica\s+de|tem[aá]tica|motivo\s+de|motivo)\s+([a-záéíóúñ0-9\s]+?)(?=\s+(?:para|con|\d|$)|$)/i);
  if (motivoMatch) {
    result.motivo = motivoMatch[1].trim().replace(/(?:^|\s)\S/g, l => l.toUpperCase());
  } else {
    // Si dice: "topper de Spiderman", "stickers de Flores", etc.
    const deMatch = lower.match(/(?:topper[s]?|stickers?|taza[s]?|invitaci[oó]n(?:es)?|letras? 3d|pend[oó]n(?:es)?)\s+de\s+([a-záéíóúñ0-9\s]+?)(?=\s+(?:para|con|\d|$)|$)/i);
    if (deMatch) {
      const candidate = deMatch[1].trim();
      const forbidden = ["hoy", "mañana", "lunes", "martes", "miercoles", "miércoles", "jueves", "viernes", "sabado", "sábado", "domingo", "mostrador", "taller"];
      if (!forbidden.includes(candidate.toLowerCase())) {
        result.motivo = candidate.replace(/(?:^|\s)\S/g, l => l.toUpperCase());
      }
    }
  }

  // C. Extraer fecha / día de la semana
  const today = new Date();
  if (lower.includes("para hoy") || lower.includes("hoy")) {
    result.fechaEntrega = today.toISOString().split('T')[0];
  } else if (lower.includes("para mañana") || lower.includes("mañana")) {
    const tm = new Date(today);
    tm.setDate(tm.getDate() + 1);
    result.fechaEntrega = tm.toISOString().split('T')[0];
  } else {
    // Reconocer días de la semana: lunes, martes, miércoles, jueves, viernes, sábado, domingo
    const daysMap = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, "miércoles": 3, jueves: 4, viernes: 5, sabado: 6, "sábado": 6 };
    for (const [dayName, dayNum] of Object.entries(daysMap)) {
      if (lower.includes("para el " + dayName) || lower.includes("el " + dayName)) {
        const currentDay = today.getDay();
        let diff = (dayNum - currentDay + 7) % 7;
        if (diff === 0) diff = 7; // Próxima semana
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + diff);
        result.fechaEntrega = targetDate.toISOString().split('T')[0];
        break;
      }
    }
  }

  // D. Extraer hora de entrega
  if (lower.includes("noche") || lower.includes("final de la jornada") || lower.includes("final de jornada")) {
    result.entregaHora = "19:30";
  } else if (lower.includes("final de la tarde") || lower.includes("tarde")) {
    result.entregaHora = "17:30";
  } else if (lower.includes("mañana por la mañana") || lower.includes("en la mañana")) {
    result.entregaHora = "10:00";
  }

  const horaMatch = lower.match(/(?:a las|para las)\s+(\d{1,2})(?::(\d{2}))?\s*(de la tarde|de la mañana|de la noche|am|pm)?/i);
  if (horaMatch) {
    let hh = parseInt(horaMatch[1], 10);
    const mm = horaMatch[2] || "00";
    const mod = (horaMatch[3] || "").toLowerCase();
    if ((mod.includes("tarde") || mod.includes("noche") || mod.includes("pm")) && hh < 12) hh += 12;
    if (mod.includes("am") && hh === 12) hh = 0;
    result.entregaHora = `${String(hh).padStart(2,'0')}:${mm}`;
  }

  // E. Extraer trabajos tipificados (Topper, Stickers, Taza, etc.)
  const typesMap = [
    { patterns: ["toppers 3d", "topper 3d", "toppers", "topper"], formal: "Topper" },
    { patterns: ["stickers", "sticker", "calcomanias", "calcomanías"], formal: "Stickers" },
    { patterns: ["tazas sublimadas", "taza sublimada", "tazas", "taza"], formal: "Taza Sublimada" },
    { patterns: ["invitaciones digitales", "invitacion digital", "invitación digital", "invitaciones", "invitacion", "invitación"], formal: "Invitación Digital" },
    { patterns: ["letras 3d", "letra 3d"], formal: "Letras 3D" },
    { patterns: ["pendones", "pendon", "pendón"], formal: "Pendón" },
    { patterns: ["cajas sorpresa", "caja sorpresa", "cotillones", "cotillon", "cotillón"], formal: "Caja Sorpresa" }
  ];

  for (const t of typesMap) {
    for (const pat of t.patterns) {
      if (lower.includes(pat)) {
        // Buscar cantidad antes del tipo (ej: "2 toppers")
        const qtyRegex = new RegExp(`(\d+)\s*(?:de\s+)?` + pat.replace(" ", "\s+"), "i");
        const qtyMatch = lower.match(qtyRegex);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        result.items.push({
          tipo: t.formal,
          cant: qty,
          det: result.motivo || t.formal
        });
        break;
      }
    }
  }

  // Fallback si no detectó ítems específicos
  if (!result.items.length) {
    result.items.push({
      tipo: "Topper",
      cant: 1,
      det: result.motivo || "General"
    });
  }

  return result;
};

window.parseAndFillExpressForm = function(text) {
  const parsed = window.parseOrderNaturalLanguage(text);

  const cliInput = document.getElementById("express-cliente");
  if (cliInput && parsed.cliente) cliInput.value = parsed.cliente;

  const fInput = document.getElementById("express-fecha-entrega");
  if (fInput && parsed.fechaEntrega) fInput.value = parsed.fechaEntrega;

  const hInput = document.getElementById("express-hora-entrega");
  if (hInput && parsed.entregaHora) hInput.value = parsed.entregaHora;

  // Llenar lista de ítems
  const list = document.getElementById("express-items-list");
  if (list && parsed.items.length > 0) {
    list.innerHTML = "";
    parsed.items.forEach(it => {
      const row = document.createElement("div");
      row.className = "subitem-row";
      row.innerHTML = `
        <input type="text" class="swal-item-tipo" value="${escapeHtml(it.tipo)}" required>
        <input type="number" class="swal-item-cant" value="${it.cantidad || 1}" min="1" style="text-align:center;">
        <input type="text" class="swal-item-det" value="${escapeHtml(it.detalles || '')}" placeholder="Detalles">
        <button type="button" class="subitem-del-btn" onclick="this.closest('.subitem-row').remove()">🗑️</button>
      `;
      list.appendChild(row);
    });
  }

  // Mostrar el AVISO DE CONFIRMACIÓN VISUAL EN PANTALLA
  const confirmBox = document.getElementById("express-visual-confirm");
  const confirmSummary = document.getElementById("express-confirm-summary");
  if (confirmBox && confirmSummary) {
    confirmBox.style.display = "block";
    confirmSummary.innerHTML = `
      <strong>Cliente:</strong> ${escapeHtml(parsed.cliente || 'Detectado')}<br/>
      <strong>Trabajos:</strong> ${parsed.items.map(it => `${it.cantidad}x ${it.tipo}`).join(", ")}<br/>
      <strong>Entrega:</strong> ${parsed.fechaEntrega} a las ${parsed.entregaHora}
    `;
  }
};

window.processVoiceTranscript = function(text) {
  const parsed = window.parseOrderNaturalLanguage(text);
  const confirmArea = document.getElementById("jj-bot-confirm-area");
  if (!confirmArea) return;

  confirmArea.innerHTML = `
    <div class="visual-confirm-box">
      <div class="visual-confirm-title"><i class="fas fa-check-circle"></i> ¡Todo lo que indicaste ya está listo para revisar!</div>
      <div style="font-size:12px; margin-bottom:8px; line-height:1.4;">
        👤 <strong>Cliente:</strong> ${escapeHtml(parsed.cliente || 'Cliente nuevo')}<br/>
        📦 <strong>Trabajos:</strong> ${parsed.items.map(it => `${it.cantidad}x ${it.tipo} ${it.detalles ? '('+it.detalles+')' : ''}`).join(', ')}<br/>
        📅 <strong>Entrega:</strong> ${parsed.fechaEntrega} a las ${parsed.entregaHora}
      </div>
      <div style="display:flex; gap:6px;">
        <button type="button" class="primary-button" style="padding:6px 10px; font-size:11px; background:#10b981;" onclick="confirmBotOrder(${JSON.stringify(parsed).replace(/"/g, '&quot;')})">
          💾 Guardar de Inmediato
        </button>
        <button type="button" class="secondary-button" style="padding:6px 10px; font-size:11px;" onclick="closeModal(); openExpressOrderModal(); setTimeout(() => parseAndFillExpressForm('${text.replace(/'/g, "\'")}'), 200);">
          ✏️ Ajustar en Pantalla
        </button>
      </div>
    </div>
  `;
};

window.confirmBotOrder = async function(parsed) {
  const subItems = parsed.items || [];
  const tipoResumen = subItems.map(s => `${s.cantidad}x ${s.tipo}`).join(" + ") || "Trabajo Dictado";

  const payload = {
    cliente: parsed.cliente || "Cliente Dictado",
    tipo: tipoResumen,
    motivo: parsed.motivo || "General",
    descripcion: `[DICTADO POR VOZ]:
${subItems.map((s, i) => `${i+1}. ${s.cantidad}x ${s.tipo} ${s.detalles ? '('+s.detalles+')' : ''}`).join('\n')}`,
    fechaEntrega: parsed.fechaEntrega,
    horaEntrega: parsed.entregaHora || "17:30",
    responsable: state.session?.name || "Sin asignar",
    diseno: "Sí",
    subItems: subItems
  };

  try {
    await api("profile_create_order", { form: payload });
    const confirmArea = document.getElementById("jj-bot-confirm-area");
    if (confirmArea) {
      confirmArea.innerHTML = `<div style="background:#dcfce7; color:#15803d; padding:10px; border-radius:8px; font-size:12px; font-weight:bold;">✅ ¡Pedido guardado exitosamente en el sistema!</div>`;
    }
    await refresh(false);
    showToast("¡Pedido guardado!");
  } catch(err) {
    alert(`Error: ${err.message}`);
  }
};

window.toggleJJBot = function() {
  const w = document.getElementById("jj-bot-window");
  if (w) w.classList.toggle("chat-hidden");
};

window.processBotMessage = function() {
  const input = document.getElementById("jj-bot-input");
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = "";
  window.processVoiceTranscript(text);
};

// =========================================================
// 6. COMMAND PALETTE SPOTLIGHT GLOBAL (Ctrl + K)
// =========================================================
let spotlightIndex = 0;

window.openSpotlight = function() {
  const overlay = document.getElementById("sics-spotlight-overlay");
  const input = document.getElementById("spotlight-search");
  if (!overlay || !input) return;

  overlay.classList.add("active");
  input.value = "";
  window.renderSpotlightList("");
  setTimeout(() => input.focus(), 80);
};

window.closeSpotlight = function() {
  const overlay = document.getElementById("sics-spotlight-overlay");
  if (overlay) overlay.classList.remove("active");
};

window.renderSpotlightList = function(query) {
  const listEl = document.getElementById("spotlight-list");
  if (!listEl) return;

  const q = String(query || "").toLowerCase().trim();
  spotlightIndex = 0;

  // Acciones Rápidas Disponibles
  const quickActions = [
    { title: "Crear Nuevo Pedido Completo", icon: "fa-plus-circle", action: () => { window.closeSpotlight(); formOrder(); } },
    { title: "Abrir Modo Mostrador Rápido", icon: "fa-bolt", action: () => { window.closeSpotlight(); openExpressOrderModal(); } },
    { title: "Ver Mi Bandeja de Órdenes", icon: "fa-inbox", action: () => { window.closeSpotlight(); navigate("queue"); } },
    { title: "Ver Casos y Estadísticas del Equipo", icon: "fa-users", action: () => { window.closeSpotlight(); navigate("team"); } },
    { title: "Consultar Historial de Proyectos", icon: "fa-archive", action: () => { window.closeSpotlight(); navigate("history"); } },
    { title: "Cambiar Tema (Oscuro / Claro)", icon: "fa-adjust", action: () => { window.closeSpotlight(); toggleTheme(); } },
    { title: "Ver Alertas y Monitoreo del Taller", icon: "fa-bell", action: () => { window.closeSpotlight(); document.getElementById("bellIconBtn")?.click(); } },
    { title: "Abrir Asistente JJ-Bot de Voz", icon: "fa-robot", action: () => { window.closeSpotlight(); window.toggleJJBot(); } }
  ];

  // Búsqueda en órdenes activas y clientes
  const matchingOrders = (state.data.allOrders || []).filter(o => 
    !q || o.id.toLowerCase().includes(q) || o.cliente.toLowerCase().includes(q) || o.tipo.toLowerCase().includes(q)
  ).slice(0, 5);

  let items = [];

  // Filtrar acciones
  quickActions.forEach(a => {
    if (!q || a.title.toLowerCase().includes(q)) {
      items.push({ type: "action", ...a });
    }
  });

  // Agregar órdenes encontradas
  matchingOrders.forEach(o => {
    items.push({
      type: "order",
      title: `${o.id} – ${o.cliente} (${o.tipo})`,
      icon: "fa-file-invoice",
      action: () => { window.closeSpotlight(); detail(o); }
    });
  });

  if (items.length === 0) {
    listEl.innerHTML = `<div style="padding:26px; text-align:center; color:var(--text-muted); font-size:13px;"><i class="fas fa-ghost" style="font-size:2rem; opacity:0.3; margin-bottom:8px;"></i><br/>No se encontraron resultados para "${escapeHtml(q)}".</div>`;
    return;
  }

  listEl.innerHTML = items.map((it, idx) => `
    <div class="spotlight-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
      <div class="s-icon"><i class="fas ${it.icon}"></i></div>
      <div class="s-title">${escapeHtml(it.title)}</div>
    </div>
  `).join("");

  listEl.querySelectorAll(".spotlight-item").forEach(el => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.idx, 10);
      if (items[idx] && items[idx].action) items[idx].action();
    });
  });

  window.spotlightCurrentItems = items;
};

// Eventos de teclado para Spotlight
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    window.openSpotlight();
  }
  const overlay = document.getElementById("sics-spotlight-overlay");
  if (e.key === "Escape" && overlay && overlay.classList.contains("active")) {
    window.closeSpotlight();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchToggleBtn");
  const overlay = document.getElementById("sics-spotlight-overlay");
  const input = document.getElementById("spotlight-search");

  if (searchBtn) searchBtn.addEventListener("click", window.openSpotlight);

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) window.closeSpotlight();
    });
  }

  if (input) {
    input.addEventListener("input", (e) => {
      window.renderSpotlightList(e.target.value);
    });

    input.addEventListener("keydown", (e) => {
      const listEl = document.getElementById("spotlight-list");
      if (!listEl) return;
      const itemsEls = listEl.querySelectorAll(".spotlight-item");
      if (itemsEls.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        itemsEls[spotlightIndex]?.classList.remove("selected");
        spotlightIndex = (spotlightIndex + 1) % itemsEls.length;
        itemsEls[spotlightIndex]?.classList.add("selected");
        itemsEls[spotlightIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        itemsEls[spotlightIndex]?.classList.remove("selected");
        spotlightIndex = (spotlightIndex - 1 + itemsEls.length) % itemsEls.length;
        itemsEls[spotlightIndex]?.classList.add("selected");
        itemsEls[spotlightIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (window.spotlightCurrentItems && window.spotlightCurrentItems[spotlightIndex]) {
          window.spotlightCurrentItems[spotlightIndex].action();
        }
      }
    });
  }
});

// =========================================================
// 7. CIERRE DE SESIÓN SEGURO CON SWEETALERT2
// =========================================================
window.doLogout = function() {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  if (window.Swal) {
    Swal.fire({
      title: "¿Cerrar Sesión?",
      text: "Tendrás que ingresar tu PIN para acceder nuevamente al sistema.",
      icon: "warning",
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f8fafc" : "#0f172a",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: isDark ? "#334155" : "#94a3b8",
      confirmButtonText: '<i class="fas fa-power-off"></i> Sí, salir',
      cancelButtonText: "Cancelar"
    }).then((res) => {
      if (res.isConfirmed) {
        store.remove("pp_profile_session");
        state.session = null;
        showLogin();
      }
    });
  } else {
    if (confirm("¿Deseas cerrar sesión?")) {
      store.remove("pp_profile_session");
      state.session = null;
      showLogin();
    }
  }
};


// =========================================================
// SICS 2026: NAVEGADOR GLOBAL ENTRE MÓDULOS Y FICHAS
// =========================================================
window.navigate = function(screenName) {
  if ((screenName === 'providers' || screenName === 'cash') && !isLead()) {
    showToast("🔒 Módulo exclusivo para Gerencia y Jefes.");
    state.screen = "modules";
  } else {
    state.screen = screenName || "modules";
  }
  state.searchQuery = "";
  if (typeof render === "function") render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};


window.toggleSubitemsSection = function() {
  const content = document.getElementById("subitems-content");
  const chevron = document.getElementById("subitems-chevron");
  if (content && chevron) {
    if (content.style.display === "none") {
      content.style.display = "block";
      chevron.classList.remove("fa-chevron-down");
      chevron.classList.add("fa-chevron-up");
    } else {
      content.style.display = "none";
      chevron.classList.remove("fa-chevron-up");
      chevron.classList.add("fa-chevron-down");
    }
  }
};

window.addStandardSubItem = function(tipo, cant, det) {
  const list = document.getElementById("subitems-form-list");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "subitem-row";
  row.innerHTML = `
    <input type="text" list="subitem-tipos-list" class="subitem-form-tipo" placeholder="Tipo" value="${escapeHtml(tipo)}">
    <input type="number" class="subitem-form-cant" value="${cant || 1}" min="1" placeholder="Cant." style="text-align:center;">
    <input type="text" class="subitem-form-det subitem-det-col" placeholder="Detalles / Medidas" value="${escapeHtml(det || '')}">
    <button type="button" class="subitem-del-btn" onclick="this.closest('.subitem-row').remove()">🗑️</button>
  `;
  list.appendChild(row);
};


// =========================================================================
// MÓDULO 1: PROVEEDORES Y CUENTAS POR PAGAR (EXCLUSIVO GERENCIA / JEFES)
// =========================================================================
function getStoredProvidersData() {
  const defaultProviders = [
    "Americas (Jorge José Ochoa Gómez)",
    "Blindac, C.A.",
    "Prodimarca (Manualidades y Artes)",
    "Inversiones Patiño, C.A.",
    "Huepa (Chocolates & Repostería)",
    "Mercal",
    "Makro",
    "Lider",
    "Central Madeirense",
    "Papeles Valencia",
    "Silicones Venezuela",
    "Artesanías Creativas",
    "Distribuidora de Repostería",
    "Chocolatería Artesanal"
  ];
  
  const defaultList = [
    {
      id: "PROV-11140",
      proveedor: "Americas (Jorge José Ochoa Gómez)",
      numeroNota: "11140",
      fechaEntrega: "2026-09-02",
      fechaVencimiento: "2026-09-09",
      moneda: "USD",
      montoTotal: 325.00,
      abonado: 100.00,
      saldoPendiente: 225.00,
      estado: "Vencida",
      tasaBCV: 798.33,
      fotos: [],
      abonos: [
        { fecha: "05/09/2026 10:30 AM", monto: 100.00, moneda: "USD", referencia: "Efectivo", registradoPor: "Moises" }
      ],
      notas: "Promoción Nata 1 Galon, Mantequilla Galon"
    },
    {
      id: "PROV-111764",
      proveedor: "Blindac, C.A.",
      numeroNota: "CD111764",
      fechaEntrega: "2026-09-07",
      fechaVencimiento: "2026-09-10",
      moneda: "USD",
      montoTotal: 15.45,
      abonado: 15.45,
      saldoPendiente: 0.00,
      estado: "Pagada",
      tasaBCV: 798.33,
      fotos: [],
      abonos: [
        { fecha: "10/09/2026 04:15 PM", monto: 15.45, moneda: "USD", referencia: "Transferencia Banesco", registradoPor: "Julieta" }
      ],
      notas: "Porta Carnet Negro Pointer y Azul Pointer"
    },
    {
      id: "PROV-162893",
      proveedor: "Prodimarca (Manualidades y Artes)",
      numeroNota: "00162893",
      fechaEntrega: "2026-09-01",
      fechaVencimiento: "2026-09-20",
      moneda: "USD",
      montoTotal: 245.40,
      abonado: 50.00,
      saldoPendiente: 195.40,
      estado: "Parcial",
      tasaBCV: 798.33,
      fotos: [],
      abonos: [
        { fecha: "08/09/2026 11:00 AM", monto: 50.00, moneda: "USD", referencia: "Pago Móvil", registradoPor: "Moises" }
      ],
      notas: "Cartulinas construcción college, silicón líquido y en barra"
    },
    {
      id: "PROV-36689",
      proveedor: "Inversiones Patiño, C.A.",
      numeroNota: "00036689",
      fechaEntrega: "2026-09-03",
      fechaVencimiento: "2026-09-23",
      moneda: "USD",
      montoTotal: 81.00,
      abonado: 0.00,
      saldoPendiente: 81.00,
      estado: "Pendiente",
      tasaBCV: 798.33,
      fotos: [],
      abonos: [],
      notas: "Crema Chantilly Sucream 1Lt x 12"
    },
    {
      id: "PROV-18503",
      proveedor: "Huepa (Chocolates & Repostería)",
      numeroNota: "00018503",
      fechaEntrega: "2026-09-09",
      fechaVencimiento: "2026-09-29",
      moneda: "USD",
      montoTotal: 92.28,
      abonado: 0.00,
      saldoPendiente: 92.28,
      estado: "Pendiente",
      tasaBCV: 798.33,
      fotos: [],
      abonos: [],
      notas: "Tina Maxiplas, Cuchara postre, Bolsas teta y casero"
    }
  ];
  return store.get("pp_provider_invoices", defaultList);
}

function saveStoredProvidersData(list) {
  store.set("pp_provider_invoices", list);
}

function getProviderList() {
  return store.get("pp_provider_list", [
    "Americas (Jorge José Ochoa Gómez)",
    "Blindac, C.A.",
    "Prodimarca (Manualidades y Artes)",
    "Inversiones Patiño, C.A.",
    "Huepa (Chocolates & Repostería)",
    "Mercal",
    "Makro",
    "Lider",
    "Central Madeirense",
    "Papeles Valencia",
    "Silicones Venezuela",
    "Artesanías Creativas",
    "Distribuidora de Repostería",
    "Chocolatería Artesanal"
  ]);
}

function saveProviderList(list) {
  store.set("pp_provider_list", list);
}

function providersView() {
  if (!isLead()) {
    return `<div style="text-align:center; padding:50px; color:#ef4444;"><h2>🔒 Acceso Restringido</h2><p>Este módulo es exclusivo para Gerencia y Jefes.</p></div>`;
  }

  const invoices = getStoredProvidersData();
  const currentTasa = parseFloat(store.get("pp_tasa_bcv", 798.33));

  // KPIs
  let totalDeudaUSD = 0;
  let totalAbonadoUSD = 0;
  let vencidasCount = 0;
  let proximasCount = 0;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  invoices.forEach(inv => {
    const saldo = Number(inv.saldoPendiente || 0);
    const monto = Number(inv.montoTotal || 0);
    const abon = Number(inv.abonado || 0);
    totalDeudaUSD += saldo;
    totalAbonadoUSD += abon;

    if (saldo > 0.01) {
      if (inv.fechaVencimiento && inv.fechaVencimiento < todayStr) {
        vencidasCount++;
      } else if (inv.fechaVencimiento) {
        const diffDays = Math.ceil((new Date(inv.fechaVencimiento) - now) / 86400000);
        if (diffDays >= 0 && diffDays <= 5) proximasCount++;
      }
    }
  });

  const totalDeudaBs = totalDeudaUSD * currentTasa;

  return `
    <div style="max-width:1150px; margin:0 auto; padding-bottom:40px;">
      <!-- Hero de Proveedores -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div>
          <h1 style="font-size:22px; margin:0 0 6px 0; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-truck-loading" style="color:#10b981;"></i> Proveedores &amp; Cuentas por Pagar
          </h1>
          <p style="font-size:12.5px; color:var(--text-muted); margin:0;">
            Control integral de notas de entrega, pagos fraccionados, tasa oficial BCV y alertas de vencimiento para los jefes.
          </p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <!-- Tasa BCV Editable -->
          <div style="background:var(--bg-card); border:1.5px solid #10b981; border-radius:10px; padding:6px 12px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; font-weight:800; color:#10b981;">TASA BCV (Bs/$):</span>
            <input type="number" id="current-bcv-input" value="${currentTasa.toFixed(2)}" step="0.01" style="width:75px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; padding:3px 6px; font-weight:bold; font-size:12px;" onchange="window.updateBCVRate(this.value)">
          </div>
          <button type="button" class="primary-button" onclick="window.openNewProviderInvoiceModal()" style="background:#10b981; border:none; padding:9px 16px; border-radius:8px; font-weight:800; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            <i class="fas fa-file-invoice-dollar"></i> + Nueva Nota de Entrega
          </button>
        </div>
      </div>

      <!-- Métricas Resumen -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:20px;">
        <div class="sics-metric-card" style="border-color:#10b981;">
          <div style="font-size:11px; font-weight:700; color:#10b981; text-transform:uppercase;">DEUDA TOTAL PENDIENTE</div>
          <div style="font-size:24px; font-weight:900; color:var(--text-main); margin:4px 0;">$${totalDeudaUSD.toFixed(2)}</div>
          <div style="font-size:11.5px; color:#38bdf8; font-weight:bold;">Bs. ${totalDeudaBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div class="sics-metric-card" style="border-color:${vencidasCount ? '#ef4444' : 'var(--border-color)'};">
          <div style="font-size:11px; font-weight:700; color:#ef4444; text-transform:uppercase;">NOTAS VENCIDAS</div>
          <div style="font-size:24px; font-weight:900; color:${vencidasCount ? '#ef4444' : 'var(--text-main)'}; margin:4px 0;">${vencidasCount}</div>
          <div style="font-size:11px; color:${vencidasCount ? '#ef4444' : 'var(--text-muted)'}; font-weight:bold;">${vencidasCount ? '⚠️ Requieren pago urgente' : 'Cero deudas vencidas'}</div>
        </div>

        <div class="sics-metric-card" style="border-color:${proximasCount ? '#f59e0b' : 'var(--border-color)'};">
          <div style="font-size:11px; font-weight:700; color:#f59e0b; text-transform:uppercase;">POR VENCER (5 DÍAS)</div>
          <div style="font-size:24px; font-weight:900; color:${proximasCount ? '#f59e0b' : 'var(--text-main)'}; margin:4px 0;">${proximasCount}</div>
          <div style="font-size:11px; color:var(--text-muted);">Organizar abonos para esta semana</div>
        </div>

        <div class="sics-metric-card">
          <div style="font-size:11px; font-weight:700; color:#38bdf8; text-transform:uppercase;">TOTAL ABONADO / PAGADO</div>
          <div style="font-size:24px; font-weight:900; color:#10b981; margin:4px 0;">$${totalAbonadoUSD.toFixed(2)}</div>
          <div style="font-size:11px; color:var(--text-muted);">Pagos cancelados a proveedores</div>
        </div>
      </div>

      <!-- Tabla de Notas de Entrega -->
      <div class="sics-table-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <div style="font-size:14px; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:8px;">
            <i class="fas fa-list-alt" style="color:#10b981;"></i> Registro de Notas de Entrega y Facturas
          </div>
          <div style="display:flex; gap:6px;">
            <input type="text" placeholder="🔍 Filtrar proveedor o nota..." oninput="window.filterProviderTable(this.value)" style="padding:5px 10px; font-size:12px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; width:200px;">
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="sics-data-table" id="table-provider-invoices">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>N° Nota / Factura</th>
                <th>Fecha Entrega</th>
                <th>Vence</th>
                <th style="text-align:right;">Total ($)</th>
                <th style="text-align:right;">Abonado ($)</th>
                <th style="text-align:right;">Saldo Deuda</th>
                <th style="text-align:center;">Estado</th>
                <th style="text-align:center;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => {
                const isOverdue = inv.fechaVencimiento && inv.fechaVencimiento < todayStr && inv.saldoPendiente > 0.01;
                const badgeClass = isOverdue ? 'prov-badge-overdue' : (inv.saldoPendiente <= 0.01 ? 'prov-badge-paid' : (inv.abonado > 0 ? 'prov-badge-partial' : 'prov-badge-pending'));
                const badgeText = isOverdue ? '⚠️ Vencida' : (inv.saldoPendiente <= 0.01 ? '✅ Pagada' : (inv.abonado > 0 ? '🟡 Abono Parcial' : '⏳ Pendiente'));
                const saldoBs = (inv.saldoPendiente * currentTasa).toLocaleString('es-VE', { maximumFractionDigits: 0 });

                return `
                  <tr data-prov-search="${escapeHtml((inv.proveedor + ' ' + inv.numeroNota).toLowerCase())}">
                    <td style="font-weight:700; color:var(--text-main);">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-building" style="color:#9ca3af; font-size:11px;"></i> ${escapeHtml(inv.proveedor)}
                      </div>
                      ${inv.notas ? `<div style="font-size:10.5px; color:var(--text-muted); font-weight:normal;">${escapeHtml(inv.notas)}</div>` : ''}
                    </td>
                    <td style="font-family:monospace; font-weight:bold; color:#38bdf8;">${escapeHtml(inv.numeroNota || 'S/N')}</td>
                    <td style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(inv.fechaEntrega)}</td>
                    <td style="font-size:11.5px; font-weight:bold; color:${isOverdue ? '#ef4444' : 'var(--text-main)'};">
                      ${escapeHtml(inv.fechaVencimiento || 'Inmediato')}
                    </td>
                    <td style="text-align:right; font-weight:bold;">$${Number(inv.montoTotal).toFixed(2)}</td>
                    <td style="text-align:right; color:#10b981; font-weight:bold;">$${Number(inv.abonado).toFixed(2)}</td>
                    <td style="text-align:right;">
                      <strong style="color:${inv.saldoPendiente > 0 ? '#ef4444' : '#10b981'}; font-size:13px;">$${Number(inv.saldoPendiente).toFixed(2)}</strong>
                      ${inv.saldoPendiente > 0 ? `<div style="font-size:10px; color:#38bdf8;">Bs. ${saldoBs}</div>` : ''}
                    </td>
                    <td style="text-align:center;">
                      <span class="${badgeClass}">${badgeText}</span>
                    </td>
                    <td style="text-align:center; white-space:nowrap;">
                      <button type="button" class="primary-button" onclick="window.openProviderInvoiceDetailModal('${escapeHtml(inv.id)}')" style="font-size:10.5px; padding:3px 8px; background:#0ea5e9; border:none; margin-right:4px;" title="Ver abonos y fotos">
                        👁️ Ver / Abonar
                      </button>
                      <button type="button" class="secondary-button" onclick="window.deleteProviderInvoice('${escapeHtml(inv.id)}')" style="font-size:10px; padding:3px 6px; color:#ef4444;" title="Eliminar nota">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

window.updateBCVRate = function(newRate) {
  const r = parseFloat(newRate);
  if (r > 0) {
    store.set("pp_tasa_bcv", r);
    showToast(`Tasa BCV actualizada a Bs. ${r.toFixed(2)}`);
    if (typeof render === "function") render();
  }
};

window.filterProviderTable = function(q) {
  const val = String(q || "").trim().toLowerCase();
  document.querySelectorAll('#table-provider-invoices tbody tr').forEach(tr => {
    const s = tr.getAttribute('data-prov-search') || "";
    tr.style.display = (!val || s.includes(val)) ? '' : 'none';
  });
};

window.openNewProviderInvoiceModal = function() {
  let uploadedPhotos = [];

  openModal(`
    <div class="modal-head">
      <div>
        <h2 style="margin:0; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-file-invoice-dollar" style="color:#10b981;"></i> Registrar Nota de Entrega de Proveedor
        </h2>
        <div style="font-size:12px; color:var(--text-muted);">Adjunta fotos de 1 a 3 páginas y programa el pago.</div>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>

    <form id="new-prov-invoice-form" class="form-grid" style="margin-top:12px;">
      <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px; padding:12px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <span style="font-size:12px; font-weight:bold; color:#10b981;">📷 OCR: Escanear Nota de Entrega (OPCIONAL)</span>
            <div style="font-size:10px; color:#6b7280; margin-top:2px;">⚠️ Puedes llenar todos los campos manualmente abajo sin escanear</div>
          </div>
          <button type="button" class="secondary-button" id="btn-ocr-prov" style="background:#10b981; color:white; border:none; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
            📸 Escanear Nota
          </button>
        </div>
        <div id="prov-ocr-preview" style="display:none; margin-top:8px; align-items:center; gap:8px;">
          <img id="prov-ocr-thumb" src="" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid #10b981;">
          <span style="font-size:11px; color:#10b981; font-weight:bold;">Nota escaneada ✓ (Puedes editar los campos)</span>
        </div>
      </div>

      <div style="background:rgba(59,130,246,0.1); border:1px solid #3b82f6; border-radius:8px; padding:12px; margin-bottom:16px;">
        <div style="font-size:11px; font-weight:bold; color:#3b82f6;">✏️ Entrada Manual</div>
        <div style="font-size:10px; color:#6b7280; margin-top:2px;">Completa los campos abajo para registrar una nota manualmente. Todos los campos son editables.</div>
      </div>

      <label class="field">
        <span class="field-label">PROVEEDOR:</span>
        <input type="text" id="prov-nombre" name="proveedor" list="prov-sugeridos" required placeholder="Ej. Americas, Blindac, Prodimarca, Patiño, Huepa...">
        <datalist id="prov-sugeridos">
          ${getProviderList().map(p => `<option value="${escapeHtml(p)}">`).join('')}
        </datalist>
      </label>

      <div class="form-inline" style="gap:8px;">
        <label class="field" style="flex:1;">
          <span class="field-label">N° NOTA / FACTURA:</span>
          <input type="text" id="prov-numero" name="numero" placeholder="Ej. 11140, CD111764, 00018503..." required>
        </label>
        <label class="field" style="flex:1;">
          <span class="field-label">FECHA DE ENTREGA:</span>
          <input type="date" id="prov-fecha-entrega" name="fechaEntrega" value="${new Date().toISOString().split('T')[0]}" required>
        </label>
        <label class="field" style="flex:1;">
          <span class="field-label">FECHA LÍMITE PAGO:</span>
          <input type="date" id="prov-fecha-vence" name="fechaVencimiento" value="${new Date(Date.now() + 15*86400000).toISOString().split('T')[0]}" required>
        </label>
      </div>

      <div class="form-inline" style="gap:8px;">
        <label class="field" style="flex:1;">
          <span class="field-label">MONEDA:</span>
          <select id="prov-moneda" name="moneda">
            <option value="USD" selected>Dólares ($ USD)</option>
            <option value="VES">Bolívares (Bs VES)</option>
          </select>
        </label>
        <label class="field" style="flex:1.5;">
          <span class="field-label">MONTO TOTAL:</span>
          <input type="number" id="prov-monto" name="monto" step="0.01" min="0.01" placeholder="0.00" required>
        </label>
      </div>

      <!-- Subida de Fotos de Múltiples Hojas -->
      <div class="physical-invoice-box" style="border-color:#10b981; margin-top:6px;">
        <div class="physical-invoice-header">
          <span style="font-size:11px; font-weight:800; color:#10b981; text-transform:uppercase;">
            📸 Hojas de la Nota de Entrega (1 a 3+ fotos):
          </span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="secondary-button" id="btn-add-prov-cam" style="background:#10b981; color:white; border:none; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
              📸 Tomar Foto
            </button>
            <label class="secondary-button" style="background:var(--bg-main); border:1px solid var(--border-color); padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
              📁 Subir Foto/PDF
              <input type="file" id="prov-file-input" accept="image/*,.pdf" multiple style="display:none;">
            </label>
          </div>
        </div>
        <div id="prov-photos-preview" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;"></div>
      </div>

      <label class="field">
        <span class="field-label">NOTAS / PRODUCTOS INCLUIDOS:</span>
        <textarea id="prov-notas" name="notas" rows="2" placeholder="Ej. Cartulinas, silicón, envases para postre..."></textarea>
      </label>

      <div class="modal-foot" style="margin-top:10px; display:flex; gap:8px;">
        <button type="button" class="secondary-button" data-action="close" style="flex:1;">Cancelar</button>
        <button type="submit" class="primary-button" style="flex:2; background:#10b981; border:none; font-weight:bold;">
          💾 Guardar Nota de Entrega
        </button>
      </div>
    </form>
  `);

  const previewBox = document.getElementById("prov-photos-preview");
  const fileInp = document.getElementById("prov-file-input");
  const camBtn = document.getElementById("btn-add-prov-cam");
  const ocrBtn = document.getElementById("btn-ocr-prov");

  // Handler para OCR de nota de proveedor
  if (ocrBtn) {
    ocrBtn.addEventListener("click", async () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const base64 = evt.target.result;
          try {
            showToast("🔍 Procesando nota con OCR...");
            const result = await transcribePhysicalSheet(base64, "invoice");
            
            if (result && result.montoTotal) {
              document.getElementById("prov-monto").value = result.montoTotal;
            }
            if (result && result.numeroNota) {
              document.getElementById("prov-numero").value = result.numeroNota;
            }
            if (result && result.proveedor) {
              document.getElementById("prov-nombre").value = result.proveedor;
            }
            
            // Mostrar preview
            document.getElementById("prov-ocr-thumb").src = base64;
            document.getElementById("prov-ocr-preview").style.display = "flex";
            
            if (result) {
              showToast("✅ Nota procesada. Campos llenados automáticamente. Puedes editarlos manualmente.");
            } else {
              showToast("⚠️ OCR no disponible. Llena los campos manualmente.");
            }
          } catch (err) {
            console.warn("Error OCR:", err);
            showToast("⚠️ OCR no disponible. Llena los campos manualmente.");
            // Mostrar preview aunque falle el OCR
            document.getElementById("prov-ocr-thumb").src = base64;
            document.getElementById("prov-ocr-preview").style.display = "flex";
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  const renderPhotoPreviews = () => {
    previewBox.innerHTML = uploadedPhotos.map((src, idx) => `
      <div style="position:relative; width:65px; height:65px; border-radius:6px; overflow:hidden; border:1px solid #10b981;">
        <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
        <button type="button" onclick="window._removeProvPhoto(${idx})" style="position:absolute; top:2px; right:2px; background:rgba(239,68,68,0.85); color:white; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
      </div>
    `).join('');
  };

  window._removeProvPhoto = (i) => {
    uploadedPhotos.splice(i, 1);
    renderPhotoPreviews();
  };

  if (fileInp) {
    fileInp.addEventListener("change", (e) => {
      Array.from(e.target.files).forEach(f => {
        const r = new FileReader();
        r.onload = (ev) => {
          uploadedPhotos.push(ev.target.result);
          renderPhotoPreviews();
        };
        r.readAsDataURL(f);
      });
    });
  }

  if (camBtn) {
    camBtn.addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.capture = "environment";
      inp.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => {
          uploadedPhotos.push(ev.target.result);
          renderPhotoPreviews();
        };
        r.readAsDataURL(f);
      };
      inp.click();
    });
  }

  const form = document.getElementById("new-prov-invoice-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const proveedor = document.getElementById("prov-nombre").value.trim();
      const numeroNota = document.getElementById("prov-numero").value.trim();
      const fechaEntrega = document.getElementById("prov-fecha-entrega").value;
      const fechaVencimiento = document.getElementById("prov-fecha-vence").value;
      const moneda = document.getElementById("prov-moneda").value;
      const montoTotal = parseFloat(document.getElementById("prov-monto").value);
      const notas = document.getElementById("prov-notas").value.trim();
      const tasaBCV = parseFloat(store.get("pp_tasa_bcv", 798.33));

      const newInv = {
        id: "PROV-" + Date.now(),
        proveedor: proveedor,
        numeroNota: numeroNota,
        fechaEntrega: fechaEntrega,
        fechaVencimiento: fechaVencimiento,
        moneda: moneda,
        montoTotal: montoTotal,
        abonado: 0.00,
        saldoPendiente: montoTotal,
        estado: "Pendiente",
        tasaBCV: tasaBCV,
        fotos: uploadedPhotos,
        abonos: [],
        notas: notas
      };

      const list = getStoredProvidersData();
      list.unshift(newInv);
      saveStoredProvidersData(list);

      // Intentar sincronizar con backend
      try {
        api("profile_save_provider_invoice", newInv).catch(()=>{});
      } catch(e){}

      showToast(`✅ Nota de ${proveedor} guardada.`);
      closeModal();
      if (typeof render === "function") render();
    });
  }
};

window.openProviderInvoiceDetailModal = function(id) {
  const list = getStoredProvidersData();
  const inv = list.find(i => String(i.id) === String(id));
  if (!inv) return;

  const tasaBCV = parseFloat(store.get("pp_tasa_bcv", 798.33));
  const saldoBs = (inv.saldoPendiente * tasaBCV).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalBs = (inv.montoTotal * tasaBCV).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  openModal(`
    <div class="modal-head">
      <div>
        <h2 style="margin:0; display:flex; align-items:center; gap:8px;">
          ${escapeHtml(inv.proveedor)}
        </h2>
        <div style="font-size:12px; color:var(--text-muted);">
          Nota N° <strong>${escapeHtml(inv.numeroNota)}</strong> | Recibido: ${escapeHtml(inv.fechaEntrega)} | Vence: <strong>${escapeHtml(inv.fechaVencimiento)}</strong>
        </div>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>

    <div style="background:rgba(0,0,0,0.25); border-radius:10px; padding:14px; margin:14px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <span style="font-size:11px; color:var(--text-muted); display:block;">MONTO ORIGINAL:</span>
          <strong style="font-size:16px; color:var(--text-main);">$${Number(inv.montoTotal).toFixed(2)}</strong>
          <span style="font-size:11px; color:#9ca3af;">(Bs. ${totalBs})</span>
        </div>
        <div>
          <span style="font-size:11px; color:var(--text-muted); display:block;">TOTAL ABONADO:</span>
          <strong style="font-size:16px; color:#10b981;">$${Number(inv.abonado).toFixed(2)}</strong>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px; color:#ef4444; font-weight:bold; display:block;">SALDO RESTANTE POR PAGAR:</span>
          <strong style="font-size:20px; color:#ef4444;">$${Number(inv.saldoPendiente).toFixed(2)}</strong>
          <div style="font-size:12px; color:#38bdf8; font-weight:bold;">Bs. ${saldoBs} (Tasa: ${tasaBCV})</div>
        </div>
      </div>
    </div>

    <!-- Fotos de la Nota Física -->
    ${inv.fotos && inv.fotos.length ? `
      <div style="margin-bottom:16px;">
        <span style="font-size:11.5px; font-weight:bold; color:var(--text-main); display:block; margin-bottom:6px;">
          📄 Hojas / Respaldo de la Nota (${inv.fotos.length}):
        </span>
        <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:6px;">
          ${inv.fotos.map((f, idx) => `
            <a href="${f}" target="_blank" title="Abrir imagen completa">
              <img src="${f}" style="width:90px; height:120px; object-fit:cover; border-radius:6px; border:1px solid #10b981;">
            </a>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Historial de Abonos -->
    <div style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:12.5px; font-weight:bold; color:var(--text-main);">Historial de Pagos y Abonos</span>
        ${inv.saldoPendiente > 0.01 ? `
          <button type="button" class="primary-button" onclick="window.openAddProviderPaymentModal('${escapeHtml(inv.id)}')" style="font-size:11px; padding:4px 10px; background:#10b981; border:none;">
            + Registrar Abono
          </button>
        ` : '<span style="color:#10b981; font-weight:bold; font-size:12px;">✅ NOTA TOTALMENTE PAGADA</span>'}
      </div>
      <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
        ${inv.abonos && inv.abonos.length ? `
          <table style="width:100%; font-size:11.5px; border-collapse:collapse;">
            <thead>
              <tr style="background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border-color); text-align:left;">
                <th style="padding:6px 10px;">Fecha</th>
                <th style="padding:6px 10px;">Monto</th>
                <th style="padding:6px 10px;">Método / Ref</th>
                <th style="padding:6px 10px;">Registrado Por</th>
                <th style="padding:6px 10px;">Editar</th>
              </tr>
            </thead>
            <tbody>
              ${inv.abonos.map((ab, idx) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                  <td style="padding:6px 10px; color:var(--text-muted);">${escapeHtml(ab.fecha)}</td>
                  <td style="padding:6px 10px; font-weight:bold; color:#10b981;">$${Number(ab.monto).toFixed(2)}</td>
                  <td style="padding:6px 10px;">${escapeHtml(ab.referencia || 'N/A')}</td>
                  <td style="padding:6px 10px; color:var(--text-muted);">${escapeHtml(ab.registradoPor || 'Gerencia')}</td>
                  <td style="padding:6px 10px;">
                    <button type="button" onclick="window.editProviderAbono('${escapeHtml(inv.id)}', ${idx})" style="background:#0ea5e9; color:white; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">✏️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div style="padding:14px; text-align:center; color:var(--text-muted); font-size:12px;">No se han registrado abonos previos a esta nota.</div>'}
      </div>
    </div>
  `);
};

window.openAddProviderPaymentModal = function(id) {
  const list = getStoredProvidersData();
  const inv = list.find(i => String(i.id) === String(id));
  if (!inv) return;

  Swal.fire({
    title: `Abonar a ${inv.proveedor}`,
    html: `
      <div style="text-align:left; font-size:12px;">
        <p style="margin:0 0 10px 0; color:#9ca3af;">Saldo pendiente: <strong style="color:#ef4444;">$${inv.saldoPendiente.toFixed(2)}</strong></p>
        <label style="display:block; margin-bottom:6px; font-weight:bold;">Monto a Abonar ($):</label>
        <input type="number" id="swal-abono-monto" class="swal2-input" step="0.01" max="${inv.saldoPendiente}" placeholder="0.00" style="margin:0 0 10px 0; width:100%; box-sizing:border-box;">
        <label style="display:block; margin-bottom:6px; font-weight:bold;">Método / Referencia:</label>
        <input type="text" id="swal-abono-ref" class="swal2-input" placeholder="Ej. Pago Móvil 5407 / Efectivo" style="margin:0; width:100%; box-sizing:border-box;">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Registrar Abono",
    confirmButtonColor: "#10b981",
    cancelButtonText: "Cancelar",
    preConfirm: () => {
      const m = parseFloat(document.getElementById("swal-abono-monto")?.value);
      const r = document.getElementById("swal-abono-ref")?.value.trim();
      if (isNaN(m) || m <= 0) {
        Swal.showValidationMessage("Ingresa un monto válido mayor a 0");
        return false;
      }
      return { monto: m, ref: r || "Efectivo" };
    }
  }).then(res => {
    if (res.isConfirmed && res.value) {
      const now = new Date();
      const abonoObj = {
        fecha: now.toLocaleDateString('es-VE') + ' ' + now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
        monto: res.value.monto,
        moneda: "USD",
        referencia: res.value.ref,
        registradoPor: state.session?.name || "Gerencia"
      };
      inv.abonos = inv.abonos || [];
      inv.abonos.push(abonoObj);
      inv.abonado = Number(inv.abonado || 0) + res.value.monto;
      inv.saldoPendiente = Math.max(0, Number(inv.montoTotal) - inv.abonado);
      inv.estado = inv.saldoPendiente <= 0.01 ? "Pagada" : "Parcial";

      saveStoredProvidersData(list);
      try {
        api("profile_add_provider_payment", { id: inv.id, monto: res.value.monto, referencia: res.value.ref }).catch(()=>{});
      } catch(e){}

      showToast(`✅ Abono de $${res.value.monto.toFixed(2)} registrado.`);
      closeModal();
      window.openProviderInvoiceDetailModal(inv.id);
      if (typeof render === "function") render();
    }
  });
};

window.deleteProviderInvoice = function(id) {
  if (!confirm("¿Seguro que deseas eliminar este registro de proveedor?")) return;
  let list = getStoredProvidersData();
  list = list.filter(i => String(i.id) !== String(id));
  saveStoredProvidersData(list);
  showToast("Nota de entrega eliminada.");
  if (typeof render === "function") render();
};


// =========================================================================
// MÓDULO 2: CIERRE DE CAJA POR TURNOS (PLANILLA FÍSICA CREACIONES JJ)
// =========================================================================
function getStoredCashCloses() {
  const defaultList = [
    {
      id: "CAJA-20260910-T1",
      fecha: "2026-09-10",
      turno: "Turno 1 (8:00 AM a 1:00 PM)",
      inicioBs: 300.00,
      inicioUSD: 3.00,
      totalPuntoBs: 3180.00,
      totalPagoMovilBs: 40.00,
      totalEfectivoBs: 1050.00,
      totalEfectivoUSD: 12.00,
      tasaBCV: 798.33,
      totalDiaBs: 4270.00,
      totalDiaUSD: 17.35,
      fotoRespaldo: "",
      responsable: "Moises",
      observaciones: "Turno de la mañana cuadrado con lote de punto."
    }
  ];
  return store.get("pp_cash_closes", defaultList);
}

function saveStoredCashCloses(list) {
  store.set("pp_cash_closes", list);
}

window.editCashClose = function(cashId) {
  const closes = getStoredCashCloses();
  const close = closes.find(c => c.id === cashId);
  if (!close) {
    alert("Cierre no encontrado");
    return;
  }
  
  // Modal de edición de cierre de caja
  openModal(`
    <div class="modal-head"><h2>✏️ Editar Cierre de Caja</h2><button class="close-button" data-action="close">×</button></div>
    <form id="edit-cash-form" class="form-grid">
      <div style="background:var(--bg-main); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:13px; margin-bottom:12px;">
        <div><strong>Fecha:</strong> ${escapeHtml(close.fecha)}</div>
        <div><strong>Turno:</strong> ${escapeHtml(close.turno)}</div>
        <div><strong>Responsable:</strong> ${escapeHtml(close.responsable || 'Gerencia')}</div>
      </div>
      
      <label class="field">
        <span class="field-label">Punto de Venta (Bs):</span>
        <input type="number" id="edit-punto-bs" value="${close.totalPuntoBs}" min="0" step="0.01" required style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
      </label>
      
      <label class="field">
        <span class="field-label">Pago Móvil (Bs):</span>
        <input type="number" id="edit-pago-movil-bs" value="${close.totalPagoMovilBs}" min="0" step="0.01" required style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
      </label>
      
      <label class="field">
        <span class="field-label">Efectivo (Bs):</span>
        <input type="number" id="edit-efectivo-bs" value="${close.totalEfectivoBs}" min="0" step="0.01" required style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
      </label>
      
      <label class="field">
        <span class="field-label">Efectivo ($):</span>
        <input type="number" id="edit-efectivo-usd" value="${close.totalEfectivoUSD}" min="0" step="0.01" required style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
      </label>
      
      <label class="field">
        <span class="field-label">Observaciones:</span>
        <textarea id="edit-observaciones" style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;" rows="2">${escapeHtml(close.observaciones || '')}</textarea>
      </label>
      
      <div class="modal-footer" style="margin-top:16px;">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">Guardar Cambios</button>
      </div>
    </form>
  `);
  
  document.getElementById("edit-cash-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const puntoBs = parseFloat(document.getElementById("edit-punto-bs").value);
    const pmBs = parseFloat(document.getElementById("edit-pago-movil-bs").value);
    const efBs = parseFloat(document.getElementById("edit-efectivo-bs").value);
    const efUSD = parseFloat(document.getElementById("edit-efectivo-usd").value);
    const obs = document.getElementById("edit-observaciones").value.trim();
    
    const tasa = parseFloat(store.get("pp_tasa_bcv", 798.33));
    const totalBs = puntoBs + pmBs + efBs;
    const totalUSD = (totalBs / tasa) + efUSD;
    
    // Actualizar el cierre
    close.totalPuntoBs = puntoBs;
    close.totalPagoMovilBs = pmBs;
    close.totalEfectivoBs = efBs;
    close.totalEfectivoUSD = efUSD;
    close.totalDiaBs = totalBs;
    close.totalDiaUSD = totalUSD;
    close.observaciones = obs;
    
    // Guardar cambios
    const updatedCloses = closes.map(c => c.id === cashId ? close : c);
    saveStoredCashCloses(updatedCloses);
    
    closeModal();
    showToast("✅ Cierre de caja actualizado exitosamente.");
    if (typeof render === "function") render();
  });
};

window.deleteCashClose = function(cashId) {
  if (!confirm("¿Estás seguro de que deseas eliminar este cierre de caja? Esta acción no se puede deshacer.")) {
    return;
  }
  
  const closes = getStoredCashCloses();
  const updatedCloses = closes.filter(c => c.id !== cashId);
  saveStoredCashCloses(updatedCloses);
  
  showToast("✅ Cierre de caja eliminado exitosamente.");
  if (typeof render === "function") render();
};

window.editProviderAbono = function(invoiceId, abonoIndex) {
  if (!isLead()) {
    alert("Solo gerencia puede editar abonos.");
    return;
  }
  
  const invoices = getStoredProvidersData();
  const invoice = invoices.find(inv => inv.id === invoiceId);
  if (!invoice || !invoice.abonos || !invoice.abonos[abonoIndex]) {
    alert("Abono no encontrado");
    return;
  }
  
  const abono = invoice.abonos[abonoIndex];
  
  openModal(`
    <div class="modal-head"><h2>✏️ Editar Abono</h2><button class="close-button" data-action="close">×</button></div>
    <form id="edit-abono-form" class="form-grid">
      <div style="background:var(--bg-main); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:13px; margin-bottom:12px;">
        <div><strong>Proveedor:</strong> ${escapeHtml(invoice.proveedor)}</div>
        <div><strong>Nota:</strong> ${escapeHtml(invoice.numeroNota)}</div>
        <div><strong>Abono actual:</strong> $${Number(abono.monto).toFixed(2)}</div>
      </div>
      
      <label class="field">
        <span class="field-label">Nuevo Monto ($):</span>
        <input type="number" id="edit-abono-monto" value="${abono.monto}" min="0" step="0.01" required style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
      </label>
      
      <label class="field">
        <span class="field-label">Referencia / Método:</span>
        <input type="text" id="edit-abono-referencia" value="${escapeHtml(abono.referencia || '')}" style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
      </label>
      
      <div class="modal-footer" style="margin-top:16px;">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">Guardar Cambios</button>
      </div>
    </form>
  `);
  
  document.getElementById("edit-abono-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevoMonto = parseFloat(document.getElementById("edit-abono-monto").value);
    const nuevaReferencia = document.getElementById("edit-abono-referencia").value.trim();
    
    try {
      await api("profile_edit_provider_payment", {
        invoiceId: invoiceId,
        abonoIndex: abonoIndex,
        monto: nuevoMonto,
        referencia: nuevaReferencia,
        user: state.session?.name || state.session?.nombre || 'Gerencia'
      });
      
      closeModal();
      await refresh(false);
      showToast("✅ Abono editado exitosamente.");
    } catch (err) {
      alert("Error al editar abono: " + err.message);
    }
  });
};

function cashView() {
  if (!isLead()) {
    return `<div style="text-align:center; padding:50px; color:#ef4444;"><h2>🔒 Acceso Restringido</h2><p>Este módulo es exclusivo para Gerencia y Jefes.</p></div>`;
  }

  const closes = getStoredCashCloses();
  const currentTasa = parseFloat(store.get("pp_tasa_bcv", 798.33));

  return `
    <div style="max-width:1100px; margin:0 auto; padding-bottom:40px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div>
          <h1 style="font-size:22px; margin:0 0 6px 0; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-cash-register" style="color:#f59e0b;"></i> Cierre de Caja &amp; Arqueo Diario
          </h1>
          <p style="font-size:12.5px; color:var(--text-muted); margin:0;">
            Transcribe los cierres de turno (1:00 PM y 8:00 PM) basados en la planilla física de Creaciones JJ para el contador fiscal.
          </p>
        </div>
        <button type="button" class="primary-button" onclick="window.openNewCashCloseModal()" style="background:#f59e0b; color:white; border:none; padding:9px 16px; border-radius:8px; font-weight:800; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
          <i class="fas fa-plus-circle"></i> + Nuevo Cierre de Turno
        </button>
      </div>

      <!-- Historial de Cierres -->
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${closes.map(c => `
          <div class="cash-shift-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
              <div>
                <span style="font-size:11px; font-weight:bold; color:#f59e0b; text-transform:uppercase;">
                  <i class="fas fa-clock"></i> ${escapeHtml(c.turno)}
                </span>
                <h3 style="margin:2px 0 0 0; font-size:16px; color:var(--text-main);">Fecha: ${escapeHtml(c.fecha)}</h3>
                <div style="font-size:11.5px; color:var(--text-muted);">Elaborado por: <strong>${escapeHtml(c.responsable || 'Gerencia')}</strong> | Fondo inicial: <strong>Bs. ${c.inicioBs} / $${c.inicioUSD}</strong></div>
              </div>
              <div style="text-align:right;">
                <span style="font-size:11px; color:var(--text-muted); display:block;">TOTAL EN BS:</span>
                <strong style="font-size:18px; color:#10b981;">Bs. ${Number(c.totalDiaBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                <div style="font-size:12px; font-weight:bold; color:#38bdf8;">Total USD: $${Number(c.totalDiaUSD).toFixed(2)}</div>
                <div style="margin-top:8px; display:flex; gap:6px; justify-content:flex-end;">
                  <button type="button" onclick="window.editCashClose('${escapeHtml(c.id)}')" style="background:#0ea5e9; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">✏️ Editar</button>
                  <button type="button" onclick="window.deleteCashClose('${escapeHtml(c.id)}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">🗑️ Eliminar</button>
                </div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; background:rgba(0,0,0,0.2); border-radius:8px; padding:10px;">
              <div>
                <span style="font-size:10.5px; color:var(--text-muted); display:block;">💳 PUNTO DE VENTA:</span>
                <strong style="color:var(--text-main); font-size:13px;">Bs. ${Number(c.totalPuntoBs).toLocaleString('es-VE')}</strong>
              </div>
              <div>
                <span style="font-size:10.5px; color:var(--text-muted); display:block;">📲 PAGO MÓVIL:</span>
                <strong style="color:var(--text-main); font-size:13px;">Bs. ${Number(c.totalPagoMovilBs).toLocaleString('es-VE')}</strong>
              </div>
              <div>
                <span style="font-size:10.5px; color:var(--text-muted); display:block;">💵 EFECTIVO BS:</span>
                <strong style="color:var(--text-main); font-size:13px;">Bs. ${Number(c.totalEfectivoBs).toLocaleString('es-VE')}</strong>
              </div>
              <div>
                <span style="font-size:10.5px; color:var(--text-muted); display:block;">💵 EFECTIVO $:</span>
                <strong style="color:#10b981; font-size:13px;">$${Number(c.totalEfectivoUSD).toFixed(2)}</strong>
              </div>
            </div>

            ${c.fotoRespaldo ? `
              <div style="margin-top:10px;">
                <a href="${c.fotoRespaldo}" target="_blank" style="font-size:11px; color:#38bdf8; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                  <i class="fas fa-image"></i> Ver Foto de la Hoja Física de Cierre
                </a>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.openNewCashCloseModal = function() {
  let photoRespaldoBase64 = "";

  openModal(`
    <div class="modal-head">
      <div>
        <h2 style="margin:0; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-cash-register" style="color:#f59e0b;"></i> Nuevo Cierre de Turno / Caja
        </h2>
        <div style="font-size:12px; color:var(--text-muted);">Basado en la planilla física de Creaciones JJ.</div>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>

    <form id="cash-close-form" class="form-grid" style="margin-top:12px;">
      <div class="form-inline" style="gap:8px;">
        <label class="field" style="flex:1;">
          <span class="field-label">FECHA:</span>
          <input type="date" id="caja-fecha" value="${new Date().toISOString().split('T')[0]}" required>
        </label>
        <label class="field" style="flex:1.5;">
          <span class="field-label">TURNO:</span>
          <select id="caja-turno">
            <option value="Turno 1 (8:00 AM a 1:00 PM)">Turno 1 (Mediodía - 1:00 PM)</option>
            <option value="Turno 2 (3:00 PM a 8:00 PM)">Turno 2 (Noche - 8:00 PM)</option>
            <option value="Cierre Completo del Día">Cierre Consolidado del Día</option>
          </select>
        </label>
      </div>

      <div class="form-inline" style="gap:8px;">
        <label class="field" style="flex:1;">
          <span class="field-label">INICIO BS EN CAJA:</span>
          <input type="number" id="caja-inicio-bs" value="300.00" step="0.01">
        </label>
        <label class="field" style="flex:1;">
          <span class="field-label">INICIO $ EN CAJA:</span>
          <input type="number" id="caja-inicio-usd" value="3.00" step="0.01">
        </label>
      </div>

      <!-- 1. PUNTO DE VENTA -->
      <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:10px; margin-bottom:6px;">
        <span style="font-size:11px; font-weight:800; color:#38bdf8; text-transform:uppercase; display:block; margin-bottom:6px;">
          💳 Punto de Venta (Total Lote en Bs):
        </span>
        <input type="number" id="caja-punto-bs" placeholder="Total cobrado en punto (Bs)" step="0.01" value="0.00" oninput="window.calcCashTotals()">
      </div>

      <!-- 2. PAGO MÓVIL CON REFERENCIA -->
      <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:10px; margin-bottom:6px;">
        <span style="font-size:11px; font-weight:800; color:#a78bfa; text-transform:uppercase; display:block; margin-bottom:6px;">
          📲 Pago Móvil (Monto Bs y Referencias):
        </span>
        <div class="form-inline" style="gap:8px;">
          <input type="number" id="caja-pagomovil-bs" placeholder="Monto total Pago Móvil (Bs)" step="0.01" value="0.00" oninput="window.calcCashTotals()" style="flex:1;">
          <input type="text" id="caja-pagomovil-ref" placeholder="Últimos 4 dígitos / Ref (ej: 5407, 8812)" style="flex:1.5;">
        </div>
      </div>

      <!-- 3. EFECTIVOS -->
      <div class="form-inline" style="gap:8px;">
        <label class="field" style="flex:1;">
          <span class="field-label">💵 EFECTIVO BOLÍVARES (Bs):</span>
          <input type="number" id="caja-efectivo-bs" step="0.01" value="0.00" oninput="window.calcCashTotals()">
        </label>
        <label class="field" style="flex:1;">
          <span class="field-label">💵 EFECTIVO DÓLARES ($):</span>
          <input type="number" id="caja-efectivo-usd" step="0.01" value="0.00" oninput="window.calcCashTotals()">
        </label>
      </div>

      <!-- TOTAL CALCULADO -->
      <div class="cash-total-banner">
        <div>
          <span style="font-size:11px; font-weight:bold; color:var(--text-muted); text-transform:uppercase;">TOTAL DEL TURNO EN BS:</span>
          <div id="caja-total-preview-bs" style="font-size:22px; font-weight:900; color:#10b981;">Bs. 0,00</div>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px; font-weight:bold; color:var(--text-muted); text-transform:uppercase;">TOTAL USD (A TASA BCV):</span>
          <div id="caja-total-preview-usd" style="font-size:18px; font-weight:900; color:#38bdf8;">$0.00</div>
        </div>
      </div>

      <!-- FOTO RESPALDO PLANILLA FÍSICA -->
      <div class="physical-invoice-box" style="margin-top:6px;">
        <div class="physical-invoice-header">
          <span style="font-size:11px; font-weight:800; color:#f59e0b; text-transform:uppercase;">
            📸 Foto de la Planilla Física de Cierre (Auditoría):
          </span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="secondary-button" id="btn-cam-caja" style="background:#f59e0b; color:white; border:none; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
              📸 Tomar Foto
            </button>
            <label class="secondary-button" style="background:var(--bg-main); border:1px solid var(--border-color); padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">
              📁 Subir Foto
              <input type="file" id="caja-file-input" accept="image/*" style="display:none;">
            </label>
          </div>
        </div>
        <div id="caja-photo-preview" style="display:none; margin-top:8px; align-items:center; gap:8px;">
          <img id="caja-thumb-img" src="" style="width:70px; height:70px; object-fit:cover; border-radius:6px; border:1px solid #f59e0b;">
          <span style="font-size:11.5px; color:#10b981; font-weight:bold;">Planilla física adjunta correctamente.</span>
        </div>
      </div>

      <label class="field">
        <span class="field-label">OBSERVACIONES DEL TURNO:</span>
        <input type="text" id="caja-obs" placeholder="Ej. Cuadrado con recibos y efectivo en gaveta">
      </label>

      <div class="modal-foot" style="margin-top:10px; display:flex; gap:8px;">
        <button type="button" class="secondary-button" data-action="close" style="flex:1;">Cancelar</button>
        <button type="submit" class="primary-button" style="flex:2; background:#f59e0b; border:none; font-weight:bold;">
          💾 Guardar Cierre de Caja
        </button>
      </div>
    </form>
  `);

  window.calcCashTotals = function() {
    const pto = parseFloat(document.getElementById("caja-punto-bs")?.value || 0);
    const pm = parseFloat(document.getElementById("caja-pagomovil-bs")?.value || 0);
    const efBs = parseFloat(document.getElementById("caja-efectivo-bs")?.value || 0);
    const efUSD = parseFloat(document.getElementById("caja-efectivo-usd")?.value || 0);
    const tasa = parseFloat(store.get("pp_tasa_bcv", 798.33));

    const totalBs = pto + pm + efBs;
    const totalUSD = (totalBs / (tasa || 1)) + efUSD;

    const elBs = document.getElementById("caja-total-preview-bs");
    const elUSD = document.getElementById("caja-total-preview-usd");
    if (elBs) elBs.textContent = `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
    if (elUSD) elUSD.textContent = `$${totalUSD.toFixed(2)}`;
  };
  window.calcCashTotals();

  const fileInp = document.getElementById("caja-file-input");
  const camBtn = document.getElementById("btn-cam-caja");
  const pBox = document.getElementById("caja-photo-preview");
  const pImg = document.getElementById("caja-thumb-img");

  if (fileInp) {
    fileInp.addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        photoRespaldoBase64 = ev.target.result;
        pImg.src = photoRespaldoBase64;
        pBox.style.display = "flex";
        if (typeof triggerOcrForCashClose === "function") {
          triggerOcrForCashClose(photoRespaldoBase64);
        }
      };
      r.readAsDataURL(f);
    });
  }

  if (camBtn) {
    camBtn.addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.capture = "environment";
      inp.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => {
          photoRespaldoBase64 = ev.target.result;
          pImg.src = photoRespaldoBase64;
          pBox.style.display = "flex";
          if (typeof window.triggerOcrForCashClose === "function") {
            window.triggerOcrForCashClose(photoRespaldoBase64);
          }
        };
        r.readAsDataURL(f);
      };
      inp.click();
    });
  }

  const form = document.getElementById("cash-close-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fecha = document.getElementById("caja-fecha").value;
      const turno = document.getElementById("caja-turno").value;
      const inicioBs = parseFloat(document.getElementById("caja-inicio-bs").value || 0);
      const inicioUSD = parseFloat(document.getElementById("caja-inicio-usd").value || 0);
      const pto = parseFloat(document.getElementById("caja-punto-bs").value || 0);
      const pm = parseFloat(document.getElementById("caja-pagomovil-bs").value || 0);
      const pmRef = document.getElementById("caja-pagomovil-ref").value.trim();
      const efBs = parseFloat(document.getElementById("caja-efectivo-bs").value || 0);
      const efUSD = parseFloat(document.getElementById("caja-efectivo-usd").value || 0);
      const obs = document.getElementById("caja-obs").value.trim();
      const tasa = parseFloat(store.get("pp_tasa_bcv", 798.33));

      const totalBs = pto + pm + efBs;
      const totalUSD = (totalBs / (tasa || 1)) + efUSD;

      const newClose = {
        id: "CAJA-" + Date.now(),
        fecha: fecha,
        turno: turno,
        inicioBs: inicioBs,
        inicioUSD: inicioUSD,
        totalPuntoBs: pto,
        totalPagoMovilBs: pm,
        totalEfectivoBs: efBs,
        totalEfectivoUSD: efUSD,
        tasaBCV: tasa,
        totalDiaBs: totalBs,
        totalDiaUSD: totalUSD,
        detalles: { pmRef: pmRef },
        fotoRespaldo: photoRespaldoBase64,
        responsable: state.session?.name || "Gerencia",
        observaciones: obs
      };

      const list = getStoredCashCloses();
      list.unshift(newClose);
      saveStoredCashCloses(list);

      try {
        api("profile_save_cash_close", newClose).catch(()=>{});
      } catch(e){}

      showToast("✅ Cierre de caja registrado exitosamente.");
      closeModal();
      if (typeof render === "function") render();
    });
  }
};


// =========================================================================
// MÓDULO 3: MINI INVENTARIO Y LISTA DE COMPRAS
// =========================================================================
function getStoredInventory() {
  // PRIORIDAD: Backend primero (como pedidos), cache local como backup solo si backend falla
  if (state.data?.inventory && state.data.inventory.length > 0) {
    // Normalizar campos del backend para coincidir con frontend
    const normalizedInventory = state.data.inventory.map(item => ({
      id: item.id,
      producto: item.producto,
      categoria: item.categoria,
      stockActual: item.stockActual,
      estado: item.estado,
      precioUSD: item.precioEstimadoUSD || item.precioUSD || 0,
      proveedor: item.proveedorHabitual || item.proedor || "",
      notas: item.notas
    }));
    
    // Actualizar cache local como backup (pero no como fuente primaria)
    store.set("pp_inventory_items", normalizedInventory);
    return normalizedInventory;
  }
  
  // Si no hay datos del backend, usar cache local como backup temporal
  const cachedItems = store.get("pp_inventory_items", null);
  if (cachedItems && cachedItems.length > 0) {
    console.log("Usando cache local de inventario como backup (backend no tiene datos)");
    return cachedItems;
  }
  
  // Si no hay datos en ninguno, retornar array vacío
  return [];
}

function saveStoredInventory(list) {
  store.set("pp_inventory_items", list);
  // También guardar en el backend para sincronización
  api("profile_save_inventory_list", { items: list }).catch(() => {});
}

// =========================================================================
// MÓDULO DE PRECIOS Y MEDIDAS DEL TALLER (SOLO GERENCIA)
// =========================================================================
function getWorkshopPrices() {
  return state.data?.workshopPrices || [];
}

function workshopPricesView() {
  const prices = getWorkshopPrices();
  const isManager = isLead();
  
  return `
    <div style="max-width:1150px; margin:0 auto; padding-bottom:40px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div>
          <h2 style="margin:0; font-size:20px; color:var(--text-main);">💰 Precios y Medidas del Taller</h2>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-muted);">
            Información de referencia para presupuestos y especificaciones técnicas
          </p>
        </div>
        ${isManager ? `
          <button type="button" class="primary-button" onclick="window.openAddWorkshopPriceModal()" style="background:#10b981; border:none; padding:8px 14px; font-size:11.5px;">
            ➕ Agregar Precio/Medida
          </button>
        ` : ''}
      </div>

      <div style="overflow-x:auto;">
        <table class="sics-data-table">
          <thead>
            <tr>
              <th>Item / Servicio</th>
              <th>Categoría</th>
              <th>Precio USD</th>
              <th>Medidas</th>
              <th>Notas</th>
              <th>Actualizado Por</th>
              ${isManager ? '<th>Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${prices.length ? prices.map(p => `
              <tr>
                <td style="font-weight:bold; color:var(--text-main);">${escapeHtml(p.item)}</td>
                <td style="color:var(--text-muted);">${escapeHtml(p.categoria)}</td>
                <td style="text-align:right; font-weight:bold; color:#10b981;">${p.precioUSD > 0 ? '$' + Number(p.precioUSD).toFixed(2) : '-'}</td>
                <td style="color:var(--text-main);">${escapeHtml(p.medidas || '-')}</td>
                <td style="color:var(--text-muted); font-size:11px;">${escapeHtml(p.notas || '-')}</td>
                <td style="color:#38bdf8; font-size:11px;">${escapeHtml(p.actualizadoPor || 'N/A')}</td>
                ${isManager ? `
                  <td>
                    <button type="button" class="secondary-button" onclick="window.editWorkshopPrice('${escapeHtml(p.id)}')" style="padding:4px 8px; font-size:10px;">
                      ✏️ Editar
                    </button>
                    <button type="button" class="secondary-button" onclick="window.deleteWorkshopPrice('${escapeHtml(p.id)}')" style="padding:4px 8px; font-size:10px; background:#ef4444; color:white; border:none;">
                      🗑️
                    </button>
                  </td>
                ` : ''}
              </tr>
            `).join('') : '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">No hay precios/medidas registrados. Solo gerencia puede agregar información.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openAddWorkshopPriceModal = function() {
  openModal(`
    <div class="modal-head"><h2>Agregar Precio/Medida del Taller</h2><button class="close-button" data-action="close">×</button></div>
    <form id="workshop-price-form" class="form-grid">
      <label class="field"><span class="field-label">ITEM / SERVICIO:</span>
        <input type="text" name="item" required placeholder="Ej: Topper 30cm, DTF Camisa Adulto M" style="max-width:100%;">
      </label>
      <label class="field"><span class="field-label">CATEGORÍA:</span>
        <select name="categoria" style="max-width:100%;">
          <option value="Topper">Topper</option>
          <option value="DTF">DTF</option>
          <option value="Piñata">Piñata</option>
          <option value="Maqueta">Maqueta</option>
          <option value="Banderín">Banderín</option>
          <option value="Caja Explosiva">Caja Explosiva</option>
          <option value="General">General</option>
        </select>
      </label>
      <label class="field"><span class="field-label">PRECIO USD (OPCIONAL):</span>
        <input type="number" name="precioUSD" step="0.01" placeholder="0.00" style="max-width:100%;">
      </label>
      <label class="field"><span class="field-label">MEDIDAS / ESPECIFICACIONES:</span>
        <input type="text" name="medidas" placeholder="Ej: 30x30cm, 35x45cm" style="max-width:100%;">
      </label>
      <label class="field"><span class="field-label">NOTAS ADICIONALES:</span>
        <textarea name="notas" placeholder="Ej: Incluye base, material recomendado..." style="max-width:100%;"></textarea>
      </label>
      <button type="submit" class="primary-button">💾 Guardar Precio/Medida</button>
    </form>
  `);

  $("#workshop-price-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "⏳ Guardando...";

    try {
      await api("profile_save_workshop_price", {
        item: e.target.item.value.trim(),
        categoria: e.target.categoria.value,
        precioUSD: Number(e.target.precioUSD.value || 0),
        medidas: e.target.medidas.value.trim(),
        notas: e.target.notas.value.trim(),
        actualizadoPor: state.session?.name || "Gerencia"
      });
      closeModal();
      await refresh(false);
      showToast("✅ Precio/medida agregado exitosamente.");
    } catch (err) {
      alert(`Error: ${err.message}`);
      btn.disabled = false;
      btn.textContent = "💾 Guardar Precio/Medida";
    }
  });
};

window.editWorkshopPrice = function(id) {
  const prices = getWorkshopPrices();
  const price = prices.find(p => p.id === id);
  if (!price) return;

  openModal(`
    <div class="modal-head"><h2>Editar Precio/Medida</h2><button class="close-button" data-action="close">×</button></div>
    <form id="workshop-price-form" class="form-grid">
      <input type="hidden" name="id" value="${escapeHtml(price.id)}">
      <label class="field"><span class="field-label">ITEM / SERVICIO:</span>
        <input type="text" name="item" required value="${escapeHtml(price.item)}" style="max-width:100%;">
      </label>
      <label class="field"><span class="field-label">CATEGORÍA:</span>
        <select name="categoria" style="max-width:100%;">
          <option value="Topper" ${price.categoria === 'Topper' ? 'selected' : ''}>Topper</option>
          <option value="DTF" ${price.categoria === 'DTF' ? 'selected' : ''}>DTF</option>
          <option value="Piñata" ${price.categoria === 'Piñata' ? 'selected' : ''}>Piñata</option>
          <option value="Maqueta" ${price.categoria === 'Maqueta' ? 'selected' : ''}>Maqueta</option>
          <option value="Banderín" ${price.categoria === 'Banderín' ? 'selected' : ''}>Banderín</option>
          <option value="Caja Explosiva" ${price.categoria === 'Caja Explosiva' ? 'selected' : ''}>Caja Explosiva</option>
          <option value="General" ${price.categoria === 'General' ? 'selected' : ''}>General</option>
        </select>
      </label>
      <label class="field"><span class="field-label">PRECIO USD (OPCIONAL):</span>
        <input type="number" name="precioUSD" step="0.01" value="${price.precioUSD}" style="max-width:100%;">
      </label>
      <label class="field"><span class="field-label">MEDIDAS / ESPECIFICACIONES:</span>
        <input type="text" name="medidas" value="${escapeHtml(price.medidas)}" style="max-width:100%;">
      </label>
      <label class="field"><span class="field-label">NOTAS ADICIONALES:</span>
        <textarea name="notas" style="max-width:100%;">${escapeHtml(price.notas)}</textarea>
      </label>
      <button type="submit" class="primary-button">💾 Actualizar Precio/Medida</button>
    </form>
  `);

  $("#workshop-price-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "⏳ Actualizando...";

    try {
      await api("profile_save_workshop_price", {
        id: e.target.id.value,
        item: e.target.item.value.trim(),
        categoria: e.target.categoria.value,
        precioUSD: Number(e.target.precioUSD.value || 0),
        medidas: e.target.medidas.value.trim(),
        notas: e.target.notas.value.trim(),
        actualizadoPor: state.session?.name || "Gerencia"
      });
      closeModal();
      await refresh(false);
      showToast("✅ Precio/medida actualizado exitosamente.");
    } catch (err) {
      alert(`Error: ${err.message}`);
      btn.disabled = false;
      btn.textContent = "💾 Actualizar Precio/Medida";
    }
  });
};

window.deleteWorkshopPrice = function(id) {
  if (!confirm("¿Estás seguro de eliminar este precio/medida?")) return;
  
  // Marcar como eliminado vaciando los campos
  const prices = getWorkshopPrices();
  const price = prices.find(p => p.id === id);
  if (!price) return;

  api("profile_save_workshop_price", {
    id: id,
    item: price.item,
    categoria: price.categoria,
    precioUSD: 0,
    medidas: "",
    notas: "ELIMINADO",
    actualizadoPor: state.session?.name || "Gerencia"
  }).then(() => {
    refresh(false);
    showToast("🗑️ Precio/medida eliminado.");
  }).catch(err => {
    alert(`Error: ${err.message}`);
  });
};

function inventoryView() {
  const items = getStoredInventory();
  const currentTab = state.inventoryTab || 'catalog'; // 'catalog' | 'shopping_list'
  const outItems = items.filter(i => i.estado === 'Agotado' || i.estado === 'Bajo Stock');

  return `
    <div style="max-width:1150px; margin:0 auto; padding-bottom:40px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div>
          <h1 style="font-size:22px; margin:0 0 6px 0; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-boxes" style="color:#06b6d4;"></i> Mini Inventario &amp; Control de Insumos
          </h1>
          <p style="font-size:12.5px; color:var(--text-muted); margin:0;">
            Control de materiales del taller, alertas de agotados y lista para compras mensuales a proveedores.
          </p>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="secondary-button" onclick="window.setInventoryTab('${currentTab === 'catalog' ? 'shopping_list' : 'catalog'}')" style="background:${currentTab === 'shopping_list' ? '#06b6d4; color:white;' : 'var(--bg-card)'}; font-weight:bold; font-size:12px; padding:8px 14px;">
            <i class="fas fa-clipboard-list"></i> ${currentTab === 'shopping_list' ? 'Ver Catálogo Completo' : `📋 Lista de Compras (${outItems.length})`}
          </button>
          <button type="button" class="primary-button" onclick="window.openNewInventoryModal()" style="background:#06b6d4; border:none; padding:8px 14px; font-size:12px; font-weight:bold;">
            + Nuevo Insumo
          </button>
        </div>
      </div>

      ${currentTab === 'shopping_list' ? `
        <!-- VISTA DE LISTA DE COMPRAS PARA PROVEEDORES -->
        <div class="sics-table-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="margin:0; font-size:16px; color:#06b6d4;">📋 Lista de Compras Mensual (${outItems.length} insumos requeridos)</h3>
              <div style="font-size:11.5px; color:var(--text-muted);">Artículos agotados o con bajo stock en el taller.</div>
            </div>
            <button type="button" class="primary-button" onclick="window.copyShoppingListWhatsApp()" style="background:#25d366; border:none; padding:8px 16px; font-weight:bold; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
              <i class="fab fa-whatsapp"></i> Copiar Lista para WhatsApp
            </button>
          </div>

          <div style="overflow-x:auto;">
            <table class="sics-data-table">
              <thead>
                <tr>
                  <th>Insumo / Producto</th>
                  <th>Categoría</th>
                  <th>Estado Actual</th>
                  <th>Proveedor Habitual</th>
                  <th style="text-align:right;">Precio Estimado</th>
                </tr>
              </thead>
              <tbody>
                ${outItems.length ? outItems.map(i => `
                  <tr>
                    <td style="font-weight:bold; color:var(--text-main);">${escapeHtml(i.producto)}</td>
                    <td style="color:var(--text-muted);">${escapeHtml(i.categoria)}</td>
                    <td>
                      <span style="padding:2px 8px; border-radius:10px; font-size:10.5px; font-weight:bold; background:${i.estado === 'Agotado' ? 'rgba(239,68,68,0.2); color:#ef4444;' : 'rgba(245,158,11,0.2); color:#f59e0b;'}">
                        ${escapeHtml(i.estado)}
                      </span>
                    </td>
                    <td style="color:#38bdf8; font-weight:bold;">${escapeHtml(i.proveedor || 'Sin asignar')}</td>
                    <td style="text-align:right; font-weight:bold; color:#10b981;">$${Number(i.precioUSD).toFixed(2)}</td>
                  </tr>
                `).join('') : '<tr><td colspan="5" style="text-align:center; padding:20px; color:#10b981;">🎉 ¡Todos los insumos están abastecidos! No hay faltantes.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      ` : `
        <!-- CATÁLOGO DE INSUMOS (GRID) -->
        <div class="inventory-grid">
          ${items.map(item => {
            const isOut = item.estado === 'Agotado';
            const isLow = item.estado === 'Bajo Stock';
            const cardClass = isOut ? 'inventory-card is-out' : (isLow ? 'inventory-card is-low' : 'inventory-card');
            const badgeBg = isOut ? 'rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.4);' : (isLow ? 'rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4);' : 'rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4);');

            return `
              <div class="${cardClass}">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <span style="font-size:10px; font-weight:800; color:#38bdf8; text-transform:uppercase;">${escapeHtml(item.categoria)}</span>
                    <button type="button" onclick="window.cycleInventoryStatus('${escapeHtml(item.id)}')" style="border-radius:12px; padding:2px 8px; font-size:10px; font-weight:800; cursor:pointer; background:${badgeBg}">
                      ${escapeHtml(item.estado)}
                    </button>
                  </div>
                  <h3 style="margin:0 0 4px 0; font-size:14px; color:var(--text-main);">${escapeHtml(item.producto)}</h3>
                  <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">
                    Stock: <strong>${escapeHtml(item.stockActual || 'N/A')}</strong>
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px; font-size:11.5px; gap:6px;">
                  <span style="color:#9ca3af;"><i class="fas fa-truck" style="font-size:10px;"></i> ${escapeHtml(item.proveedor || 'Proveedor')}</span>
                  <span style="display:flex; align-items:center; gap:8px;">
                    <strong style="color:#10b981;">$${Number(item.precioUSD).toFixed(2)}</strong>
                    <button type="button" title="Editar insumo (stock, precio, proveedor)" onclick="window.editInventoryItem('${escapeHtml(item.id)}')" style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.4); color:#38bdf8; border-radius:6px; padding:2px 7px; cursor:pointer; font-size:11px;">✏️</button>
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

window.setInventoryTab = function(tab) {
  state.inventoryTab = tab;
  if (typeof render === "function") render();
};

window.setReportsViewType = function(type) {
  state.reportsViewType = type;
  if (typeof render === "function") render();
  // Restaurar estado colapsado después de renderizar
  setTimeout(() => {
    if (state.reportOrdersCollapsed) {
      const list = document.getElementById('report-orders-list');
      const icon = document.getElementById('report-collapse-icon');
      const text = document.getElementById('report-collapse-text');
      if (list) list.style.display = 'none';
      if (icon) icon.className = 'fas fa-chevron-up';
      if (text) text.textContent = 'Mostrar lista';
    }
  }, 0);
};

window.setFinancesPeriod = function(period) {
  state.financesDateFilter = period;
  if (typeof render === "function") render();
};

window.updateOrderMonto = async function(orderId, monto) {
  try {
    await api("profile_update_order", { id: orderId, changes: { montoPedido: Number(monto) } });
    showToast("✅ Monto actualizado correctamente.");
    await refresh(false);
  } catch (err) {
    showToast("❌ Error al actualizar monto: " + err.message);
  }
};

window.setReportsDateFilter = function(filter) {
  state.reportsDateFilter = filter;
  if (typeof render === "function") render();
};

window.setCustomDateFrom = function(date) {
  state.reportsDateFrom = date;
};

window.setCustomDateTo = function(date) {
  state.reportsDateTo = date;
};

window.applyCustomDateFilter = function() {
  state.reportsDateFilter = 'custom';
  if (typeof render === "function") render();
};

window.toggleReportOrdersCollapse = function() {
  state.reportOrdersCollapsed = !state.reportOrdersCollapsed;
  const list = document.getElementById('report-orders-list');
  const icon = document.getElementById('report-collapse-icon');
  const text = document.getElementById('report-collapse-text');
  
  if (list) {
    list.style.display = state.reportOrdersCollapsed ? 'none' : 'block';
  }
  if (icon) {
    icon.className = state.reportOrdersCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
  }
  if (text) {
    text.textContent = state.reportOrdersCollapsed ? 'Mostrar lista' : 'Ocultar lista';
  }
};

window.forzarActualizacionGlobal = function() {
  console.log("forzarActualizacionGlobal llamado");
  // Ejecutar directamente la lógica de force-update
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:10000;';
  modal.innerHTML = `
    <div style="background:var(--bg-card); border-radius:12px; padding:24px; max-width:400px; box-shadow:0 10px 40px rgba(0,0,0,0.4);">
      <h3 style="margin:0 0 12px 0; color:#ef4444; font-size:18px;">
        <i class="fas fa-rocket"></i> Forzar Actualización Global
      </h3>
      <p style="margin:0 0 16px 0; color:var(--text-main); font-size:14px; line-height:1.5;">
        ¿Deseas forzar la actualización inmediata en todas las sesiones y teléfonos activos del taller?
      </p>
      <p style="margin:0 0 20px 0; color:var(--text-muted); font-size:12px; line-height:1.4;">
        <strong>⚠️ Todos los dispositivos del equipo recargarán automáticamente la versión más reciente.</strong><br>
        Los trabajadores verán una notificación y sus pantallas se actualizarán.
      </p>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button id="cancel-force-update" style="padding:8px 16px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-main); cursor:pointer; font-size:13px;">
          Cancelar
        </button>
        <button id="confirm-force-update" style="padding:8px 16px; border-radius:6px; border:none; background:#ef4444; color:white; cursor:pointer; font-size:13px; font-weight:bold;">
          <i class="fas fa-check"></i> Confirmar Actualización
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  console.log("Modal de force-update agregado al DOM");
  
  document.getElementById('cancel-force-update').onclick = () => {
    document.body.removeChild(modal);
    showToast("⏸️ Actualización cancelada por el usuario.");
  };
  
  document.getElementById('confirm-force-update').onclick = async () => {
    document.body.removeChild(modal);
    showToast("🔄 Iniciando actualización global del equipo...");
    try {
      const newVer = "v_" + Date.now();
      await api("profile_force_update", { version: newVer });
      store.set("pp_app_version", newVer);
      showToast("✅ Orden de actualización global enviada a todo el equipo exitosamente.");
      showToast("📱 Los dispositivos del equipo recargarán automáticamente.");
      await refresh(false);
    } catch (err) { 
      showToast("❌ Error al forzar actualización: " + err.message);
      alert(`Error al forzar actualización: ${err.message}`); 
    }
  };
};

window.printReport = function() {
  const allOrders = state.data?.allOrders || [];
  const finishedOrders = state.data?.finishedOrders || [];
  const currentFilter = state.reportsDateFilter || 'month';
  
  // Filtrar por fecha
  const filterByPeriod = (orderList) => {
    const now = new Date();
    return orderList.filter(o => {
      const rawDate = o.fechaCierre || o.entrega || o.creado || "";
      const d = safeParseDate(rawDate);
      if (!d) return true;
      if (currentFilter === 'today') {
        return d.toDateString() === now.toDateString();
      } else if (currentFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
        return d >= oneWeekAgo && d <= now;
      } else if (currentFilter === 'month') {
        return (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) ||
               String(rawDate).includes("-09-") || String(rawDate).includes("/09/") || String(rawDate).includes("/9/");
      } else if (currentFilter === 'last_month') {
        const lastM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === lastM && d.getFullYear() === lastY;
      } else if (currentFilter === 'custom') {
        const from = state.reportsDateFrom ? safeParseDate(state.reportsDateFrom) : null;
        const to = state.reportsDateTo ? safeParseDate(state.reportsDateTo) : null;
        if (from && d < from) return false;
        if (to) {
          const toEnd = new Date(to.getTime());
          toEnd.setHours(23, 59, 59, 999);
          if (d > toEnd) return false;
        }
        return from || to;
      }
      return true;
    });
  };
  
  const periodFinishedOrders = filterByPeriod(finishedOrders);
  
  // Calcular estadísticas por trabajador
  const workerStats = {};
  periodFinishedOrders.forEach(o => {
    const resp = String(o.responsable || "").trim();
    if (!workerStats[resp]) {
      workerStats[resp] = { count: 0, totalMin: 0 };
    }
    workerStats[resp].count++;
    workerStats[resp].totalMin += Number(o.duracionRealMin || 0);
  });
  
  // Generar contenido HTML para imprimir
  const printContent = `
    <html>
    <head>
      <title>Reporte de Pedidos Completados - Creaciones JJ</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 15px; color: #333; font-size: 11px; background: #fff; }
        h1 { text-align: center; color: #1e40af; margin: 0 0 5px 0; font-size: 16px; }
        h2 { text-align: center; color: #6b7280; font-size: 12px; margin: 0 0 15px 0; }
        .logo-container { text-align: center; margin-bottom: 15px; }
        .logo-text { font-size: 24px; font-weight: bold; color: #1e40af; letter-spacing: 2px; }
        .logo-sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
        th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; }
        th { background-color: #f3f4f6; font-weight: bold; font-size: 9px; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .summary { background-color: #eff6ff; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 10px; }
        .summary-item { display: inline-block; margin-right: 20px; }
        .summary-label { font-weight: bold; color: #1e40af; }
        .summary-value { color: #6b7280; }
        .worker-summary { margin-top: 15px; background-color: #fef3c7; padding: 10px; border-radius: 6px; }
        .worker-item { display: inline-block; margin-right: 25px; }
        .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #9ca3af; }
        @media print { body { padding: 5px; } }
      </style>
    </head>
    <body>
      <div class="logo-container">
        <div class="logo-text">CREACIONES JJ</div>
        <div class="logo-sub">Ochoa & Risquez · Taller</div>
      </div>
      <h1>Reporte de Pedidos Completados</h1>
      <h2>Creaciones JJ Ochoa & Risquez · Taller</h2>
      
      <div class="summary">
        <div class="summary-item">
          <span class="summary-label">Total:</span>
          <span class="summary-value">${periodFinishedOrders.length}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Fecha:</span>
          <span class="summary-value">${new Date().toLocaleDateString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Filtro:</span>
          <span class="summary-value">${currentFilter === 'month' ? 'Este mes' : currentFilter === 'today' ? 'Hoy' : currentFilter === 'week' ? 'Esta semana' : currentFilter === 'custom' ? 'Personalizado' : 'Todo el historial'}</span>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 12%;">ID</th>
            <th style="width: 20%;">Cliente</th>
            <th style="width: 15%;">Responsable</th>
            <th style="width: 13%;">Fecha Cierre</th>
            <th style="width: 10%;">Tiempo</th>
            <th style="width: 10%;">Estado</th>
            <th style="width: 20%;">Tipo</th>
          </tr>
        </thead>
        <tbody>
          ${periodFinishedOrders.map(o => `
            <tr>
              <td>${escapeHtml(o.id)}</td>
              <td>${escapeHtml(o.cliente)}</td>
              <td>${escapeHtml(o.responsable)}</td>
              <td>${escapeHtml(formatDate(o.fechaCierre))}</td>
              <td>${o.duracionRealMin || 0} min</td>
              <td>${escapeHtml(o.estado)}</td>
              <td>${escapeHtml(o.tipo)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="worker-summary">
        <strong>Resumen por Trabajador:</strong><br><br>
        ${Object.entries(workerStats).map(([worker, stats]) => `
          <div class="worker-item">
            <span class="summary-label">${escapeHtml(worker)}:</span>
            <span class="summary-value">${stats.count} pedidos, ${stats.totalMin} min (${Math.round(stats.totalMin / 60)}h)</span>
          </div>
        `).join('')}
      </div>
      
      <div class="footer">
        Reporte generado automáticamente por Creaciones JJ - Sistema de Gestión de Producción
      </div>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.print();
};

window.toggleUserStatus = async function(userName, currentActive) {
  try {
    await api("profile_toggle_user", { name: userName, active: !currentActive });
    await refresh(false);
    showToast(`Usuario ${!currentActive ? 'activado' : 'desactivado'} exitosamente.`);
  } catch (err) {
    alert(`Error al cambiar estado: ${err.message}`);
  }
};

window.saveGeminiApiKey = function() {
  const input = document.getElementById("gemini-api-key-input");
  const apiKey = input?.value.trim();
  
  if (!apiKey) {
    showToast("⚠️ Ingresa una API Key válida");
    return;
  }
  
  store.set("pp_gemini_api_key", apiKey);
  showToast("✅ API Key de Gemini guardada. El OCR debería funcionar ahora.");
};

window.openReportIssueModal = function() {
  Swal.fire({
    title: "🐛 Reportar Problema al Sistema",
    html: `
      <div style="text-align:left; font-size:12px; line-height:1.5;">
        <p style="margin-bottom:12px;">Si encuentras algún error, bug o comportamiento inesperado en el sistema, por favor repórtalo para que podamos corregirlo:</p>
        <label style="display:block; margin-bottom:6px; font-weight:bold;">¿Qué problema experimentas?</label>
        <textarea id="issue-description" class="swal2-input" rows="3" placeholder="Describe el problema detalladamente..."></textarea>
        
        <label style="display:block; margin-top:12px; margin-bottom:6px; font-weight:bold;">¿En qué sección del sistema ocurre?</label>
        <select id="issue-section" class="swal2-input">
          <option value="">Selecciona una sección...</option>
          <option value="login">Inicio de sesión</option>
          <option value="pedidos">Gestión de pedidos</option>
          <option value="mostrador">Mostrador Rápido</option>
          <option value="inventario">Inventario</option>
          <option value="caja">Cierre de Caja</option>
          <option value="proveedores">Proveedores</option>
          <option value="reportes">Reportes</option>
          <option value="general">General / Otro</option>
        </select>
        
        <label style="display:block; margin-top:12px; margin-bottom:6px; font-weight:bold;">Captura de pantalla (opcional):</label>
        <input type="file" id="issue-screenshot" class="swal2-file" accept="image/*">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "📤 Enviar Reporte",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#ef4444",
    preConfirm: async () => {
      const description = document.getElementById("issue-description")?.value.trim();
      const section = document.getElementById("issue-section")?.value;
      const fileInput = document.getElementById("issue-screenshot");
      
      if (!description) {
        Swal.showValidationMessage("Por favor describe el problema");
        return false;
      }
      
      let screenshotBase64 = "";
      if (fileInput && fileInput.files[0]) {
        screenshotBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(fileInput.files[0]);
        });
      }
      
      try {
        await api("profile_create_suggestion", {
          comentario: `[${section || 'General'}] ${description}`,
          fotoBase64: screenshotBase64
        });
        return true;
      } catch (err) {
        Swal.showValidationMessage("Error al enviar: " + err.message);
        return false;
      }
    }
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "✅ Reporte Enviado",
        text: "Gracias por ayudarnos a mejorar el sistema. Gerencia revisará tu reporte.",
        icon: "success",
        confirmButtonColor: "#10b981"
      });
    }
  });
};

window.cycleInventoryStatus = function(id) {
  const list = getStoredInventory();
  const it = list.find(i => String(i.id) === String(id));
  if (!it) return;
  if (it.estado === "Disponible") it.estado = "Bajo Stock";
  else if (it.estado === "Bajo Stock") it.estado = "Agotado";
  else it.estado = "Disponible";

  saveStoredInventory(list);

  // Sincronizar con backend
  api("profile_save_inventory_item", {
    id: it.id,
    producto: it.producto,
    categoria: it.categoria,
    stockActual: it.stockActual,
    estado: it.estado,
    precioEstimadoUSD: it.precioUSD,
    proveedorHabitual: it.proveedor,
    notas: it.notas
  }).catch(() => {});

  showToast(`${it.producto}: ${it.estado}`);
  if (typeof render === "function") render();
};

window.editInventoryItem = function(id) {
  const list = getStoredInventory();
  const idx = list.findIndex(i => String(i.id) === String(id));
  if (idx === -1) return;
  const it = list[idx];

  // Separar cantidad y unidad del texto actual (ej. "5 unidades" -> 5, "unidades")
  const m = String(it.stockActual || "").match(/^([\d.,]+)\s*(.*)$/);
  const curQty = m ? parseFloat(m[1].replace(",", ".")) : 0;
  const curUnit = (m && m[2]) ? m[2] : "unidades";

  Swal.fire({
    title: "✏️ Editar Insumo",
    html: `
      <div style="text-align:left; font-size:12px;">
        <label style="display:block; margin-bottom:4px; font-weight:bold;">Producto:</label>
        <input type="text" id="swal-inv-e-nombre" class="swal2-input" value="${escapeHtml(it.producto)}" style="margin:0 0 8px 0; width:100%; box-sizing:border-box;">
        <div style="display:flex; gap:8px;">
          <div style="flex:1;">
            <label style="display:block; margin-bottom:4px; font-weight:bold;">Cantidad en Stock:</label>
            <input type="number" id="swal-inv-e-cant" class="swal2-input" step="any" min="0" value="${curQty}" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div style="flex:1.2;">
            <label style="display:block; margin-bottom:4px; font-weight:bold;">Unidad:</label>
            <input type="text" id="swal-inv-e-unidad" class="swal2-input" value="${escapeHtml(curUnit)}" placeholder="unidades, pliegos, cajas..." style="margin:0; width:100%; box-sizing:border-box;">
          </div>
        </div>
        <label style="display:block; margin:8px 0 4px 0; font-weight:bold;">Estado:</label>
        <select id="swal-inv-e-estado" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;">
          <option value="auto" ${it.estado ? '' : 'selected'}>Automático según cantidad</option>
          <option value="Disponible" ${it.estado === 'Disponible' ? 'selected' : ''}>Disponible</option>
          <option value="Bajo Stock" ${it.estado === 'Bajo Stock' ? 'selected' : ''}>Bajo Stock</option>
          <option value="Agotado" ${it.estado === 'Agotado' ? 'selected' : ''}>Agotado</option>
        </select>
        <label style="display:block; margin:8px 0 4px 0; font-weight:bold;">Precio Estimado ($ USD):</label>
        <input type="number" id="swal-inv-e-precio" class="swal2-input" step="0.01" min="0" value="${Number(it.precioUSD || 0).toFixed(2)}" style="margin:0; width:100%; box-sizing:border-box;">
        <label style="display:block; margin:8px 0 4px 0; font-weight:bold;">Proveedor Habitual:</label>
        <input type="text" id="swal-inv-e-prov" class="swal2-input" value="${escapeHtml(it.proveedor || '')}" style="margin:0; width:100%; box-sizing:border-box;">
        <label style="display:block; margin:8px 0 4px 0; font-weight:bold;">Categoría:</label>
        <input type="text" id="swal-inv-e-cat" class="swal2-input" value="${escapeHtml(it.categoria || 'General')}" style="margin:0; width:100%; box-sizing:border-box;">
        <label style="display:block; margin:8px 0 4px 0; font-weight:bold;">Notas:</label>
        <input type="text" id="swal-inv-e-notas" class="swal2-input" value="${escapeHtml(it.notas || '')}" placeholder="Ej. Urgente, pedir caja..." style="margin:0; width:100%; box-sizing:border-box;">
      </div>
    `,
    showCancelButton: true,
    showDenyButton: true,
    denyButtonText: "🗑️ Eliminar",
    denyButtonColor: "#ef4444",
    confirmButtonText: "💾 Guardar Cambios",
    confirmButtonColor: "#06b6d4",
    cancelButtonText: "Cancelar",
    focusConfirm: false,
    preConfirm: () => {
      const nombre = document.getElementById("swal-inv-e-nombre")?.value.trim();
      const qtyRaw = document.getElementById("swal-inv-e-cant")?.value;
      const qty = parseFloat(String(qtyRaw || "0").replace(",", "."));
      if (!nombre) {
        Swal.showValidationMessage("El nombre del insumo es obligatorio");
        return false;
      }
      if (isNaN(qty) || qty < 0) {
        Swal.showValidationMessage("La cantidad debe ser un número mayor o igual a 0");
        return false;
      }
      return {
        producto: nombre,
        qty: qty,
        unit: (document.getElementById("swal-inv-e-unidad")?.value.trim() || "unidades"),
        estadoSel: document.getElementById("swal-inv-e-estado")?.value || "auto",
        precioUSD: parseFloat(document.getElementById("swal-inv-e-precio")?.value || 0),
        proveedor: (document.getElementById("swal-inv-e-prov")?.value.trim() || "Proveedor"),
        categoria: (document.getElementById("swal-inv-e-cat")?.value.trim() || "General"),
        notas: (document.getElementById("swal-inv-e-notas")?.value.trim() || "")
      };
    }
  }).then(res => {
    if (res.isDenied) {
      Swal.fire({
        title: `¿Eliminar "${it.producto}"?`,
        text: "Esta acción no se puede deshacer.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        confirmButtonColor: "#ef4444",
        cancelButtonText: "Cancelar"
      }).then(d => {
        if (d.isConfirmed) {
          list.splice(idx, 1);
          saveStoredInventory(list);
          // Sincronizar con backend
          api("profile_save_inventory_item", { id: it.id, producto: it.producto, stockActual: "", estado: "Eliminado" }).catch(()=>{});
          showToast(`🗑️ "${it.producto}" eliminado del inventario.`);
          if (typeof render === "function") render();
        }
      });
      return;
    }
    if (res.isConfirmed && res.value) {
      const v = res.value;
      let estado;
      if (v.estadoSel === "auto") {
        estado = (v.qty <= 0) ? "Agotado" : (v.qty <= 2 ? "Bajo Stock" : "Disponible");
      } else {
        estado = v.estadoSel;
      }
      it.producto = v.producto;
      it.stockActual = `${v.qty} ${v.unit}`;
      it.estado = estado;
      it.precioUSD = v.precioUSD;
      it.proveedor = v.proveedor;
      it.categoria = v.categoria;
      it.notas = v.notas;
      saveStoredInventory(list);
      
      // Sincronizar con backend
      api("profile_save_inventory_item", {
        id: it.id,
        producto: it.producto,
        categoria: it.categoria,
        stockActual: it.stockActual,
        estado: it.estado,
        precioEstimadoUSD: it.precioUSD,
        proveedorHabitual: it.proveedor,
        notas: it.notas
      }).catch(() => {});
      
      showToast(`✅ "${it.producto}" actualizado: ${it.stockActual} · ${estado}`);
      if (typeof render === "function") render();
    }
  });
};

window.openNewInventoryModal = function() {
  Swal.fire({
    title: "Nuevo Insumo de Taller",
    html: `
      <div style="text-align:left; font-size:12px;">
        <label style="display:block; margin-bottom:4px; font-weight:bold;">Nombre del Insumo / Material:</label>
        <input type="text" id="swal-inv-nombre" class="swal2-input" placeholder="Ej. Silicón frío 250cc, Vinil dorado" style="margin:0 0 8px 0; width:100%; box-sizing:border-box;">
        <label style="display:block; margin-bottom:4px; font-weight:bold;">Categoría:</label>
        <input type="text" id="swal-inv-cat" class="swal2-input" placeholder="Ej. Pegamentos, Papelería, Sublimación" value="Papelería" style="margin:0 0 8px 0; width:100%; box-sizing:border-box;">
        <label style="display:block; margin-bottom:4px; font-weight:bold;">Proveedor Habitual:</label>
        <input type="text" id="swal-inv-prov" class="swal2-input" placeholder="Ej. Prodimarca, Blindac, Americas" style="margin:0 0 8px 0; width:100%; box-sizing:border-box;">
        <label style="display:block; margin-bottom:4px; font-weight:bold;">Precio Estimado ($ USD):</label>
        <input type="number" id="swal-inv-precio" class="swal2-input" step="0.01" placeholder="0.00" value="1.00" style="margin:0; width:100%; box-sizing:border-box;">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Guardar Insumo",
    confirmButtonColor: "#06b6d4",
    cancelButtonText: "Cancelar",
    preConfirm: () => {
      const n = document.getElementById("swal-inv-nombre")?.value.trim();
      const c = document.getElementById("swal-inv-cat")?.value.trim() || "General";
      const p = document.getElementById("swal-inv-prov")?.value.trim() || "Proveedor";
      const pr = parseFloat(document.getElementById("swal-inv-precio")?.value || 0);
      if (!n) {
        Swal.showValidationMessage("El nombre del insumo es obligatorio");
        return false;
      }
      return { producto: n, categoria: c, proveedor: p, precioUSD: pr };
    }
  }).then(res => {
    if (res.isConfirmed && res.value) {
      const list = getStoredInventory();
      const newItem = {
        id: "INV-" + Date.now(),
        producto: res.value.producto,
        categoria: res.value.categoria,
        stockActual: "1 unidad",
        estado: "Disponible",
        precioUSD: res.value.precioUSD,
        proveedor: res.value.proveedor,
        notas: ""
      };
      list.push(newItem);
      saveStoredInventory(list);

      // Sincronizar con backend
      api("profile_save_inventory_item", {
        id: newItem.id,
        producto: newItem.producto,
        categoria: newItem.categoria,
        stockActual: newItem.stockActual,
        estado: newItem.estado,
        precioEstimadoUSD: newItem.precioUSD,
        proveedorHabitual: newItem.proveedor,
        notas: newItem.notas
      }).catch(() => {});

      showToast(`✅ Insumo "${res.value.producto}" añadido.`);
      if (typeof render === "function") render();
    }
  });
};

window.copyShoppingListWhatsApp = function() {
  const items = getStoredInventory().filter(i => i.estado === 'Agotado' || i.estado === 'Bajo Stock');
  if (!items.length) {
    showToast("No hay insumos faltantes para pedir.");
    return;
  }
  let text = `📦 *LISTA DE COMPRAS - CREACIONES JJ* 🎨\n`;
  text += `Fecha: ${new Date().toLocaleDateString('es-VE')}\n\n`;
  items.forEach(it => {
    text += `▪️ *${it.producto}* (${it.categoria}) - ${it.estado}\n   Proveedor: ${it.proveedor || 'General'} | Ref: $${it.precioUSD.toFixed(2)}\n`;
  });
  text += `\n_Generado automáticamente desde el Sistema Creaciones JJ._`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("📋 ¡Lista de compras copiada al portapapeles para WhatsApp!");
    });
  } else {
    alert(text);
  }
};


/* =========================================================
   SISTEMA DE AUTOGESTIÓN DE PIN Y OCR DE FOTOS CON GEMINI IA
   CREACIONES JJ · OCHOA & RISQUEZ
   ========================================================= */

// 1. MODAL DE CAMBIO DE PIN / CONTRASEÑA
window.openChangePinModal = function() {
  const currentUserName = state.session?.name || state.session?.nombre || "Usuario";
  
  openModal(`
    <div class="modal-head">
      <div>
        <h2 style="margin:0; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-key" style="color:#38bdf8;"></i> Cambiar Mi PIN Personal
        </h2>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
          Actualiza tu clave de acceso para <strong>${escapeHtml(currentUserName)}</strong>
        </div>
      </div>
      <button class="close-button" data-action="close">×</button>
    </div>

    <form id="change-pin-form" class="form-grid" style="margin-top:14px;">
      <div style="background:rgba(56,189,248,0.08); border-left:4px solid #38bdf8; padding:10px 12px; border-radius:6px; font-size:12px; line-height:1.4;">
        🔒 Puedes cambiar la contraseña genérica por un PIN personal de <strong>4 a 6 dígitos</strong> que recuerdes fácilmente.
      </div>

      <label class="field">
        <span class="field-label">USUARIO ACTIVO:</span>
        <input type="text" value="${escapeHtml(currentUserName)}" disabled style="background:rgba(255,255,255,0.05); font-weight:bold; cursor:not-allowed;">
      </label>

      <label class="field">
        <span class="field-label">NUEVO PIN (4 A 6 DÍGITOS):</span>
        <div style="position:relative; display:flex; align-items:center;">
          <input type="password" id="new-pin-input" inputmode="numeric" maxlength="6" placeholder="Ej. 240815" required style="width:100%; padding-right:38px;">
          <button type="button" id="toggle-pin-visibility" style="position:absolute; right:10px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px;" title="Ver/Ocultar">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </label>

      <label class="field">
        <span class="field-label">CONFIRMAR NUEVO PIN:</span>
        <input type="password" id="confirm-pin-input" inputmode="numeric" maxlength="6" placeholder="Repite tu nuevo PIN" required>
      </label>

      <div id="pin-match-error" style="display:none; color:#ef4444; font-size:12px; font-weight:bold; padding:6px 10px; background:rgba(239,68,68,0.1); border-radius:6px;">
        ⚠️ Los PIN ingresados no coinciden o deben tener entre 4 y 6 dígitos numéricos.
      </div>

      <div class="modal-foot" style="margin-top:12px; display:flex; gap:8px;">
        <button type="button" class="secondary-button" data-action="close" style="flex:1;">Cancelar</button>
        <button type="submit" class="primary-button" id="submit-pin-btn" style="flex:2; background:#0284c7; border:none; font-weight:bold; cursor:pointer;">
          💾 Guardar Nuevo PIN
        </button>
      </div>
    </form>
  `);

  const eyeBtn = document.getElementById("toggle-pin-visibility");
  const newPinInp = document.getElementById("new-pin-input");
  const confPinInp = document.getElementById("confirm-pin-input");
  const errBox = document.getElementById("pin-match-error");

  if (eyeBtn && newPinInp) {
    eyeBtn.addEventListener("click", () => {
      const isPwd = newPinInp.type === "password";
      newPinInp.type = isPwd ? "text" : "password";
      if (confPinInp) confPinInp.type = isPwd ? "text" : "password";
      eyeBtn.innerHTML = isPwd ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    });
  }

  const form = document.getElementById("change-pin-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const p1 = (newPinInp?.value || "").trim();
      const p2 = (confPinInp?.value || "").trim();

      if (!p1 || p1.length < 4 || p1.length > 6 || p1 !== p2) {
        if (errBox) errBox.style.display = "block";
        return;
      }
      if (errBox) errBox.style.display = "none";

      const btn = document.getElementById("submit-pin-btn");
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      }

      try {
        const res = await api("profile_change_pin", {
          user: currentUserName,
          newPin: p1
        });
        if (res && (res.ok || res.exito)) {
          if (state.session) state.session.pin = p1;
          store.set("pp_profile_session", state.session);
          closeModal();
          if (window.Swal) {
            Swal.fire({
              title: "¡PIN Actualizado!",
              text: "Tu nueva clave de acceso personal ha sido guardada correctamente en el sistema.",
              icon: "success",
              confirmButtonColor: "#0284c7"
            });
          } else {
            alert("¡PIN actualizado con éxito!");
          }
        } else {
          throw new Error(res?.error || res?.mensaje || "No se pudo actualizar el PIN");
        }
      } catch (err) {
        alert("Error al guardar PIN: " + err.message);
        if (btn) {
          btn.disabled = false;
          btn.textContent = "💾 Guardar Nuevo PIN";
        }
      }
    });
  }
};

// 2. CONFIGURACIÓN DE GEMINI API KEY (Persistente y compartida entre usuarios)
window.getGeminiApiKey = function() {
  // Intentar obtener del almacenamiento persistente de la app primero
  let key = store.get("jj_gemini_api_key") || "";
  
  // Si no existe, intentar del localStorage (fallback)
  if (!key) {
    key = localStorage.getItem("jj_gemini_api_key") || "";
  }
  
  return key;
};

window.setGeminiApiKey = function(key) {
  const clean = String(key || "").trim();
  
  // Guardar en localStorage (rápido, se usa durante la sesión)
  if (clean) {
    localStorage.setItem("jj_gemini_api_key", clean);
  } else {
    localStorage.removeItem("jj_gemini_api_key");
  }
  
  // Guardar en almacenamiento persistente de la app (sobrevive limpiezas de caché)
  if (clean) {
    store.set("jj_gemini_api_key", clean);
  } else {
    store.remove("jj_gemini_api_key");
  }
  
  // Sincronizar con backend para que esté disponible en otros dispositivos
  if (clean) {
    api("profile_save_gemini_key", { apiKey: clean }).catch(() => {
      console.log("No se pudo sincronizar API key con backend, pero se guardó localmente");
    });
  }
};

window.saveGeminiKeyFromSettings = function() {
  const val = document.getElementById("settings-gemini-key")?.value?.trim() || "";
  window.setGeminiApiKey(val);
  showToast(val ? "✅ Clave de Gemini guardada correctamente." : "🗑️ Clave de Gemini eliminada.");
};

window.testGeminiConnection = async function() {
  const resEl = document.getElementById("gemini-test-result");
  const key = document.getElementById("settings-gemini-key")?.value?.trim() || window.getGeminiApiKey();
  if (!key) {
    if (resEl) resEl.innerHTML = '<span style="color:#ef4444; font-weight:bold;">⚠️ Por favor ingresa una clave API primero.</span>';
    return;
  }
  if (resEl) resEl.innerHTML = '<span style="color:#0ea5e9;"><i class="fas fa-spinner fa-spin"></i> Conectando con Gemini Flash...</span>';
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Responde exactamente: OK Creaciones JJ" }] }]
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (resEl) resEl.innerHTML = `<span style="color:#10b981; font-weight:bold;"><i class="fas fa-check-circle"></i> ¡Conexión Exitosa con Google Gemini! (${escapeHtml(text.trim())})</span>`;
  } catch (err) {
    if (resEl) resEl.innerHTML = `<span style="color:#ef4444; font-weight:bold;">❌ Error de conexión: ${escapeHtml(err.message)}</span>`;
  }
};

window.addProvider = function() {
  const input = document.getElementById("new-provider-input");
  const name = input?.value?.trim();
  if (!name) {
    showToast("⚠️ Por favor ingresa el nombre del proveedor.");
    return;
  }
  
  const list = getProviderList();
  if (list.includes(name)) {
    showToast("⚠️ Ese proveedor ya existe en la lista.");
    return;
  }
  
  list.push(name);
  saveProviderList(list);
  showToast("✅ Proveedor agregado correctamente.");
  
  // Actualizar la lista en la UI
  if (typeof render === "function") render();
};

window.removeProvider = function(name) {
  if (!confirm(`¿Estás seguro de eliminar "${name}" de la lista de proveedores?`)) {
    return;
  }
  
  const list = getProviderList();
  const index = list.indexOf(name);
  if (index > -1) {
    list.splice(index, 1);
    saveProviderList(list);
    showToast("✅ Proveedor eliminado.");
    
    // Actualizar la lista en la UI
    if (typeof render === "function") render();
  }
};

// COMPRESOR DE IMAGEN EN EL NAVEGADOR PARA OCR ULTRA-RÁPIDO - OPTIMIZADO
window.compressImageForOcr = function(dataUrl, maxDim = 1000, quality = 0.65) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch (e) { resolve(dataUrl); }
  });
};

// 3. MOTOR DE TRANSCRIPCIÓN CON IA (GEMINI VISION) - OPTIMIZADO PARA VELOCIDAD
window.transcribePhysicalSheet = async function(base64Image, sheetType) {
  if (!base64Image) {
    throw new Error("No hay imagen cargada para transcribir.");
  }

  let apiKey = window.getGeminiApiKey();

  if (!apiKey) {
    let enteredKey = "";
    if (window.Swal) {
      const result = await Swal.fire({
        title: "✨ Transcripción Automática con IA",
        html: `
          <div style="font-size:12.5px; text-align:left; line-height:1.5; color:var(--text-main, #333);">
            El sistema de Creaciones JJ utiliza <strong>Google Gemini Flash</strong> para transcribir hojas y recibos físicos al instante sin tipear.<br><br>
            Por favor, introduce tu <strong>Gemini API Key gratuita</strong> de Google AI Studio (se guardará en este dispositivo):
          </div>
          <input type="password" id="swal-gemini-key" class="swal2-input" placeholder="AIzaSy..." style="width:85%; font-size:13px;">
          <div style="margin-top:8px; font-size:11.5px;">
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:#0284c7; font-weight:bold; text-decoration:underline;">
              🔗 Obtén tu clave gratis en Google AI Studio (toma 1 minuto)
            </a>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Guardar y Transcribir",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#0284c7",
        preConfirm: () => {
          const val = document.getElementById("swal-gemini-key")?.value?.trim();
          if (!val) {
            Swal.showValidationMessage("Debes ingresar una clave válida");
          }
          return val;
        }
      });
      if (!result.isConfirmed || !result.value) return null;
      apiKey = result.value;
      window.setGeminiApiKey(apiKey);
    } else {
      apiKey = prompt("Introduce tu clave API de Google Gemini para transcripción automática:");
      if (!apiKey) return null;
      window.setGeminiApiKey(apiKey);
    }
  }

  console.log("Gemini API Key configured:", apiKey ? "Yes" : "No");

  // Comprimir imagen en el navegador: subida mucho más rápida a la API
  const compressedDataUrl = await window.compressImageForOcr(base64Image);
  const cleanBase64 = compressedDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
  
  let promptText = "";
  if (sheetType === "caja") {
    promptText = `Eres un transcriptor contable experto para el taller de Creaciones JJ.
Analiza la foto de la planilla física de Cierre de Caja / Arqueo Diario.
La planilla contiene columnas manuscritas: PUNTO (lotes/montos en Bs), PAGO MOVIL (montos y refs), EFECTIVOS BS (montos en Bs), EFECTIVOS $ (montos en $), e INICIO BS EN CAJA (ej. 300bs / 3$).
Devuelve ÚNICAMENTE un JSON estricto válido con las siguientes claves:
{
  "fecha": "YYYY-MM-DD",
  "turno": "Turno 1 (8:00 AM a 1:00 PM)" | "Turno 2 (3:00 PM a 8:00 PM)" | "Cierre Completo del Día",
  "inicioBs": 300,
  "inicioUSD": 3,
  "puntoVentaBs": suma total de los montos de punto de venta en Bs (número),
  "puntoVentaLotes": "desglose de los montos separados por coma (ej. 140, 1480, 600, 960)",
  "pagoMovilBs": suma total de pago móvil en Bs (número),
  "pagoMovilRef": "referencia o banco (ej. Ref 5407)",
  "efectivoBs": suma total de efectivo en bolívares (número),
  "efectivoUSD": suma total de efectivo en dólares (número),
  "observaciones": "cualquier nota u observación legible"
}`;
  } else {
    promptText = `Eres un transcriptor experto para Creaciones JJ, taller de papelería creativa y diseño.
Analiza la foto de la comanda física de pedido rápido (JJ Express).
El formato impreso tiene: CLIENTE, TELÉFONO, FECHA DE PEDIDO, FECHA DE ENTREGA, CANT, DESCRIPCIÓN (ej. Pendón, Topper), P.UNIT, TOTAL ($), método EFECTIVO / TRANSFERENCIA, TOTAL, ANTICIPO, RESTA, NOTAS (ej. Falta dar 3$ de vuelto) y ATENDIDO POR.
Devuelve ÚNICAMENTE un JSON estricto con las siguientes claves:
{
  "cliente": "nombre del cliente",
  "telefono": "teléfono (ej. 04141234567)",
  "tipo": "tipo de producto (Topper, Pendón, Libreta, Stickers, etc.)",
  "motivo": "personaje, motivo o temática si está indicado",
  "cantidad": 1,
  "costo": monto total en dólares (número),
  "abono": anticipo o abono en dólares (número),
  "resta": resta o saldo en dólares (número),
  "metodoPago": "Efectivo $" | "Pago Móvil" | "Punto de Venta" | "Zelle",
  "notasCobro": "observaciones, notas de vuelto o cobro",
  "fechaEntrega": "YYYY-MM-DD",
  "atendidoPor": "nombre del responsable"
}`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    console.log("Calling Gemini API with URL:", url.substring(0, 50) + "...");
    
    const payload = {
      contents: [{
        parts: [
          { text: promptText },
          { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errorMsg = errJson.error?.message || `HTTP ${response.status}`;
      
      if (response.status === 403 || response.status === 401) {
        console.warn("API Key inválida, permitiendo entrada manual");
        // No lanzar error, solo retornar null para permitir entrada manual
        return null;
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Respuesta vacía del modelo de IA.");

    return JSON.parse(rawText);
  } catch (directErr) {
    console.warn("Fallo llamada directa Gemini, intentando vía backend:", directErr);
    
    if (directErr.message && directErr.message.includes("API Key")) {
      throw directErr; // Re-lanzar error de API key específico
    }
    
    try {
      const backendRes = await api("profile_ai_transcribe", {
        imageBase64: compressedDataUrl,
        sheetType: sheetType,
        apiKey: apiKey
      });
      if (backendRes && backendRes.data) {
        return backendRes.data;
      }
    } catch (bErr) {
      console.warn("Fallo backend también:", bErr);
    }
    throw directErr;
  }
};

// 4. HANDLERS INTERACTIVOS PARA JJ EXPRESS Y CIERRE DE CAJA - OPTIMIZADOS
window.triggerOcrForExpressInvoice = async function(base64) {
  const container = document.getElementById("express-invoice-preview-wrap");
  if (!container) return;

  let banner = document.getElementById("express-ocr-status-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "express-ocr-status-banner";
    container.parentNode.insertBefore(banner, container.nextSibling);
  }

  banner.className = "ocr-scanning-banner";
  banner.style.display = "flex";
  banner.innerHTML = '<i class="fas fa-magic fa-spin"></i> <span>🤖 Analizando recibo (2-5 seg)...</span>';

  try {
    // Agregar timeout de 60 segundos para OCR (aumentado de 30s para PC/móvil)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Tiempo de espera agotado. Intenta nuevamente o llena los campos manualmente.")), 60000);
    });

    const data = await Promise.race([
      window.transcribePhysicalSheet(base64, "express"),
      timeoutPromise
    ]);

    if (!data) {
      banner.style.display = "none";
      return;
    }

    if (data.cliente) {
      const cliInp = document.getElementById("express-cliente");
      if (cliInp) cliInp.value = data.cliente;
    }
    if (data.telefono) {
      const telInp = document.getElementById("express-telefono");
      if (telInp) telInp.value = data.telefono;
    }
    if (data.costo !== undefined && data.costo !== null && !isNaN(Number(data.costo))) {
      const cInp = document.getElementById("express-costo");
      if (cInp) cInp.value = Number(data.costo);
    }
    if (data.abono !== undefined && data.abono !== null && !isNaN(Number(data.abono))) {
      const aInp = document.getElementById("express-anticipo");
      if (aInp) aInp.value = Number(data.abono);
    }
    if (data.resta !== undefined && data.resta !== null && !isNaN(Number(data.resta))) {
      const rInp = document.getElementById("express-resta");
      if (rInp) rInp.value = Number(data.resta);
    }
    if (data.motivo) {
      const mInp = document.getElementById("express-motivo");
      if (mInp) mInp.value = data.motivo;
    }
    if (data.notasCobro) {
      const nInp = document.getElementById("express-nota-pago");
      if (nInp) nInp.value = data.notasCobro;
    }
    if (data.fechaEntrega) {
      const fInp = document.getElementById("express-fecha");
      if (fInp) fInp.value = data.fechaEntrega;
    }
    if (data.metodoPago) {
      const metSelect = document.getElementById("express-metodo-pago");
      if (metSelect) {
        for (let opt of metSelect.options) {
          if (opt.value.toLowerCase().includes(data.metodoPago.toLowerCase()) || data.metodoPago.toLowerCase().includes(opt.value.toLowerCase())) {
            metSelect.value = opt.value;
            break;
          }
        }
      }
    }
    if (data.atendidoPor) {
      const respSelect = document.getElementById("express-responsable");
      if (respSelect) {
        for (let opt of respSelect.options) {
          if (opt.value.toLowerCase().includes(data.atendidoPor.toLowerCase()) || data.atendidoPor.toLowerCase().includes(opt.value.toLowerCase())) {
            respSelect.value = opt.value;
            break;
          }
        }
      }
    }
    if (data.tipo) {
      const firstTipoInp = document.querySelector("#express-items-list .subitem-row .swal-item-tipo");
      if (firstTipoInp) firstTipoInp.value = data.tipo;
    }

    if (typeof window.recalcExpressPayment === "function") {
      window.recalcExpressPayment();
    }

    banner.className = "ocr-verified-banner";
    banner.innerHTML = '<i class="fas fa-check-circle"></i> <span>✨ <strong>Datos transcritos con éxito:</strong> Comprueba que los datos coincidan con la comanda física antes de guardar.</span>';
    showToast("✨ Recibo transcrito automáticamente con IA");
  } catch (err) {
    console.error("Error en transcripción OCR Express:", err);
    banner.className = "ocr-error-banner";
    banner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${err.message || "No se pudo transcribir automáticamente"} - Puedes llenar los campos manualmente.</span>`;
    showToast("⚠️ OCR falló - Llena los campos manualmente");
  }
};
var triggerOcrForExpressInvoice = window.triggerOcrForExpressInvoice;

window.triggerOcrForCashClose = async function(base64) {
  const container = document.getElementById("caja-photo-preview");
  if (!container) return;

  let banner = document.getElementById("caja-ocr-status-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "caja-ocr-status-banner";
    container.parentNode.insertBefore(banner, container.nextSibling);
  }

  banner.className = "ocr-scanning-banner";
  banner.style.display = "flex";
  banner.innerHTML = '<i class="fas fa-magic fa-spin"></i> <span>🤖 Analizando planilla (3-6 seg)...</span>';

  try {
    // Agregar timeout de 60 segundos para OCR (aumentado de 30s para PC/móvil)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Tiempo de espera agotado. Intenta nuevamente o llena los campos manualmente.")), 60000);
    });

    const data = await Promise.race([
      window.transcribePhysicalSheet(base64, "caja"),
      timeoutPromise
    ]);

    if (!data) {
      banner.style.display = "none";
      return;
    }

    if (data.fecha) {
      const fInp = document.getElementById("caja-fecha");
      if (fInp) fInp.value = data.fecha;
    }
    if (data.turno) {
      const tSel = document.getElementById("caja-turno");
      if (tSel) {
        for (let opt of tSel.options) {
          if (opt.value.toLowerCase().includes(data.turno.toLowerCase()) || data.turno.toLowerCase().includes(opt.value.toLowerCase())) {
            tSel.value = opt.value;
            break;
          }
        }
      }
    }
    if (data.inicioBs !== undefined && data.inicioBs !== null && !isNaN(Number(data.inicioBs))) {
      const iBs = document.getElementById("caja-inicio-bs");
      if (iBs) iBs.value = Number(data.inicioBs);
    }
    if (data.inicioUSD !== undefined && data.inicioUSD !== null && !isNaN(Number(data.inicioUSD))) {
      const iUsd = document.getElementById("caja-inicio-usd");
      if (iUsd) iUsd.value = Number(data.inicioUSD);
    }
    if (data.puntoVentaBs !== undefined && data.puntoVentaBs !== null && !isNaN(Number(data.puntoVentaBs))) {
      const pBs = document.getElementById("caja-punto-bs");
      if (pBs) pBs.value = Number(data.puntoVentaBs);
    }
    if (data.pagoMovilBs !== undefined && data.pagoMovilBs !== null && !isNaN(Number(data.pagoMovilBs))) {
      const pmBs = document.getElementById("caja-pagomovil-bs");
      if (pmBs) pmBs.value = Number(data.pagoMovilBs);
    }
    if (data.pagoMovilRef) {
      const pmRef = document.getElementById("caja-pagomovil-ref");
      if (pmRef) pmRef.value = data.pagoMovilRef;
    }
    if (data.efectivoBs !== undefined && data.efectivoBs !== null && !isNaN(Number(data.efectivoBs))) {
      const efBs = document.getElementById("caja-efectivo-bs");
      if (efBs) efBs.value = Number(data.efectivoBs);
    }
    if (data.efectivoUSD !== undefined && data.efectivoUSD !== null && !isNaN(Number(data.efectivoUSD))) {
      const efUsd = document.getElementById("caja-efectivo-usd");
      if (efUsd) efUsd.value = Number(data.efectivoUSD);
    }
    if (data.observaciones) {
      const obs = document.getElementById("caja-obs");
      if (obs) obs.value = data.observaciones;
    }

    if (typeof window.calcCashTotals === "function") {
      window.calcCashTotals();
    }

    banner.className = "ocr-verified-banner";
    banner.innerHTML = '<i class="fas fa-check-circle"></i> <span>✨ <strong>Planilla transcrita con éxito:</strong> Por favor verifica que los montos coincidan con la hoja antes de guardar.</span>';
    showToast("✨ Planilla transcrita automáticamente con IA");
  } catch (err) {
    console.error("Error en transcripción OCR Caja:", err);
    banner.className = "ocr-error-banner";
    banner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>No se pudo transcribir automáticamente (${escapeHtml(err.message)}). Puedes llenar los campos manualmente.</span>`;
  }
};
var triggerOcrForCashClose = window.triggerOcrForCashClose;
