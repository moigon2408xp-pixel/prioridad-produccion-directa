const $ = (selector) => document.querySelector(selector);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); },
};

function cleanPhoneNumber(phone = "") {
  let num = String(phone || "").replace(/\D/g, "");
  if (!num) return "";
  if (num.startsWith("0")) num = "58" + num.slice(1);
  else if (num.length === 10 && !num.startsWith("58")) num = "58" + num;
  return num;
}

const normalizeClient = (c) => {
  if (!c) return { name: "", phone: "" };
  if (Array.isArray(c)) return { name: String(c[0] || "").trim(), phone: cleanPhoneNumber(c[1] || "") };
  if (typeof c === "object") {
    return {
      name: String(c.name || c.Nombre || c.nombre || c.cliente || c[0] || "").trim(),
      phone: cleanPhoneNumber(c.phone || c.Telefono || c.telefono || c.celular || c[1] || "")
    };
  }
  return { name: String(c).trim(), phone: "" };
};

const normalizeType = (t) => {
  if (!t) return "";
  if (Array.isArray(t)) return String(t[0] || "").trim();
  if (typeof t === "object") return String(t.type || t.Tipo || t.tipo || t.nombre || t.trabajo || t[0] || "").trim();
  return String(t).trim();
};

const normalizeOrder = (o) => ({
  id: String(o.id || o['ID Pedido'] || o.ID || "").trim(),
  cliente: String(o.cliente || o.Cliente || "Sin cliente").trim(),
  tipo: String(o.tipo || o['Tipo de trabajo'] || o.Tipo || o.trabajo || "Sin tipo").trim(),
  descripcion: String(o.descripcion || o.Descripción || "").trim(),
  entrega: String(o.entrega || o['Fecha entrega'] || o.Entrega_comprometida || "").trim(),
  responsable: String(o.responsable || o.Responsable || "Sin asignar").trim(),
  estado: String(o.estado || o.Estado || "Pendiente").trim(),
  telefono: cleanPhoneNumber(o.telefono || o.Telefono || o['Teléfono'] || o.phone || ""),
  comentarioCierre: String(o.comentarioCierre || o.Comentario_cierre || "").trim(),
  fotoEvidencia: String(o.fotoEvidencia || o.Evidencias_Drive || o.evidenciasDrive || "").trim(),
  fotoReferencia: String(o.fotoReferencia || o.Referencia_Drive || o.referenciaDrive || "").trim(),
  inicioProduccion: String(o.inicioProduccion || o.Inicio_produccion || "").trim(),
  finProduccion: String(o.finProduccion || o.Fin_produccion || "").trim(),
  duracionRealMin: Number(o.duracionRealMin || o.Duracion_real_min || 0),
  ultimaPausa: String(o.ultimaPausa || o.UltimaPausa || "").trim(),
  tiempoPausadoMin: Number(o.tiempoPausadoMin || o.TiempoPausado || 0),
  cerrado: String(o.cerrado || o.Cerrado || "No").trim()
});

const normalizeUser = (u) => {
  if (Array.isArray(u)) {
    return { name: String(u[0] || "").trim(), role: String(u[1] || "trabajador").toLowerCase().trim(), active: String(u[3] || "Sí").toLowerCase() === "sí" };
  }
  return {
    name: String(u.name || u.Nombre || "").trim(),
    role: String(u.role || u.Perfil || "trabajador").toLowerCase().trim(),
    active: String(u.active || u.Activo || "Sí").toLowerCase() === "sí" || u.active === true || u.active === "true"
  };
};

const state = {
  session: store.get("pp_profile_session", null),
  frequentClients: [],
  frequentTypes: [],
  waTemplate: store.get("pp_wa_template", "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega. Puedes pasar a retirarlo. ¡Feliz día!"),
  theme: store.get("pp_theme", "light"),
  customColor: store.get("pp_custom_color", "#1976d2"),
  screen: "now",
  offline: false,
  filters: { historySearch: "", historyResponsable: "", teamSearch: "" },
  data: { myOrders: [], teamCritical: [], allOrders: [], finishedOrders: [], users: [] },
};

const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function applyTheme() {
  let themeStyle = document.getElementById("pp-theme-styles");
  if (!themeStyle) {
    themeStyle = document.createElement("style");
    themeStyle.id = "pp-theme-styles";
    document.head.appendChild(themeStyle);
  }

  let bgBody = "#f4f6f8", bgCard = "#ffffff", textMain = "#333333", textSub = "#666666", border = "#dddddd", primary = state.customColor || "#1976d2";

  if (state.theme === "dark") {
    bgBody = "#121212"; bgCard = "#1e1e1e"; textMain = "#ffffff"; textSub = "#aaaaaa"; border = "#333333"; primary = state.customColor !== "#1976d2" ? state.customColor : "#bb86fc";
  } else if (state.theme === "pink") {
    bgBody = "#fce4ec"; bgCard = "#ffffff"; textMain = "#4a148c"; textSub = "#880e4f"; border = "#f8bbd0"; primary = state.customColor !== "#1976d2" ? state.customColor : "#ec407a";
  } else if (state.theme === "emerald") {
    bgBody = "#e8f5e9"; bgCard = "#ffffff"; textMain = "#1b5e20"; textSub = "#2e7d32"; border = "#c8e6c9"; primary = state.customColor !== "#1976d2" ? state.customColor : "#2e7d32";
  }

  themeStyle.textContent = `
    body, #workspace, .app-layout { background-color: ${bgBody} !important; color: ${textMain} !important; }
    .order-card, .card, .hero-card, .modal-content, .user-card, .settings-card { background-color: ${bgCard} !important; color: ${textMain} !important; border-color: ${border} !important; }
    p, span, label, h1, h2, h3, div, small, .meta { color: ${textMain}; }
    .eyebrow, .field-label, .section-heading, small, .meta strong { color: ${textSub}; }
    input, select, textarea { background-color: ${bgCard} !important; color: ${textMain} !important; border-color: ${border} !important; }
    .primary-button { background-color: ${primary} !important; color: #ffffff !important; }
  `;
}

function getDeliveryDateObj(entregaStr) {
  if (!entregaStr) return null;
  let str = String(entregaStr).trim();
  if (str.includes(" - ")) str = str.split(" - ")[0];
  if (str.includes(" a las ")) str = str.split(" a las ")[0];
  if (str.includes("/")) {
    const parts = str.split(" ")[0].split("/");
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

const priority = (order) => {
  const deliveryDate = getDeliveryDateObj(order.entrega);
  if (!deliveryDate) return "now";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(deliveryDate);
  checkDate.setHours(0, 0, 0, 0);

  if (checkDate < today) return "overdue";
  if (checkDate.getTime() === today.getTime()) return "today";
  return "later";
};

const priorityLabel = { overdue: "🚨 ¡RETRASADO!", now: "Hacer ahora", today: "Hacer hoy", later: "Programar" };
const active = (order) => !["Terminado", "Entregado", "Cancelado"].includes(order.estado) && order.cerrado !== "Sí";
const isLead = () => ["manager", "jefa"].includes(state.session?.role);

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  let str = String(value).trim();
  if (str.includes("AM") || str.includes("PM")) return str;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} a las ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = String(message || "Operación realizada");
  toast.classList.add("show");
  clearTimeout(window.ppToast);
  window.ppToast = setTimeout(() => toast.classList.remove("show"), 3200);
}

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
    throw new Error(data?.error || data?.mensaje || "Error al procesar solicitud.");
  } catch (err) {
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error("Error de conexión con Google Sheets.");
    }
    throw err;
  }
}

async function refresh(showMessage = true) {
  const btnRefresh = $("#refresh");
  if (btnRefresh) btnRefresh.textContent = "…";
  try {
    const response = await api("profile_dashboard");
    const rawData = response.data || {};
    
    state.data = {
      myOrders: (rawData.myOrders || []).map(normalizeOrder),
      teamCritical: (rawData.teamCritical || []).map(normalizeOrder),
      allOrders: (rawData.allOrders || []).map(normalizeOrder),
      finishedOrders: (rawData.finishedOrders || []).map(normalizeOrder),
      users: (rawData.users || []).map(normalizeUser)
    };

    const rawClients = rawData.frequentClients || rawData.clientes || [];
    const rawTypes = rawData.frequentTypes || rawData.tipos || [];

    state.frequentClients = rawClients.map(normalizeClient).filter(c => c.name && c.name.toLowerCase() !== "nombre");
    state.frequentTypes = rawTypes.map(normalizeType).filter(t => t && t.toLowerCase() !== "tipo");
    if (rawData.waTemplate) {
      state.waTemplate = rawData.waTemplate;
      store.set("pp_wa_template", state.waTemplate);
    }
    state.offline = false;

    store.set("pp_profile_data", state.data);
    render();
    if (showMessage) showToast("Información sincronizada.");
  } catch (error) {
    state.offline = true;
    render();
    if (showMessage) showToast(error?.message || "Modo sin conexión.");
  } finally {
    if (btnRefresh) btnRefresh.textContent = "↻";
  }
}

function priorityPill(order) {
  const val = priority(order);
  const isOverdue = val === "overdue";
  const bgStyle = isOverdue ? 'background-color:#d32f2f; color:white; font-weight:bold; padding:4px 8px; border-radius:4px;' : '';
  return `<span class="priority priority-${val}" style="${bgStyle}">${priorityLabel[val]}</span>`;
}

function orderCard(order, position) {
  const searchHaystack = `${order.cliente} ${order.tipo} ${order.descripcion} ${order.id} ${order.responsable}`.toLowerCase();
  return `<button class="order-card" data-action="detail" data-id="${escapeHtml(order.id)}" data-search="${escapeHtml(searchHaystack)}">
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
    const dA = getDeliveryDateObj(a.entrega) || new Date(9999, 0, 1);
    const dB = getDeliveryDateObj(b.entrega) || new Date(9999, 0, 1);
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
  ${next ? `<article class="hero-card"><p class="eyebrow">TU SIGUIENTE TRABAJO PRIORITARIO</p>${priorityPill(next)}<h2>${escapeHtml(next.cliente)}</h2><p>${escapeHtml(next.tipo)} · Entrega: ${escapeHtml(formatDate(next.entrega))}</p><div class="actions"><button class="action-button" data-action="detail" data-id="${escapeHtml(next.id)}">Ver detalle</button></div></article>` : '<div class="empty"><strong>Tu cola de trabajo está al día.</strong></div>'}
  <p class="section-heading">CRÍTICOS DEL EQUIPO</p>
  <div class="order-list">${critical.map(orderCard).join("") || '<div class="team-note">No hay pedidos críticos en el taller.</div>'}</div>`;
}

function queueView() {
  const list = getMyOpenOrders();
  return list.length ? `<div class="order-list">${list.map(orderCard).join("")}</div>` : '<div class="empty"><strong>No tienes pedidos asignados pendientes</strong></div>';
}

function historyView() {
  const orders = state.data.finishedOrders || [];
  const users = state.data.users || [];

  return `
    <div class="search-box" style="margin-bottom:12px; display:flex; gap:8px;">
      <input type="text" id="history-search-input" value="${escapeHtml(state.filters.historySearch)}" placeholder="🔍 Escribe para buscar en el historial..." style="flex:1; padding:10px; border-radius:6px; border:1px solid var(--border-color);">
      <select id="history-resp-filter" style="padding:10px; border-radius:6px; border:1px solid var(--border-color);">
        <option value="">Todos los Responsables</option>
        ${users.map(u => `<option value="${escapeHtml(u.name)}" ${state.filters.historyResponsable.toLowerCase() === u.name.toLowerCase() ? "selected" : ""}>${escapeHtml(u.name)}</option>`).join("")}
      </select>
    </div>

    ${!orders.length ? '<div class="empty"><strong>No hay proyectos archivados</strong></div>' : ''}

    <div class="order-list" id="history-list">${orders.map((order) => {
      const links = String(order.fotoEvidencia || "").split("\n").filter(Boolean);
      const refLinks = String(order.fotoReferencia || "").split("\n").filter(Boolean);
      const isEntregado = order.estado === "Entregado";
      const searchHaystack = `${order.cliente} ${order.tipo} ${order.descripcion} ${order.id} ${order.responsable}`.toLowerCase();
      
      return `
      <article class="order-card history-card-item" data-search="${escapeHtml(searchHaystack)}" data-responsable="${escapeHtml(order.responsable.toLowerCase())}" style="border-left: 5px solid ${isEntregado ? '#2e7d32' : '#f57c00'}; margin-bottom:10px;">
        <div class="order-top">
          <div><h3>${escapeHtml(order.cliente)}</h3><p>${escapeHtml(order.tipo)} (${escapeHtml(order.id)})</p></div>
          <span class="priority" style="background:${isEntregado ? '#2e7d32' : '#f57c00'}; color:white;">${escapeHtml(order.estado)}</span>
        </div>
        <div class="meta">
          Entrega pactada: ${escapeHtml(formatDate(order.entrega))}<br/>
          Responsable: <strong>${escapeHtml(order.responsable)}</strong><br/>
          ⏱️ Tiempo invertido: <strong>${order.duracionRealMin || 0} min</strong><br/>
          ${order.descripcion ? `<strong>Motivo/Detalles:</strong> ${escapeHtml(order.descripcion)}<br/>` : ""}
          ${order.comentarioCierre ? `<strong>Observación Cierre:</strong> ${escapeHtml(order.comentarioCierre)}<br/>` : ""}
          
          <div style="margin-top:6px;">
            ${refLinks.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" style="color:#00838f; font-weight:bold; text-decoration:underline; margin-right:8px;">📌 Ref ${idx + 1}</a>`).join("")}
            ${links.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" style="color:#1976d2; font-weight:bold; text-decoration:underline; margin-right:8px;">📷 Evidencia ${idx + 1}</a>`).join("")}
          </div>

          ${isLead() ? `
            <div class="actions" style="margin-top:10px; display:flex; gap:6px;">
              ${!isEntregado ? `<button class="secondary-button" style="background:#2e7d32; color:white; padding:6px 10px; font-size:12px;" data-action="mark-delivered" data-id="${escapeHtml(order.id)}">🚚 Marcar Entregado</button>` : ''}
              <button class="secondary-button" style="background:#1976d2; color:white; padding:6px 10px; font-size:12px;" data-action="reopen-order" data-id="${escapeHtml(order.id)}">🔄 Reabrir / Pasar a Activo</button>
            </div>
          ` : ''}
        </div>
      </article>
    `;
    }).join('')}</div>
  `;
}

function teamView() {
  const orders = sortOrdersByUrgency((state.data.allOrders || []).filter(active));

  return `
    <div class="actions"><button class="primary-button" data-action="new-order">＋ Registrar nuevo pedido</button></div>
    <div style="margin:10px 0;">
      <input type="text" id="team-search-input" value="${escapeHtml(state.filters.teamSearch)}" placeholder="🔍 Filtrar por cliente, motivo, responsable..." style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color);">
    </div>
    <p class="section-heading">TODOS LOS PEDIDOS ACTIVOS DEL TALLER (${orders.length})</p>
    <div class="order-list" id="team-list">${orders.map(orderCard).join("") || '<div class="team-note">No hay pedidos activos.</div>'}</div>
  `;
}

function settingsView() {
  const session = state.session;
  
  const fcList = state.frequentClients.map((c) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid var(--border-color); margin-bottom:6px; border-radius:6px;">
      <div><strong>${escapeHtml(c.name)}</strong><br/><small>${escapeHtml(c.phone || "Sin teléfono")}</small></div>
      ${isLead() ? `<button class="secondary-button" style="background:#d32f2f; color:white;" data-action="delete-client" data-name="${escapeHtml(c.name)}">🗑️</button>` : ''}
    </div>
  `).join("");
  
  const ftList = state.frequentTypes.map((t) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid var(--border-color); margin-bottom:6px; border-radius:6px;">
      <strong>${escapeHtml(t)}</strong>
      ${isLead() ? `<button class="secondary-button" style="background:#d32f2f; color:white;" data-action="delete-type" data-type="${escapeHtml(t)}">🗑️</button>` : ''}
    </div>
  `).join("");

  const usersList = (state.data.users || []).map((u) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid var(--border-color); margin-bottom:6px; border-radius:6px;">
      <div><strong>${escapeHtml(u.name)}</strong> <small>(${escapeHtml(u.role)})</small><br/><span style="color:${u.active ? 'green' : 'red'}; font-size:12px;">${u.active ? '● Activo' : '○ Inactivo'}</span></div>
      <button class="secondary-button" data-action="toggle-user" data-name="${escapeHtml(u.name)}" data-active="${u.active}">${u.active ? 'Desactivar' : 'Activar'}</button>
    </div>
  `).join("");

  return `
    <div class="card settings-card" style="padding:12px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:15px;">
      <h3>Mi perfil</h3>
      <div class="detail-row"><span>NOMBRE:</span> <strong>${escapeHtml(session ? session.name : "")}</strong></div>
      <div class="detail-row"><span>ROL:</span> <strong>${escapeHtml(session ? session.role : "")}</strong></div>
      <button class="secondary-button" data-action="logout" style="margin-top:10px;">Cerrar sesión</button>
      <button class="secondary-button" data-action="clear-cache" style="margin-top:8px;">🧹 Limpiar Caché Local</button>
    </div>

    <div class="card settings-card" style="padding:12px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:15px;">
      <h3>🎨 Personalización Estética</h3>
      <label class="field"><span class="field-label">TEMA DE LA INTERFAZ</span>
        <select id="theme-selector" style="padding:8px;">
          <option value="light" ${state.theme === "light" ? "selected" : ""}>☀️ Modo Claro (Estándar)</option>
          <option value="dark" ${state.theme === "dark" ? "selected" : ""}>🌙 Modo Oscuro</option>
          <option value="pink" ${state.theme === "pink" ? "selected" : ""}>🌸 Rosa Creativo</option>
          <option value="emerald" ${state.theme === "emerald" ? "selected" : ""}>🌲 Verde Esmeralda</option>
        </select>
      </label>
      <label class="field" style="margin-top:8px;"><span class="field-label">COLOR PRINCIPAL (BOTONES Y DESTACADOS)</span>
        <input type="color" id="custom-color-picker" value="${state.customColor}" style="height:40px; cursor:pointer;">
      </label>
    </div>

    ${isLead() ? `
      <div class="card settings-card" style="padding:12px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:15px;">
        <h3>📲 Plantilla de Notificación WhatsApp</h3>
        <p style="font-size:12px;">Variables disponibles: {cliente}, {tipo}, {estado}</p>
        <textarea id="wa-template-input" style="width:100%; height:80px; margin-top:6px; padding:6px; border-radius:6px; border:1px solid var(--border-color);">${escapeHtml(state.waTemplate)}</textarea>
        <button class="primary-button" id="btn-save-wa-template" style="margin-top:6px;">Guardar Plantilla</button>
      </div>

      <p class="section-heading">GESTIÓN DE PERFILES / USUARIOS</p>
      <button class="primary-button" data-action="new-user" style="margin-bottom:10px;">＋ Crear Nuevo Perfil</button>
      <div class="user-list">${usersList || '<div class="team-note">No hay usuarios registrados.</div>'}</div>
    ` : ''}

    <p class="section-heading">CLIENTES FRECUENTES (${state.frequentClients.length})</p>
    ${isLead() ? `<button class="primary-button" data-action="new-client" style="margin-bottom:10px;">＋ Agregar Cliente Frecuente</button>` : ''}
    <div class="user-list">${fcList || '<div class="team-note">No hay clientes guardados.</div>'}</div>

    <p class="section-heading">TIPOS DE TRABAJO (${state.frequentTypes.length})</p>
    ${isLead() ? `<button class="primary-button" data-action="new-type" style="margin-bottom:10px;">＋ Agregar Tipo de Trabajo</button>` : ''}
    <div class="user-list">${ftList || '<div class="team-note">No hay tipos de trabajo guardados.</div>'}</div>
  `;
}

function filterHistoryDOM() {
  const query = state.filters.historySearch.toLowerCase().trim();
  const resp = state.filters.historyResponsable.toLowerCase().trim();
  const cards = document.querySelectorAll(".history-card-item");

  cards.forEach(card => {
    const haystack = card.dataset.search || "";
    const cardResp = card.dataset.responsable || "";
    const matchesQuery = !query || haystack.includes(query);
    const matchesResp = !resp || cardResp === resp;
    card.style.display = matchesQuery && matchesResp ? "block" : "none";
  });
}

function filterTeamDOM() {
  const query = state.filters.teamSearch.toLowerCase().trim();
  const cards = document.querySelectorAll("#team-list .order-card");

  cards.forEach(card => {
    const haystack = card.dataset.search || "";
    card.style.display = !query || haystack.includes(query) ? "block" : "none";
  });
}

function render() {
  if (!state.session) return;
  applyTheme();
  const screenNames = { now: "Ahora", queue: "Mi cola", team: "Equipo", history: "Historial", settings: "Ajustes" };
  $("#screen-title").textContent = screenNames[state.screen];
  $("#role-label").textContent = `${state.session.role.toUpperCase()} · ${state.session.name.toUpperCase()}`;
  $("#screen").innerHTML = ({ now: nowView, queue: queueView, team: teamView, history: historyView, settings: settingsView })[state.screen]();
  
  document.querySelectorAll(".nav-button").forEach((btn) => btn.classList.toggle("active", btn.dataset.screen === state.screen));

  // Búsqueda fluida sin perder el foco
  const histInput = $("#history-search-input");
  if (histInput) {
    histInput.addEventListener("input", (e) => {
      state.filters.historySearch = e.target.value;
      filterHistoryDOM();
    });
  }

  const histResp = $("#history-resp-filter");
  if (histResp) {
    histResp.addEventListener("change", (e) => {
      state.filters.historyResponsable = e.target.value;
      filterHistoryDOM();
    });
  }

  const teamInput = $("#team-search-input");
  if (teamInput) {
    teamInput.addEventListener("input", (e) => {
      state.filters.teamSearch = e.target.value;
      filterTeamDOM();
    });
  }

  // Theme Listeners
  $("#theme-selector")?.addEventListener("change", (e) => {
    state.theme = e.target.value;
    store.set("pp_theme", state.theme);
    applyTheme();
  });
  $("#custom-color-picker")?.addEventListener("input", (e) => {
    state.customColor = e.target.value;
    store.set("pp_custom_color", state.customColor);
    applyTheme();
  });

  // Guardar plantilla WhatsApp
  $("#btn-save-wa-template")?.addEventListener("click", async () => {
    const val = $("#wa-template-input").value.trim();
    if (!val) return alert("La plantilla no puede estar vacía");
    state.waTemplate = val;
    store.set("pp_wa_template", val);
    try {
      await api("profile_save_wa_template", { template: val });
      showToast("Plantilla guardada exitosamente.");
    } catch (err) {
      showToast("Guardada localmente.");
    }
  });
}

function openModal(content) { const m = $("#modal"); if (m) { m.innerHTML = `<div class="modal-content">${content}</div>`; m.showModal(); } }
function closeModal() { const m = $("#modal"); if (m) m.close(); }

function detail(order) {
  const rawPhone = cleanPhoneNumber(order.telefono);
  const waMsg = state.waTemplate
    .replace(/{cliente}/g, order.cliente)
    .replace(/{tipo}/g, order.tipo)
    .replace(/{estado}/g, order.estado);

  const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(waMsg)}`;

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
      <div class="detail-row"><span>MOTIVO / DETALLES</span><strong>${escapeHtml(order.descripcion || "Sin descripción")}</strong></div>
    </div>
    ${rawPhone ? `<div class="actions" style="margin-top:12px;"><a href="${whatsappUrl}" target="_blank" rel="noopener" class="secondary-button" style="background:#25D366; color:white; text-align:center; display:block;">📲 Notificar por WhatsApp</a></div>` : ""}
    ${isLead() ? `<div class="actions" style="margin-top:12px;"><button class="secondary-button" style="background:#d32f2f; color:white; width:100%;" data-action="delete-order" data-id="${escapeHtml(order.id)}">🗑️ Eliminar Pedido del Sistema</button></div>` : ""}
  `);

  $("#status-change-select").addEventListener("change", async (e) => {
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
      } catch (err) { alert(`Error: ${err.message}`); }
    }
  });
}

function openFinishModal(order, targetStatus) {
  openModal(`
    <div class="modal-head"><h2>Completar Pedido (${targetStatus})</h2><button class="close-button" data-action="close">×</button></div>
    <form id="finish-form" class="form-grid">
      <label class="field"><span class="field-label">COMENTARIO DE CIERRE / OBSERVACIÓN</span>
        <textarea name="comentarioCierre" required placeholder="Escribe un comentario final o imprevisto..."></textarea>
      </label>
      <label class="field"><span class="field-label">SUBIR EVIDENCIA FOTOGRÁFICA (HASTA 3 FOTOS)</span>
        <input type="file" id="evidencia-files" accept="image/*" multiple>
      </label>
      <div class="modal-footer"><button type="submit" class="primary-button">Guardar y Finalizar Pedido</button></div>
    </form>
  `);

  $("#finish-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "Procesando...";

    const filesInput = $("#evidencia-files");
    const files = Array.from(filesInput.files).slice(0, 3);
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
    
    <div style="background:var(--bg-body); padding:10px; border-radius:6px; margin-bottom:12px; border:1px dashed var(--border-color);">
      <strong>🧙‍♂️ Pegado Mágico (WhatsApp)</strong>
      <textarea id="magic-paste-text" placeholder="Pega aquí la plantilla que envió el cliente por WhatsApp..." style="width:100%; height:60px; margin-top:4px; font-size:12px;"></textarea>
      <button type="button" class="secondary-button" id="btn-magic-parse" style="margin-top:4px; width:100%;">✨ Autocompletar Campos</button>
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

      <div class="form-inline">
        <label class="field"><span class="field-label">FECHA DE ENTREGA</span><input type="date" id="input-fecha" name="fechaEntrega" required></label>
        <label class="field"><span class="field-label">HORA DE ENTREGA</span>
          <select name="horaEntrega" required>
            <option value="11:00 AM" selected>11:00 AM</option>
            <option value="02:00 PM">02:00 PM</option>
            <option value="05:00 PM">05:00 PM</option>
          </select>
        </label>
      </div>

      <label class="field"><span class="field-label">RESPONSABLE</span>
        <select name="responsable"><option value="">Sin asignar</option>${users.map(u => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join("")}</select>
      </label>
      <label class="field"><span class="field-label">MOTIVO / MEDIDAS / DETALLES</span><textarea id="input-descripcion" name="descripcion" placeholder="Detalles del pedido, medidas de la torta, temática..."></textarea></label>
      
      <label class="field"><span class="field-label">FOTO DE REFERENCIA DEL CLIENTE (OPCIONAL)</span>
        <input type="file" id="input-ref-file" accept="image/*">
      </label>

      <div class="modal-footer"><button type="submit" class="primary-button">Guardar Pedido</button></div>
    </form>
  `);

  $("#btn-magic-parse")?.addEventListener("click", () => {
    const raw = $("#magic-paste-text").value;
    if (!raw) return alert("Pega primero un texto en el recuadro.");

    const lines = raw.split('\n');
    let cliente = "", telefono = "", tipo = "", motivo = "", medidas = "", detalles = [];

    lines.forEach(line => {
      const lower = line.toLowerCase();
      if (lower.includes("cliente:") || lower.includes("nombre:")) cliente = line.split(":")[1]?.trim() || cliente;
      else if (lower.includes("tel:") || lower.includes("teléfono:") || lower.includes("telefono:") || lower.includes("ws:") || lower.includes("whatsapp:")) telefono = line.split(":")[1]?.trim() || telefono;
      else if (lower.includes("tipo:") || lower.includes("trabajo:") || lower.includes("producto:")) tipo = line.split(":")[1]?.trim() || tipo;
      else if (lower.includes("motivo:") || lower.includes("temática:") || lower.includes("tematica:")) motivo = line.split(":")[1]?.trim();
      else if (lower.includes("medida:") || lower.includes("medidas:") || lower.includes("torta:")) medidas = line.split(":")[1]?.trim();
      else if (line.trim()) detalles.push(line.trim());
    });

    if (cliente) $("#input-cliente").value = cliente;
    if (telefono) $("#input-telefono").value = cleanPhoneNumber(telefono);
    if (tipo) $("#input-tipo").value = tipo;

    let descParts = [];
    if (motivo) descParts.push(`Motivo: ${motivo}`);
    if (medidas) descParts.push(`Medidas: ${medidas}`);
    if (detalles.length) descParts.push(`Detalles: ${detalles.join(" | ")}`);

    if (descParts.length) $("#input-descripcion").value = descParts.join("\n");
    showToast("Campos autocompletados con éxito.");
  });

  $("#fc-select")?.addEventListener("change", (e) => {
    if (e.target.value !== "") {
      const c = clients[e.target.value];
      $("#input-cliente").value = c.name;
      $("#input-telefono").value = c.phone || "";
    }
  });

  $("#ft-select")?.addEventListener("change", (e) => {
    if (e.target.value && e.target.value !== "__CUSTOM__") $("#input-tipo").value = e.target.value;
  });

  $("#order-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    const refInput = $("#input-ref-file");
    let refImageData = null;
    if (refInput && refInput.files.length > 0) {
      const f = refInput.files[0];
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result.split(',')[1]);
        reader.readAsDataURL(f);
      });
      refImageData = { data: base64, mimeType: f.type };
    }

    try {
      await api("profile_create_order", { 
        form: Object.fromEntries(new FormData(e.target)),
        refImage: refImageData
      });
      closeModal();
      await refresh(false);
      showToast("Pedido guardado exitosamente.");
    } catch (err) {
      btn.disabled = false;
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

  $("#user-form").addEventListener("submit", async (e) => {
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
      $("#login-view").classList.add("hidden");
      $("#workspace").classList.remove("hidden");
      await refresh(false);
    } catch (err) {
      $("#login-error").textContent = err.message;
    }
  });
}

$("#refresh")?.addEventListener("click", () => refresh());
document.querySelectorAll(".nav-button").forEach((btn) => btn.addEventListener("click", () => { state.screen = btn.dataset.screen; render(); }));

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]"); if (!btn) return;
  const act = btn.dataset.action;
  if (act === "close") return closeModal();
  if (act === "detail") { const o = [...state.data.allOrders, ...state.data.finishedOrders, ...state.data.myOrders].find(i => String(i.id) === String(btn.dataset.id)); if (o) detail(o); return; }
  if (act === "new-order") return formOrder();
  if (act === "new-user") return formNewUser();
  if (act === "clear-cache") { store.remove("pp_profile_data"); showToast("Caché borrada."); return refresh(); }

  if (act === "mark-delivered") {
    if (confirm("¿Confirmar que el cliente ya retiró su pedido?")) {
      try {
        await api("profile_update_order", { id: btn.dataset.id, changes: { estado: "Entregado" } });
        await refresh(false);
        showToast("Pedido marcado como Entregado.");
      } catch (err) { alert(err.message); }
    }
    return;
  }

  if (act === "reopen-order") {
    if (confirm("¿Deseas reactivar este pedido y regresarlo a la bandeja de pendientes?")) {
      try {
        await api("profile_reopen_order", { id: btn.dataset.id });
        await refresh(false);
        showToast("Pedido reactivado y regresado a la bandeja activa.");
      } catch (err) { alert(err.message); }
    }
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
    if (confirm(`¿Eliminar el cliente "${btn.dataset.name}"?`)) {
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
    if (confirm(`¿Eliminar el tipo de trabajo "${btn.dataset.type}"?`)) {
      try {
        await api("profile_delete_type", { type: btn.dataset.type });
        await refresh(false);
        showToast("Tipo de trabajo eliminado.");
      } catch (err) { alert(err.message); }
    }
    return;
  }

  if (act === "delete-order") {
    if (confirm("¿Seguro que deseas eliminar este pedido permanentemente?")) {
      try {
        await api("profile_delete_order", { id: btn.dataset.id });
        closeModal();
        await refresh(false);
        showToast("Pedido eliminado correctamente.");
      } catch (err) { alert(err.message); }
    }
    return;
  }

  if (act === "toggle-user") {
    if (confirm(`¿Cambiar estado de ${btn.dataset.name}?`)) {
      await api("profile_toggle_user", { name: btn.dataset.name, active: btn.dataset.active !== "true" });
      await refresh(false);
    }
    return;
  }
  if (act === "logout") { store.remove("pp_profile_session"); state.session = null; location.reload(); return; }
});

if (state.session) {
  $("#login-view")?.classList.add("hidden");
  $("#workspace")?.classList.remove("hidden");
  render();
  refresh(false);
}
