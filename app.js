/* NightModeScheduler Logic
   Offline evening screen-time log with a simple bedtime estimate. Logs are
   held in localStorage encrypted at rest with a device-bound, non-extractable
   AES-GCM key (see the ENCRYPTION AT REST block below).
*/

const slider = document.getElementById('exposure-slider');
const sliderVal = document.getElementById('exposure-val');
const btnLog = document.getElementById('save-log-btn');
const root = document.documentElement;

// Data Management Elements
const btnExport = document.getElementById('export-btn');
const btnImport = document.getElementById('import-btn');
const fileInput = document.getElementById('import-file');

/* THE BEDTIME ESTIMATE
   One fixed rule, nothing more: start at 22:00 and add 20 minutes for every
   hour of screen time logged after 18:00. It is an estimate, not a
   measurement and not advice, and the page says so in plain words under the
   figure (see describeRule). Keep that sentence in step with these numbers.
   The app makes no claim about sleep, health or the body. */
const BASE_BEDTIME_MINUTES = 22 * 60;    // 22:00
const MINUTES_PER_SCREEN_HOUR = 20;
const EVENING_START_MINUTES = 18 * 60;   // the slider counts screen time after 18:00
const DAY_MINUTES = 24 * 60;

// Minutes since midnight, wrapped into 0..1439 so that 24:00 reads as 00:00
// and never as 12:00 PM (noon).
function wrapMinutes(totalMinutes) {
  const m = Math.round(totalMinutes);
  return ((m % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function estimateBedtimeMinutes(hours) {
  return wrapMinutes(BASE_BEDTIME_MINUTES + hours * MINUTES_PER_SCREEN_HOUR);
}

// Clock times in the visitor's own short time format: 00:00 and 22:40 in
// Norway or the UK, 12:00 AM and 10:40 PM in the US. Built and formatted in
// UTC so no time zone or daylight-saving change can shift a time of day.
const clockFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: 'UTC' });
const hoursFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function formatTime(totalMinutes) {
  const m = wrapMinutes(totalMinutes);
  return clockFormat.format(new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60), m % 60)));
}

function formatHours(hours) {
  return `${hoursFormat.format(hours)} hrs`;
}

function describeRule() {
  return `Estimate from a fixed rule, not a measurement: ${formatTime(BASE_BEDTIME_MINUTES)} plus ` +
    `${MINUTES_PER_SCREEN_HOUR} minutes for each hour of screen time after ${formatTime(EVENING_START_MINUTES)}.`;
}

/* ================================================================
   ENCRYPTION AT REST
   Logs are stored in localStorage as ciphertext, encrypted with a
   device-bound AES-GCM key that lives in IndexedDB as a NON-EXTRACTABLE
   CryptoKey. The key material cannot be read back out by script, so a
   glance at localStorage (or a browser storage export) shows only
   ciphertext, never your history.

   Threat model, stated honestly: this is at-rest protection against
   casual inspection, a shared computer, or a storage dump. It is not a
   defence against malicious script running on this same origin, which
   could ask the key to decrypt. Convenience first: no passphrase is
   needed for everyday use. Portable, cross-device backups still use the
   password-based export further down this file.
================================================================ */
const STORE_KEY = 'nightmode_logs_v2';   // ciphertext blob (iv + AES-GCM)
const LEGACY_KEY = 'nightmode_logs';     // pre-encryption plaintext (migrated once)
const IDB_NAME = 'nightmode-secure';
const IDB_STORE = 'keys';

function openKeyDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbOp(mode, fn) {
  return openKeyDb().then(db => new Promise((resolve, reject) => {
    const store = db.transaction(IDB_STORE, mode).objectStore(IDB_STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function getDeviceKey() {
  let key = await idbOp('readonly', s => s.get('logKey'));
  if (!key) {
    // extractable = false: the raw bytes can never be read back out by script.
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await idbOp('readwrite', s => s.put(key, 'logKey'));
  }
  return key;
}

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function writeLogs(logs) {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(logs))));
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  localStorage.setItem(STORE_KEY, toB64(combined));
}

async function readLogs() {
  // One-time migration of any pre-encryption plaintext.
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy !== null && localStorage.getItem(STORE_KEY) === null) {
    // Only drop the plaintext once the encrypted copy is safely written, so a
    // failed write (IndexedDB blocked, quota) never loses the logs.
    try { await writeLogs(JSON.parse(legacy)); localStorage.removeItem(LEGACY_KEY); }
    catch (e) { /* leave legacy in place if it fails */ }
  }
  const blob = localStorage.getItem(STORE_KEY);
  if (!blob) return [];
  try {
    const raw = fromB64(blob);
    const iv = raw.slice(0, 12);
    const ct = raw.slice(12);
    const key = await getDeviceKey();
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const logs = JSON.parse(new TextDecoder().decode(pt));
    return Array.isArray(logs) ? logs : [];
  } catch (e) {
    return [];
  }
}

function updateAesthetic(hours) {
  const maxHours = 6;
  const percentage = Math.min(hours / maxHours, 1);
  const targetHue = 220 - (percentage * 200);
  root.style.setProperty('--bg-hue', targetHue);

  sliderVal.textContent = formatHours(hours);
  document.getElementById('bedtime-val').textContent = formatTime(estimateBedtimeMinutes(hours));
}

// Event Listeners
slider.addEventListener('input', (e) => {
  updateAesthetic(parseFloat(e.target.value));
});

// Load Logs
async function loadLogs() {
  const listEl = document.getElementById('log-list');
  listEl.innerHTML = '';

  const logs = await readLogs();

  if (logs.length === 0) {
    listEl.innerHTML = '<li class="log-item"><span class="log-date">No logs yet.</span></li>';
    return;
  }
  
  logs.slice(0, 10).forEach(log => {
    if (!log || typeof log.hours !== 'number' || !isFinite(log.hours)) return;
    // Entries saved before 2026-10 kept the time as text, and 6 hours was
    // stored as "12:00 PM". The rule has never changed, so recompute it.
    const bedtime = typeof log.bedtimeMinutes === 'number' ? log.bedtimeMinutes : estimateBedtimeMinutes(log.hours);

    const li = document.createElement('li');
    li.className = 'log-item';
    
    const dateSpan = document.createElement('span');
    dateSpan.className = 'log-date';
    dateSpan.textContent = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    
    const valSpan = document.createElement('span');
    valSpan.className = 'log-data';
    valSpan.textContent = `${formatHours(log.hours)} (${formatTime(bedtime)})`;
    
    li.appendChild(dateSpan);
    li.appendChild(valSpan);
    listEl.appendChild(li);
  });
}

btnLog.addEventListener('click', async () => {
  const val = parseFloat(slider.value);
  const logs = await readLogs();

  // Add new log at beginning. The estimate is stored as minutes since
  // midnight and formatted only when shown, in the visitor's own clock format.
  logs.unshift({
    timestamp: new Date().getTime(),
    hours: val,
    bedtimeMinutes: estimateBedtimeMinutes(val)
  });

  await writeLogs(logs);
  await loadLogs();

  const originalText = btnLog.textContent;
  btnLog.textContent = "Logged";
  btnLog.style.background = "#00ff64";
  
  setTimeout(() => {
    btnLog.textContent = originalText;
    btnLog.style.background = "var(--accent-primary)";
  }, 2000);
});

// Encryption Helpers
async function encryptData(text, password) {
  if (!password) return JSON.stringify({ encrypted: false, data: btoa(unescape(encodeURIComponent(text))) });
  
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0); 
  combined.set(iv, salt.length); 
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  const base64 = btoa(Array.from(combined).map(b => String.fromCharCode(b)).join(''));
  return JSON.stringify({ encrypted: true, data: base64 });
}

async function decryptData(payloadStr, password) {
  const payload = JSON.parse(payloadStr);
  if (!payload.encrypted) return decodeURIComponent(escape(atob(payload.data)));
  if (!password) throw new Error("Password required");
  
  const combined = new Uint8Array(atob(payload.data).split('').map(c => c.charCodeAt(0)));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);
  
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// Data Management: Export
btnExport.addEventListener('click', async () => {
  const data = JSON.stringify(await readLogs());
  const pwd = prompt("Enter a password to encrypt the backup, or leave empty for an unencrypted file:");
  if (pwd === null) return; // User cancelled
  
  try {
    const finalPayload = await encryptData(data, pwd);
    const blob = new Blob([finalPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `nightmode_logs_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Encryption failed: " + e.message);
  }
});

// Data Management: Import
btnImport.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const fileContent = event.target.result;
      const parsedContent = JSON.parse(fileContent);
      
      let pwd = null;
      if (parsedContent.encrypted) {
        pwd = prompt("This backup is encrypted. Please enter the password to decrypt:");
        if (pwd === null) {
          fileInput.value = "";
          return; // User cancelled
        }
      }
      
      const decryptedJsonStr = await decryptData(fileContent, pwd);
      const importedData = JSON.parse(decryptedJsonStr);
      
      if (Array.isArray(importedData)) {
        await writeLogs(importedData);
        await loadLogs();
        alert('Logs imported successfully!');
      } else {
        alert('Invalid log format. Must be a JSON array.');
      }
    } catch (err) {
      alert('Error reading file or incorrect password.');
    }
    fileInput.value = ""; // Reset input to allow re-importing same file
  };
  reader.readAsText(file);
});

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('evening-start').textContent = formatTime(EVENING_START_MINUTES);
  document.getElementById('bedtime-desc').textContent = describeRule();
  updateAesthetic(parseFloat(slider.value));
  await loadLogs();
});
