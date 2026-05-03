function nowTimeStr() {
  var now = new Date();
  return String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
}
function todayStr() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
}
function parseDate(str) {
  var parts = str.split('-').map(Number);
  return new Date(parts[0], parts[1]-1, parts[2]);
}
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  var parts = timeStr.split(':').map(Number);
  return parts[0]*60 + parts[1];
}
function minutesToTime(mins) {
  var h = Math.floor(mins/60), m = mins%60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}
function roundUpClockIn(timeStr) {
  var mins = timeToMinutes(timeStr);
  var r = mins % 30;
  if (r === 0) return timeStr;
  return minutesToTime(mins + (30-r));
}
function roundDownClockOut(timeStr) {
  return minutesToTime(Math.floor(timeToMinutes(timeStr)/30)*30);
}
function calcWorkMinutes(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  var diff = timeToMinutes(clockOut) - timeToMinutes(clockIn);
  return diff > 0 ? diff : 0;
}
function formatWorkTime(mins) {
  if (!mins || mins === 0) return '0時間';
  var h = Math.floor(mins/60), m = mins%60;
  return m === 0 ? h+'時間' : h+'時間'+m+'分';
}
function calcDailyWage(clockInCalc, clockOutCalc, wage, isSpecialDay) {
  var workMins = calcWorkMinutes(clockInCalc, clockOutCalc);
  var effectiveWage = isSpecialDay ? wage+50 : wage;
  return Math.floor((workMins/60)*effectiveWage);
}
function formatCurrency(amount) {
  return '¥' + Number(amount||0).toLocaleString();
}
function formatDateJP(dateStr) {
  if (!dateStr) return '';
  var d = parseDate(dateStr);
  var days = ['日','月','火','水','木','金','土'];
  return (d.getMonth()+1)+'月'+d.getDate()+'日('+days[d.getDay()]+')';
}
function formatDateLong(dateStr) {
  if (!dateStr) return '';
  var d = parseDate(dateStr);
  return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';
}
function staffTypeLabel(type) {
  var map = { hourly:'時給スタッフ', senzoku:'専従者', employee:'社員', officer:'役員' };
  return map[type] || type;
}
function showToast(message, type) {
  type = type || 'success';
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 400); }, 3000);
}
function openModal(id) {
  var el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) { el.style.display = 'none'; document.body.style.overflow = ''; }
}
function confirmAction(message) { return confirm(message); }
function currentYear() { return new Date().getFullYear(); }
function currentMonth() { return new Date().getMonth()+1; }
function calcTax(monthlyIncome, taxRows) {
  if (!taxRows || !taxRows.length) return 0;
  var sorted = taxRows.slice().sort(function(a,b) { return b.income_from - a.income_from; });
  for (var i = 0; i < sorted.length; i++) {
    if (monthlyIncome >= sorted[i].income_from) return sorted[i].tax_amount;
  }
  return 0;
}
