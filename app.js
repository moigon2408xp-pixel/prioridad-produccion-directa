const $ = (selector) => document.querySelector(selector);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); },
};

const state = {
  session: store.get("pp_profile_session", null),
  screen: "now",
  filter: "all",
  offline: false,
  data: store.get("pp_profile_data", { myOrders: [], teamCritical: [], allOrders: [], users: [] }),
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const active = (order) => !["Entregado", "Cancelado"].includes(order.estado);
const operable = (order) => active(order) && !["Terminado", "Listo para entregar"].includes(order.estado);
const hoursRemaining = (order) => order.entrega ? (new Date(order.entrega) - Date.now()) / 3600000 : Infinity;
const priority = (order) => order.estado === "Bloqueado" || order.diseno === "No" || order.material === "No" ? "blocked" : hoursRemaining(order) <= 4 ? "now" : hoursRemaining(order) <= 24 ? "today" : "later";
const priorityLabel = { blocked: "Bloqueado", now: "Hacer ahora", today: "Hacer hoy", later: "Programar" };
const orderByPriority = (left, right) => ({ blocked: 0, now: 1, today: 2, later: 3 }[priority(left)] - { blocked: 0, now: 1, today: 2, later: 3 }[priority(right)]) || (new Date(left.entrega || "2999") - new Date(right.entrega || "2999"));
const isLead = () => ["manager", "jefa"].includes(state.session?.role);
const isManager = () => state.session?.role === "manager";
const formatDate = (value) => { const date = new Date(value); return value && !Number.isNaN(date) ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Sin fecha"; };
const durationLabel = (order) => order.finProduccion ? `${Math.round(Number(order.duracionRealMin || 0))} min reales` : order.inicioProduccion ? "En proceso" : "Aún no iniciado";

async function enablePush() {
  try {
    const { activatePushNotifications } = await import("./push.js");
    await activatePushNotifications(
      async (deviceToken) => { await api("profile_register_device", { deviceToken }); },
      (payload) => showToast(payload.notification?.title || "Nueva actualización de producción.")
    );
    showToast("Este dispositivo quedó registrado para recibir avisos.");
  } catch (error) { showToast(error.message); }
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
    window[callback] = (response) => { clearTimeout(timer); finish(); response.ok ? resolve(response) : reject(new Error(response.error || "No se pudo completar la acción.")); };
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
  return `<button class="order-card" data-action="detail" data-id="${escapeHtml(order.id)}"><div class="order-top"><div><h3>${position === undefined ? "" : `${position + 1}. `}${escapeHtml(order.cliente || "Sin cliente")}</h3><p>${escapeHtml(order.tipo || "Sin tipo")}</p></div>${priorityPill(order)}</div><div class="meta">Estado: ${escapeHtml(order.estado || "Pendiente")}<br/>Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>Responsable: ${escapeHtml(order.responsable || "Sin asignar")} · ${escapeHtml(durationLabel(order))}</div></button>`;
}

function nowView() {
  const myOpenOrders = (state.data.myOrders || []).filter(operable).sort(orderByPriority);
  const next = myOpenOrders[0];
  const critical = (state.data.teamCritical || []).sort(orderByPriority);
  return `${state.offline ? '<p class="offline">Mostrando la última información guardada.</p>' : ""}${next ? `<article class="hero-card"><p class="eyebrow">TU SIGUIENTE TRABAJO</p>${priorityPill(next)}<h2>${escapeHtml(next.cliente)}</h2><p>${escapeHtml(next.tipo)} · Entrega ${escapeHtml(formatDate(next.entrega))}</p><div class="actions"><button class="action-button" data-action="detail" data-id="${escapeHtml(next.id)}">Ver detalle</button></div></article>` : '<div class="empty"><strong>Tu cola está al día</strong>Las nuevas asignaciones aparecerán aquí.</div>'}<p class="section-heading">CRÍTICOS DEL EQUIPO</p><div class="order-list">${critical.map(orderCard).join("") || '<div class="team-note">No hay bloqueos ni vencimientos inmediatos.</div>'}</div>`;
}

function queueView() {
  const list = (state.data.myOrders || []).filter(active).filter((order) => state.filter === "all" || priority(order) === state.filter).sort(orderByPriority);
  const filters = [["all", "Todo"], ["now", "Ahora"], ["today", "Hoy"], ["blocked", "Bloqueados"]];
  return `<div class="filter-row">${filters.map(([key, label]) => `<button class="filter ${state.filter === key ? "active" : ""}" data-action="filter" data-filter="${key}">${label}</button>`).join("")}</div>${list.length ? `<div class="order-list">${list.map(orderCard).join("")}</div>` : '<div class="empty"><strong>No hay pedidos en este filtro</strong>Prueba otra categoría.</div>'}`;
}

function historyView() {
  const orders = (state.data.finishedOrders || []).sort((left, right) => new Date(right.entregadoEn || right.finProduccion || 0) - new Date(left.entregadoEn || left.finProduccion || 0));
  if (!orders.length) return '<div class="empty"><strong>Aún no hay proyectos terminados</strong>Los pedidos aparecerán aquí al marcarlos como terminados, listos para entregar o entregados.</div>';
  return `<p class="team-note">Consulta la duración real, la entrega y las fotografías de cada proyecto finalizado.</p><div class="order-list">${orders.map((order) => { const links = String(order.evidenciasDrive || '').split("\n").filter(Boolean); const delay = Number(order.retrasoMin || 0); return `<article class="order-card"><div class="order-top"><div><h3>${escapeHtml(order.cliente || 'Sin cliente')}</h3><p>${escapeHtml(order.tipo || 'Sin tipo')}</p></div><span class="priority priority-${order.estado === 'Entregado' ? 'later' : 'today'}">${escapeHtml(order.estado)}</span></div><div class="meta">Responsable: ${escapeHtml(order.responsable || 'Sin asignar')}<br/>Finalizado: ${escapeHtml(formatDate(order.finProduccion))}<br/>Duración: ${escapeHtml(durationLabel(order))}<br/>Entrega: ${escapeHtml(formatDate(order.entregadoEn))}${order.entregadoEn ? ` · ${delay ? `${delay} min de retraso` : 'A tiempo'}` : ''}<br/>Cierre: ${escapeHtml(order.comentarioCierre || 'Sin comentario')}</div>${links.length ? `<div class="actions">${links.map((url, index) => `<a class="secondary-button" href="${escapeHtml(url)}" target="_blank" rel="noopener">Ver foto ${index + 1}</a>`).join('')}</div>` : '<p class="team-note">Sin fotos adjuntas.</p>'}</article>`; }).join('')}</div>`;
}

function teamView() {
  const users = (state.data.users || []).filter((user) => user.active);
  const orders = (state.data.allOrders || []).filter(active);
  const critical = (state.data.teamCritical || []).sort(orderByPriority);
  if (!isLead()) return `<p class="section-heading">ATENCIÓN DEL EQUIPO</p><div class="order-list">${critical.map(orderCard).join("") || '<div class="team-note">No hay casos críticos.</div>'}</div>`;
  const load = users.filter((user) => user.role !== "manager").map((user) => {
    const assigned = orders.filter((order) => order.responsable === user.name);
    return `<div class="load-card"><strong>${escapeHtml(user.name)}</strong><span>${assigned.length} pedidos activos</span></div>`;
  }).join("");
  return `<div class="actions"><button class="primary-button" data-action="new-order">＋ Registrar pedido</button></div><p class="section-heading">CARGA ACTUAL</p><div class="load-grid">${load || '<div class="team-note">Aún no hay trabajadores registrados.</div>'}</div><p class="section-heading">PEDIDOS ACTIVOS</p><div class="order-list">${orders.sort(orderByPriority).map(orderCard).join("") || '<div class="team-note">No hay pedidos activos.</div>'}</div>`;
}

function settingsView() {
  const session = state.session;
  const accessList = (state.data.users || []).map((user) => `<div class="user-card"><div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.role)} · ${user.active ? "activo" : "inactivo"}</span></div>${user.name !== session.name ? `<button class="secondary-button" data-action="toggle-user" data-name="${escapeHtml(user.name)}" data-active="${user.active ? "false" : "true"}">${user.active ? "Desactivar" : "Activar"}</button>` : ""}</div>`).join("");
  return `<div class="card settings-card"><h3>Mi espacio</h3><div class="detail-row"><span>NOMBRE</span><strong>${escapeHtml(session.name)}</strong></div><div class="detail-row"><span>PERFIL</span><strong>${escapeHtml(session.role)}</strong></div><button class="secondary-button" data-action="logout">Cerrar sesión en este dispositivo</button></div>${isManager() ? `<p class="section-heading">ACCESOS DEL EQUIPO</p><button class="primary-button" data-action="new-user">＋ Crear perfil</button><div class="user-list">${accessList}</div><p class="section-heading">LIMPIEZA DE PRUEBAS</p><button class="secondary-button" data-action="archive">Archivar pedidos de prueba</button>` : ""}<p class="section-heading">AVISOS DEL DISPOSITIVO</p><button class="primary-button" data-action="enable-push">Activar notificaciones</button><p class="team-note">Los avisos push se habilitan una vez que Firebase esté configurado.</p><p class="section-heading">SINCRONIZACIÓN</p><div class="team-note">${state.offline ? "Sin conexión. Se muestra la última información disponible." : "Conectada al registro central de Google Sheets."}</div>`;
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
  const editable = isLead() || order.responsable === state.session.name;
  const people = (state.data.users || []).filter((user) => user.active && user.role !== "manager");
  const workerStates = ["En proceso", "Terminado", "Listo para entregar"];
  const leadStates = ["Pendiente", "En proceso", "Terminado", "Listo para entregar", "Entregado", "Bloqueado"];
  const states = isLead() ? leadStates : workerStates;
  openModal(`<div class="modal-head"><div><p class="eyebrow">${escapeHtml(order.id)}</p><h2>${escapeHtml(order.cliente)}</h2></div><button class="close-button" data-action="close">×</button></div><p style="color:var(--blue);font-weight:800">${escapeHtml(order.tipo)}</p><div class="detail-grid"><div class="detail-row"><span>ESTADO</span><strong>${escapeHtml(order.estado || "Pendiente")}</strong></div><div class="detail-row"><span>ENTREGA</span><strong>${escapeHtml(formatDate(order.entrega))}</strong></div><div class="detail-row"><span>RESPONSABLE</span><strong>${escapeHtml(order.responsable || "Sin asignar")}</strong></div><div class="detail-row"><span>DESCRIPCIÓN</span><strong>${escapeHtml(order.descripcion || "Sin descripción")}</strong></div><div class="detail-row"><span>NOTAS</span><strong>${escapeHtml(order.notas || "Sin notas")}</strong></div><div class="detail-row"><span>PREPARACIÓN</span><strong>Diseño: ${escapeHtml(order.diseno)} · Material: ${escapeHtml(order.material)}</strong></div></div>${isLead() ? `<label class="field"><span class="field-label">ASIGNAR RESPONSABLE</span><select id="assign-select"><option value="">Sin asignar</option>${people.map((user) => `<option ${user.name === order.responsable ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("")}</select></label><button class="primary-button" data-action="assign" data-id="${escapeHtml(order.id)}">Guardar responsable</button>` : ""}${editable ? `<p class="section-heading">AVANCE DEL TRABAJO</p><div class="toggle-actions">${states.filter((item) => item !== order.estado).map((item) => `<button data-action="progress" data-id="${escapeHtml(order.id)}" data-state="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}</div><p class="section-heading">PREPARACIÓN</p><div class="toggle-actions"><button data-action="toggle-ready" data-id="${escapeHtml(order.id)}" data-key="diseno" data-value="${order.diseno === "Sí" ? "No" : "Sí"}">Diseño ${order.diseno === "Sí" ? "pendiente" : "listo"}</button><button data-action="toggle-ready" data-id="${escapeHtml(order.id)}" data-key="material" data-value="${order.material === "Sí" ? "No" : "Sí"}">Material ${order.material === "Sí" ? "pendiente" : "listo"}</button><button data-action="note" data-id="${escapeHtml(order.id)}">Añadir nota</button></div>` : '<div class="team-note">Este pedido pertenece a otra persona.</div>'}`);
}

function formOrder() {
  const people = (state.data.users || []).filter((user) => user.active && user.role !== "manager");
  openModal(`<div class="modal-head"><h2>Nuevo pedido</h2><button class="close-button" data-action="close">×</button></div><form id="order-form" class="form-grid"><label class="field"><span class="field-label">CLIENTE</span><input name="cliente" required></label><label class="field"><span class="field-label">TIPO</span><input name="tipo" required></label><div class="form-inline"><label class="field"><span class="field-label">FECHA DE ENTREGA</span><input type="date" name="fechaEntrega" required></label><label class="field"><span class="field-label">HORA DE ENTREGA</span><input type="time" name="horaEntrega" required></label></div><label class="field"><span class="field-label">CANTIDAD</span><input type="number" min="1" name="cantidad" value="1"></label><label class="field"><span class="field-label">RESPONSABLE</span><select name="responsable"><option value="">Sin asignar</option>${people.map((user) => `<option>${escapeHtml(user.name)}</option>`).join("")}</select></label><div class="form-inline"><label class="field"><span class="field-label">DISEÑO</span><select name="diseno"><option>Sí</option><option>No</option></select></label><label class="field"><span class="field-label">MATERIAL</span><select name="material"><option>Sí</option><option>No</option></select></label></div><label class="field"><span class="field-label">DESCRIPCIÓN</span><textarea name="descripcion"></textarea></label><label class="field"><span class="field-label">NOTAS INICIALES</span><textarea name="notas"></textarea></label><p class="team-note">El tiempo real se calculará desde que el pedido pase a «En proceso» hasta que se marque «Terminado».</p><div class="modal-footer"><button type="button" class="secondary-button" data-action="close">Cancelar</button><button class="primary-button">Registrar</button></div></form>`);
  $("#order-form").addEventListener("submit", async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button[type=submit]"); button.disabled = true; button.textContent = "Registrando…"; try { await api("profile_create_order", { form: Object.fromEntries(new FormData(event.currentTarget)) }); closeModal(); await refresh(false); showToast("Pedido registrado."); } catch (error) { showToast(error.message); button.disabled = false; button.textContent = "Registrar"; } });
}

function formUser() {
  openModal(`<div class="modal-head"><h2>Nuevo perfil</h2><button class="close-button" data-action="close">×</button></div><form id="user-form" class="form-grid"><label class="field"><span class="field-label">NOMBRE</span><input name="name" required placeholder="Ej. Valentina"></label><label class="field"><span class="field-label">PERFIL</span><select name="role"><option value="trabajador">Trabajador</option><option value="jefa">Jefa</option><option value="manager">Manager</option></select></label><label class="field"><span class="field-label">PIN DE SEIS DÍGITOS</span><input name="pin" inputmode="numeric" pattern="[0-9]{6}" required placeholder="Ej. 123456"></label><div class="modal-footer"><button type="button" class="secondary-button" data-action="close">Cancelar</button><button class="primary-button">Crear perfil</button></div></form>`);
  $("#user-form").addEventListener("submit", async (event) => { event.preventDefault(); try { await api("profile_create_user", { user: Object.fromEntries(new FormData(event.currentTarget)) }); closeModal(); await refresh(false); showToast("Perfil creado."); } catch (error) { showToast(error.message); } });
}

function formNote(id) {
  openModal(`<div class="modal-head"><h2>Registrar avance</h2><button class="close-button" data-action="close">×</button></div><form id="note-form" class="form-grid"><label class="field"><span class="field-label">NOTA OPERATIVA</span><textarea name="notes" required></textarea></label><div class="modal-footer"><button type="button" class="secondary-button" data-action="close">Cancelar</button><button class="primary-button">Guardar</button></div></form>`);
  $("#note-form").addEventListener("submit", (event) => { event.preventDefault(); saveUpdate(id, { appendNote: new FormData(event.currentTarget).get("notes") }, "Nota guardada."); });
}

function formCloseOrder(id) {
  openModal(`<div class="modal-head"><h2>Cerrar producción</h2><button class="close-button" data-action="close">×</button></div><p class="team-note">Se guardará el tiempo real desde «En proceso». Indica cualquier imprevisto, detalle de entrega o aclaración final.</p><form id="close-order-form" class="form-grid"><label class="field"><span class="field-label">COMENTARIO DE CIERRE</span><textarea name="closeComment" placeholder="Ej. Se terminó sin imprevistos."></textarea></label><label class="field"><span class="field-label">FOTOS DE EVIDENCIA (OPCIONAL)</span><input id="evidence-files" type="file" accept="image/*" capture="environment" multiple><small>Máximo tres fotos. Se comprimirán antes de guardarse de forma privada en Drive.</small></label><div class="modal-footer"><button type="button" class="secondary-button" data-action="close">Cancelar</button><button class="primary-button">Marcar terminado</button></div></form>`);
  $("#close-order-form").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); const files = [...$("#evidence-files").files]; button.disabled = true; button.textContent = "Guardando…"; try { await api("profile_update_order", { id, changes: { estado: "Terminado", closeComment: String(new FormData(form).get("closeComment") || "").trim() } }); closeModal(); await refresh(false); showToast(files.length ? "Producción terminada. Guardando fotos…" : "Producción terminada y tiempo real registrado."); if (files.length) uploadEvidence(id, files).then(async () => { await refresh(false); showToast("Fotos de evidencia guardadas."); }).catch((error) => showToast(`Pedido terminado; no se pudieron guardar las fotos: ${error.message}`)); } catch (error) { showToast(error.message); button.disabled = false; button.textContent = "Marcar terminado"; } });
}

async function imageAsJpegData(file) {
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = reader.result; }; reader.onerror = reject; reader.readAsDataURL(file); });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

async function uploadEvidence(id, files) {
  if (!files.length) return;
  if (files.length > 3) throw new Error("Puedes adjuntar como máximo tres fotos por cierre.");
  const images = await Promise.all(files.map(imageAsJpegData));
  const baseUrl = window.PRIORIDAD_CONFIG?.appsScriptUrl || "";
  if (!baseUrl.startsWith("https://")) throw new Error("Falta configurar la conexión con Google Sheets.");
  await fetch(baseUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "profile_upload_evidence", token: state.session?.token || "", id, images: images.map((data) => ({ data })) }) });
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

function formArchive() {
  openModal(`<div class="modal-head"><h2>Archivar pruebas</h2><button class="close-button" data-action="close">×</button></div><p class="team-note">Escribe solo los ID de prueba, separados por comas. Se moverán a la pestaña Pedidos_Archivo; no se eliminarán definitivamente.</p><form id="archive-form" class="form-grid"><label class="field"><span class="field-label">ID DE PEDIDOS</span><textarea name="ids" required placeholder="Ej. PED-0001, PED-0002"></textarea></label><div class="modal-footer"><button type="button" class="secondary-button" data-action="close">Cancelar</button><button class="primary-button">Archivar</button></div></form>`);
  $("#archive-form").addEventListener("submit", async (event) => { event.preventDefault(); const ids = String(new FormData(event.currentTarget).get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean); try { await api("profile_archive_orders", { ids }); closeModal(); await refresh(false); showToast("Pedidos archivados."); } catch (error) { showToast(error.message); } });
}

function updateLocalOrder(id, changes) {
  const transform = (order) => order.id !== id ? order : { ...order, ...changes, comentarioCierre: Object.prototype.hasOwnProperty.call(changes, "closeComment") ? changes.closeComment : order.comentarioCierre, notas: changes.appendNote ? [order.notas, `• ${state.session.name}: ${changes.appendNote}`].filter(Boolean).join("\n") : order.notas };
  state.data = { ...state.data, myOrders: (state.data.myOrders || []).map(transform), teamCritical: (state.data.teamCritical || []).map(transform), allOrders: (state.data.allOrders || []).map(transform), finishedOrders: (state.data.finishedOrders || []).map(transform) };
  store.set("pp_profile_data", state.data);
  render();
}

async function saveUpdate(id, changes, successText) {
  updateLocalOrder(id, changes);
  closeModal();
  showToast("Guardando…");
  try { await api("profile_update_order", { id, changes }); showToast(successText); refresh(false); } catch (error) { showToast(error.message); refresh(false); }
}

$("#login-form").addEventListener("submit", async (event) => { event.preventDefault(); $("#login-error").textContent = ""; try { const response = await api("profile_login", { name: $("#login-name").value.trim(), pin: $("#login-pin").value.trim() }); state.session = response.session; store.set("pp_profile_session", state.session); $("#login-view").classList.add("hidden"); $("#workspace").classList.remove("hidden"); await refresh(false); } catch (error) { $("#login-error").textContent = error.message; } });
$("#refresh").addEventListener("click", () => refresh());
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => { state.screen = button.dataset.screen; render(); }));
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]"); if (!button) return;
  const data = button.dataset;
  if (data.action === "close") return closeModal();
  if (data.action === "filter") { state.filter = data.filter; return render(); }
  if (data.action === "detail") { const order = [...(state.data.allOrders || []), ...(state.data.finishedOrders || [])].find((item) => item.id === data.id); if (order) detail(order); return; }
  if (data.action === "new-order") return formOrder();
  if (data.action === "new-user") return formUser();
  if (data.action === "note") return formNote(data.id);
  if (data.action === "archive") return formArchive();
  if (data.action === "enable-push") return enablePush();
  if (data.action === "logout") { store.remove("pp_profile_session"); state.session = null; $("#workspace").classList.add("hidden"); $("#login-view").classList.remove("hidden"); return; }
  if (data.action === "progress") return data.state === "Terminado" ? formCloseOrder(data.id) : saveUpdate(data.id, { estado: data.state }, `Estado: ${data.state}.`);
  if (data.action === "toggle-ready") return saveUpdate(data.id, { [data.key]: data.value }, "Preparación actualizada.");
  try {
    if (data.action === "assign") return saveUpdate(data.id, { responsable: $("#assign-select").value }, "Responsable actualizado.");
    if (data.action === "toggle-user") { await api("profile_update_user", { name: data.name, active: data.active === "true" }); await refresh(false); showToast("Acceso actualizado."); }
  } catch (error) { showToast(error.message); }
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
if (state.session) { $("#login-view").classList.add("hidden"); $("#workspace").classList.remove("hidden"); render(); refresh(false); }
