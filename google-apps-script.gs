// ──────────────────────────────────────────────────────────────────
//  Óptica Admin — Google Apps Script
//  Pega este código en script.google.com y vuelve a publicar (Deploy)
// ──────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Registros';

// Columnas EN ORDEN — deben coincidir exactamente con las cabeceras de la hoja
const COLUMNS = [
  'id', 'type', 'fecha', 'cliente', 'edad', 'whatsapp',
  'ojoD', 'ojoI', 'dp', 'ref', 'producto', 'descripcion',
  'precio', 'abono', 'pagoCompleto', 'nota', 'foto',
  'createdAt', 'updatedAt'
];

// ─── GET: Devuelve todos los registros como JSON ───────────────────
function doGet(e) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    setupHeaders(sheet);

    const data      = sheet.getDataRange().getValues();
    const headers   = data[0].map(h => String(h).trim());
    const rows      = data.slice(1);

    const records = rows
      .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          let val = row[i];
          // Normalize booleans
          if (val === 'TRUE' || val === true)  val = true;
          if (val === 'FALSE' || val === false) val = false;
          // Normalize edad: always a clean integer string
          if (h === 'edad') {
            const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
            val = isNaN(n) ? '' : String(n);
          }
          obj[h] = (val === null || val === undefined) ? '' : val;
        });
        return obj;
      });

    return ContentService
      .createTextOutput(JSON.stringify(records))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── POST: Guarda o elimina un registro ───────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const sheet   = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    setupHeaders(sheet);

    // ── ELIMINAR ──────────────────────────────────────────────────
    if (payload.action === 'delete') {
      const deleted = deleteRow(sheet, payload.id);
      return jsonResponse({ status: deleted ? 'success' : 'not_found' });
    }

    // ── CREAR O ACTUALIZAR ────────────────────────────────────────
    const headers  = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
    const data     = sheet.getDataRange().getValues();
    const ids      = data.slice(1).map(r => String(r[0]));
    const rowIndex = ids.indexOf(String(payload.id));

    // Normalizar edad antes de guardar
    if (payload.edad !== undefined) {
      const n = parseInt(String(payload.edad).replace(/[^0-9]/g, ''), 10);
      payload.edad = isNaN(n) ? '' : String(n);
    }

    const rowData = COLUMNS.map(col => {
      const val = payload[col];
      if (val === undefined || val === null) return '';
      if (typeof val === 'boolean') return val;
      return String(val);
    });

    if (rowIndex === -1) {
      // Nueva fila
      sheet.appendRow(rowData);
    } else {
      // Actualizar fila existente (rowIndex+2 porque fila 1=headers, slice desde 1)
      sheet.getRange(rowIndex + 2, 1, 1, rowData.length).setValues([rowData]);
    }

    return jsonResponse({ status: 'success' });
  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────
function setupHeaders(sheet) {
  const existing = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
  const isEmpty  = existing.every(c => c === '' || c === null || c === undefined);
  if (isEmpty) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    sheet.setFrozenRows(1);
  }
}

function deleteRow(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
