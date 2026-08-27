const $ = (selector) => document.querySelector(selector);
const storage = {
  get(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); },
};

const state = {
  pin: storage.get("pp_pin", ""),
  member: storage.get("pp_member", ""),
  screen: "now",
  filter: "all",
  catalogs: storage.get("pp_catalogs", { tipos: [], responsables: [], estados: [] }),
  orders: storage.get("pp_orders", []),
  offline: false,
};

function esc(value = "") { return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }
function dateText(value) { if (!value) return "Sin fecha"; const date = new Date(value); return Number.isNaN(date) ? "Sin fecha" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date); }
function dueHours(order) { if (!order.entrega) return Infinity; return (new Date(order.entrega).getTime() - Date.now()) / 3600000; }
function priority(order) {
  if (order.estado === "Bloqueado" || order.diseno === "No" || order.material === "No") return "blocked";
  if (order.estado === "Entregado" || order.estado === "Cancelado") return "done";
  const hours = dueHours(order);
  if (hours <= 4) return "now";
  if (hours <= 24) return "today";
  return "later";
}
function priorityLabel(level) { return ({ now: "Hacer ahora", today: "Hacer hoy", later: "Programar", blocked: "Bloqueado", done: "Cerrado" })[level] || "Programar"; }
function priorityPill(order) { const level = priority(order); return `<span class="priority priority-${level}">${priorityLabel(level)}</span>`; }
function activeOrders() { return state.orders.filter((order) => !["Entregado", "Cancelado"].includes(order.estado)); }
function myOrders() { return activeOrders().filter((order) => !state.member || order.responsable === state.member).sort(sortOrders); }
function sortOrders(a, b) { const weights = { blocked: 0, now: 1, today: 2, later: 3, done: 4 }; return (weights[priority(a)] - weights[priority(b)]) || (new Date(a.entrega || "2999-01-01") - new Date(b.entrega || "2999-01-01")); }
function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); clearTimeout(window.__toast); window.__toast = setTimeout(() => node.classList.remove("show"), 3200); }

async function api(action, data = {}) {
  const response = await fetch("./api/rpc", { method: "POST", headers: { "Content-Type": "application/json", "X-Team-Pin": state.pin }, body: JSON.stringify({ action, data }) });
  const body = await response.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta." }));
  if (!response.ok || !body.ok) throw new Error(body.error || "No se pudo completar la operación.");
  return body;
}

async function refresh() {
  $("#refresh").textContent = "…";
  try {
    const [list, catalogs] = await Promise.all([api("pwa_list_orders"), api("pwa_catalogs")]);
    state.orders = list.orders || [];
    state.catalogs = catalogs.catalogs || state.catalogs;
    state.offline = false;
    storage.set("pp_orders", state.orders); storage.set("pp_catalogs", state.catalogs);
    render();
    toast("Cola actualizada desde Google Sheets.");
  } catch (error) {
    state.offline = true; render(); toast(`Sin conexión: ${error.message}`);
  } finally { $("#refresh").textContent = "↻"; }
}

function orderCard(order, index = null) {
  return `<button class="order-card" data-action="detail" data-id="${esc(order.id)}"><div class="order-top"><div><h3>${index !== null ? `<span class="order-index">${index + 1}. </span>` : ""}${esc(order.cliente || "Sin cliente")}</h3><p>${esc(order.tipo || "Sin tipo")}</p></div>${priorityPill(order)}</div><div class="meta">Entrega: ${esc(dateText(order.entrega))}<br/>Responsable: ${esc(order.responsable || "Sin asignar")} · ${esc(order.tiempoMinutos || 0)} min</div></button>`;
}

function renderNow() {
  const mine = myOrders(); const current = mine[0];
  return `${state.offline ? `<p class="offline">Mostrando la última cola guardada. Se actualizará cuando vuelva la conexión.</p>` : ""}${current ? `<article class="hero-card"><p class="eyebrow">TU SIGUIENTE TRABAJO</p>${priorityPill(current)}<h2>${esc(current.cliente)}</h2><p>${esc(current.tipo)} · Entrega ${esc(dateText(current.entrega))}</p><p>${current.diseno === "No" || current.material === "No" ? "Antes de empezar, revisa los requisitos pendientes." : "Todo está listo para avanzar."}</p><div class="actions"><button class="action-button" data-action="status" data-id="${esc(current.id)}" data-status="En proceso">Empezar</button><button class="action-button" data-action="detail" data-id="${esc(current.id)}">Ver detalle</button></div></article>` : `<div class="empty"><strong>Tu cola está al día</strong>Cuando haya una asignación para ${esc(state.member || "el equipo")}, aparecerá aquí.</div>`}<p class="section-heading">CRÍTICOS DEL EQUIPO</p><div class="order-list">${activeOrders().filter((order) => ["blocked", "now"].includes(priority(order))).sort(sortOrders).slice(0, 4).map((order) => orderCard(order)).join("") || `<div class="team-note">No hay bloqueos ni pedidos con vencimiento inmediato.</div>`}</div>`;
}

function renderQueue() {
  const filters = [["all", "Todo"], ["now", "Ahora"], ["today", "Hoy"], ["blocked", "Bloqueados"]];
  const list = myOrders().filter((order) => state.filter === "all" || priority(order) === state.filter);
  return `<div class="filter-row">${filters.map(([id, label]) => `<button class="filter ${state.filter === id ? "active" : ""}" data-action="filter" data-filter="${id}">${label}</button>`).join("")}</div>${list.length ? `<div class="order-list">${list.map((order, index) => orderCard(order, index)).join("")}</div>` : `<div class="empty"><strong>No hay pedidos en este filtro</strong>Prueba con otra categoría o revisa la cola del equipo.</div>`}`;
}

function renderTeam() {
  const members = state.catalogs.responsables || [];
  const orders = activeOrders();
  const load = members.map((name) => { const assigned = orders.filter((order) => order.responsable === name); return { name, count: assigned.length, minutes: assigned.reduce((total, order) => total + Number(order.tiempoMinutos || 0), 0) }; });
  const critical = orders.filter((order) => ["blocked", "now"].includes(priority(order))).sort(sortOrders);
  return `<div class="actions"><button class="primary-button" data-action="new-order">＋ Registrar pedido</button></div><p class="section-heading">CARGA ACTUAL</p><div class="load-grid">${load.map((item) => `<div class="load-card"><strong>${esc(item.name)}</strong><span>${item.count} pedido${item.count === 1 ? "" : "s"} · ${item.minutes} min</span></div>`).join("") || `<div class="team-note">Configura responsables en la pestaña Configuracion del libro.</div>`}</div><p class="section-heading">REQUIEREN APOYO</p><div class="order-list">${critical.map((order) => orderCard(order)).join("") || `<div class="team-note">No hay casos críticos. Todos pueden continuar con sus colas.</div>`}</div>`;
}

function renderSettings() {
  const members = state.catalogs.responsables || [];
  return `<div class="card settings-card"><h3>Mi configuración</h3><p>Elige la persona cuya cola vas a consultar en este dispositivo.</p><div class="setting-line"><div><strong>Persona activa</strong><br/><small>${esc(state.member || "Sin seleccionar")}</small></div><select id="member-select"><option value="">Seleccionar</option>${members.map((name) => `<option ${state.member === name ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></div><div class="setting-line"><div><strong>Instalación</strong><br/><small>Usa el menú del navegador para instalar esta aplicación.</small></div><span>⌄</span></div><div class="setting-line"><div><strong>Datos</strong><br/><small>${state.orders.length} pedidos guardados en la última actualización.</small></div><button class="secondary-button" data-action="clear-cache">Salir</button></div></div><p class="section-heading">ESTADO</p><div class="team-note">${state.offline ? "Sin conexión con Google Sheets. La aplicación conserva la última cola descargada." : "Conectada con Google Sheets. Los cambios se guardan al confirmarlos."}</div>`;
}

function render() {
  const title = { now: "Ahora", queue: "Mi cola", team: "Equipo", settings: "Ajustes" }[state.screen];
  $("#screen-title").textContent = title;
  $("#screen").innerHTML = ({ now: renderNow, queue: renderQueue, team: renderTeam, settings: renderSettings })[state.screen]();
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.screen === state.screen));
}

function openModal(content) { const modal = $("#modal"); modal.innerHTML = `<div class="modal-content">${content}</div>`; modal.showModal(); }
function closeModal() { $("#modal").close(); }

function detailModal(order) {
  const canEdit = !state.member || order.responsable === state.member;
  openModal(`<div class="modal-head"><div><p class="eyebrow">${esc(order.id)}</p><h2>${esc(order.cliente)}</h2></div><button class="close-button" data-action="close">×</button></div><p style="margin:0;color:var(--blue);font-weight:800">${esc(order.tipo)}</p><div class="detail-grid"><div class="detail-row"><span>ENTREGA</span><strong>${esc(dateText(order.entrega))}</strong></div><div class="detail-row"><span>RESPONSABLE</span><strong>${esc(order.responsable || "Sin asignar")}</strong></div><div class="detail-row"><span>DESCRIPCIÓN</span><strong>${esc(order.descripcion || "Sin descripción")}</strong></div><div class="detail-row"><span>NOTAS</span><strong>${esc(order.notas || "Sin notas")}</strong></div><div class="detail-row"><span>PREPARACIÓN</span><strong>Diseño: ${esc(order.diseno)} · Material: ${esc(order.material)}</strong></div></div>${canEdit ? `<div class="toggle-actions"><button data-action="status" data-id="${esc(order.id)}" data-status="En proceso">Empezar</button><button data-action="status" data-id="${esc(order.id)}" data-status="Entregado">Entregado</button><button class="danger" data-action="status" data-id="${esc(order.id)}" data-status="Bloqueado">Bloquear</button><button data-action="ready" data-id="${esc(order.id)}" data-field="diseno" data-value="${order.diseno === "Sí" ? "No" : "Sí"}">Diseño ${order.diseno === "Sí" ? "pendiente" : "listo"}</button><button data-action="ready" data-id="${esc(order.id)}" data-field="material" data-value="${order.material === "Sí" ? "No" : "Sí"}">Material ${order.material === "Sí" ? "pendiente" : "listo"}</button><button data-action="note" data-id="${esc(order.id)}">Añadir nota</button></div>` : `<div class="team-note">Este pedido pertenece a otra persona. Puedes ver su urgencia para apoyar al equipo.</div>`}`);
}

function newOrderModal() {
  const types = state.catalogs.tipos || []; const people = state.catalogs.responsables || [];
  openModal(`<div class="modal-head"><div><p class="eyebrow">ADMINISTRACIÓN</p><h2>Nuevo pedido</h2></div><button class="close-button" data-action="close">×</button></div><form id="new-order-form" class="form-grid"><label class="field"><span class="field-label">CLIENTE</span><input name="cliente" required placeholder="Nombre del cliente" /></label><label class="field"><span class="field-label">TIPO DE TRABAJO</span><select name="tipo" required>${types.map((type) => `<option>${esc(type)}</option>`).join("") || `<option>Otro</option>`}</select></label><div class="form-inline"><label class="field"><span class="field-label">FECHA DE ENTREGA</span><input name="fechaEntrega" type="date" required /></label><label class="field"><span class="field-label">HORA</span><input name="horaEntrega" type="time" required /></label></div><div class="form-inline"><label class="field"><span class="field-label">TIEMPO (MIN)</span><input name="tiempoMinutos" type="number" min="1" required placeholder="90" /></label><label class="field"><span class="field-label">CANTIDAD</span><input name="cantidad" type="number" min="1" value="1" /></label></div><label class="field"><span class="field-label">RESPONSABLE</span><select name="responsable">${people.map((name) => `<option ${name === state.member ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label><div class="form-inline"><label class="field"><span class="field-label">DISEÑO</span><select name="diseno"><option>Sí</option><option>No</option></select></label><label class="field"><span class="field-label">MATERIAL</span><select name="material"><option>Sí</option><option>No</option></select></label></div><label class="field"><span class="field-label">DESCRIPCIÓN</span><textarea name="descripcion" placeholder="Detalles de producción"></textarea></label><label class="field"><span class="field-label">NOTAS</span><textarea name="notas" placeholder="Información adicional"></textarea></label><div class="modal-footer"><button type="button" class="secondary-button" data-action="close">Cancelar</button><button type="submit" class="primary-button">Registrar pedido</button></div></form>`);
  $("#new-order-form").addEventListener("submit", async (event) => { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); try { const result = await api("pwa_create_order", { form }); closeModal(); await refresh(); toast(`Pedido ${result.result.id} registrado.`); } catch (error) { toast(error.message); } });
}

function noteModal(id) {
  openModal(`<div class="modal-head"><h2>Registrar avance</h2><button class="close-button" data-action="close">×</button></div><form id="note-form" class="form-grid"><label class="field"><span class="field-label">NOTA OPERATIVA</span><textarea name="notes" required placeholder="Ej. Se confirmó el color; falta cortar el material."></textarea></label><div class="modal-footer"><button type="button" class="secondary-button" data-action="close">Cancelar</button><button class="primary-button">Guardar</button></div></form>`);
  $("#note-form").addEventListener("submit", async (event) => { event.preventDefault(); const note = new FormData(event.currentTarget).get("notes").toString().trim(); const order = state.orders.find((item) => item.id === id); try { await api("pwa_update_order", { id, changes: { notas: [order?.notas, note].filter(Boolean).join("\n• ") } }); closeModal(); await refresh(); toast("Nota guardada en el pedido."); } catch (error) { toast(error.message); } });
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]"); if (!target) return;
  const { action, id, status, field, value, filter } = target.dataset;
  if (action === "close") return closeModal();
  if (action === "detail") { const order = state.orders.find((item) => item.id === id); if (order) detailModal(order); return; }
  if (action === "new-order") return newOrderModal();
  if (action === "filter") { state.filter = filter; return render(); }
  if (action === "clear-cache") { storage.remove("pp_pin"); storage.remove("pp_member"); state.pin = ""; state.member = ""; $("#workspace").classList.add("hidden"); $("#unlock").classList.remove("hidden"); return; }
  if (action === "note") return noteModal(id);
  if (["status", "ready"].includes(action)) {
    const changes = action === "status" ? { estado: status } : { [field]: value };
    try { await api("pwa_update_order", { id, changes }); closeModal(); await refresh(); toast("Cambio guardado en Google Sheets."); } catch (error) { toast(error.message); }
  }
});

$("#refresh").addEventListener("click", refresh);
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => { state.screen = button.dataset.screen; render(); }));
document.addEventListener("change", (event) => { if (event.target.id === "member-select") { state.member = event.target.value; storage.set("pp_member", state.member); render(); } });
$("#unlock-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const pin = $("#team-pin").value.trim(); $("#unlock-error").textContent = ""; state.pin = pin;
  try { await refresh(); storage.set("pp_pin", pin); $("#unlock").classList.add("hidden"); $("#workspace").classList.remove("hidden"); render(); } catch (error) { $("#unlock-error").textContent = error.message; }
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
if (state.pin) { $("#unlock").classList.add("hidden"); $("#workspace").classList.remove("hidden"); render(); refresh(); }
