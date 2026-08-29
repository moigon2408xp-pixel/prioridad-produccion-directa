const $ = (selector) => document.querySelector(selector);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); },
};

const state = {
  session: store.get("pp_profile_session", null),
  frequentClients: store.get("pp_frequent_clients", []),
  frequentTypes: store.get("pp_frequent_types", ["Topper Acrílico", "DTF", "Camisas", "Impresiones", "Sublimación"]),
  screen: "now",
  filter: "all",
  offline: false,
  data: store.get("pp_profile_data", { myOrders: [], teamCritical: [], allOrders: [], users: [] }),
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const active = (order) => !["Entregado", "Cancelado"].includes(order.estado);
const operable = (order) => active(order) && order.estado !== "Terminado";
const priority = (order) => order.estado === "Bloqueado" || order.diseno === "No" || order.material === "No" ? "blocked" : "now";
const priorityLabel = { blocked: "Bloqueado", now: "Hacer ahora", today: "Hacer hoy", later: "Programar" };
const isLead = () => ["manager", "jefa"].includes(state.session?.role);
const isManager = () => state.session?.role === "manager";

// Formateador limpio de fecha/hora sin conversiones erróneas de zona horaria
const formatDate = (value) => {
  if (!value) return "Sin fecha";
  if (typeof value === "string" && (value.includes("AM") || value.includes("PM"))) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

function cleanPhoneNumber(phone = "") {
  let num = String(phone).replace(/\D/g, "");
  if (!num) return "";
  if (num.startsWith("04")) num = "58" + num.slice(1);
  else if (num.startsWith("4") && num.length === 10) num = "58" + num;
  else if (num.length === 10 && !num.startsWith("58")) num = "58" + num;
  return num;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.ppToast);
  window.ppToast = setTimeout(() => toast.classList.remove("show"), 3200);
}

function api(action, extra = {}) {
  return new Promise((resolve, reject) => {
    const baseUrl = window.PRIORIDAD_CONFIG?.appsScriptUrl || "";
    if (!baseUrl.startsWith("https://")) return reject(new Error("Falta configurar la URL de Apps Script."));
    const callback = `ppc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const finish = () => { delete window[callback]; script.remove(); };
    const timer = setTimeout(() => { finish(); reject(new Error("Google Sheets tardó demasiado en responder.")); }, 20000);
    window[callback] = (response) => { clearTimeout(timer); finish(); (response && response.ok) ? resolve(response) : reject(new Error(response?.error || "No se pudo completar la acción.")); };
    const payload = encodeURIComponent(JSON.stringify({ action, token: state.session?.token || "", ...extra }));
    script.src = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}callback=${callback}&payload=${payload}`;
    script.onerror = () => { clearTimeout(timer); finish(); reject(new Error("No se pudo comunicar con Google Sheets.")); };
    document.head.append(script);
  });
}

async function refresh(showMessage = true) {
  $("#refresh").textContent = "…";
  try {
    const response = await api("profile_dashboard");
    state.data = response.data;
    state.offline = false;
    store.set("pp_profile_data", state.data);
    render();
    if (showMessage) showToast("Información actualizada.");
  } catch (error) {
    state.offline = true;
    render();
    if (showMessage) showToast(error.message);
  } finally {
    $("#refresh").textContent = "↻";
  }
}

function priorityPill(order) { const value = priority(order); return `<span class="priority priority-${value}">${priorityLabel[value]}</span>`; }
function orderCard(order, position) {
  return `<button class="order-card" data-action="detail" data-id="${escapeHtml(order.id)}"><div class="order-top"><div><h3>${position === undefined ? "" : `${position + 1}. `}${escapeHtml(order.cliente || "Sin cliente")}</h3><p>${escapeHtml(order.tipo || "Sin tipo")}</p></div>${priorityPill(order)}</div><div class="meta">Estado: ${escapeHtml(order.estado || "Pendiente")}<br/>Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>Teléfono: ${escapeHtml(order.telefono || "No registrado")}</div></button>`;
}

function nowView() {
  const myOpenOrders = (state.data.myOrders || []).filter(operable);
  const next = myOpenOrders[0];
  const critical = (state.data.teamCritical || []);
  return `${state.offline ? '<p class="offline">Mostrando información guardada.</p>' : ""}${next ? `<article class="hero-card"><p class="eyebrow">TU SIGUIENTE TRABAJO</p>${priorityPill(next)}<h2>${escapeHtml(next.cliente)}</h2><p>${escapeHtml(next.tipo)} · Entrega ${escapeHtml(formatDate(next.entrega))}</p><div class="actions"><button class="action-button" data-action="detail" data-id="${escapeHtml(next.id)}">Ver detalle</button></div></article>` : '<div class="empty"><strong>Tu cola está al día</strong></div>'}<p class="section-heading">CRÍTICOS DEL EQUIPO</p><div class="order-list">${critical.map(orderCard).join("") || '<div class="team-note">No hay casos críticos.</div>'}</div>`;
}

function queueView() {
  const list = (state.data.myOrders || []).filter(active);
  return list.length ? `<div class="order-list">${list.map(orderCard).join("")}</div>` : '<div class="empty"><strong>No hay pedidos pendientes</strong></div>';
}

function historyView() {
  const orders = (state.data.finishedOrders || []);
  if (!orders.length) return '<div class="empty"><strong>Aún no hay proyectos terminados</strong></div>';
  return `<div class="order-list">${orders.map((order) => `<article class="order-card"><div class="order-top"><div><h3>${escapeHtml(order.cliente)}</h3><p>${escapeHtml(order.tipo)}</p></div></div><div class="meta">Entrega: ${escapeHtml(formatDate(order.entrega))}</div></article>`).join('')}</div>`;
}

function teamView() {
  const orders = (state.data.allOrders || []).filter(active);
  return `<div class="actions"><button class="primary-button" data-action="new-order">＋ Registrar pedido</button></div><p class="section-heading">PEDIDOS ACTIVOS</p><div class="order-list">${orders.map(orderCard).join("") || '<div class="team-note">No hay pedidos activos.</div>'}</div>`;
}

function settingsView() {
  const session = state.session;
  const fcList = state.frequentClients.map((c, index) => `<div class="user-card"><div><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.phone)}</span></div><button class="secondary-button" style="border-color:red; color:red;" data-action="delete-fc" data-index="${index}">🗑</button></div>`).join("");
  const ftList = state.frequentTypes.map((t, index) => `<div class="user-card"><div><strong>${escapeHtml(t)}</strong></div><button class="secondary-button" style="border-color:red; color:red;" data-action="delete-ft" data-index="${index}">🗑</button></div>`).join("");

  return `
    <div class="card settings-card">
      <h3>Mi espacio</h3>
      <div class="detail-row"><span>NOMBRE</span><strong>${escapeHtml(session.name)}</strong></div>
      <button class="secondary-button" data-action="logout">Cerrar sesión</button>
    </div>
    
    <p class="section-heading">CLIENTES FRECUENTES</p>
    <button class="primary-button" data-action="new-frequent-client">＋ Agregar Cliente Frecuente</button>
    <div class="user-list" style="margin-top:10px;">${fcList || '<div class="team-note">No hay clientes guardados.</div>'}</div>

    <p class="section-heading">TIPOS DE TRABAJO FRECUENTES</p>
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
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.screen === state.screen));
}

function openModal(content) { const modal = $("#modal"); modal.innerHTML = `<div class="modal-content">${content}</div>`; modal.showModal(); }
function closeModal() { $("#modal").close(); }

function detail(order) {
  const phoneVal = order.telefono || order.phone || order.celular || "";
  const rawPhone = cleanPhoneNumber(phoneVal);
  const whatsappMsg = encodeURIComponent(`Hola ${order.cliente || ''}, tu pedido de ${order.tipo || ''} ya está listo.`);
  const whatsappUrl = rawPhone ? `https://wa.me/${rawPhone}?text=${whatsappMsg}` : `https://wa.me/?text=${whatsappMsg}`;

  openModal(`
    <div class="modal-head"><div><p class="eyebrow">${escapeHtml(order.id)}</p><h2>${escapeHtml(order.cliente)}</h2></div><button class="close-button" data-action="close">×</button></div>
    <div class="detail-grid">
      <div class="detail-row"><span>TIPO</span><strong>${escapeHtml(order.tipo)}</strong></div>
      <div class="detail-row"><span>ESTADO</span><strong>${escapeHtml(order.estado || "Pendiente")}</strong></div>
      <div class="detail-row"><span>ENTREGA</span><strong>${escapeHtml(formatDate(order.entrega))}</strong></div>
      <div class="detail-row"><span>RESPONSABLE</span><strong>${escapeHtml(order.responsable || "Sin asignar")}</strong></div>
      <div class="detail-row"><span>TELÉFONO</span><strong>${escapeHtml(phoneVal || "No registrado")}</strong></div>
      <div class="detail-row"><span>DESCRIPCIÓN</span><strong>${escapeHtml(order.descripcion || "Sin descripción")}</strong></div>
    </div>
    <div class="actions" style="margin-top:12px;">
      <a href="${whatsappUrl}" target="_blank" rel="noopener" class="secondary-button" style="background:#25D366; color:white; border:none; padding:10px; border-radius:6px; text-align:center; text-decoration:none; display:block; font-weight:bold;">
        📲 Notificar por WhatsApp ${rawPhone ? `(${phoneVal})` : '(Sin número)'}
      </a>
    </div>
    ${isLead() ? `<p class="section-heading" style="color:red;">ADMINISTRACIÓN</p><button class="secondary-button" style="border-color:red; color:red;" data-action="delete-single-order" data-id="${escapeHtml(order.id)}">🗑 Eliminar pedido</button>` : ""}
  `);
}

function formOrder() {
  const people = (state.data.users || []).filter((user) => user.active && user.role !== "manager");
  const clients = state.frequentClients;
  const types = state.frequentTypes;

  openModal(`
    <div class="modal-head"><h2>Nuevo pedido</h2><button class="close-button" data-action="close">×</button></div>
    <form id="order-form" class="form-grid" novalidate>
      ${clients.length ? `
        <label class="field">
          <span class="field-label">SELECCIONAR CLIENTE FRECUENTE</span>
          <select id="frequent-client-select">
            <option value="">-- Cliente nuevo / Manual --</option>
            ${clients.map((c, i) => `<option value="${i}">${escapeHtml(c.name)} (${escapeHtml(c.phone)})</option>`).join("")}
          </select>
        </label>
      ` : ''}

      <label class="field"><span class="field-label">CLIENTE</span><input id="input-cliente" name="cliente" required placeholder="Ej. Carolai Toppers"></label>
      <label class="field"><span class="field-label">WHATSAPP / TELÉFONO</span><input id="input-telefono" name="telefono" placeholder="Ej. 04121234567"></label>
      
      <label class="field">
        <span class="field-label">TIPO DE TRABAJO</span>
        ${types.length ? `
          <select id="tipo-select" style="margin-bottom:6px;">
            <option value="">-- Seleccionar tipo frecuente --</option>
            ${types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}
            <option value="__CUSTOM__">✏️ Escribir otro manualmente...</option>
          </select>
        ` : ''}
        <input id="input-tipo" name="tipo" required placeholder="Ej. Topper Acrílico / DTF">
      </label>

      <div class="form-inline">
        <label class="field"><span class="field-label">FECHA DE ENTREGA</span><input type="date" name="fechaEntrega" required></label>
        <label class="field">
          <span class="field-label">HORA DE ENTREGA</span>
          <select name="horaEntrega" required>
            <option value="08:00 AM">08:00 AM</option>
            <option value="09:00 AM">09:00 AM</option>
            <option value="10:00 AM">10:00 AM</option>
            <option value="11:00 AM" selected>11:00 AM</option>
            <option value="12:00 PM">12:00 PM</option>
            <option value="01:00 PM">01:00 PM</option>
            <option value="02:00 PM">02:00 PM</option>
            <option value="03:00 PM">03:00 PM</option>
            <option value="04:00 PM">04:00 PM</option>
            <option value="05:00 PM">05:00 PM</option>
            <option value="06:00 PM">06:00 PM</option>
            <option value="07:00 PM">07:00 PM</option>
          </select>
        </label>
      </div>

      <label class="field"><span class="field-label">RESPONSABLE</span><select name="responsable"><option value="">Sin asignar</option>${people.map((user) => `<option>${escapeHtml(user.name)}</option>`).join("")}</select></label>
      <label class="field"><span class="field-label">DESCRIPCIÓN</span><textarea name="descripcion"></textarea></label>
      
      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">Registrar</button>
      </div>
    </form>
  `);

  const selectFC = $("#frequent-client-select");
  if (selectFC) {
    selectFC.addEventListener("change", (e) => {
      const idx = e.target.value;
      if (idx !== "") {
        const selected = clients[idx];
        $("#input-cliente").value = selected.name;
        $("#input-telefono").value = selected.phone;
      }
    });
  }

  const selectTipo = $("#tipo-select");
  if (selectTipo) {
    selectTipo.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val && val !== "__CUSTOM__") $("#input-tipo").value = val;
      else if (val === "__CUSTOM__") { $("#input-tipo").value = ""; $("#input-tipo").focus(); }
    });
  }

  $("#order-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector(".primary-button");
    button.disabled = true;
    button.textContent = "Registrando…";
    try {
      const values = Object.fromEntries(new FormData(form));
      await api("profile_create_order", { form: values });
      closeModal();
      await refresh(false);
      showToast("Pedido registrado correctamente.");
    } catch (error) {
      button.disabled = false;
      button.textContent = "Registrar";
      window.alert(`Error: ${error.message}`);
    }
  });
}

function formFrequentClient() {
  openModal(`
    <div class="modal-head"><h2>Nuevo Cliente Frecuente</h2><button class="close-button" data-action="close">×</button></div>
    <form id="fc-form" class="form-grid">
      <label class="field"><span class="field-label">NOMBRE DEL CLIENTE</span><input name="name" required placeholder="Ej. Carolai Toppers"></label>
      <label class="field"><span class="field-label">WHATSAPP / TELÉFONO</span><input name="phone" required placeholder="Ej. 04121234567"></label>
      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">Guardar</button>
      </div>
    </form>
  `);
  
  $("#fc-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    state.frequentClients.push({ name: values.name.trim(), phone: values.phone.trim() });
    store.set("pp_frequent_clients", state.frequentClients);
    closeModal();
    render();
    showToast("Cliente frecuente guardado.");
  });
}

function formFrequentType() {
  openModal(`
    <div class="modal-head"><h2>Nuevo Tipo de Trabajo</h2><button class="close-button" data-action="close">×</button></div>
    <form id="ft-form" class="form-grid">
      <label class="field"><span class="field-label">NOMBRE DEL TIPO</span><input name="typeName" required placeholder="Ej. DTF / Sublimación"></label>
      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">Guardar</button>
      </div>
    </form>
  `);

  $("#ft-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = new FormData(e.currentTarget).get("typeName").trim();
    if (val) {
      state.frequentTypes.push(val);
      store.set("pp_frequent_types", state.frequentTypes);
      closeModal();
      render();
      showToast("Tipo de trabajo guardado.");
    }
  });
}

$("#login-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const response = await api("profile_login", { name: $("#login-name").value.trim(), pin: $("#login-pin").value.trim() }); state.session = response.session; store.set("pp_profile_session", state.session); $("#login-view").classList.add("hidden"); $("#workspace").classList.remove("hidden"); await refresh(false); } catch (error) { $("#login-error").textContent = error.message; } });
$("#refresh").addEventListener("click", () => refresh());
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => { state.screen = button.dataset.screen; render(); }));
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]"); if (!button) return;
  const data = button.dataset;
  if (data.action === "close") return closeModal();
  if (data.action === "detail") { const order = [...(state.data.allOrders || []), ...(state.data.finishedOrders || [])].find((item) => String(item.id) === String(data.id)); if (order) detail(order); return; }
  if (data.action === "new-order") return formOrder();
  if (data.action === "new-frequent-client") return formFrequentClient();
  if (data.action === "delete-fc") { state.frequentClients.splice(Number(data.index), 1); store.set("pp_frequent_clients", state.frequentClients); render(); return; }
  if (data.action === "new-frequent-type") return formFrequentType();
  if (data.action === "delete-ft") { state.frequentTypes.splice(Number(data.index), 1); store.set("pp_frequent_types", state.frequentTypes); render(); return; }
  if (data.action === "logout") { store.remove("pp_profile_session"); state.session = null; $("#workspace").classList.add("hidden"); $("#login-view").classList.remove("hidden"); return; }
  if (data.action === "delete-single-order") {
    if (window.confirm("¿Eliminar pedido?")) {
      await api("profile_delete_order", { id: data.id });
      closeModal();
      await refresh(false);
    }
  }
});

if (state.session) { $("#login-view").classList.add("hidden"); $("#workspace").classList.remove("hidden"); render(); refresh(false); }
