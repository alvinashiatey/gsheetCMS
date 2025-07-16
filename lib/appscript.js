const CONFIG = {
  SHEET_NAMES: ["Sheet1"],
  // The row number where the data headers are located (e.g., 'parent/child').
  HEADER_ROW: 1,
  // The column number where the data begins.
  START_COLUMN: 1,
};

function doGet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const allSheetsData = [];

  CONFIG.SHEET_NAMES.forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);

    // Gracefully skip if a sheet defined in the config doesn't exist.
    if (!sheet) {
      console.warn(`Sheet named "${sheetName}" was not found. Skipping.`);
      return; // Skips to the next sheet in the loop.
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const headerRowIndex = CONFIG.HEADER_ROW;
    const startRowIndex = headerRowIndex + 1;

    // Proceed only if there is data to read (at least one row after the header).
    if (lastRow < startRowIndex) {
      console.warn(
        `No data found in sheet "${sheetName}" after the header row. Skipping.`
      );
      return;
    }

    // Dynamically calculate the range to fetch all data from the header row downwards.
    const numRowsToFetch = lastRow - headerRowIndex + 1;
    const range = sheet.getRange(
      headerRowIndex,
      CONFIG.START_COLUMN,
      numRowsToFetch,
      lastColumn
    );
    const displayValues = range.getDisplayValues();

    // Convert the 2D array of values into a structured JSON array.
    const structuredData = createStructuredData(displayValues);

    allSheetsData.push({
      sheetName: sheetName,
      children: structuredData,
    });
  });

  // Return the final data as a JSON response.
  return ContentService.createTextOutput(
    JSON.stringify({ data: allSheetsData })
  ).setMimeType(ContentService.MimeType.JSON);
}

function createStructuredData(data) {
  // The first row contains the header keys (e.g., 'company/address/street').
  const keys = data[0];
  // The rest of the rows contain the data.
  const rows = data.slice(1);

  const result = [];

  rows.forEach((row) => {
    const obj = {};
    let rowHasData = false; // A flag to avoid creating objects for empty rows.

    row.forEach((value, index) => {
      // Ensure there is a key for the current column and the cell value is not empty.
      if (keys[index] && value !== "") {
        setNestedProperty(obj, keys[index], value);
        rowHasData = true;
      }
    });

    // Only add the generated object to our results if it contains data.
    if (rowHasData) {
      result.push(obj);
    }
  });

  return result;
}

function setNestedProperty(obj, path, value) {
  const parts = path.split("/");
  let currentContext = obj;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLastPart = i === parts.length - 1;

    // Check for array syntax, e.g., "items[2]"
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);

    if (arrayMatch) {
      const arrayKey = arrayMatch[1]; // "items"
      const index = parseInt(arrayMatch[2], 10); // 2

      // Create the array if it doesn't exist on the current object.
      if (!currentContext[arrayKey]) {
        currentContext[arrayKey] = [];
      }

      if (isLastPart) {
        currentContext[arrayKey][index] = value;
      } else {
        // If we are not at the end of the path, ensure the next level exists.
        // Look ahead to see if the next part is also an array index.
        const nextPartIsArray = /\[\d+\]/.test(parts[i + 1]);
        if (!currentContext[arrayKey][index]) {
          currentContext[arrayKey][index] = nextPartIsArray ? [] : {};
        }
        currentContext = currentContext[arrayKey][index];
      }
    } else {
      // This part is a simple object key.
      if (isLastPart) {
        currentContext[part] = value;
      } else {
        // Look ahead to see if the next part is an array index.
        const nextPartIsArray = /\[\d+\]/.test(parts[i + 1]);
        if (!currentContext[part]) {
          currentContext[part] = nextPartIsArray ? [] : {};
        }
        currentContext = currentContext[part];
      }
    }
  }
}
