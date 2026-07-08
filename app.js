/* NightModeScheduler Logic
   Offline `localStorage` screen time tracker and dynamic blue-light calculator.
*/

const slider = document.getElementById('exposure-slider');
const sliderVal = document.getElementById('exposure-val');
const btnLog = document.getElementById('save-log-btn');
const root = document.documentElement;

// Data Management Elements
const btnExport = document.getElementById('export-btn');
const btnImport = document.getElementById('import-btn');
const fileInput = document.getElementById('import-file');

// Base optimal bedtime is 10:00 PM
const BASE_BEDTIME_MINUTES = 22 * 60; // 1320 minutes since midnight
let currentRecommendedBedtime = "";

function formatTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
}

function updateAesthetic(hours) {
  const maxHours = 6;
  const percentage = Math.min(hours / maxHours, 1);
  const targetHue = 220 - (percentage * 200);
  root.style.setProperty('--bg-hue', targetHue);
  
  const delayMinutes = hours * 20;
  const recommendedMinutes = BASE_BEDTIME_MINUTES + delayMinutes;
  
  currentRecommendedBedtime = formatTime(recommendedMinutes);
  document.getElementById('bedtime-val').textContent = currentRecommendedBedtime;
  
  const descEl = document.getElementById('bedtime-desc');
  if (hours === 0) {
    descEl.textContent = "Perfect! Your circadian rhythm is fully aligned.";
  } else if (hours <= 2) {
    descEl.textContent = "Moderate exposure. Consider using a blue-light filter.";
  } else if (hours <= 4) {
    descEl.textContent = "High exposure. Your melatonin production is significantly delayed.";
  } else {
    descEl.textContent = "Critical exposure. Severe disruption to your sleep cycle expected.";
  }
}

// Event Listeners
slider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  sliderVal.textContent = `${val.toFixed(1)} hrs`;
  updateAesthetic(val);
});

// Load Logs
function loadLogs() {
  const listEl = document.getElementById('log-list');
  listEl.innerHTML = '';
  
  const logs = JSON.parse(localStorage.getItem('nightmode_logs') || '[]');
  
  if (logs.length === 0) {
    listEl.innerHTML = '<li class="log-item"><span class="log-date">No logs yet.</span></li>';
    return;
  }
  
  logs.slice(0, 10).forEach(log => {
    const li = document.createElement('li');
    li.className = 'log-item';
    
    const dateSpan = document.createElement('span');
    dateSpan.className = 'log-date';
    dateSpan.textContent = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    
    const valSpan = document.createElement('span');
    valSpan.className = 'log-data';
    valSpan.textContent = `${log.hours.toFixed(1)} hrs (${log.recommendedBedtime || 'N/A'})`;
    
    li.appendChild(dateSpan);
    li.appendChild(valSpan);
    listEl.appendChild(li);
  });
}

btnLog.addEventListener('click', () => {
  const val = parseFloat(slider.value);
  const logs = JSON.parse(localStorage.getItem('nightmode_logs') || '[]');
  
  // Add new log at beginning
  logs.unshift({
    timestamp: new Date().getTime(),
    hours: val,
    recommendedBedtime: currentRecommendedBedtime
  });
  
  localStorage.setItem('nightmode_logs', JSON.stringify(logs));
  loadLogs();
  
  const originalText = btnLog.textContent;
  btnLog.textContent = "Logged Successfully!";
  btnLog.style.background = "#00ff64";
  
  setTimeout(() => {
    btnLog.textContent = originalText;
    btnLog.style.background = "var(--accent-primary)";
  }, 2000);
});

// Data Management: Export
btnExport.addEventListener('click', () => {
  const data = localStorage.getItem('nightmode_logs') || '[]';
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `nightmode_logs_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Data Management: Import
btnImport.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedData = JSON.parse(event.target.result);
      if (Array.isArray(importedData)) {
        localStorage.setItem('nightmode_logs', JSON.stringify(importedData));
        loadLogs();
        alert('Logs imported successfully!');
      } else {
        alert('Invalid log format. Must be a JSON array.');
      }
    } catch (err) {
      alert('Error reading file. Make sure it is a valid JSON file.');
    }
  };
  reader.readAsText(file);
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  updateAesthetic(parseFloat(slider.value));
  loadLogs();
});
