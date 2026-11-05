"use strict";
/*! NightModeScheduler: app.js is compiled from ts/app.ts by tools/build-ts.sh, which leaves out
    every comment but this one: the explanations are in the source. Edit the .ts, never the .js:
    the build refuses to overwrite a hand edit, and its check mode fails on one. */
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`NightModeScheduler: #${id} is missing`);
    return el;
}
function inputById(id) {
    const el = byId(id);
    if (!(el instanceof HTMLInputElement))
        throw new Error(`NightModeScheduler: #${id} is not an input`);
    return el;
}
function prop(value, key) {
    if (value === null || value === undefined) {
        throw new TypeError(`Cannot read properties of ${String(value)} (reading '${key}')`);
    }
    return value[key];
}
function isArray(value) {
    return Array.isArray(value);
}
const slider = inputById('exposure-slider');
const sliderVal = byId('exposure-val');
const btnLog = byId('save-log-btn');
const root = document.documentElement;
const btnExport = byId('export-btn');
const btnImport = byId('import-btn');
const fileInput = inputById('import-file');
const BASE_BEDTIME_MINUTES = 22 * 60;
const MINUTES_PER_SCREEN_HOUR = 20;
const EVENING_START_MINUTES = 18 * 60;
const DAY_MINUTES = 24 * 60;
function wrapMinutes(totalMinutes) {
    const m = Math.round(totalMinutes);
    return ((m % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}
function estimateBedtimeMinutes(hours) {
    return wrapMinutes(BASE_BEDTIME_MINUTES + hours * MINUTES_PER_SCREEN_HOUR);
}
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
const STORE_KEY = 'nightmode_logs_v2';
const LEGACY_KEY = 'nightmode_logs';
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
        key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        await idbOp('readwrite', s => s.put(key, 'logKey'));
    }
    return key;
}
function toB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++)
        s += String.fromCharCode(bytes[i] ?? 0);
    return btoa(s);
}
function fromB64(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
async function writeLogs(logs) {
    const key = await getDeviceKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(logs))));
    const combined = new Uint8Array(iv.length + ct.length);
    combined.set(iv, 0);
    combined.set(ct, iv.length);
    localStorage.setItem(STORE_KEY, toB64(combined));
}
async function readLogs() {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null && localStorage.getItem(STORE_KEY) === null) {
        try {
            await writeLogs(JSON.parse(legacy));
            localStorage.removeItem(LEGACY_KEY);
        }
        catch (e) { }
    }
    const blob = localStorage.getItem(STORE_KEY);
    if (!blob)
        return [];
    try {
        const raw = fromB64(blob);
        const iv = raw.slice(0, 12);
        const ct = raw.slice(12);
        const key = await getDeviceKey();
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        const logs = JSON.parse(new TextDecoder().decode(pt));
        return isArray(logs) ? logs : [];
    }
    catch (e) {
        return [];
    }
}
function updateAesthetic(hours) {
    const maxHours = 6;
    const percentage = Math.min(hours / maxHours, 1);
    const targetHue = 220 - (percentage * 200);
    root.style.setProperty('--bg-hue', String(targetHue));
    sliderVal.textContent = formatHours(hours);
    byId('bedtime-val').textContent = formatTime(estimateBedtimeMinutes(hours));
}
slider.addEventListener('input', () => {
    updateAesthetic(parseFloat(slider.value));
});
async function loadLogs() {
    const listEl = byId('log-list');
    listEl.innerHTML = '';
    const logs = await readLogs();
    if (logs.length === 0) {
        listEl.innerHTML = '<li class="log-item"><span class="log-date">No logs yet.</span></li>';
        return;
    }
    logs.slice(0, 10).forEach(log => {
        if (!log)
            return;
        const hours = prop(log, 'hours');
        if (typeof hours !== 'number' || !isFinite(hours))
            return;
        const saved = prop(log, 'bedtimeMinutes');
        const bedtime = typeof saved === 'number' ? saved : estimateBedtimeMinutes(hours);
        const li = document.createElement('li');
        li.className = 'log-item';
        const dateSpan = document.createElement('span');
        dateSpan.className = 'log-date';
        dateSpan.textContent = new Date(prop(log, 'timestamp')).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const valSpan = document.createElement('span');
        valSpan.className = 'log-data';
        valSpan.textContent = `${formatHours(hours)} (${formatTime(bedtime)})`;
        li.appendChild(dateSpan);
        li.appendChild(valSpan);
        listEl.appendChild(li);
    });
}
btnLog.addEventListener('click', async () => {
    const val = parseFloat(slider.value);
    const logs = await readLogs();
    const entry = {
        timestamp: new Date().getTime(),
        hours: val,
        bedtimeMinutes: estimateBedtimeMinutes(val)
    };
    logs.unshift(entry);
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
async function encryptData(text, password) {
    if (!password)
        return JSON.stringify({ encrypted: false, data: btoa(unescape(encodeURIComponent(text))) });
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
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
    if (!prop(payload, 'encrypted'))
        return decodeURIComponent(escape(atob(String(prop(payload, 'data')))));
    if (!password)
        throw new Error("Password required");
    const combined = new Uint8Array(atob(String(prop(payload, 'data'))).split('').map(c => c.charCodeAt(0)));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
}
btnExport.addEventListener('click', async () => {
    const data = JSON.stringify(await readLogs());
    const pwd = prompt("Enter a password to encrypt the backup, or leave empty for an unencrypted file:");
    if (pwd === null)
        return;
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
    }
    catch (e) {
        alert("Encryption failed: " + String(prop(e, 'message')));
    }
});
btnImport.addEventListener('click', () => {
    fileInput.click();
});
fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (!files)
        throw new TypeError("Cannot read properties of null (reading '0')");
    const file = files[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const fileContent = reader.result;
            if (typeof fileContent !== 'string')
                throw new TypeError('NightModeScheduler: the backup was not read as text');
            const parsedContent = JSON.parse(fileContent);
            let pwd = null;
            if (prop(parsedContent, 'encrypted')) {
                pwd = prompt("This backup is encrypted. Please enter the password to decrypt:");
                if (pwd === null) {
                    fileInput.value = "";
                    return;
                }
            }
            const decryptedJsonStr = await decryptData(fileContent, pwd);
            const importedData = JSON.parse(decryptedJsonStr);
            if (isArray(importedData)) {
                await writeLogs(importedData);
                await loadLogs();
                alert('Logs imported successfully!');
            }
            else {
                alert('Invalid log format. Must be a JSON array.');
            }
        }
        catch (err) {
            alert('Error reading file or incorrect password.');
        }
        fileInput.value = "";
    };
    reader.readAsText(file);
});
document.addEventListener('DOMContentLoaded', async () => {
    byId('evening-start').textContent = formatTime(EVENING_START_MINUTES);
    byId('bedtime-desc').textContent = describeRule();
    updateAesthetic(parseFloat(slider.value));
    await loadLogs();
});
