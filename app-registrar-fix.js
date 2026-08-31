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
  entrega: String(o.entrega || o['Fecha entrega'] || o.Entrega_comprometida || "").trim(),
  responsable: String(o.responsable || o.Responsable || "Sin asignar").trim(),
  estado: String(o.estado || o.Estado || "Pendiente").trim(),
  telefono: cleanPhoneNumber(o.telefono || o.Telefono || o['Teléfono'] || o.phone || ""),
  comentarioCierre: String(o.comentarioCierre || o.Comentario_cierre || "").trim(),
  fotoEvidencia: String(o.fotoEvidencia || o.Evidencias_Drive || o.evidenciasDrive || "").trim(),
  inicioProduccion: String(o.inicioProduccion || o.Inicio_produccion || "").trim(),
  finProduccion: String(o.finProduccion || o.Fin_produccion || "").trim(),
  duracionRealMin: Number(o.duracionRealMin || o.Duracion_real_min || 0),
  ultimaPausa: String(o.ultimaPausa || o.UltimaPausa || "").trim(),
  tiempoPausadoMin: Number(o.tiempoPausadoMin || o.TiempoPausado || 0),
  cerrado: String(o.cerrado || o.Cerrado || "No").trim()
});

const normalizeUser = (u) => {
  if (!u) return { name: "", role: "trabajador", active: true };
  if (Array.isArray(u)) {
    return { name: String(u[0] || "").trim(), role: String(u[1] || "trabajador").toLowerCase().trim(), active: String(u[3] || "Sí").toLowerCase() === "sí" };
  }
  const isAct = typeof u.active === "boolean" ? u.active : (typeof u.activo === "boolean" ? u.activo : String(u.active || u.activo || u.Activo || "Sí").toLowerCase() === "sí" || u.active === "true");
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
  waTemplate: "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega.",
  screen: "now",
  offline: false,
  data: { myOrders: [], teamCritical: [], allOrders: [], finishedOrders: [], users: [] },
};

const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

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
  if (!value) return "Sin fecha";
  let str = String(value).trim();
  if (str.includes("AM") || str.includes("PM")) return str;

  if (str.includes(" - ")) str = str.split(" - ")[0];
  if (str.includes(" a las ")) str = str.split(" a las ")[0];

  let date;
  if (str.includes("/")) {
    const parts = str.split(" ")[0].split("/");
    if (parts.length === 3) {
      date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  } else {
    date = new Date(str);
  }

  if (!date || isNaN(date.getTime())) return String(value);

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${day}/${month}/${year} a las ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
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
    if (!data) throw new Error("El servidor devolvió una respuesta vacía.");
    if (data && (data.ok || data.exito)) return data;
    
    throw new Error(data?.error || data?.mensaje || "Error al procesar solicitud.");
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

    state.data = {
      myOrders: (rawData.myOrders || []).map(normalizeOrder),
      teamCritical: (rawData.teamCritical || []).map(normalizeOrder),
      allOrders: (rawData.allOrders || rawData.allorders || []).map(normalizeOrder),
      finishedOrders: (rawData.finishedOrders || rawData.pedidosTerminados || rawData.completedOrders || []).map(normalizeOrder),
      users: (rawData.allUsers || rawData.users || rawData.trabajadores || []).map(normalizeUser)
    };

    const rawClients = rawData.frequentClients || rawData.clients || rawData.clientes || rawData.telefonos || rawData.phones || [];
    const rawTypes = rawData.frequentTypes || rawData.types || rawData.tipos || rawData.tiposTrabajo || rawData.typesObjects || [];

    state.frequentClients = rawClients.map(normalizeClient).filter(c => c.name && c.name.toLowerCase() !== "nombre" && c.name.toLowerCase() !== "cliente");
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
  if (!orders.length) return '<div class="empty"><strong>No hay proyectos terminados en el historial</strong></div>';

  return `<div class="order-list">${orders.map((order) => {
    const links = String(order.fotoEvidencia || "").split("\n").filter(Boolean);
    return `
    <article class="order-card">
      <div class="order-top">
        <div><h3>${escapeHtml(order.cliente)}</h3><p>${escapeHtml(order.tipo)}</p></div>
        <span class="priority" style="background:#2e7d32; color:white;">${escapeHtml(order.estado)}</span>
      </div>
      <div class="meta">
        Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>
        Responsable: ${escapeHtml(order.responsable)}<br/>
        ⏱️ Tiempo invertido: <strong>${order.duracionRealMin || 0} min</strong><br/>
        ${order.comentarioCierre ? `<strong>Observación:</strong> ${escapeHtml(order.comentarioCierre)}<br/>` : ""}
        ${links.length ? links.map((link, idx) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" style="color:#1976d2; font-weight:bold; text-decoration:underline; display:inline-block; margin-right:8px;">📷 Foto ${idx + 1}</a>`).join("") : ""}
      </div>
    </article>
  `;
  }).join('')}</div>`;
}

function teamView() {
  const orders = sortOrdersByUrgency((state.data.allOrders || []).filter(active));
  return `<div class="actions"><button class="primary-button" data-action="new-order">＋ Registrar pedido</button></div><p class="section-heading">TODOS LOS PEDIDOS ACTIVOS DEL TALLER (${orders.length})</p><div class="order-list">${orders.map(orderCard).join("") || '<div class="team-note">No hay pedidos activos.</div>'}</div>`;
}

function settingsView() {
  const session = state.session;

  const fcList = state.frequentClients.map((c) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid #ddd; margin-bottom:6px; border-radius:6px;">
      <div><strong>${escapeHtml(c.name)}</strong><br/><small>${escapeHtml(c.phone || "Sin teléfono")}</small></div>
      ${isLead() ? `<button class="secondary-button" style="background:#d32f2f; color:white;" data-action="delete-client" data-name="${escapeHtml(c.name)}">🗑️</button>` : ''}
    </div>
  `).join("");

  const ftList = state.frequentTypes.map((t) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid #ddd; margin-bottom:6px; border-radius:6px;">
      <strong>${escapeHtml(t)}</strong>
      ${isLead() ? `<button class="secondary-button" style="background:#d32f2f; color:white;" data-action="delete-type" data-type="${escapeHtml(t)}">🗑️</button>` : ''}
    </div>
  `).join("");

  const usersList = (state.data.users || []).map((u) => `
    <div class="user-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid #ddd; margin-bottom:6px; border-radius:6px;">
      <div><strong>${escapeHtml(u.name)}</strong> <small>(${escapeHtml(u.role)})</small><br/><span style="color:${u.active ? 'green' : 'red'}; font-size:12px;">${u.active ? '● Activo' : '○ Inactivo'}</span></div>
      <button class="secondary-button" data-action="toggle-user" data-name="${escapeHtml(u.name)}" data-active="${u.active}">${u.active ? 'Desactivar' : 'Activar'}</button>
    </div>
  `).join("");

  return `
    <div class="card settings-card" style="padding:12px; border:1px solid #ddd; border-radius:8px; margin-bottom:15px;">
      <h3>Mi perfil</h3>
      <div class="detail-row"><span>NOMBRE:</span> <strong>${escapeHtml(session ? session.name : "")}</strong></div>
      <div class="detail-row"><span>ROL:</span> <strong>${escapeHtml(session ? session.role : "")}</strong></div>
      <button class="secondary-button" data-action="logout" style="margin-top:10px;">Cerrar sesión</button>
      <button class="secondary-button" data-action="clear-cache" style="margin-top:8px;">🧹 Limpiar Caché Local</button>
    </div>

    ${isLead() ? `
      <p class="section-heading">GESTIÓN DE PERFILES / USUARIOS</p>
      <button class="primary-button" data-action="new-user" style="margin-bottom:10px;">＋ Crear Nuevo Perfil</button>
      <div class="user-list">${usersList || '<div class="team-note">No hay usuarios registrados.</div>'}</div>
    ` : ''}

    <p class="section-heading">CLIENTES FRECUENTES (${state.frequentClients.length})</p>
    ${isLead() ? `<button class="primary-button" data-action="new-client" style="margin-bottom:10px;">＋ Agregar Cliente Frecuente</button>` : ''}
    <div class="user-list">${fcList || '<div class="team-note">No hay clientes guardados en Google Sheets.</div>'}</div>

    <p class="section-heading">TIPOS DE TRABAJO (${state.frequentTypes.length})</p>
    ${isLead() ? `<button class="primary-button" data-action="new-type" style="margin-bottom:10px;">＋ Agregar Tipo de Trabajo</button>` : ''}
    <div class="user-list">${ftList || '<div class="team-note">No hay tipos de trabajo guardados.</div>'}</div>
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

function detail(order) {
  const rawPhone = cleanPhoneNumber(order.telefono);
  const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(state.waTemplate.replace(/{cliente}/g, order.cliente).replace(/{tipo}/g, order.tipo).replace(/{estado}/g, order.estado))}`;

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
    <div class="modal-head"><h2>Completar Trabajo (${targetStatus})</h2><button class="close-button" data-action="close">×</button></div>
    <form id="finish-form" class="form-grid">
      <label class="field"><span class="field-label">COMENTARIO DE CIERRE / OBSERVACIÓN</span>
        <textarea name="comentarioCierre" required placeholder="Escribe un comentario sobre la elaboración o imprevistos..."></textarea>
      </label>
      <label class="field"><span class="field-label">SUBIR EVIDENCIA FOTOGRÁFICA (HASTA 3 FOTOS)</span>
        <input type="file" id="evidencia-files" accept="image/*" multiple>
      </label>
      <div id="file-preview-list" style="font-size:12px; color:#666;"></div>
      <div class="modal-footer"><button type="submit" class="primary-button">Guardar y Finalizar Pedido</button></div>
    </form>
  `);

  $("#finish-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector(".primary-button");
    btn.disabled = true;
    btn.textContent = "Guardando e subiendo evidencias...";

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
      <label class="field"><span class="field-label">DESCRIPCIÓN</span><textarea name="descripcion" placeholder="Detalles del pedido..."></textarea></label>
      <div class="modal-footer"><button type="submit" class="primary-button">Guardar Pedido</button></div>
    </form>
  `);

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
    try {
      await api("profile_create_order", { form: Object.fromEntries(new FormData(e.target)) });
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
      $("#login-view")?.classList.add("hidden");
      $("#workspace")?.classList.remove("hidden");
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
});

if (state.session) {
  $("#login-view")?.classList.add("hidden");
  $("#workspace")?.classList.remove("hidden");
  refresh(false);
}
