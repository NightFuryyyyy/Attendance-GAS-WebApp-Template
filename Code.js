function getLastRow(sheet) {
  const names = sheet.getRange("A2:A").getValues().flat();
  for (let i = names.length - 1; i >= 0; i--) {
    if (names[i].trim() != "") {
      return i + 2;
    }
  }
  return 0;
}

function getNameMap(section) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(section);
  const lastRow = getLastRow(sheet);
  const nameRange = sheet.getRange(`A2:A${lastRow}`);
  const names = nameRange.getValues().flat();
  const nameMap = names.map((name, index) => ({
    row: index + 2,
    name
  }));

  return {
    nameMap,
    issues: getIssues(sheet),
  };
}

function exchange(updates, section, date, year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(updates).forEach(sectionInUpdates => {
    const sheet = ss.getSheetByName(sectionInUpdates);
    Object.keys(updates[sectionInUpdates]).forEach(yearInUpdates => {
      Object.keys(updates[sectionInUpdates][yearInUpdates]).forEach(dateInUpdates => {
        const col = getColByDate(sheet, dateInUpdates, yearInUpdates);
        const lastRow = getLastRow(sheet);
        const range = sheet.getRange(2, col, lastRow - 1);
        const values = range.getValues();
        Object.keys(updates[sectionInUpdates][yearInUpdates][dateInUpdates]).forEach(rowInUpdates => {
          const value = updates[sectionInUpdates][yearInUpdates][dateInUpdates][rowInUpdates];
          values[rowInUpdates - 2][0] = value == "blank" ? "" : value;
        });
        range.setValues(values);
      });
    });
  });
  const sheet = ss.getSheetByName(section);
  const lastRow = getLastRow(sheet);
  const valueRange = sheet.getRange(2, getColByDate(sheet, date, year), lastRow - 1);
  const values = valueRange.getValues();
  const fetchTime = (new Date()).toISOString();
  const valueMap = values.flat().reduce((obj, value, index) => {
    value = value.trim().toLowerCase();
    if (value == "") {
      obj[index + 2] = "blank";
    } else if (value == "p") {
      obj[index + 2] = "P";
    } else if (value == "a") {
      obj[index + 2] = "A";
    } else if (value == "e") {
      obj[index + 2] = "E";
    } else if (value == "m") {
      obj[index + 2] = "M";
    } else if (value == "i") {
      obj[index + 2] = "I";
    } else if (value == "c") {
      obj[index + 2] = "C";
    }
    return obj;
  }, {});
  const percentRange = sheet.getRange(2, getColByHeader(sheet, "Percentage"), lastRow - 1);
  const percentages = percentRange.getValues();
  const percentMap = Object.fromEntries(
    percentages.flat().map((item, index) => [index + 2, item])
  );
  return {
    section,
    date,
    year,
    valueMap,
    processedUpdates: updates,
    fetchTime,
    percentMap
  };
}

function getColByDate(sheet, date, year) {
  const dateRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const dateColFinder = dateRange.createTextFinder(date);
  while (range = dateColFinder.findNext()) {
    const date = range.getValue();
    if (date.getFullYear() == year) {
      return range.getColumn();
    }
  }
}

function getColByHeader(sheet, header) {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headerColFinder = headerRange.createTextFinder(header);
  const range = headerColFinder.findNext();
  return range.getColumn();
}

function getIssues(sheet) {
  const headings = sheet.getRange("1:1").getValues()[0];
  const firstCol = headings.findIndex(item => typeof item != "string") + 1;
  const lastCol = headings.length;
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(1, firstCol, lastRow, lastCol - (firstCol - 1)).getValues();
  var issues = [];
  for (let i = 0; i < values[0].length; i++) {
    var date = values[0][i];
    if (date.toDateString() == new Date().toDateString()) {
      continue;
    }
    var blankCount = 0;
    for (let j = 1; j < values.length; j++) {
      if (values[j][i]?.trim()) {
        continue;
      }
      blankCount++;
    }
    if (blankCount == 0 || blankCount == values.length - 1) {
      continue;
    }
    issues.push({
      type: "missing",
      date: date.toISOString(),
      blankCount
    });
  }
  return issues;
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const userEmail = Session.getEffectiveUser().getEmail();

  const whitelist = ss.getEditors().map(editor => editor.getEmail());

  if (!whitelist.includes(userEmail)) {
    return;
  }
  
  var template = HtmlService.createTemplateFromFile("index");

  template.sheets = ss.getSheets().map(sheet => {
    let colour;
    try {
      colour = sheet.getTabColorObject()?.asRgbColor()?.asHexString();
    } catch {
      colour = "#000000";
    }
    return {
      name: sheet.getSheetName(),
      colour,
    };
  });

  Logger.log(`${userEmail} logged in at ${new Date().toISOString()}.`);
  
  return template.evaluate()
    .setTitle('Attendance-GAS-WebApp-Template')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}