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
  return String(Math.floor(mins/60)).padStart(2,'0') + ':' + String(mins%60).padStart(2,'0');
}
function roundUpClockIn(timeStr) {
  var mins = timeToMinutes(timeStr), r = mins % 30;
  return r === 0 ? timeStr : minutesToTime(mins + (30-r));
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
  return Math.floor((workMins/60)*(isSpecialDay ? wage+50 : wage));
}
function formatCurrency(amount) { return '¥' + Number(amount||0).toLocaleString(); }
function formatDateJP(dateStr) {
  if (!dateStr) return '';
  var d = parseDate(dateStr), days = ['日','月','火','水','木','金','土'];
  return (d.getMonth()+1)+'月'+d.getDate()+'日('+days[d.getDay()]+')';
}
function staffTypeLabel(type) {
  return {hourly:'時給スタッフ',senzoku:'専従者',employee:'社員',officer:'役員'}[type] || type;
}
function showToast(message, type) {
  type = type || 'success';
  var existing = document.querySelector('.toast'); if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type; toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function(){ toast.classList.add('show'); }, 10);
  setTimeout(function(){ toast.classList.remove('show'); setTimeout(function(){ toast.remove(); }, 400); }, 3000);
}
function openModal(id) { var el=document.getElementById(id); if(el){el.style.display='flex';document.body.style.overflow='hidden';} }
function closeModal(id) { var el=document.getElementById(id); if(el){el.style.display='none';document.body.style.overflow='';} }
function confirmAction(msg) { return confirm(msg); }
function currentYear() { return new Date().getFullYear(); }
function currentMonth() { return new Date().getMonth()+1; }

// ============================================================
// 所得税計算（扶養人数対応）
// ============================================================
function calcTax(monthlyIncome, taxRows, taxType, dependents) {
  if (!taxRows || !taxRows.length) return 0;
  taxType = taxType || 'kou';
  dependents = parseInt(dependents) || 0;
  var sorted = taxRows.slice().sort(function(a,b){return b.income_from - a.income_from;});
  var baseTax = 0;
  for (var i=0; i<sorted.length; i++) {
    if (monthlyIncome >= sorted[i].income_from) { baseTax = sorted[i].tax_amount; break; }
  }
  if (taxType === 'otsu') return baseTax;
  // 甲欄：扶養親族1人につき1,610円控除
  return Math.max(0, baseTax - dependents * 1610);
}

// ============================================================
// 雇用保険料（令和8年度 一般の事業）
// ============================================================
var EMP_INS_RATE_EMPLOYEE = 0.006; // 被保険者負担 6/1000
function calcEmploymentInsurance(grossPay, isEnrolled) {
  if (!isEnrolled) return 0;
  return Math.floor(grossPay * EMP_INS_RATE_EMPLOYEE);
}

// ============================================================
// 通勤費 非課税限度額（マイカー等距離区分）
// ============================================================
var COMMUTE_TAX_FREE_TABLE = [
  {minKm:0,  maxKm:2,   monthlyLimit:0    },
  {minKm:2,  maxKm:10,  monthlyLimit:4200 },
  {minKm:10, maxKm:15,  monthlyLimit:7100 },
  {minKm:15, maxKm:25,  monthlyLimit:12900},
  {minKm:25, maxKm:35,  monthlyLimit:18700},
  {minKm:35, maxKm:45,  monthlyLimit:24400},
  {minKm:45, maxKm:55,  monthlyLimit:28000},
  {minKm:55, maxKm:9999,monthlyLimit:31600},
];
function getCommuteTaxFreeLimit(distanceKm) {
  var km = parseFloat(distanceKm) || 0;
  for (var i=0; i<COMMUTE_TAX_FREE_TABLE.length; i++) {
    var r = COMMUTE_TAX_FREE_TABLE[i];
    if (km >= r.minKm && km < r.maxKm) return r.monthlyLimit;
  }
  return 31600;
}
function calcCommuteAllowance(dailyAmount, workDays, distanceKm) {
  var daily = parseInt(dailyAmount)||0, days = parseInt(workDays)||0;
  var total = daily * days;
  var taxFreeLimit = getCommuteTaxFreeLimit(distanceKm);
  return { total:total, taxFree:Math.min(total,taxFreeLimit), taxable:Math.max(0,total-taxFreeLimit) };
}
