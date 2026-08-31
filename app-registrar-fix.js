const $ = (selector) => document.querySelector(selector);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); },
};

const state = {
  session: store.get("pp_profile_session", null),
  frequentClients: [],
  frequentTypes: [],
  waTemplate: "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega.",
  screen: "now",
  filter: "all",
  offline: false,
  data: store.get("pp_profile_data", { myOrders: [], teamCritical: [], allOrders: [], finishedOrders: [], users: [] }),
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));

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
  if (order.diseno === "No" || order.material === "No") return "blocked";
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
  blocked: "Pendiente Material/Diseño",
  now: "Hacer ahora",
  today: "Hacer hoy",
  later: "Programar"
};

const active = (order) => !["Terminado", "Entregado", "Cancelado"].includes(order.estado);
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

function cleanPhoneNumber(phone = "") {
  let num = String(phone).replace(/\D/g, "");
  if (!num) return "";
  if (num.startsWith("0")) num = "58" + num.slice(1);
  else if (num.length === 10 && !num.startsWith("58")) num = "58" + num;
  return num;
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.ppToast);
  window.ppToast = setTimeout(() => toast.classList.remove("show"), 3200);
}

function convertirArchivoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// Petición HTTP usando fetch estándar (reemplaza JSONP para evitar redirección de sesión)
async function api(action, extra = {}) {
  const baseUrl = window.PRIORIDAD_CONFIG?.appsScriptUrl || "https://script.google.com/macros/s/AKfycby_mIt5VzEOZjKb6znpYXH_T0Q0jJfEqr5UB1Z8l0JpUiHfEC9CuRuK9z2s_Q3lNl6www/exec";
  if (!baseUrl.startsWith("https://")) throw new Error("Falta configurar la URL de Apps Script.");

  const payload = {
    action,
    token: state.session?.token || "",
    ...extra
  };

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data && (data.ok || data.exito)) {
    return data;
  } else {
    throw new Error(data?.error || data?.mensaje || "No se pudo completar la acción.");
  }
}

async function refresh(showMessage = true) {
  const btnRefresh = $("#refresh");
  if (btnRefresh) btnRefresh.textContent = "…";
  try {
    const response = await api("profile_dashboard");
    state.data = response.data;
    state.frequentClients = response.data.frequentClients || [];
    state.frequentTypes = response.data.frequentTypes || ["Topper Acrílico", "DTF", "Camisas", "Impresiones", "Sublimación"];
    state.waTemplate = response.data.waTemplate || "Hola {cliente}, tu pedido de {tipo} ya se encuentra listo para entrega.";
    state.offline = false;
    store.set("pp_profile_data", state.data);
    render();
    if (showMessage) showToast("Información actualizada.");
  } catch (error) {
    state.offline = true;
    render();
    if (showMessage) showToast(error.message);
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
  const tipoDisplay = order.tipo || order['tipo de trabajo'] || order.trabajo || order.producto || "Sin tipo";
  return `<button class="order-card" data-action="detail" data-id="${escapeHtml(order.id)}"><div class="order-top"><div><h3>${position === undefined ? "" : `${position + 1}. `}${escapeHtml(order.cliente || "Sin cliente")}</h3><p>${escapeHtml(tipoDisplay)}</p></div>${priorityPill(order)}</div><div class="meta">Estado: <strong>${escapeHtml(order.estado || "Pendiente")}</strong><br/>Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>Teléfono: ${escapeHtml(order.telefono || "No registrado")}</div></button>`;
}

function sortOrdersByUrgency(orders) {
  return orders.slice().sort((a, b) => {
    const prioOrder = { overdue: 0, blocked: 1, today: 2, now: 3, later: 4 };
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
  const critical = sortOrdersByUrgency((state.data.teamCritical || []));
  const tipoDisplay = next ? (next.tipo || next['tipo de trabajo'] || next.trabajo || next.producto || "Sin tipo") : "";

  return `${state.offline ? '<p class="offline">Mostrando información guardada.</p>' : ""}
  ${next ? `<article class="hero-card"><p class="eyebrow">TU SIGUIENTE TRABAJO PRIORITARIO</p>${priorityPill(next)}<h2>${escapeHtml(next.cliente)}</h2><p>${escapeHtml(tipoDisplay)} · Entrega: ${escapeHtml(formatDate(next.entrega))}</p><div class="actions"><button class="action-button" data-action="detail" data-id="${escapeHtml(next.id)}">Ver detalle</button></div></article>` : '<div class="empty"><strong>Tu cola está al día</strong></div>'}
  <p class="section-heading">CRÍTICOS DEL EQUIPO</p>
  <div class="order-list">${critical.map(orderCard).join("") || '<div class="team-note">No hay casos críticos.</div>'}</div>`;
}

function queueView() {
  const list = sortOrdersByUrgency((state.data.myOrders || []).filter(active));
  return list.length ? `<div class="order-list">${list.map(orderCard).join("")}</div>` : '<div class="empty"><strong>No hay pedidos pendientes</strong></div>';
}

function historyView() {
  const all = [...(state.data.finishedOrders || []), ...(state.data.allOrders || [])];
  const finishedMap = new Map();
  
  all.forEach((order) => {
    if (["Terminado", "Entregado", "Cancelado"].includes(order.estado)) {
      finishedMap.set(String(order.id), order);
    }
  });

  const orders = Array.from(finishedMap.values());
  if (!orders.length) return '<div class="empty"><strong>Aún no hay proyectos terminados</strong></div>';

  return `<div class="order-list">${orders.map((order) => {
    const tipoDisplay = order.tipo || order['tipo de trabajo'] || order.trabajo || order.producto || "Sin tipo";
    const foto = order.fotoEvidencia || order.foto;
    return `
      <article class="order-card">
        <div class="order-top">
          <div>
            <h3>${escapeHtml(order.cliente)}</h3>
            <p>${escapeHtml(tipoDisplay)}</p>
          </div>
          <span class="priority" style="background:#2e7d32; color:white;">${escapeHtml(order.estado)}</span>
        </div>
        <div class="meta">
          Entrega: ${escapeHtml(formatDate(order.entrega))}<br/>
          Responsable: ${escapeHtml(order.responsable || "Sin asignar")}<br/>
          ${order.comentarioCierre ? `<strong>Nota de cierre:</strong> ${escapeHtml(order.comentarioCierre)}<br/>` : ""}
          ${foto ? `<a href="${escapeHtml(foto)}" target="_blank" rel="noopener" style="color:#1976d2; font-weight:bold; text-decoration:underline;">📷 Ver Evidencia en Drive</a>` : ""}
        </div>
      </article>
    `;
  }).join('')}</div>`;
}

function teamView() {
  const orders = sortOrdersByUrgency((state.data.allOrders || []).filter(active));
  return `<div class="actions"><button class="primary-button" data-action="new-order">＋ Registrar pedido</button></div><p class="section-heading">PEDIDOS ACTIVOS (${orders.length})</p><div class="order-list">${orders.map(orderCard).join("") || '<div class="team-note">No hay pedidos activos.</div>'}</div>`;
}

function settingsView() {
  const session = state.session;
  const fcList = state.frequentClients.map((c, index) => `<div class="user-card"><div><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.phone)}</span></div><button class="secondary-button" style="border-color:red; color:red;" data-action="delete-fc" data-index="${index}">🗑</button></div>`).join("");
  const ftList = state.frequentTypes.map((t, index) => `<div class="user-card"><div><strong>${escapeHtml(t)}</strong></div><button class="secondary-button" style="border-color:red; color:red;" data-action="delete-ft" data-index="${index}">🗑</button></div>`).join("");

  return `
    <div class="card settings-card">
      <h3>Mi espacio</h3>
      <div class="detail-row"><span>NOMBRE</span><strong>${escapeHtml(session ? session.name : "")}</strong></div>
      <button class="secondary-button" data-action="logout">Cerrar sesión</button>
    </div>

    ${isLead() ? `
      <p class="section-heading">MENSAJE DE WHATSAPP (PLANTILLA)</p>
      <div class="card settings-card" style="margin-bottom:15px;">
        <label class="field">
          <span class="field-label">PLANTILLA DEL MENSAJE</span>
          <textarea id="wa-template-input" style="min-height:80px;">${escapeHtml(state.waTemplate)}</textarea>
          <small style="color:#666; font-size:11px; margin-top:4px;">Variables disponibles: <code>{cliente}</code>, <code>{tipo}</code>, <code>{estado}</code></small>
        </label>
        <button class="primary-button" id="save-wa-template" style="margin-top:8px;">Guardar Mensaje WhatsApp</button>
      </div>
    ` : ''}
    
    <p class="section-heading">CLIENTES FRECUENTES (RESPALDADO EN CLOUD)</p>
    <button class="primary-button" data-action="new-frequent-client">＋ Agregar Cliente Frecuente</button>
    <div class="user-list" style="margin-top:10px;">${fcList || '<div class="team-note">No hay clientes guardados.</div>'}</div>

    <p class="section-heading">TIPOS DE TRABAJO FRECUENTES (RESPALDADO EN CLOUD)</p>
    <button class="primary-button" data-action="new-frequent-type">＋ Agregar Tipo de Trabajo</button>
    <div class="user-list" style="margin-top:10px;">${ftList || '<div class="team-note">No hay tipos de trabajo guardados.</div>'}</div>
  `;
}

function render() {
  if (!state.session) return;
  const screenNames = { now: "Ahora", queue: "Mi cola", team: "Equipo", history: "Historial", settings: "Ajustes" };
  const titleElem = $("#screen-title");
  const roleElem = $("#role-label");
  const screenElem = $("#screen");

  if (titleElem) titleElem.textContent = screenNames[state.screen];
  if (roleElem) roleElem.textContent = `${state.session.role.toUpperCase()} · ${state.session.name.toUpperCase()}`;
  if (screenElem) screenElem.innerHTML = ({ now: nowView, queue: queueView, team: teamView, history: historyView, settings: settingsView })[state.screen]();
  
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.screen === state.screen));

  const saveWaBtn = $("#save-wa-template");
  if (saveWaBtn) {
    saveWaBtn.addEventListener("click", async () => {
      const val = $("#wa-template-input").value.trim();
      if (val) {
        saveWaBtn.disabled = true;
        try {
          await api("profile_save_setting", { key: "wa_template", value: val });
          state.waTemplate = val;
          showToast("Plantilla guardada permanentemente en Google Sheets.");
        } catch (err) {
          window.alert(`Error al guardar: ${err.message}`);
        } finally {
          saveWaBtn.disabled = false;
        }
      }
    });
  }
}

function openModal(content) { const modal = $("#modal"); if (modal) { modal.innerHTML = `<div class="modal-content">${content}</div>`; modal.showModal(); } }
function closeModal() { const modal = $("#modal"); if (modal) modal.close(); }

function promptFinishOrder(order) {
  openModal(`
    <div class="modal-head"><h2>Finalizar Pedido</h2><button class="close-button" data-action="close">×</button></div>
    <form id="finish-order-form" class="form-grid">
      <p><strong>Cliente:</strong> ${escapeHtml(order.cliente)}</p>
      <label class="field">
        <span class="field-label">COMENTARIO / OBSERVACIÓN DE CIERRE</span>
        <textarea name="comentarioCierre" placeholder="Ej. Trabajo entregado conforme. Se incluyeron 2 piezas extra."></textarea>
      </label>
      <label class="field">
        <span class="field-label">FOTO DE EVIDENCIA (OPCIONAL)</span>
        <input type="file" id="evidencia-file-input" accept="image/*">
        <small style="color:#666;">Se guardará en tu Google Drive automáticamente.</small>
      </label>
      <div style="margin-top: 1rem; display: flex; gap: 8px;">
        <button type="submit" class="primary-button">Marcar como Terminado</button>
      </div>
    </form>
  `);

  const form = document.getElementById("finish-order-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnSubmit = form.querySelector('button[type="submit"]');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Guardando...";
      }

      const comentario = form.elements["comentarioCierre"] ? form.elements["comentarioCierre"].value : "";
      const fileInput = document.getElementById("evidencia-file-input");
      const fotosArray = [];

      if (fileInput && fileInput.files.length > 0) {
        for (const file of fileInput.files) {
          try {
            const base64String = await convertirArchivoBase64(file);
            fotosArray.push({
              bytes: base64String.split(",")[1],
              mimeType: file.type
            });
          } catch (err) {
            console.error("Error al procesar la foto:", err);
          }
        }
      }

      if (typeof window.enviarCierreOrden === "function") {
        window.enviarCierreOrden(order.id, comentario, fotosArray);
      } else {
        alert("La función de cierre no está definida en la vista principal.");
      }
    });
  }
}

function detail(order) {
  const phoneVal = order.telefono || order.phone || order.celular || "";
  const rawPhone = cleanPhoneNumber(phoneVal);
  const tipoDisplay = order.tipo || order['tipo de trabajo'] || order.trabajo || order.producto || "Sin tipo";
  
  const rawMsg = state.waTemplate
    .replace(/{cliente}/g, order.cliente || "")
    .replace(/{tipo}/g, tipoDisplay)
    .replace(/{estado}/g, order.estado || "");

  const whatsappMsg = encodeURIComponent(rawMsg);
  const whatsappUrl = rawPhone ? `https://wa.me/${rawPhone}?text=${whatsappMsg}` : `https://wa.me/?text=${whatsappMsg}`;

  const availableStatuses = ["Pendiente", "En proceso", "Pausado", "Terminado", "Entregado", "Cancelado"];

  openModal(`
    <div class="modal-head"><div><p class="eyebrow">${escapeHtml(order.id)}</p><h2>${escapeHtml(order.cliente)}</h2></div><button class="close-button" data-action="close">×</button></div>
    <div class="detail-grid">
      <div class="detail-row"><span>TIPO</span><strong>${escapeHtml(tipoDisplay)}</strong></div>
      <div class="detail-row">
        <span>CAMBIAR ESTADO</span>
        <select id="status-change-select" data-id="${escapeHtml(order.id)}" style="padding:4px 8px; font-weight:bold; border-radius:6px; border:1px solid #ccc;">
          ${availableStatuses.map((st) => `<option value="${st}" ${order.estado === st ? "selected" : ""}>${st}</option>`).join("")}
        </select>
      </div>
      <div class="detail-row"><span>FECHA Y HORA</span><strong>${escapeHtml(formatDate(order.entrega))}</strong></div>
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

  const selectStatus = $("#status-change-select");
  if (selectStatus) {
    selectStatus.addEventListener("change", async (e) => {
      const newStatus = e.target.value;
      if (newStatus === "Terminado") {
        closeModal();
        promptFinishOrder(order);
        return;
      }
      selectStatus.disabled = true;
      try {
        await api("profile_update_order", { id: order.id, changes: { estado: newStatus } });
        order.estado = newStatus;
        showToast(`Estado actualizado a ${newStatus}`);
        closeModal();
        await refresh(false);
      } catch (err) {
        selectStatus.disabled = false;
        window.alert(`Error al actualizar estado: ${err.message}`);
      }
    });
  }
}

function formOrder() {
  const people = (state.data.users || []).filter((user) => user && user.name && String(user.active) !== "false");
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
            <option value="07:30 PM">07:30 PM</option>
            <option value="08:00 PM">08:00 PM</option>
            <option value="08:30 PM">08:30 PM</option>
            <option value="09:00 PM">09:00 PM</option>
          </select>
        </label>
      </div>

      <label class="field">
        <span class="field-label">RESPONSABLE</span>
        <select name="responsable">
          <option value="">Sin asignar</option>
          ${people.map((user) => `<option value="${escapeHtml(user.name)}">${escapeHtml(user.name)}</option>`).join("")}
        </select>
      </label>
      
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
  const inputTipo = $("#input-tipo");
  if (selectTipo && inputTipo) {
    selectTipo.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val && val !== "__CUSTOM__") {
        inputTipo.value = val;
      } else if (val === "__CUSTOM__") {
        inputTipo.value = "";
        inputTipo.focus();
      }
    });
  }

  const orderForm = $("#order-form");
  if (orderForm) {
    orderForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector(".primary-button");
      button.disabled = true;
      button.textContent = "Registrando…";
      try {
        const values = Object.fromEntries(new FormData(form));
        let finalTipo = inputTipo ? inputTipo.value.trim() : "";
        if (!finalTipo && selectTipo && selectTipo.value && selectTipo.value !== "__CUSTOM__") {
          finalTipo = selectTipo.value;
        }

        if (!finalTipo) throw new Error("Debes especificar el tipo de trabajo.");
        values.tipo = finalTipo;

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
}

function formFrequentClient() {
  openModal(`
    <div class="modal-head"><h2>Nuevo Cliente Frecuente</h2><button class="close-button" data-action="close">×</button></div>
    <form id="fc-form" class="form-grid">
      <label class="field"><span class="field-label">NOMBRE DEL CLIENTE</span><input name="name" required placeholder="Ej. Carolai Toppers"></label>
      <label class="field"><span class="field-label">WHATSAPP / TELÉFONO</span><input name="phone" required placeholder="Ej. 04121234567"></label>
      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">Guardar en Google Sheets</button>
      </div>
    </form>
  `);

  const fcForm = $("#fc-form");
  if (fcForm) {
    fcForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.currentTarget.querySelector(".primary-button");
      btn.disabled = true;
      try {
        const values = Object.fromEntries(new FormData(e.currentTarget));
        await api("profile_save_client", { name: values.name.trim(), phone: values.phone.trim() });
        closeModal();
        await refresh(false);
        showToast("Cliente frecuente respaldado en Google Sheets.");
      } catch (err) {
        btn.disabled = false;
        window.alert(`Error: ${err.message}`);
      }
    });
  }
}

function formFrequentType() {
  openModal(`
    <div class="modal-head"><h2>Nuevo Tipo de Trabajo</h2><button class="close-button" data-action="close">×</button></div>
    <form id="ft-form" class="form-grid">
      <label class="field"><span class="field-label">NOMBRE DEL TIPO</span><input name="typeName" required placeholder="Ej. DTF / Sublimación"></label>
      <div class="modal-footer">
        <button type="button" class="secondary-button" data-action="close">Cancelar</button>
        <button type="submit" class="primary-button">Guardar en Google Sheets</button>
      </div>
    </form>
  `);

  const ftForm = $("#ft-form");
  if (ftForm) {
    ftForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.currentTarget.querySelector(".primary-button");
      const val = new FormData(e.currentTarget).get("typeName").trim();
      if (val) {
        btn.disabled = true;
        try {
          await api("profile_save_type", { typeName: val });
          closeModal();
          await refresh(false);
          showToast("Tipo de trabajo respaldado en Google Sheets.");
        } catch (err) {
          btn.disabled = false;
          window.alert(`Error: ${err.message}`);
        }
      }
    });
  }
}

const loginForm = $("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await api("profile_login", { name: $("#login-name").value.trim(), pin: $("#login-pin").value.trim() });
      state.session = response.session;
      store.set("pp_profile_session", state.session);
      $("#login-view").classList.add("hidden");
      $("#workspace").classList.remove("hidden");
      await refresh(false);
    } catch (error) {
      const loginErr = $("#login-error");
      if (loginErr) loginErr.textContent = error.message;
    }
  });
}

const refreshBtn = $("#refresh");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => refresh());
}

document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => { state.screen = button.dataset.screen; render(); }));

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]"); if (!button) return;
  const data = button.dataset;
  if (data.action === "close") return closeModal();
  if (data.action === "detail") { const order = [...(state.data.allOrders || []), ...(state.data.finishedOrders || []), ...(state.data.myOrders || [])].find((item) => String(item.id) === String(data.id)); if (order) detail(order); return; }
  if (data.action === "new-order") return formOrder();
  if (data.action === "new-frequent-client") return formFrequentClient();
  if (data.action === "delete-fc") {
    if (window.confirm("¿Eliminar cliente frecuente de Google Sheets?")) {
      await api("profile_delete_client", { index: Number(data.index) });
      await refresh(false);
    }
    return;
  }
  if (data.action === "new-frequent-type") return formFrequentType();
  if (data.action === "delete-ft") {
    if (window.confirm("¿Eliminar tipo de trabajo de Google Sheets?")) {
      await api("profile_delete_type", { index: Number(data.index) });
      await refresh(false);
    }
    return;
  }
  if (data.action === "logout") { store.remove("pp_profile_session"); state.session = null; $("#workspace").classList.add("hidden"); $("#login-view").classList.remove("hidden"); return; }
  if (data.action === "delete-single-order") {
    if (window.confirm("¿Eliminar pedido?")) {
      await api("profile_delete_order", { id: data.id });
      closeModal();
      await refresh(false);
    }
  }
});

if (state.session) {
  const loginView = $("#login-view");
  const workspaceView = $("#workspace");
  if (loginView) loginView.classList.add("hidden");
  if (workspaceView) workspaceView.classList.remove("hidden");
  render();
  refresh(false);
}
