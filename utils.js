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

// 出勤：30分単位で切り上げ
function roundUpClockIn(timeStr) {
  var mins = timeToMinutes(timeStr), r = mins % 30;
  return r === 0 ? timeStr : minutesToTime(mins + (30 - r));
}

// 退勤：30分単位で切り捨て
function roundDownClockOut(timeStr) {
  return minutesToTime(Math.floor(timeToMinutes(timeStr) / 30) * 30);
}

// ============================================================
// 勤務時間計算（昼休憩対応）
// hasLunchBreak: true の場合 60分控除
// ============================================================
function calcWorkMinutes(clockInCalc, clockOutCalc, lunchBreak, lunchStart, lunchEnd) {
  if (!clockInCalc || !clockOutCalc) return 0;
  var inMins  = timeToMinutes(clockInCalc);
  var outMins = timeToMinutes(clockOutCalc);
  var diff = outMins - inMins;
  if (diff <= 0) return 0;
  // 昼休み控除（開始〜終了が設定されていればその時間、なければ0）
  if (lunchBreak && lunchStart && lunchEnd) {
    var lsM = timeToMinutes(lunchStart);
    var leM = timeToMinutes(lunchEnd);
    var overlapStart = Math.max(inMins, lsM);
    var overlapEnd   = Math.min(outMins, leM);
    var overlap = Math.max(0, overlapEnd - overlapStart);
    diff -= overlap;
  }
  return Math.max(0, diff);
}

function formatWorkTime(mins) {
  if (!mins || mins === 0) return '0時間';
  var h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? h + '時間' : h + '時間' + m + '分';
}

// 日給計算（勤務時間×時給）
function calcDailyWage(clockInCalc, clockOutCalc, wage, isSpecialDay, lunchBreak, lunchStart, lunchEnd) {
  var workMins = calcWorkMinutes(clockInCalc, clockOutCalc, lunchBreak, lunchStart, lunchEnd);
  var effectiveWage = isSpecialDay ? Math.ceil(wage * 1.25) : wage; // 日曜・祝日は25%割増（法定）
  return Math.floor((workMins / 60) * effectiveWage);
}

function formatCurrency(amount) { return '¥' + Number(amount || 0).toLocaleString(); }

function formatDateJP(dateStr) {
  if (!dateStr) return '';
  var d = parseDate(dateStr), days = ['日','月','火','水','木','金','土'];
  return (d.getMonth()+1) + '月' + d.getDate() + '日(' + days[d.getDay()] + ')';
}

function staffTypeLabel(type) {
  return {hourly:'時給スタッフ', senzoku:'専従者', employee:'社員', officer:'役員'}[type] || type;
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
// 所得税計算（令和8年分 甲欄・扶養人数対応）
// ============================================================
// taxRows 新形式(甲欄): { income_from, income_to, dep0〜dep7, calc_type, base_income, base_tax_dep0, rate }
// taxRows 旧形式(後方互換): { income_from, tax_amount }
function calcTax(monthlyIncome, taxRows, taxType, dependents) {
  if (!taxRows || !taxRows.length) return 0;
  taxType = taxType || 'kou';
  dependents = parseInt(dependents) || 0;

  // 新形式（甲欄・扶養人数別テーブル）
  if (taxType === 'kou' && taxRows[0] && taxRows[0].dep0 !== undefined) {
    var sorted = taxRows.slice().sort(function(a,b){ return a.income_from - b.income_from; });
    var row = null;
    for (var i = sorted.length - 1; i >= 0; i--) {
      var r = sorted[i];
      if (monthlyIncome >= r.income_from) {
        if (!r.income_to || monthlyIncome < r.income_to) { row = r; break; }
      }
    }
    if (!row) return 0;
    // 計算式型の行（740,000円超など）
    if (row.calc_type === 'formula') {
      var depTax7 = row.dep7 !== undefined ? row.dep7 : Math.max(0, (row.dep0||0) - 7*1610);
      var baseDep = Math.max(0, depTax7 - Math.max(0, dependents-7)*1610);
      if (dependents <= 7) {
        var depKey = 'dep'+Math.min(dependents,7);
        baseDep = row[depKey] !== undefined ? row[depKey] : Math.max(0,(row.dep0||0)-dependents*1610);
      }
      var over = Math.max(0, monthlyIncome - row.base_income);
      return Math.max(0, Math.round(baseDep + over * row.rate));
    }
    // 通常の表引き
    var dk = 'dep' + Math.min(dependents, 7);
    var tax = (row[dk] !== undefined) ? row[dk] : 0;
    if (dependents > 7) tax = Math.max(0, (row.dep7||0) - (dependents-7)*1610);
    return Math.max(0, tax);
  }

  // 乙欄 または 旧形式甲欄（後方互換）
  var sortedOld = taxRows.slice().sort(function(a,b){ return b.income_from - a.income_from; });
  var baseTax = 0;
  for (var j = 0; j < sortedOld.length; j++) {
    if (monthlyIncome >= sortedOld[j].income_from) { baseTax = sortedOld[j].tax_amount||0; break; }
  }
  if (taxType === 'otsu') return baseTax;
  return Math.max(0, baseTax - dependents * 1610);
}


// ============================================================
// 雇用保険料（令和8年度）
// ============================================================
var EMP_INS_RATE_EMPLOYEE = 0.005; // 令和8年度 一般の事業：5/1000
function calcEmploymentInsurance(grossPay, isEnrolled, category) {
  if (!isEnrolled) return 0;
  // 雇用保険料率キャッシュから事業区分別料率を取得
  var rate = EMP_INS_RATE_EMPLOYEE;
  if (window._empInsRatesCache && window._empInsRatesCache.length) {
    var cat = category || '一般の事業';
    var found = window._empInsRatesCache.find(function(r){ return r.category === cat; });
    if (found) rate = found.employee_numerator / (found.employee_denominator || 1000);
  }
  return Math.floor((grossPay || 0) * rate);
}

// ============================================================
// 通勤費 非課税限度額
// ============================================================
// 令和7年11月改正後（令和7年4月1日以後支払分より適用）国税庁 No.2585 準拠
var COMMUTE_TAX_FREE_TABLE = [
  {minKm:0,   maxKm:2,    monthlyLimit:0    }, // 全額課税
  {minKm:2,   maxKm:10,   monthlyLimit:4200 },
  {minKm:10,  maxKm:15,   monthlyLimit:7300 },
  {minKm:15,  maxKm:25,   monthlyLimit:13500},
  {minKm:25,  maxKm:35,   monthlyLimit:19700},
  {minKm:35,  maxKm:45,   monthlyLimit:25900},
  {minKm:45,  maxKm:55,   monthlyLimit:32300},
  {minKm:55,  maxKm:9999, monthlyLimit:38700},
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
  var daily = parseInt(dailyAmount) || 0, days = parseInt(workDays) || 0;
  var total = daily * days;
  var taxFreeLimit = getCommuteTaxFreeLimit(distanceKm);
  return { total:total, taxFree:Math.min(total, taxFreeLimit), taxable:Math.max(0, total - taxFreeLimit) };
}

// 役員用通勤費：距離の非課税限度額を固定支給（全額非課税）
// 役員の固定通勤費計算
function calcOfficerCommuteFixed(staff) {
  var fixedAmt = staff.commute_fixed || 0;
  var distAmt  = staff.commute_distance ? getCommuteTaxFreeLimit(staff.commute_distance) : 0;
  var amount   = fixedAmt > 0 ? fixedAmt : distAmt;
  if (amount <= 0) return { total:0, taxFree:0, taxable:0 };
  return { total: amount, taxFree: amount, taxable: 0 };
}

function calcOfficerCommuteAllowance(distanceKm) {
  var taxFreeLimit = getCommuteTaxFreeLimit(distanceKm);
  return { total:taxFreeLimit, taxFree:taxFreeLimit, taxable:0 };
}
