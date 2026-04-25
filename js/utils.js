function nowTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function roundUpClockIn(timeStr) {
  let mins = timeToMinutes(timeStr);
  const remainder = mins % 30;
  if (remainder === 0) return timeStr;
  mins = mins + (30 - remainder);
  return minutesToTime(mins);
}

function roundDownClockOut(timeStr) {
  let mins = timeToMinutes(timeStr);
  mins = Math.floor(mins / 30) * 30;
  return minutesToTime(mins);
}

function calcWorkMinutes(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const inMins = timeToMinutes(clockIn);
  const outMins = timeToMinutes(clockOut);
  if (outMins <= inMins) return 0;
  return outMins - inMins;
}

function formatWorkTime(mins) {
  if (!mins || mins === 0) return '0時間';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

function calcDailyWage(clockInCalc, clockOutCalc, wage, isSpecialDay) {
  const workMins = calcWorkMinutes(clockInCalc, clockOutCalc);
  const effectiveWage = isSpecialDay ? wage + 50 : wage;
  return Math.floor((workMins / 60) * effectiveWage);
}

function formatCurrency(amount) {
  return `¥${Number(amount || 0).toLocaleString()}`;
}

function formatDateJP(dateStr) {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  const days = ['日','月','火','水','木','金','土'];
  return `${d.getMonth()+1}月${d.getDate()}日(${days[d.getDay()]})`;
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

function staffTypeLabel(type) {
  const map = { hourly: '時給スタッフ', senzoku: '専従者', employee: '社員' };
  return map[type] || type;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'none'; document.body.style.overflow = ''; }
}

function confirmAction(message) {
  return confirm(message);
}

function currentYear() { return new Date().getFullYear(); }
function currentMonth() { return new Date().getMonth() + 1; }

function calcTax(monthlyIncome, taxRows) {
  if (!taxRows || taxRows.length === 0) return 0;
  const sorted = [...taxRows].sort((a, b) => b.income_from - a.income_from);
  for (const row of sorted) {
    if (monthlyIncome >= row.income_from) return row.tax_amount;
  }
  return 0;
}
