/**
 * Richard Eugenio — Lead-capture API
 * -------------------------------------------
 * index.html is hosted as a static file on GitHub Pages. This script is a
 * SEPARATE Apps Script project (tied to a Google Sheet) that just receives
 * contact-form submissions and logs them to a "Leads" sheet.
 *
 * SETUP
 * 1. Create a new Google Sheet (or open an existing one).
 * 2. Extensions > Apps Script, and paste this file in as "code.gs".
 *    (No index.html needed in this project — GitHub Pages serves that.)
 * 3. Deploy > New deployment > Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 4. Copy the deployment URL (it ends in /exec).
 * 5. Open index.html and paste that URL into the GAS_WEBAPP_URL constant
 *    near the top of the <script> block, then push to GitHub Pages.
 *
 * WHY TWO REQUEST PATHS
 * The page tries a normal fetch() POST first (fast, gives a real response).
 * If a browser's CORS handling blocks that — which happens on some mobile
 * browsers — it automatically falls back to a JSONP-style <script> request,
 * which isn't subject to CORS at all. Both paths land here and call the
 * same handleLead_() logic.
 *
 * Leave LEADS_SPREADSHEET_ID blank to use whichever Sheet this script is
 * bound to. Only fill it in if this is a standalone script not bound to
 * any Sheet.
 */

const LEADS_SPREADSHEET_ID = '';
const LEADS_SHEET_NAME = 'Leads';

/**
 * Handles plain GET requests (health check) and JSONP-style submissions
 * (when ?callback=... is present, used as the CORS-proof fallback).
 */
function doGet(e) {
  const params = (e && e.parameter) || {};

  if (params.callback) {
    let result;
    try {
      result = handleLead_(params);
    } catch (err) {
      result = { ok: false, message: err.message };
    }
    return jsonpResponse_(params.callback, result);
  }

  return ContentService
    .createTextOutput('Richard Eugenio — lead API is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Handles the normal fetch() POST from the contact form.
 * Expects a JSON string body (sent with Content-Type: text/plain to avoid
 * a CORS preflight, which Apps Script doesn't handle well).
 */
function doPost(e) {
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    result = handleLead_(data);
  } catch (err) {
    result = { ok: false, message: err.message || 'Something went wrong. Please try again.' };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Shared validation + sheet-logging logic for both request paths.
 */
function handleLead_(data) {
  const name = clean_(data && data.name);
  const business = clean_(data && data.business);
  const contact = clean_(data && data.contact);
  const message = clean_(data && data.message);

  if (!name || !message) {
    return { ok: false, message: 'Please fill in your name and a short message.' };
  }

  const sheet = getLeadsSheet_();
  sheet.appendRow([new Date(), name, business, contact, message]);
  return { ok: true };
}

/**
 * Gets (or creates, on first use) the Leads sheet with a header row.
 */
function getLeadsSheet_() {
  const ss = LEADS_SPREADSHEET_ID
    ? SpreadsheetApp.openById(LEADS_SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('No spreadsheet is bound to this script. Set LEADS_SPREADSHEET_ID in code.gs.');
  }

  let sheet = ss.getSheetByName(LEADS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LEADS_SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Name', 'Business / Type', 'Contact No.', 'Message']);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 5);
  }
  return sheet;
}

/**
 * Wraps a JSON payload in `callbackName(...)` for JSONP responses.
 * The callback name is sanitized since it's reflected straight into
 * executable JS — never trust it as-is.
 */
function jsonpResponse_(callbackName, dataObj) {
  const safeCallback = String(callbackName).replace(/[^a-zA-Z0-9_$]/g, '');
  const body = safeCallback + '(' + JSON.stringify(dataObj) + ');';
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function clean_(value) {
  return (value || '').toString().trim();
}
