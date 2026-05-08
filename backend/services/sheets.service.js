/**
 * @module services/sheets
 * Push audit result rows to a Google Sheet tab.
 * Uses a service account (GOOGLE_APPLICATION_CREDENTIALS).
 */
import { google } from 'googleapis';

/**
 * Clear a named tab in a Google Spreadsheet, then write all rows starting at A1.
 *
 * @param {object}   params
 * @param {string}   params.spreadsheetId  - Google Sheets file ID (from the sheet URL)
 * @param {string}   params.tabName        - Exact name of the sheet tab to overwrite
 * @param {string[][]} params.rows         - 2D array; first row should be the header
 * @returns {Promise<{ rowsWritten: number }>} Number of data rows written (header excluded)
 */
export async function pushToSheets({ spreadsheetId, tabName, rows }) {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes:  ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Clear existing content in the tab
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: tabName,
  });

  // Write all rows starting at A1 (even if rows is empty — just leaves tab clear)
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody:      { values: rows },
    });
  }

  return { rowsWritten: rows.length > 0 ? rows.length - 1 : 0 };
}
