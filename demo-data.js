// ============================================================
// utils.js - 共通ユーティリティ関数
// ============================================================

// 現在時刻を "HH:MM" 形式で返す
function nowTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// 今日の日付を "YYYY-MM-DD" 形式で返す
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

// "YYYY-MM-DD" → Date オブジェクト
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "HH:MM" → 分数(整数)
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 分数 → "HH:MM"
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// 出勤時刻を30分切り上げ
// 例: 9:05 → 9:30、9:31 → 10:00、9:00 → 9:00
function roundUpClockIn(timeStr) {
  let mins = timeToMinutes(timeStr);
  const remainder = mins % 30;
  if (remainder === 0) return timeStr;
  mins = mins + (30 - remainder);
  return minutesToTime(mins);
}

// 退勤時刻を30分切り捨て
// 例: 18:25 → 18:00、18:55 → 18:30、18:30 → 18:30
function roundDownClockOut(timeStr) {
  let mins = timeToMinutes(timeStr);
  mins = Math.floor(mins / 30) * 30;
  return minutesToTime(mins);
}

// 労働時間を計算(分単位)
function calcWorkMinutes(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const inMins = timeToMinutes(clockIn);
  const outMins = timeToMinutes(clockOut);
  if (outMins <= inMins) return 0;
  return outMins - inMins;
}

// 分数 → "X時間Y分" 表示
function formatWorkTime(mins) {
  if (!mins || mins === 0) return '0時間';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

// 日給計算
function calcDailyWage(clockInCalc, clockOutCalc, wage, isSpecialDay) {
  const workMins = calcWorkMinutes(clockInCalc, clockOutCalc);
  const effectiveWage = isSpecialDay ? wage + 50 : wage;
  return Math.floor((workMins / 60) * effectiveWage);
}

// 金額を日本円形式にフォーマット
function formatCurrency(amount) {
  return `¥${Number(amount || 0).toLocaleString()}`;
}

// "YYYY-MM-DD" → "M月D日(曜)" 表示
function formatDateJP(dateStr) {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  const days = ['日','月','火','水','木','金','土'];
  return `${d.getMonth()+1}月${d.getDate()}日(${days[d.getDay()]})`;
}

// "YYYY-MM-DD" → "YYYY年M月D日"
function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

// スタッフ種別を日本語に
function staffTypeLabel(type) {
  const map = { hourly: '時給スタッフ', senzoku: '専従者', employee: '社員' };
  return map[type] || type;
}

// 簡易トースト通知
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

// モーダル表示・非表示
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'none'; document.body.style.overflow = ''; }
}

// 確認ダイアログ
function confirmAction(message) {
  return confirm(message);
}

// 現在年
function currentYear() { return new Date().getFullYear(); }
// 現在月
function currentMonth() { return new Date().getMonth() + 1; }

// 税額計算
function calcTax(monthlyIncome, taxRows) {
  if (!taxRows || taxRows.length === 0) return 0;
  const sorted = [...taxRows].sort((a, b) => b.income_from - a.income_from);
  for (const row of sorted) {
    if (monthlyIncome >= row.income_from) return row.tax_amount;
  }
  return 0;
}
