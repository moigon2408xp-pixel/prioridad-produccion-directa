/**
 * SISTEMA DE PRODUCCIÓN Y API WEB DE PRIORIDAD PRODUCCIÓN
 * Versión 7.5 - Frontend JavaScript (app-registrar-fix.js)
 * Incluye Cambio de Tema Reactivo, Reapertura de Pedidos y Fotos de Referencia.
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

// ==== GESTIÓN Y GENERADOR DE TEMAS PERSONALIZADOS EN TIEMPO REAL ====
function applyTheme() {
  const currentTheme = store.get("pp_theme", "light");
  const currentAccent = store.get("pp_accent", "blue");
  const customColors = store.get("pp_custom_colors", {});
  
  document.documentElement.setAttribute("data-theme", currentTheme);
  document.documentElement.setAttribute("data-accent", currentAccent);
  
  // Aplicar o remover colores personalizados dinámicamente
  if (customColors.primary) {
    document.documentElement.style.setProperty("--primary-color", customColors.primary);
    document.documentElement.style.setProperty("--primary-hover", customColors.primary);
  } else {
    document.documentElement.style.removeProperty("--primary-color");
    document.documentElement.style.removeProperty("--primary-hover");
  }

  if (customColors.cardBg) {
    document.documentElement.style.setProperty("--bg-card", customColors.cardBg);
  } else {
    document.documentElement.style.removeProperty("--bg-card");
  }

  if (customColors.textMain) {
    document.documentElement.style.setProperty("--text-main", customColors.textMain);
  } else {
    document.documentElement.style.removeProperty("--text-main");
  }

  if (customColors.mainBg) {
    document.documentElement.style.setProperty("--bg-main", customColors.mainBg);
  } else {
    document.documentElement.style.removeProperty("--bg-main");
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
  showToast("Tema restablecido a los valores por defecto.");
}

function cleanPhoneNumber(phone = "") {
  let num = String(phone || "").replace(/\D/g, "");
  if (!num) return "";
  if (num.startsWith("0")) num = "58" + num.slice(1);
  else if (num.length === 10 && !num.startsWith("58")) num = "58" + num;
  return num;
}

function safeParseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  let str = String(value).trim();
  if (!str) return null;
  
  if (str.includes(" - ")) str = str.split(" - ")[0];
  if (str.includes(" a las ")) str = str.split(" a las ")[0];
  
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

// Normalizadores universales de datos
const normalizeClient = (c) => {
  if (!c) return { name: "", phone: "" };
  if (Array.isArray(c)) {
    return { name: String(c[0] || "").trim(), phone: cleanPhoneNumber(c[1] || "") };
  }
  if (typeof c === "object") {
    return {
      name: String(c.name || c.nombre || c.Nombre || c.cliente || c[0] || "").trim(),
      phone: cleanPhoneNumber(c.phone || c.telefono || c.Telefono || c.celular || c.tel || c[1] || "")
    };
  }
  return { name: String(c).trim(), phone: "" };
};

const normalizeType = (t) => {
  if (!t) return "";
  if (Array.isArray(t)) return String(t[0] || "").trim();
  if (typeof t === "object") {
    return String(t.type || t.tipo || t.Tipo || t.nombre || t.trabajo || t.name || t[0] || "").trim();
  }
  return String(t).trim();
};

const normalizeOrder = (o) => ({
  id: String(o.id || o['ID Pedido'] || o.ID || "").trim(),
  cliente: String(o.cliente || o.Cliente || "Sin cliente").trim(),
  tipo: String(o.tipo || o['Tipo de trabajo'] || o.Tipo || o.trabajo || "Sin tipo").trim(),
  descripcion: String(o.descripcion || o.Descripción || "").trim(),
  entrega: String(o.entrega || o['Fecha entrega'] || o.Entrega || "").trim(),
  responsable: String(o.responsable || o.Responsable || "Sin asignar").trim(),
  estado: String(o.estado || o.Estado || "Pendiente").trim(),
  diseno: String(o.diseno || o.diseño || "No").trim(),
  material: String(o.material || o.Material || "No").trim(),
  telefono: cleanPhoneNumber(o.telefono || o.Telefono || o['Teléfono'] || o.phone || ""),
  comentarioCierre: String(o.comentarioCierre || o.Comentario_cierre || "").trim(),
  fotoEvidencia: String(o.fotoEvidencia || o.Evidencias_Drive || o.evidenciasDrive || o.foto || "").trim(),
  inicioProduccion: String(o.inicioProduccion || o.Inicio_produccion || "").trim(),
  finProduccion: String(o.finProduccion || o.Fin_produccion || "").trim(),
  duracionRealMin: Number(o.duracionRealMin || o.Duracion_real_min || 0),
  ultimaPausa: String(o.ultimaPausa || o.UltimaPausa || "").trim(),
  tiempoPausadoMin: Number(o.tiempoPausadoMin || o.TiempoPausadoMin || 0),
  cerrado: String(o.cerrado || o.Cerrado || "No").trim()
});

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
  frequentTypes: [],
  waTemplate: store.get("pp_wa_template", "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega."),
  screen: "now",
  offline: false,
  data: { myOrders: [], teamCritical: [], allOrders: [], finishedOrders: [], users: [] },
};

const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));

const priority = (order) => {
  const deliveryDate = safeParseDate(order.entrega);
  if (!deliveryDate) return "now";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(deliveryDate);
  checkDate.setHours(0, 0, 0, 0);
  if (checkDate < today) return "overdue";
  if (checkDate.getTime() === today.getTime()) return "today";
  return "later";
};

const priorityLabel = {
  overdue: "🚨 ¡RETRASADO!",
  now: "Hacer ahora",
  today: "Hacer hoy",
  later: "Programar"
};

const active = (order) => !["Terminado", "Entregado", "Cancelado"].includes(order.estado) && String(order.cerrado).toLowerCase() !== "sí" && String(order.cerrado).toLowerCase() !== "si";
const operable = (order) => active(order);
const isLead = () => ["manager", "jefa"].includes(state.session?.role);

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = String(message || "Operación realizada");
  toast.classList.add("show");
  clearTimeout(window.ppToast);
  window.ppToast = setTimeout(() => toast.classList.remove("show"), 3200);
}

// ==== GENERADOR DE HORARIOS DE 7 AM A 9 PM ====
function generateTimeOptions(selectedTime = "11:00 AM") {
  const hours = [
    "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
    "07:00 PM", "08:00 PM", "09:00 PM"
  ];
  return hours.map(h => `<option value="${h}" ${h === selectedTime ? "selected" : ""}>${h}</option>`).join("");
}

// ==== PARSER DE PEGADO MÁGICO ====
function parseMagicPasteText(rawText) {
  const result = {
    cliente: "",
    telefono: "",
    tipo: "",
    fechaEntrega: "",
    horaEntrega: "11:00 AM",
    descripcion: rawText.trim()
  };
  
  if (!rawText) return result;
  
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  
  const clienteMatch = rawText.match(/(?:cliente|nombre|para|comprador)[:\s]+([^\n\r,]+)/i);
  if (clienteMatch) {
    result.cliente = clienteMatch[1].trim();
  } else if (lines.length > 0 && !lines[0].includes(":")) {
    result.cliente = lines[0].replace(/^hola,?\s*/i, "").trim();
  }
  
  const phoneMatch = rawText.match(/(\+?58\s?)?0?4\d{2}[\s-]?\d{7}|\b\d{10,11}\b/);
  if (phoneMatch) {
    result.telefono = cleanPhoneNumber(phoneMatch[0]);
  }
  
  const typeMatch = rawText.match(/(?:tipo|trabajo|producto|servicio|item)[:\s]+([^\n\r,]+)/i);
  if (typeMatch) {
    result.tipo = typeMatch[1].trim();
  } else {
    for (const t of state.frequentTypes) {
      if (t && rawText.toLowerCase().includes(t.toLowerCase())) {
        result.tipo = t;
        break;
      }
    }
  }
  
  const dateMatch = rawText.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/);
  if (dateMatch) {
    const parsedDate = safeParseDate(dateMatch[0]);
    if (parsedDate) {
      const year = parsedDate.getFullYear();
      const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
      const day = parsedDate.getDate().toString().padStart(2, '0');
      result.fechaEntrega = `${year}-${month}-${day}`;
    }
  }
  
  const timeMatch = rawText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    let hourNum = parseInt(timeMatch[1], 10);
    const ampm = timeMatch[3].toUpperCase();
    if (hourNum < 10) hourNum = "0" + hourNum;
    result.horaEntrega = `${hourNum}:00 ${ampm}`;
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
      throw new Error("Error de conexión con Google Sheets. Verifica tu conexión a internet.");
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
    
    state.data = {
      myOrders: (rawData.myOrders || []).map(normalizeOrder),
      teamCritical: (rawData.teamCritical || []).map(normalizeOrder),
      allOrders: (rawData.allOrders || rawData.allorders || []).map(normalizeOrder),
      finishedOrders: (rawData.finishedOrders || rawData.pedidosTerminados || []).map(normalizeOrder),
      users: (rawData.allUsers || rawData.users || []).map(normalizeUser)
    };
    
    const rawClients = rawData.frequentClients || rawData.clients || rawData.clientes || rawData.telefonos || [];
    const rawTypes = rawData.frequentTypes || rawData.types || rawData.tipos || rawData.tiposTrabajo || [];
    
    state.frequentClients = rawClients.map(normalizeClient).filter(c => c.name && c.name.toLowerCase() !== "nombre");
    state.frequentTypes = rawTypes.map(normalizeType).filter(t => t && t.toLowerCase() !== "tipo");
    state.waTemplate = rawData.waTemplate || state.waTemplate;
    state.offline = false;
    
    store.set("pp_profile_data", state.data);
    render();
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

function priorityPill(order) {
  const val = priority(order);
  const isOverdue = val === "overdue";
  const bgStyle = isOverdue ? 'background-color:#d32f2f; color:white; font-weight:bold; padding:4px 8px; border-radius:4px;' : '';
  return `<span class="priority priority-${val}" style="${bgStyle}">${priorityLabel[val]}</span>`;
}

function orderCard(order, position) {
  return `<button class="order-card" data-action="detail" data-id="${escapeHtml(order.id)}">
    <div class="order-top">
      <div><h3>${position === undefined ? "" : `${position + 1}. `}${escapeHtml(order.cliente)}</h3><p>${escapeHtml(order.tipo)}</p></div>
      ${priorityPill(order)}
    </div>
    <div class="meta">
      Estado: <strong>${escapeHtml(order.estado)}</strong> · Asignado a: <strong>${escapeHtml(order.responsable)}</strong><br/>
      Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>
      Teléfono: ${escapeHtml(order.telefono || "No registrado")}
    </div>
  </button>`;
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
  return `${state.offline ? '<p class="offline">Mostrando información guardada localmente.</p>' : ""}
  ${next ? `<article class="hero-card" style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); box-shadow:var(--shadow-md); margin-bottom:20px;"><p class="eyebrow">TU SIGUIENTE TRABAJO PRIORITARIO</p>${priorityPill(next)}<h2 style="margin-top:10px;">${escapeHtml(next.cliente)}</h2><p style="color:var(--text-muted); margin-bottom:12px;">${escapeHtml(next.tipo)} · Entrega: ${escapeHtml(formatDate(next.entrega))}</p><div class="actions"><button class="primary-button" data-action="detail" data-id="${escapeHtml(next.id)}">Ver detalle completo</button></div></article>` : '<div class="empty"><strong>Tu cola de trabajo está al día.</strong></div>'}
  <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-bottom:10px;">CRÍTICOS DEL EQUIPO</p>
  <div class="order-list">${critical.map(orderCard).join("") || '<div class="team-note">No hay pedidos críticos en el taller.</div>'}</div>`;
}

function queueView() {
  const list = getMyOpenOrders();
  return list.length ? `<div class="order-list">${list.map(orderCard).join("")}</div>` : '<div class="empty"><strong>No tienes pedidos asignados pendientes</strong></div>';
}

function historyView() {
  const orders = state.data.finishedOrders || [];
  if (!orders.length) return '<div class="empty"><strong>No hay proyectos terminados en el historial</strong></div>';
  return `<div class="order-list">${orders.map((order) => {
    const links = String(order.fotoEvidencia || "").split("\n").filter(Boolean);
    return `
      <article class="order-card">
        <div class="order-top" data-action="detail" data-id="${escapeHtml(order.id)}">
          <div><h3>${escapeHtml(order.cliente)}</h3><p>${escapeHtml(order.tipo)}</p></div>
          <span class="priority" style="background:#2e7d32; color:white; padding:4px 8px; border-radius:4px;">${escapeHtml(order.estado)}</span>
        </div>
        <div class="meta" data-action="detail" data-id="${escapeHtml(order.id)}">
          Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>
          Responsable: ${escapeHtml(order.responsable)}<br/>
          ⏱️ Tiempo invertido: <strong>${order.duracionRealMin || 0} min</strong><br/>
          ${order.comentarioCierre ? `<strong>Observación:</strong> ${escapeHtml(order.comentarioCierre)}<br/>` : ""}
          ${links.length ? links.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" style="color:var(--primary-color); font-weight:bold; text-decoration:underline; display:inline-block; margin-right:8px; margin-top:6px;">📷 Foto / Referencia ${idx + 1}</a>`).join("") : ""}
        </div>
        ${isLead() ? `
          <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
            <button class="secondary-button" style="background:var(--primary-color); color:white; border:none; flex:1;" data-action="reopen-order" data-id="${escapeHtml(order.id)}">🔄 Reabrir Proyecto</button>
            ${order.estado !== "Entregado" ? `<button class="secondary-button" style="background:var(--success-color); color:white; border:none; flex:1;" data-action="mark-delivered" data-id="${escapeHtml(order.id)}">📦 Marcar Entregado</button>` : ''}
          </div>
        ` : ''}
      </article>
    `;
  }).join('')}</div>`;
}

function teamView() {
  const orders = sortOrdersByUrgency((state.data.allOrders || []).filter(active));
  return `<div class="actions" style="margin-bottom:16px;"><button class="primary-button" data-action="new-order">＋ Registrar pedido</button></div>
  <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-bottom:10px;">TODOS LOS PEDIDOS ACTIVOS DEL TALLER (${orders.length})</p>
  <div class="order-list">${orders.map(orderCard).join("") || '<div class="team-note">No hay pedidos activos.</div>'}</div>`;
}

function settingsView() {
  const session = state.session || {};
  const customColors = store.get("pp_custom_colors", {});
  
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
      <div><strong>${escapeHtml(u.name)}</strong> <small style="color:var(--text-muted);">(${escapeHtml(u.role)})</small><br/><span style="color:${u.active ? 'var(--success-color)' : 'var(--danger-color)'}; font-size:12px;">${u.active ? '● Activo' : '○ Inactivo'}</span></div>
      <button class="secondary-button" data-action="toggle-user" data-name="${escapeHtml(u.name)}" data-active="${u.active}">${u.active ? 'Desactivar' : 'Activar'}</button>
    </div>
  `).join("");
  
  return `
    <div class="card settings-card" style="padding:20px; border:1px solid var(--border-color); border-radius:var(--radius-md); background:var(--bg-card); margin-bottom:20px;">
      <h3 style="margin-bottom:14px;">Mi Perfil y Personalización</h3>
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

      <!-- EDICIÓN DE PLANTILLA DE WHATSAPP -->
      <div style="margin-top:20px; padding-top:14px; border-top:1px solid var(--border-color);">
        <p style="font-weight:700; font-size:13px; margin-bottom:8px;">📲 PLANTILLA DE MENSAJE WHATSAPP:</p>
        <textarea id="wa-template-input" class="field" style="width:100%; min-height:80px; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-main);">${escapeHtml(state.waTemplate)}</textarea>
        <small style="color:var(--text-muted); display:block; margin-top:4px;">Variables disponibles: {cliente}, {tipo}, {estado}, {id}</small>
        <button class="primary-button" id="save-wa-template-btn" style="margin-top:8px;">💾 Guardar Plantilla de WhatsApp</button>
      </div>

      <div style="display:flex; gap:10px; margin-top:20px; flex-wrap:wrap;">
        <button class="secondary-button" data-action="logout">Cerrar sesión</button>
        <button class="secondary-button" data-action="clear-cache">🧹 Limpiar Caché Local</button>
      </div>
    </div>
    
    ${isLead() ? `
      <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-bottom:10px;">GESTIÓN DE PERFILES / USUARIOS</p>
      <button class="primary-button" data-action="new-user" style="margin-bottom:12px;">＋ Crear Nuevo Perfil</button>
      <div class="user-list">${usersList || '<div class="team-note">No hay usuarios registrados.</div>'}</div>
    ` : ''}
    
    <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-top:20px; margin-bottom:10px;">CLIENTES FRECUENTES (${state.frequentClients.length})</p>
    ${isLead() ? `<button class="primary-button" data-action="new-client" style="margin-bottom:12px;">＋ Agregar Cliente Frecuente</button>` : ''}
    <div class="user-list">${fcList || '<div class="team-note">No hay clientes guardados en Google Sheets.</div>'}</div>
    
    <p class="section-heading" style="font-weight:800; font-size:14px; letter-spacing:1px; margin-top:20px; margin-bottom:10px;">TIPOS DE TRABAJO (${state.frequentTypes.length})</p>
    ${isLead() ? `<button class="primary-button" data-action="new-type" style="margin-bottom:12px;">＋ Agregar Tipo de Trabajo</button>` : ''}
    <div class="user-list">${ftList || '<div class="team-note">No hay tipos de trabajo guardados.</div>'}</div>
  `;
}

function render() {
  if (!state.session) {
    state.session = store.get("pp_profile_session", null);
  }
  if (!state.session) return;
  
  try {
    applyTheme();
    const screenNames = { now: "Ahora", queue: "Mi cola", team: "Equipo", history: "Historial", settings: "Ajustes" };
    
    const titleEl = $("#screen-title");
    if (titleEl) titleEl.textContent = screenNames[state.screen] || "Ahora";
    
    const roleLabelEl = $("#role-label");
    if (roleLabelEl && state.session) {
      const roleStr = String(state.session.role || "trabajador").toUpperCase();
      const nameStr = String(state.session.name || "Usuario").toUpperCase();
      roleLabelEl.textContent = `${roleStr} · ${nameStr}`;
    }
    
    const screenEl = $("#screen");
    if (screenEl) {
      const views = { now: nowView, queue: queueView, team: teamView, history: historyView, settings: settingsView };
      screenEl.innerHTML = (views[state.screen] || views.now)();
    }
    
    document.querySelectorAll(".nav-button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.screen === state.screen);
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
  const links = String(order.fotoEvidencia || "").split("\n").filter(Boolean);

  openModal(`
    <div class="modal-head"><div><p class="eyebrow">${escapeHtml(order.id)}</p><h2>${escapeHtml(order.cliente)}</h2></div><button class="close-button" data-action="close">×</button></div>
    <div class="detail-grid">
      <div class="detail-row"><span>TIPO DE TRABAJO</span><strong>${escapeHtml(order.tipo)}</strong></div>
      <div class="detail-row"><span>CAMBIAR ESTADO</span>
        <select id="status-change-select" data-id="${escapeHtml(order.id)}">
          ${["Pendiente", "En proceso", "Pausado", "Terminado", "Entregado", "Cancelado"].map((st) => `<option value="${st}" ${order.estado === st ? "selected" : ""}>${st}</option>`).join("")}
        </select>
      </div>
      <div class="detail-row"><span>ENTREGA</span><strong>${escapeHtml(formatDate(order.entrega))}</strong></div>
      <div class="detail-row"><span>RESPONSABLE</span><strong>${escapeHtml(order.responsable)}</strong></div>
      <div class="detail-row"><span>TELÉFONO</span><strong>${escapeHtml(order.telefono || "No registrado")}</strong></div>
      <div class="detail-row"><span>DESCRIPCIÓN</span><strong>${escapeHtml(order.descripcion || "Sin descripción")}</strong></div>
      ${links.length ? `
        <div class="detail-row" style="grid-column:1/-1;">
          <span>📷 FOTOS DE REFERENCIA / EVIDENCIA:</span>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
            ${links.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="secondary-button" style="color:var(--primary-color);">🖼️ Ver Foto ${idx + 1}</a>`).join("")}
          </div>
        </div>
      ` : ''}
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
      try {
        await api("profile_update_order", { id: order.id, changes: { estado: val } });
        closeModal();
        await refresh(false);
        showToast(`Estado cambiado a ${val}.`);
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    }
  });
}

function openFinishModal(order, targetStatus) {
  openModal(`
    <div class="modal-head"><h2>Completar Trabajo (${targetStatus})</h2><button class="close-button" data-action="close">×</button></div>
    <form id="finish-form" class="form-grid">
      <label class="field"><span class="field-label">COMENTARIO DE CIERRE / OBSERVACIÓN</span>
        <textarea name="comentarioCierre" required placeholder="Escribe un comentario sobre la elaboración o imprevistos..."></textarea>
      </label>
      <label class="field"><span class="field-label">SUBIR EVIDENCIA FOTOGRÁFICA (HASTA 3 FOTOS)</span>
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
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(f);
      });
      imagesData.push({ data: base64, mimeType: f.type });
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
  
  openModal(`
    <div class="modal-head"><h2>Registrar Pedido</h2><button class="close-button" data-action="close">×</button></div>
    
    <!-- CONTENEDOR DE PEGADO MÁGICO -->
    <div class="magic-paste-box">
      <div class="magic-paste-title">✨ Pegado Mágico (Desde WhatsApp / Instagram)</div>
      <textarea id="magic-paste-input" class="magic-paste-textarea" placeholder="Pega aquí el mensaje del cliente (Ej: 'Cliente: Ana Perez, Tel: 04141234567, Tipo: Topper Acrílico, Entrega: 05/09/2026 3:00 PM')"></textarea>
      <button type="button" id="magic-paste-btn" class="secondary-button" style="background:var(--primary-color); color:white; border:none;">🪄 Analizar y Llenar Campos</button>
    </div>

    <form id="order-form" class="form-grid">
      ${clients.length ? `
        <label class="field"><span class="field-label">SELECCIONAR CLIENTE GUARDADO</span>
          <select id="fc-select"><option value="">-- Autocompletar datos --</option>${clients.map((c, i) => `<option value="${i}">${escapeHtml(c.name)} (${escapeHtml(c.phone || "Sin tel.")})</option>`).join("")}</select>
        </label>` : ''}
      <label class="field"><span class="field-label">NOMBRE DEL CLIENTE</span><input id="input-cliente" name="cliente" required placeholder="Escribe el nombre del cliente"></label>
      <label class="field"><span class="field-label">TELÉFONO WHATSAPP</span><input id="input-telefono" name="telefono" type="tel" placeholder="Ingresa o cambia el número"></label>
      
      <label class="field"><span class="field-label">TIPO DE TRABAJO</span>
        ${types.length ? `<select id="ft-select" style="margin-bottom:6px;"><option value="">-- Seleccionar existente --</option>${types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}<option value="__CUSTOM__">Escribir otro nuevo...</option></select>` : ''}
        <input id="input-tipo" name="tipo" required placeholder="Ej. Topper Acrílico">
      </label>

      <!-- ADJUNTAR FOTOS DE REFERENCIA DEL CLIENTE -->
      <label class="field"><span class="field-label">🖼️ ADJUNTAR FOTOS DE REFERENCIA DEL CLIENTE (HASTA 3 FOTOS)</span>
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
      <label class="field"><span class="field-label">DESCRIPCIÓN</span><textarea id="input-descripcion" name="descripcion" placeholder="Detalles del pedido..."></textarea></label>
      <div class="modal-footer"><button type="submit" class="primary-button">Guardar Pedido</button></div>
    </form>
  `);
  
  // PEGADO MÁGICO EVENTO
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
      }
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
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(f);
      });
      referenceImages.push({ data: base64, mimeType: f.type });
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
      <label class="field"><span class="field-label">NOMBRE DEL TRABAJADOR</span><input name="name" required placeholder="Ej. Carla"></label>
      <label class="field"><span class="field-label">PIN DE ACCESO (6 DÍGITOS)</span><input name="pin" type="password" inputmode="numeric" required maxlength="6" placeholder="123456"></label>
      <label class="field"><span class="field-label">ROL DE USUARIO</span>
        <select name="role">
          <option value="trabajador">Trabajador</option>
          <option value="jefa">Jefa</option>
          <option value="manager">Manager</option>
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

const loginForm = $("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const res = await api("profile_login", { name: $("#login-name").value.trim(), pin: $("#login-pin").value.trim() });
      state.session = res.session;
      store.set("pp_profile_session", state.session);
      $("#login-view")?.classList.add("hidden");
      $("#workspace")?.classList.remove("hidden");
      await refresh(false);
    } catch (err) {
      const errEl = $("#login-error");
      if (errEl) errEl.textContent = err.message;
    }
  });
}

$("#refresh")?.addEventListener("click", () => refresh());

document.querySelectorAll(".nav-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.screen = btn.dataset.screen;
    render();
  });
});

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
    $("#workspace")?.classList.add("hidden");
    $("#login-view")?.classList.remove("hidden");
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
    const clientName = prompt("Nombre del Cliente:");
    if (clientName && clientName.trim()) {
      const clientPhone = prompt("Teléfono del Cliente (opcional):");
      try {
        await api("profile_create_client", { name: clientName.trim(), phone: clientPhone ? clientPhone.trim() : "" });
        await refresh(false);
        showToast("Cliente agregado.");
      } catch (err) { alert(err.message); }
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

// Inicialización de temas e interfaz
applyTheme();
if (state.session) {
  $("#login-view")?.classList.add("hidden");
  $("#workspace")?.classList.remove("hidden");
  refresh(false);
}
