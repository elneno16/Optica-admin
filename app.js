/* ──────────────────────────────────────────────
   Óptica Admin — app.js
   Storage: localStorage
   ────────────────────────────────────────────── */

'use strict';

// ─── STATE ─────────────────────────────────────
let records = [];
let currentType = 'exam';   // 'exam' | 'sale'
let editingId = null;
let calDate = new Date();   // month displayed in calendar
let selectedPhotoB64 = '';  // base64 of chosen photo

const STORAGE_KEY = 'optica-admin-records';
const GOOGLE_APP_URL = 'https://script.google.com/macros/s/AKfycbwe8MBLbgUbEgyaxNLr9NACif4t4oMEiKLebIDRAxmvFMkaugAhRBqe0UlrQlFiLZgr/exec';

// ─── INIT ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  renderHeaderDate();
  renderStats();
  renderTable();
  bindEvents();
});

// ─── STORAGE ────────────────────────────────────
async function loadRecords() {
  try {
    records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    renderStats();
    renderTable();
  } catch {
    records = [];
  }
  
  // Fetch from Google Sheets in background
  try {
    showToast('🔄 Sincronizando con Google Sheets...', '');
    const res = await fetch(GOOGLE_APP_URL);
    const data = await res.json();
    if (data && Array.isArray(data)) {
      records = data; // use Sheets as the absolute source of truth
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      renderStats();
      renderTable();
      showToast('✅ Sincronizado correctamente', 'success');
    }
  } catch(e) {
    console.warn("Offline or error syncing: ", e);
  }
}
function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ─── HEADER DATE ────────────────────────────────
function renderHeaderDate() {
  const el = document.getElementById('headerDate');
  const now = new Date();
  el.textContent = now.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ─── STATS ──────────────────────────────────────
function renderStats() {
  const todayStr = formatDate(new Date());
  document.getElementById('statTotal').textContent = records.length;
  document.getElementById('statExams').textContent = records.filter(r => r.type === 'exam').length;
  document.getElementById('statSales').textContent = records.filter(r => r.type === 'sale').length;
  document.getElementById('statToday').textContent = records.filter(r => r.fecha === todayStr).length;
}

// ─── TABLE ──────────────────────────────────────
function renderTable(filtered) {
  const tbody = document.getElementById('recordsBody');
  const emptyRow = document.getElementById('emptyRow');
  const data = filtered !== undefined ? filtered : records;

  // Clear existing rows (except emptyRow)
  Array.from(tbody.querySelectorAll('tr:not(#emptyRow)')).forEach(r => r.remove());

  if (data.length === 0) {
    emptyRow.style.display = '';
    return;
  }
  emptyRow.style.display = 'none';

  data.slice().reverse().forEach((rec, idx) => {
    const precio = parseFloat(rec.precio) || 0;
    const abono  = parseFloat(rec.abono)  || 0;
    const saldo  = precio - abono;
    const isPaid = rec.pagoCompleto;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.length - idx}</td>
      <td>${rec.type === 'exam'
        ? '<span class="badge-exam">🔬 Examen</span>'
        : '<span class="badge-sale">🕶️ Montura</span>'
      }</td>
      <td>${rec.fecha || '—'}</td>
      <td>${esc(rec.cliente) || '—'}</td>
      <td>${rec.edad ? esc(rec.edad) : '—'}</td>
      <td>${rec.whatsapp ? `<a href="https://wa.me/${String(rec.whatsapp).replace(/\D/g,'')}" target="_blank" style="color:#25d366;text-decoration:none;">📱 ${esc(rec.whatsapp)}</a>` : '—'}</td>
      <td class="td-product">${esc(truncate(rec.producto, 50)) || '—'}</td>
      <td>${precio ? '$' + precio.toLocaleString('es-CO') : '—'}</td>
      <td>${abono  ? '$' + abono.toLocaleString('es-CO')  : '—'}</td>
      <td>${isPaid
        ? '<span class="badge-paid">✅ Pagado</span>'
        : saldo > 0
          ? `<span class="badge-pending">$${saldo.toLocaleString('es-CO')}</span>`
          : '—'
      }</td>
      <td><button class="btn-row-copy" data-id="${rec.id}" title="Copiar datos de esta fila">📋 Copiar</button></td>
      <td>
        <div class="action-btns">
          <button class="btn-row-view" data-id="${rec.id}">Ver detalle</button>
          <button class="btn-row-edit" data-id="${rec.id}" title="Editar registro">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── SEARCH ─────────────────────────────────────
function doSearch(q) {
  if (!q.trim()) { renderTable(); return; }
  const lq = q.toLowerCase();
  const filtered = records.filter(r =>
    (String(r.cliente || '')).toLowerCase().includes(lq) ||
    (String(r.whatsapp || '')).toLowerCase().includes(lq) ||
    (String(r.ref || '')).toLowerCase().includes(lq) ||
    (String(r.producto || '')).toLowerCase().includes(lq) ||
    (String(r.nota || '')).toLowerCase().includes(lq)
  );
  renderTable(filtered);
}

// ─── CALENDAR ───────────────────────────────────
function renderCalendar() {
  const grid  = document.getElementById('calGrid');
  const label = document.getElementById('calMonthYear');
  grid.innerHTML = '';

  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  label.textContent = new Date(y, m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const first = new Date(y, m, 1).getDay();
  const days  = new Date(y, m + 1, 0).getDate();
  const today = new Date();

  // Blank slots
  for (let i = 0; i < first; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= days; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;

    const isToday = today.getDate() === d && today.getMonth() === m && today.getFullYear() === y;
    if (isToday) cell.classList.add('today');

    const dateStr = formatDate(new Date(y, m, d));
    const currentVal = document.getElementById('fieldFecha').value;
    if (currentVal === dateStr) cell.classList.add('selected');

    cell.addEventListener('click', () => {
      document.getElementById('fieldFecha').value = dateStr;
      document.getElementById('calendarPopup').classList.remove('open');
      renderCalendar(); // refresh selected state
    });
    grid.appendChild(cell);
  }
}

function formatDate(d) {
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ─── EYE FORMULA AUTO-FORMAT ────────────────────
// Input digits (and +/-) → every 3 digits get separated by " - "
function formatEyeField(val) {
  // Keep only digits, +, -, .
  let clean = val.replace(/[^0-9+\-.]/g, '');

  // Split on separator characters to get segments
  // Strategy: collect sequences of digits (with optional leading sign)
  const raw = val.replace(/\s/g, ''); // remove spaces
  // Split by the user-typed separators: we allow the user to type raw digits
  // We detect groups of 3 consecutive digits and insert separator

  // Remove all existing " - " separators first (from previous formatting)
  let stripped = val.replace(/ - /g, '');
  // Now group: split on natural separators (+/-) but keep them
  // Approach: every run of 3+ digits gets a separator between each 3-digit chunk
  let result = stripped.replace(/(\d{3})(?=\d)/g, '$1 - ');
  return result;
}

// ─── MODAL OPEN ─────────────────────────────────
function openModal(type, record) {
  currentType = type;
  editingId   = record ? record.id : null;
  selectedPhotoB64 = record ? (record.foto || '') : '';

  // Badge + title
  const badge = document.getElementById('modalTypeBadge');
  badge.className = 'modal-type-badge ' + type;
  badge.textContent = type === 'exam' ? '🔬 Examen Visual' : '🕶️ Venta Montura';
  document.getElementById('modalTitle').textContent =
    record ? 'Editar Registro' : (type === 'exam' ? 'Nuevo Examen Visual' : 'Nueva Venta de Montura');

  // Show/hide exam-only fields
  document.querySelectorAll('.exam-only').forEach(el => {
    el.style.display = type === 'exam' ? '' : 'none';
  });

  // Reset form
  document.getElementById('registryForm').reset();
  document.getElementById('recordId').value   = record ? record.id : '';
  document.getElementById('recordType').value = type;

  // Fill if editing
  if (record) {
    setValue('fieldFecha',   record.fecha);
    setValue('fieldCliente', record.cliente);
    setValue('fieldWA',      record.whatsapp);
    setValue('fieldRef',     record.ref);
    setValue('fieldProducto',record.producto);
    setValue('fieldDesc',    record.descripcion);
    setValue('fieldPrecio',  record.precio);
    setValue('fieldAbono',   record.abono);
    setValue('fieldNota',    record.nota);
    if (type === 'exam') {
      setValue('fieldEdad', record.edad);
      setValue('fieldOjoD', record.ojoD);
      setValue('fieldOjoI', record.ojoI);
      setValue('fieldDP',   record.dp);
    }
    document.getElementById('fieldPagoCompleto').checked = !!record.pagoCompleto;
    updatePagoLabel();
    updateSaldo();
  }

  // Photo
  const prev    = document.getElementById('photoPreview');
  const ph      = document.getElementById('photoPlaceholder');
  const btnRem  = document.getElementById('btnRemovePhoto');
  if (selectedPhotoB64) {
    prev.src = selectedPhotoB64;
    prev.style.display = '';
    ph.style.display   = 'none';
    btnRem.style.display = '';
  } else {
    prev.src = '';
    prev.style.display = 'none';
    ph.style.display   = '';
    btnRem.style.display = 'none';
  }

  // Update counters
  updateCharCount('fieldProducto', 'cntProducto');
  updateCharCount('fieldNota', 'cntNota');

  // Open
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  calDate = new Date();
  renderCalendar();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('calendarPopup').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── DETAIL MODAL ───────────────────────────────
function openDetail(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;

  document.getElementById('detailTitle').textContent =
    rec.type === 'exam' ? '🔬 Examen Visual — ' + (rec.cliente || '') : '🕶️ Venta Montura — ' + (rec.cliente || '');

  const precio = parseFloat(rec.precio) || 0;
  const abono  = parseFloat(rec.abono)  || 0;
  const saldo  = precio - abono;

  let html = `<div class="detail-grid">`;

  const field = (label, val, full, className) => {
    if (!val && val !== 0) return '';
    return `<div class="detail-field${full ? ' full' : ''}">
      <div class="detail-field-label">${label}</div>
      <div class="detail-field-val${className ? ' ' + className : ''}">${val}</div>
    </div>`;
  };

  html += field('Tipo', rec.type === 'exam' ? '<span class="badge-exam">🔬 Examen Visual</span>' : '<span class="badge-sale">🕶️ Venta Montura</span>');
  html += field('Fecha', rec.fecha);
  html += field('Cliente', esc(rec.cliente), false);
  html += field('WhatsApp', rec.whatsapp ? `<a href="https://wa.me/${String(rec.whatsapp).replace(/\D/g,'')}" target="_blank" style="color:#25d366">📱 ${esc(rec.whatsapp)}</a>` : '');

  if (rec.type === 'exam') {
    html += field('Edad', rec.edad ? esc(rec.edad) + ' años' : '');
    html += field('Ojo Derecho (OD)', rec.ojoD ? `<span class="detail-formula">${esc(rec.ojoD)}</span>` : '');
    html += field('Ojo Izquierdo (OI)', rec.ojoI ? `<span class="detail-formula">${esc(rec.ojoI)}</span>` : '');
    html += field('DP', rec.dp);
  }

  html += field('Ref', esc(rec.ref));
  html += field('Producto', esc(rec.producto), true);
  html += field('Descripción', esc(rec.descripcion), true);
  html += field('Precio', precio ? '$' + precio.toLocaleString('es-CO') : '');
  html += field('Abono', abono ? '$' + abono.toLocaleString('es-CO') : '');
  html += field('Saldo', rec.pagoCompleto
    ? '<span class="badge-paid">✅ Pagado completamente</span>'
    : saldo > 0 ? `<span class="badge-pending">Pendiente: $${saldo.toLocaleString('es-CO')}</span>` : '');
  html += field('Nota', esc(rec.nota), true);

  if (rec.foto) {
    html += `<div class="detail-field full">
      <div class="detail-field-label">📷 Foto</div>
      <img class="detail-photo" src="${rec.foto}" alt="Foto" />
    </div>`;
  }

  html += `</div>`;
  document.getElementById('detailBody').innerHTML = html;

  // Wire buttons
  document.getElementById('detailDelete').onclick = async () => {
    if (confirm('¿Eliminar este registro?')) {
      records = records.filter(r => r.id !== id);
      saveRecords();
      renderStats();
      renderTable();
      closeDetail();
      showToast('🗑️ Eliminando en nube...', '');
      
      try {
        await fetch(GOOGLE_APP_URL, {
          method: "POST",
          body: JSON.stringify({ action: "delete", id: id })
        });
        showToast('✅ Registro eliminado', 'success');
      } catch(e) {
        showToast('⚠️ Borrado localmente (sin internet)', 'error');
      }
    }
  };
  document.getElementById('detailEdit').onclick = () => {
    closeDetail();
    openModal(rec.type, rec);
  };

  document.getElementById('detailOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── SAVE RECORD ────────────────────────────────
async function saveRecord() {
  const type   = document.getElementById('recordType').value;
  const fecha  = document.getElementById('fieldFecha').value;
  const cliente= document.getElementById('fieldCliente').value.trim();

  if (!fecha)   { showToast('⚠️ Selecciona una fecha', 'error'); return; }
  if (!cliente) { showToast('⚠️ El nombre del cliente es obligatorio', 'error'); return; }

  const precio = parseFloat(document.getElementById('fieldPrecio').value) || 0;
  const abono  = parseFloat(document.getElementById('fieldAbono').value)  || 0;
  const paid   = document.getElementById('fieldPagoCompleto').checked;

  const record = {
    id:          editingId || Date.now().toString(36) + Math.random().toString(36).slice(2),
    type,
    fecha,
    cliente,
    whatsapp:    document.getElementById('fieldWA').value.trim(),
    ref:         document.getElementById('fieldRef').value.trim(),
    producto:    document.getElementById('fieldProducto').value.trim(),
    descripcion: document.getElementById('fieldDesc').value.trim(),
    precio,
    abono,
    pagoCompleto: paid,
    nota:        document.getElementById('fieldNota').value.trim(),
    foto:        selectedPhotoB64,
    createdAt:   editingId ? (records.find(r => r.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };

  if (type === 'exam') {
    record.edad = document.getElementById('fieldEdad').value.trim();
    record.ojoD = document.getElementById('fieldOjoD').value.trim();
    record.ojoI = document.getElementById('fieldOjoI').value.trim();
    record.dp   = document.getElementById('fieldDP').value.trim();
  }

  if (editingId) {
    const idx = records.findIndex(r => r.id === editingId);
    if (idx !== -1) records[idx] = record;
  } else {
    records.push(record);
  }

  saveRecords();
  renderStats();
  renderTable();
  closeModal();
  showToast(editingId ? '✏️ Local actualizado, guardando en nube...' : '✅ Local guardado, subiendo a nube...', '');

  // Push to Google Sheets
  try {
    const res = await fetch(GOOGLE_APP_URL, {
      method: 'POST',
      body: JSON.stringify(record)
    });
    const ans = await res.json();
    if(ans.status === "success") {
      showToast('✅ Sincronizado en la nube', 'success');
    } else {
      showToast('⚠️ Hubo un error en la nube', 'error');
    }
  } catch(e) {
    showToast('⚠️ Guardado localmente (sin conexión)', 'error');
  }
}

// ─── COPY ROW ─────────────────────────────────────
function copyRowToClipboard(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  const precio = parseFloat(rec.precio) || 0;
  const abono  = parseFloat(rec.abono)  || 0;
  const saldo  = precio - abono;
  const lines = [
    `👤 Cliente:     ${rec.cliente || '—'}`,
    `📅 Fecha:       ${rec.fecha || '—'}`,
    `🔥 Tipo:        ${rec.type === 'exam' ? 'Examen Visual' : 'Venta Montura'}`,
    `📱 WhatsApp:    ${rec.whatsapp || '—'}`,
  ];
  if (rec.type === 'exam') {
    lines.push(`🎂 Edad:        ${rec.edad || '—'}`);
    lines.push(`👁 Ojo D (OD):  ${rec.ojoD || '—'}`);
    lines.push(`👁 Ojo I (OI):  ${rec.ojoI || '—'}`);
    lines.push(`📐 DP:          ${rec.dp || '—'}`);
  }
  lines.push(
    `🔖 Ref:         ${rec.ref || '—'}`,
    `📦 Producto:    ${rec.producto || '—'}`,
    `🗒 Descripción: ${rec.descripcion || '—'}`,
    `💰 Precio:      $${precio.toLocaleString('es-CO')}`,
    `💵 Abono:       $${abono.toLocaleString('es-CO')}`,
    `⚖️ Saldo:       ${rec.pagoCompleto ? '✅ Pagado completamente' : `$${saldo.toLocaleString('es-CO')} pendiente`}`,
    `📝 Nota:        ${rec.nota || '—'}`,
  );
  const text = lines.join('\n');
  navigator.clipboard.writeText(text)
    .then(() => showToast('📋 Datos copiados al portapapeles', 'success'))
    .catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('📋 Datos copiados al portapapeles', 'success');
    });
}

// ─── DELETE MANAGER MODAL ─────────────────────────────
function openDeleteManager() {
  const body = document.getElementById('deleteManagerBody');

  if (records.length === 0) {
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay registros registrados.</p>';
  } else {
    let html = '<ul class="delete-client-list">';
    // Show newest first
    records.slice().reverse().forEach(rec => {
      html += `
        <li class="delete-client-item">
          <span class="delete-client-name">
            <span class="delete-client-icon">${rec.type === 'exam' ? '🔬' : '🕶️'}</span>
            <span>${esc(rec.cliente) || '(sin nombre)'}</span>
            <small class="delete-client-date">${rec.fecha || ''}</small>
          </span>
          <button class="btn-delete-client" data-id="${rec.id}" title="Eliminar este cliente">🗑️</button>
        </li>`;
    });
    html += '</ul>';
    body.innerHTML = html;
  }

  document.getElementById('deleteManagerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDeleteManager() {
  document.getElementById('deleteManagerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── EXPORT CSV ─────────────────────────────────
function exportCSV() {
  if (records.length === 0) { showToast('No hay registros para exportar', 'error'); return; }
  const headers = ['Tipo','Fecha','Cliente','Edad','WhatsApp','Ojo D','Ojo I','DP','Ref','Producto','Descripcion','Precio','Abono','Pago Completo','Saldo','Nota'];
  const rows = records.map(r => {
    const precio = parseFloat(r.precio) || 0;
    const abono  = parseFloat(r.abono) || 0;
    return [
      r.type === 'exam' ? 'Examen Visual' : 'Venta Montura',
      r.fecha, r.cliente, r.edad || '', r.whatsapp,
      r.ojoD || '', r.ojoI || '', r.dp || '',
      r.ref, r.producto, r.descripcion,
      precio, abono,
      r.pagoCompleto ? 'SI' : 'NO',
      precio - abono,
      r.nota
    ].map(v => `"${String(v || '').replace(/"/g,'""')}"`).join(',');
  });
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv),
    download: `optica-registros-${formatDate(new Date()).replace(/\//g,'-')}.csv`
  });
  a.click();
  showToast('📤 CSV exportado', 'success');
}

// ─── HELPERS ────────────────────────────────────
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}
function updateCharCount(fieldId, cntId) {
  const el  = document.getElementById(fieldId);
  const cnt = document.getElementById(cntId);
  if (el && cnt) cnt.textContent = el.value.length;
}
function updatePagoLabel() {
  const checked = document.getElementById('fieldPagoCompleto').checked;
  document.getElementById('pagoLabel').textContent = checked ? 'Pago completo ✅' : 'Pago incompleto';
}
function updateSaldo() {
  const precio = parseFloat(document.getElementById('fieldPrecio').value) || 0;
  const abono  = parseFloat(document.getElementById('fieldAbono').value)  || 0;
  const paid   = document.getElementById('fieldPagoCompleto').checked;
  const saldo  = precio - abono;
  const el = document.getElementById('saldoDisplay');
  if (paid) {
    el.textContent = '✅ Pago completo registrado';
    el.className = 'saldo-display paid';
  } else {
    el.textContent = `Saldo pendiente: $${Math.max(0, saldo).toLocaleString('es-CO')}`;
    el.className = 'saldo-display';
  }
}
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── EVENTS ─────────────────────────────────────
function bindEvents() {

  // Main buttons
  document.getElementById('btnExam').onclick = () => openModal('exam');
  document.getElementById('btnSale').onclick = () => openModal('sale');

  // Close modal
  document.getElementById('modalClose').onclick  = closeModal;
  document.getElementById('btnCancel').onclick   = closeModal;
  document.getElementById('detailClose').onclick = closeDetail;

  // Click outside modal
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.getElementById('detailOverlay').addEventListener('click', e => {
    if (e.target.id === 'detailOverlay') closeDetail();
  });

  // Save
  document.getElementById('btnSave').onclick = saveRecord;

  // Export
  document.getElementById('btnExport').onclick = exportCSV;

  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', e => {
    doSearch(e.target.value);
    document.getElementById('btnClearSearch').style.display = e.target.value ? '' : 'none';
  });
  document.getElementById('btnClearSearch').addEventListener('click', () => {
    searchInput.value = '';
    document.getElementById('btnClearSearch').style.display = 'none';
    renderTable();
    searchInput.focus();
  });
  document.getElementById('btnClearSearch').style.display = 'none';

  // Calendar toggle
  document.getElementById('btnCalendar').onclick = () => {
    const popup = document.getElementById('calendarPopup');
    popup.classList.toggle('open');
    if (popup.classList.contains('open')) renderCalendar();
  };
  document.getElementById('calPrev').onclick = () => {
    calDate.setMonth(calDate.getMonth() - 1);
    renderCalendar();
  };
  document.getElementById('calNext').onclick = () => {
    calDate.setMonth(calDate.getMonth() + 1);
    renderCalendar();
  };

  // Photo
  document.getElementById('btnPhoto').onclick = () => {
    document.getElementById('photoInput').click();
  };
  document.getElementById('photoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('La imagen no debe superar 5 MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      selectedPhotoB64 = ev.target.result;
      const prev   = document.getElementById('photoPreview');
      const ph     = document.getElementById('photoPlaceholder');
      const btnRem = document.getElementById('btnRemovePhoto');
      prev.src = selectedPhotoB64;
      prev.style.display   = '';
      ph.style.display     = 'none';
      btnRem.style.display = '';
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('btnRemovePhoto').onclick = () => {
    selectedPhotoB64 = '';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoPreview').src = '';
    document.getElementById('photoPlaceholder').style.display = '';
    document.getElementById('btnRemovePhoto').style.display = 'none';
    document.getElementById('photoInput').value = '';
  };

  // Toggle pago completo
  document.getElementById('fieldPagoCompleto').addEventListener('change', () => {
    updatePagoLabel();
    updateSaldo();
  });

  // Precio / Abono → update saldo
  document.getElementById('fieldPrecio').addEventListener('input', updateSaldo);
  document.getElementById('fieldAbono').addEventListener('input', updateSaldo);

  // Char counters
  document.getElementById('fieldProducto').addEventListener('input', () => updateCharCount('fieldProducto', 'cntProducto'));
  document.getElementById('fieldNota').addEventListener('input',     () => updateCharCount('fieldNota', 'cntNota'));

  // Eye-field auto-format — every 3 digits insert " - "
  ['fieldOjoD', 'fieldOjoI'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', function () {
      const cursor = this.selectionStart;
      const raw = this.value;
      // Remove existing auto-separators to re-process
      let clean = raw.replace(/ - /g, '');
      // Insert separator every 3 digits (only between digit groups)
      let formatted = clean.replace(/(\d{3})(?=\d)/g, '$1 - ');
      if (this.value !== formatted) {
        this.value = formatted;
        // Restore cursor approximately
        try { this.setSelectionRange(cursor + 1, cursor + 1); } catch {}
      }
    });
  });

  // Row buttons (event delegation)
  document.getElementById('recordsBody').addEventListener('click', e => {
    const btnView = e.target.closest('.btn-row-view');
    if (btnView) { openDetail(btnView.dataset.id); return; }
    const btnCopy = e.target.closest('.btn-row-copy');
    if (btnCopy) { copyRowToClipboard(btnCopy.dataset.id); return; }
    const btnEdit = e.target.closest('.btn-row-edit');
    if (btnEdit) { 
      const rec = records.find(r => r.id === btnEdit.dataset.id);
      if (rec) openModal(rec.type, rec);
      return; 
    }
  });

  // Delete manager
  document.getElementById('btnDeleteManager').onclick = openDeleteManager;
  document.getElementById('deleteManagerClose').onclick = closeDeleteManager;
  document.getElementById('deleteManagerOverlay').addEventListener('click', e => {
    if (e.target.id === 'deleteManagerOverlay') closeDeleteManager();
  });
  document.getElementById('deleteManagerBody').addEventListener('click', async e => {
    const btn = e.target.closest('.btn-delete-client');
    if (!btn) return;
    const id  = btn.dataset.id;
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    const cliente = rec.cliente || '(sin nombre)';
    const confirmed = confirm(
      `⚠️ ¿Estás seguro de que deseas borrar al cliente\n\n"​${cliente}"​\n\ny TODA su información?\n\nEsta acción no se puede deshacer.`
    );
    if (confirmed) {
      records = records.filter(r => r.id !== id);
      saveRecords();
      renderStats();
      renderTable();
      closeDeleteManager();
      showToast('🗑️ Eliminando en nube...', '');
      
      try {
        await fetch(GOOGLE_APP_URL, {
          method: "POST",
          body: JSON.stringify({ action: "delete", id: id })
        });
        showToast(`✅ Registro de "​${cliente}"​ eliminado`, 'success');
      } catch(ex) {
        showToast('⚠️ Borrado localmente (sin internet)', 'error');
      }
    }
  });

  // Keyboard escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetail();
    }
  });
}
