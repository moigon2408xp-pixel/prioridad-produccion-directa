const $ = (selector) => document.querySelector(selector);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); },
};

// Normalizadores de datos provenientes de Google Sheets
const normalizeClient = (c) => ({
  name: String(c.name || c.Nombre || c.nombre || "").trim(),
  phone: cleanPhoneNumber(c.phone || c.Telefono || c.telefono || c.celular || "")
});

const normalizeType = (t) => {
  if (typeof t === 'string') return t.trim();
  return String(t.type || t.Tipo || t.tipo || t.nombre || "").trim();
};

const normalizeOrder = (o) => ({
  id: String(o.id || o['ID Pedido'] || o.ID || "").trim(),
  cliente: String(o.cliente || o.Cliente || "Sin cliente").trim(),
  tipo: String(o.tipo || o['Tipo de trabajo'] || o.Tipo || o.trabajo || "Sin tipo").trim(),
  descripcion: String(o.descripcion || o.Descripción || "").trim(),
  entrega: String(o.entrega || o['Fecha entrega'] || o.Entrega_comprometida || "").trim(),
  responsable: String(o.responsable || o.Responsable || "Sin asignar").trim(),
  estado: String(o.estado || o.Estado || "Pendiente").trim(),
  telefono: String(o.telefono || o.Telefono || o['Teléfono'] || o.phone || "").trim(),
  comentarioCierre: String(o.comentarioCierre || o.Comentario_cierre || "").trim(),
  fotoEvidencia: String(o.fotoEvidencia || o.Evidencias_Drive || o.foto || "").trim(),
  cerrado: String(o.cerrado || o.Cerrado || "No").trim()
});

const normalizeUser = (u) => ({
  name: String(u.name || u.Nombre || "").trim(),
  role: String(u.role || u.Perfil || "trabajador").toLowerCase().trim(),
  active: String(u.active || u.Activo || "Sí").toLowerCase() === "sí" || u.active === true || u.active === "true"
});

const state = {
  session: store.get("pp_profile_session", null),
  frequentClients: [],
  frequentTypes: [],
  waTemplate: "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega.",
  screen: "now",
  offline: false,
  data: { myOrders: [], teamCritical: [], allOrders: [], finishedOrders: [], users: [] },
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function cleanPhoneNumber(phone = "") {
  let num = String(phone).replace(/\D/g, "");
  if (!num) return "";
  if (num.startsWith("0")) num = "58" + num.slice(1);
  else if (num.length === 10 && !num.startsWith("58")) num = "58" + num;
  return num;
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

const priorityLabel = {
  overdue: "🚨 ¡RETRASADO!",
  now: "Hacer ahora",
  today: "Hacer hoy",
  later: "Programar"
};

const active = (order) => !["Terminado", "Entregado", "Cancelado"].includes(order.estado) && order.cerrado !== "Sí";
const operable = (order) => active(order);
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
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.ppToast);
  window.ppToast = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function api(action, extra = {}) {
  const baseUrl = window.PRIORIDAD_CONFIG?.appsScriptUrl || "https://script.google.com/macros/s/AKfycby_mIt5VzEOZjKb6znpYXH_T0Q0jJfEqr5UB1Z8l0JpUiHfEC9CuRuK9z2s_Q3lNl6www/exec";
  const payload = { action, token: state.session?.token || "", ...extra };

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data && (data.ok || data.exito)) return data;
  throw new Error(data?.error || data?.mensaje || "Error al procesar la solicitud.");
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

    state.frequentClients = (rawData.frequentClients || []).map(normalizeClient).filter(c => c.name);
    state.frequentTypes = (rawData.frequentTypes || []).map(normalizeType).filter(Boolean);
    state.waTemplate = rawData.waTemplate || state.waTemplate;
    state.offline = false;

    store.set("pp_profile_data", state.data);
    render();
    if (showMessage) showToast("Información sincronizada.");
  } catch (error) {
    state.offline = true;
    render();
    if (showMessage) showToast("Modo sin conexión.");
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
  return `<button class="order-card" data-action="detail" data-id="${escapeHtml(order.id)}">
    <div class="order-top">
      <div><h3>${position === undefined ? "" : `${position + 1}. `}${escapeHtml(order.cliente)}</h3><p>${escapeHtml(order.tipo)}</p></div>
      ${priorityPill(order)}
    </div>
    <div class="meta">
      Estado: <strong>${escapeHtml(order.estado)}</strong><br/>
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

function nowView() {
  const myOpenOrders = sortOrdersByUrgency((state.data.myOrders || []).filter(operable));
  const next = myOpenOrders[0];
  const critical = sortOrdersByUrgency((state.data.teamCritical || []).filter(operable));

  return `${state.offline ? '<p class="offline">Mostrando información guardada localmente.</p>' : ""}
  ${next ? `<article class="hero-card"><p class="eyebrow">TU SIGUIENTE TRABAJO PRIORITARIO</p>${priorityPill(next)}<h2>${escapeHtml(next.cliente)}</h2><p>${escapeHtml(next.tipo)} · Entrega: ${escapeHtml(formatDate(next.entrega))}</p><div class="actions"><button class="action-button" data-action="detail" data-id="${escapeHtml(next.id)}">Ver detalle</button></div></article>` : '<div class="empty"><strong>Tu cola está al día</strong></div>'}
  <p class="section-heading">CRÍTICOS DEL EQUIPO</p>
  <div class="order-list">${critical.map(orderCard).join("") || '<div class="team-note">No hay pedidos críticos.</div>'}</div>`;
}

function queueView() {
  const list = sortOrdersByUrgency((state.data.myOrders || []).filter(active));
  return list.length ? `<div class="order-list">${list.map(orderCard).join("")}</div>` : '<div class="empty"><strong>No tienes pedidos pendientes</strong></div>';
}

function historyView() {
  const orders = state.data.finishedOrders || [];
  if (!orders.length) return '<div class="empty"><strong>No hay proyectos terminados en el historial</strong></div>';

  return `<div class="order-list">${orders.map((order) => `
    <article class="order-card">
      <div class="order-top">
        <div><h3>${escapeHtml(order.cliente)}</h3><p>${escapeHtml(order.tipo)}</p></div>
        <span class="priority" style="background:#2e7d32; color:white;">${escapeHtml(order.estado)}</span>
      </div>
      <div class="meta">
        Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>
        Responsable: ${escapeHtml(order.responsable)}<br/>
        ${order.comentarioCierre ? `<strong>Observación:</strong> ${escapeHtml(order.comentarioCierre)}<br/>` : ""}
        ${order.fotoEvidencia ? `<a href="${escapeHtml(order.fotoEvidencia)}" target="_blank" rel="noopener" style="color:#1976d2; font-weight:bold; text-decoration:underline;">📷 Evidencia en Google Drive</a>` : ""}
      </div>
    </article>
  `).join('')}</div>`;
}

function teamView() {
  const orders = sortOrdersByUrgency((state.data.allOrders || []).filter(active));
  return `<div class="actions"><button class="primary-button" data-action="new-order">＋ Registrar pedido</button></div><p class="section-heading">PEDIDOS ACTIVOS (${orders.length})</p><div class="order-list">${orders.map(orderCard).join("") || '<div class="team-note">No hay pedidos activos.</div>'}</div>`;
}

function settingsView() {
  const session = state.session;
  const fcList = state.frequentClients.map((c, i) => `<div class="user-card"><div><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.phone || "Sin teléfono")}</span></div><button class="secondary-button" style="border-color:red; color:red;" data-action="delete-fc" data-index="${i}">🗑</button></div>`).join("");
  const ftList = state.frequentTypes.map((t, i) => `<div class="user-card"><div><strong>${escapeHtml(t)}</strong></div><button class="secondary-button" style="border-color:red; color:red;" data-action="delete-ft" data-index="${i}">🗑</button></div>`).join("");
  const usersList = (state.data.users || []).map((u, i) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid #ddd; margin-bottom:6px; border-radius:6px;">
      <div><strong>${escapeHtml(u.name)}</strong> <small>(${escapeHtml(u.role)})</small><br/><span style="color:${u.active ? 'green' : 'red'}; font-size:12px;">${u.active ? '● Activo' : '○ Inactivo'}</span></div>
      <button class="secondary-button" data-action="toggle-user" data-name="${escapeHtml(u.name)}" data-active="${u.active}">${u.active ? 'Desactivar' : 'Activar'}</button>
    </div>
  `).join("");

  return `
    <div class="card settings-card">
      <h3>Mi perfil</h3>
      <div class="detail-row"><span>NOMBRE</span><strong>${escapeHtml(session ? session.name : "")}</strong></div>
      <div class="detail-row"><span>ROL</span><strong>${escapeHtml(session ? session.role : "")}</strong></div>
      <button class="secondary-button" data-action="logout">Cerrar sesión</button>
      <button class="secondary-button" data-action="clear-cache" style="margin-top:8px;">🧹 Limpiar Caché Local</button>
    </div>

    ${isLead() ? `
      <p class="section-heading">GESTIÓN DE PERFILES / USUARIOS</p>
      <button class="primary-button" data-action="new-user">＋ Crear Nuevo Perfil</button>
      <div class="user-list" style="margin-top:10px;">${usersList || '<div class="team-note">No hay usuarios registrados.</div>'}</div>

      <p class="section-heading">PLANTILLA WHATSAPP</p>
      <div class="card settings-card" style="margin-bottom:15px;">
        <label class="field">
          <textarea id="wa-template-input" style="min-height:70px;">${escapeHtml(state.waTemplate)}</textarea>
        </label>
        <button class="primary-button" id="save-wa-template" style="margin-top:8px;">Guardar Plantilla</button>
      </div>
    ` : ''}

    <p class="section-heading">CLIENTES FRECUENTES (DESDE GOOGLE SHEETS)</p>
    <button class="primary-button" data-action="new-frequent-client">＋ Agregar Cliente Frecuente</button>
    <div class="user-list" style="margin-top:10px;">${fcList || '<div class="team-note">No hay clientes guardados.</div>'}</div>

    <p class="section-heading">TIPOS DE TRABAJO (DESDE GOOGLE SHEETS)</p>
    <button class="primary-button" data-action="new-frequent-type">＋ Agregar Tipo de Trabajo</button>
    <div class="user-list" style="margin-top:10px;">${ftList || '<div class="team-note">No hay tipos de trabajo guardados.</div>'}</div>
  `;
}

function render() {
  if (!state.session) return;
  const screenNames = { now: "Ahora", queue: "Mi cola", team: "Equipo", history: "Historial", settings: "Ajustes" };
  $("#screen-title").textContent = screenNames[state.screen];
  $("#role-label").textContent = `${state.session.role.toUpperCase()} · ${state.session.name.toUpperCase()}`;
  $("#screen").innerHTML = ({ now: nowView, queue: queueView, team: teamView, history: historyView, settings: settingsView })[state.screen]();
  
  document.querySelectorAll(".nav-button").forEach((btn) => btn.classList.toggle("active", btn.dataset.screen === state.screen));
}

function openModal(content) { const m = $("#modal"); if (m) { m.innerHTML = `<div class="modal-content">${content}</div>`; m.showModal(); } }
function closeModal() { const m = $("#modal"); if (m) m.close(); }

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
      const data = Object.fromEntries(new FormData(e.target));
      await api("profile_create_user", data);
      closeModal();
      await refresh(false);
      showToast("Perfil de usuario creado en Google Sheets.");
    } catch (err) {
      btn.disabled = false;
      alert(`Error: ${err.message}`);
    }
  });
}

function detail(order) {
  const rawPhone = cleanPhoneNumber(order.telefono);
  const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(state.waTemplate.replace(/{cliente}/g, order.cliente).replace(/{tipo}/g, order.tipo).replace(/{estado}/g, order.estado))}`;

  openModal(`
    <div class="modal-head"><div><p class="eyebrow">${escapeHtml(order.id)}</p><h2>${escapeHtml(order.cliente)}</h2></div><button class="close-button" data-action="close">×</button></div>
    <div class="detail-grid">
      <div class="detail-row"><span>TIPO DE TRABAJO</span><strong>${escapeHtml(order.tipo)}</strong></div>
      <div class="detail-row"><span>ESTADO</span>
        <select id="status-change-select" data-id="${escapeHtml(order.id)}">
          ${["Pendiente", "En proceso", "Pausado", "Terminado", "Entregado", "Cancelado"].map((st) => `<option value="${st}" ${order.estado === st ? "selected" : ""}>${st}</option>`).join("")}
        </select>
      </div>
      <div class="detail-row"><span>ENTREGA</span><strong>${escapeHtml(formatDate(order.entrega))}</strong></div>
      <div class="detail-row"><span>RESPONSABLE</span><strong>${escapeHtml(order.responsable)}</strong></div>
      <div class="detail-row"><span>TELÉFONO</span><strong>${escapeHtml(order.telefono || "No registrado")}</strong></div>
      <div class="detail-row"><span>DESCRIPCIÓN</span><strong>${escapeHtml(order.descripcion || "Sin descripción")}</strong></div>
    </div>
    <div class="actions" style="margin-top:12px;">
      <a href="${whatsappUrl}" target="_blank" rel="noopener" class="secondary-button" style="background:#25D366; color:white; border:none; text-align:center; display:block; font-weight:bold;">📲 Notificar por WhatsApp</a>
    </div>
    ${isLead() ? `<button class="secondary-button" style="border-color:red; color:red; margin-top:8px;" data-action="delete-single-order" data-id="${escapeHtml(order.id)}">🗑 Eliminar pedido</button>` : ""}
  `);

  $("#status-change-select").addEventListener("change", async (e) => {
    try {
      await api("profile_update_order", { id: order.id, changes: { estado: e.target.value } });
      closeModal();
      await refresh(false);
      showToast("Estado actualizado.");
    } catch (err) {
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
    <form id="order-form" class="form-grid">
      ${clients.length ? `
        <label class="field"><span class="field-label">CLIENTE FRECUENTE</span>
          <select id="fc-select"><option value="">-- Seleccionar de la lista --</option>${clients.map((c, i) => `<option value="${i}">${escapeHtml(c.name)} (${escapeHtml(c.phone)})</option>`).join("")}</select>
        </label>` : ''}
      <label class="field"><span class="field-label">NOMBRE DEL CLIENTE</span><input id="input-cliente" name="cliente" required></label>
      <label class="field"><span class="field-label">TELÉFONO WHATSAPP</span><input id="input-telefono" name="telefono" placeholder="Ej. 04121234567"></label>
      
      <label class="field"><span class="field-label">TIPO DE TRABAJO</span>
        ${types.length ? `<select id="ft-select" style="margin-bottom:6px;"><option value="">-- Seleccionar de Excel --</option>${types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}<option value="__CUSTOM__">Escribir otro...</option></select>` : ''}
        <input id="input-tipo" name="tipo" required placeholder="Ej. Topper Acrílico">
      </label>

      <div class="form-inline">
        <label class="field"><span class="field-label">FECHA DE ENTREGA</span><input type="date" name="fechaEntrega" required></label>
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
      <label class="field"><span class="field-label">DESCRIPCIÓN</span><textarea name="descripcion"></textarea></label>
      <div class="modal-footer"><button type="submit" class="primary-button">Guardar Pedido</button></div>
    </form>
  `);

  $("#fc-select")?.addEventListener("change", (e) => {
    if (e.target.value !== "") {
      const c = clients[e.target.value];
      $("#input-cliente").value = c.name;
      $("#input-telefono").value = c.phone;
    }
  });

  $("#ft-select")?.addEventListener("change", (e) => {
    if (e.target.value && e.target.value !== "__CUSTOM__") $("#input-tipo").value = e.target.value;
  });

  $("#order-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    try {
      await api("profile_create_order", { form: Object.fromEntries(new FormData(e.target)) });
      closeModal();
      await refresh(false);
      showToast("Pedido guardado.");
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
