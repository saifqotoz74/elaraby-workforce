const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'core', 'localization', 'app_locale.dart');
const content = fs.readFileSync(filePath, 'utf8');

function extractMap(mapName) {
  const marker = `static const Map<String, String> ${mapName} = {`;
  const startIndex = content.indexOf(marker);
  if (startIndex === -1) throw new Error(`Marker ${marker} not found`);
  
  const braceStart = content.indexOf('{', startIndex);
  let braceCount = 1;
  let endIndex = braceStart + 1;
  while (braceCount > 0 && endIndex < content.length) {
    if (content[endIndex] === '{') braceCount++;
    if (content[endIndex] === '}') braceCount--;
    endIndex++;
  }
  
  const mapContent = content.substring(braceStart + 1, endIndex - 1);
  const result = {};
  
  // Match key-value pairs: 'key': 'value' or 'key': "value" or multiline
  const lines = mapContent.split('\n');
  let currentKey = null;
  let currentValue = '';
  let inString = false;
  let quoteChar = '';

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    const kvMatch = trimmed.match(/^'([^']+)'\s*:\s*(.*)$/);
    if (kvMatch) {
      if (currentKey) {
        result[currentKey] = currentValue;
      }
      currentKey = kvMatch[1];
      let rest = kvMatch[2].trim();
      if (!rest) {
        // value starts on next line
        currentValue = '';
        inString = false;
        continue;
      }
      if (rest.startsWith("'") || rest.startsWith('"')) {
        quoteChar = rest[0];
        rest = rest.slice(1);
        if (rest.endsWith("',") || rest.endsWith('",')) {
          currentValue = rest.slice(0, -2);
          result[currentKey] = currentValue;
          currentKey = null;
        } else if (rest.endsWith("'") || rest.endsWith('"')) {
          currentValue = rest.slice(0, -1);
          result[currentKey] = currentValue;
          currentKey = null;
        } else {
          currentValue = rest;
          inString = true;
        }
      } else {
        currentValue = rest;
      }
    } else if (currentKey && !inString) {
      // String starting on this line
      if (trimmed.startsWith("'") || trimmed.startsWith('"')) {
        quoteChar = trimmed[0];
        let rest = trimmed.slice(1);
        if (rest.endsWith("',") || rest.endsWith('",')) {
          currentValue = rest.slice(0, -2);
          result[currentKey] = currentValue;
          currentKey = null;
        } else if (rest.endsWith("'") || rest.endsWith('"')) {
          currentValue = rest.slice(0, -1);
          result[currentKey] = currentValue;
          currentKey = null;
        } else {
          currentValue = rest;
          inString = true;
        }
      }
    } else if (inString && currentKey) {
      if (trimmed.endsWith("',") || trimmed.endsWith('",')) {
        currentValue += (currentValue ? ' ' : '') + trimmed.slice(0, -2);
        result[currentKey] = currentValue;
        currentKey = null;
        inString = false;
      } else if (trimmed.endsWith("'") || trimmed.endsWith('"')) {
        currentValue += (currentValue ? ' ' : '') + trimmed.slice(0, -1);
        result[currentKey] = currentValue;
        currentKey = null;
        inString = false;
      } else {
        currentValue += (currentValue ? ' ' : '') + trimmed;
      }
    }
  }
  if (currentKey) {
    result[currentKey] = currentValue;
  }
  return result;
}

const en = extractMap('_en');
const ar = extractMap('_ar');

console.log('Extracted EN keys:', Object.keys(en).length);
console.log('Extracted AR keys:', Object.keys(ar).length);

// Clean up escape sequences like \n
for (const k in en) {
  en[k] = en[k].replace(/\\n/g, '\n').replace(/\\'/g, "'");
}
for (const k in ar) {
  ar[k] = ar[k].replace(/\\n/g, '\n').replace(/\\'/g, "'");
}

// Add route not found and other missing strings
const extraEn = {
  route_not_found: 'Page Not Found',
  route_not_found_desc: 'The requested page could not be found.',
  return_home: 'Return to Home',
  // Pluralization keys
  vacation_days_count: '{count, plural, =0{0 Days} =1{1 Day} other{{count} Days}}',
  vacation_days_remaining_count: '{count, plural, =0{0 days remaining} =1{1 day remaining} other{{count} days remaining}}',
  auth_locked_minutes: '{minutes, plural, =1{Too many wrong attempts. Try again in 1 minute.} other{Too many wrong attempts. Try again in {minutes} minutes.}}',
  trip_seats_left_count: '{count, plural, =0{No seats left} =1{1 seat left} other{{count} seats left}}',
};

const extraAr = {
  route_not_found: 'الصفحة غير موجودة',
  route_not_found_desc: 'تعذر العثور على الصفحة المطلوبة.',
  return_home: 'العودة للرئيسية',
  // Pluralization keys (Arabic 6 plural forms: zero, one, two, few, many, other)
  vacation_days_count: '{count, plural, =0{٠ يوم} =1{يوم واحد} =2{يومان} few{{count} أيام} many{{count} يوماً} other{{count} يوم}}',
  vacation_days_remaining_count: '{count, plural, =0{٠ يوم متبقٍ} =1{يوم واحد متبقٍ} =2{يومان متبقيان} few{{count} أيام متبقية} many{{count} يوماً متبقياً} other{{count} يوم متبقٍ}}',
  auth_locked_minutes: '{minutes, plural, =1{محاولات خاطئة كثيرة. حاول مرة أخرى بعد دقيقة واحدة.} =2{محاولات خاطئة كثيرة. حاول مرة أخرى بعد دقيقتين.} few{محاولات خاطئة كثيرة. حاول مرة أخرى بعد {minutes} دقائق.} many{محاولات خاطئة كثيرة. حاول مرة أخرى بعد {minutes} دقيقة.} other{محاولات خاطئة كثيرة. حاول مرة أخرى بعد {minutes} دقيقة.}}',
  trip_seats_left_count: '{count, plural, =0{لا توجد مقاعد متبقية} =1{مقعد واحد متبقٍ} =2{مقعدان متبقيان} few{{count} مقاعد متبقية} many{{count} مقعداً متبقياً} other{{count} مقعد متبقٍ}}',
};

Object.assign(en, extraEn);
Object.assign(ar, extraAr);

// Build final ARB JSON
const enArb = {
  "@@locale": "en",
};

for (const key of Object.keys(en).sort()) {
  enArb[key] = en[key];
  if (key === 'auth_locked') {
    enArb['@' + key] = {
      description: "Lockout message",
      placeholders: {
        minutes: {
          type: "String"
        }
      }
    };
  } else if (key === 'auth_locked_minutes') {
    enArb['@' + key] = {
      description: "Lockout message with plural minutes",
      placeholders: {
        minutes: {
          type: "num",
          format: "compact"
        }
      }
    };
  } else if (key === 'vacation_days_count' || key === 'vacation_days_remaining_count' || key === 'trip_seats_left_count') {
    enArb['@' + key] = {
      description: "Plural count",
      placeholders: {
        count: {
          type: "num",
          format: "compact"
        }
      }
    };
  }
}

const arArb = {
  "@@locale": "ar",
};

for (const key of Object.keys(ar).sort()) {
  arArb[key] = ar[key];
}

fs.writeFileSync(path.join(__dirname, '..', 'lib', 'l10n', 'app_en.arb'), JSON.stringify(enArb, null, 2), 'utf8');
fs.writeFileSync(path.join(__dirname, '..', 'lib', 'l10n', 'app_ar.arb'), JSON.stringify(arArb, null, 2), 'utf8');
console.log('Written app_en.arb and app_ar.arb successfully.');

const dartLines = [
  '// Generated file. Do not edit manually.',
  "import '../../l10n/generated/app_localizations.dart';",
  '',
  '/// Maps a string key to its corresponding localized getter on [AppLocalizations].',
  'String? lookupL10nString(AppLocalizations l10n, String key) {',
  '  switch (key) {',
];

for (const key of Object.keys(en).sort()) {
  if (key === 'auth_locked') {
    dartLines.push(`    case '${key}':\n      return l10n.auth_locked('{minutes}');`);
  } else if (key === 'auth_locked_minutes') {
    dartLines.push(`    case '${key}':\n      return l10n.auth_locked_minutes(1);`);
  } else if (key === 'vacation_days_count') {
    dartLines.push(`    case '${key}':\n      return l10n.vacation_days_count(1);`);
  } else if (key === 'vacation_days_remaining_count') {
    dartLines.push(`    case '${key}':\n      return l10n.vacation_days_remaining_count(1);`);
  } else if (key === 'trip_seats_left_count') {
    dartLines.push(`    case '${key}':\n      return l10n.trip_seats_left_count(1);`);
  } else {
    dartLines.push(`    case '${key}':\n      return l10n.${key};`);
  }
}

dartLines.push('    default:\n      return null;');
dartLines.push('  }');
dartLines.push('}');
dartLines.push('');

fs.writeFileSync(path.join(__dirname, '..', 'lib', 'core', 'localization', 'l10n_map.dart'), dartLines.join('\n'), 'utf8');
console.log('Written lib/core/localization/l10n_map.dart successfully.');

