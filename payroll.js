// ============================================================
// payroll.js — 給与計算ロジック（画面から独立した純粋関数）
// 給与明細・月次集計・給与確定はすべてこの computePayslipData を使う
// ============================================================

// 社会保険・税金は自動計算するため、明細設定に同名項目があっても金額計算には使わない
var AUTO_CALC_ITEM_NAMES = ['所得税','健康保険料','介護保険料','厚生年金保険','子育て支援金','雇用保険料','雇用保険'];

function _ymIndex(d){ return d.getFullYear()*12 + d.getMonth(); }
function _pad2(n){ return String(n).padStart(2,'0'); }
function monthStartStr(year, month){ return year+'-'+_pad2(month)+'-01'; }
function monthEndStr(year, month){ return year+'-'+_pad2(month)+'-'+_pad2(new Date(year, month, 0).getDate()); }

// 介護保険第2号被保険者の保険料がかかる月か
// 40歳の誕生日の前日が属する月から、65歳の誕生日の前日が属する月の前月まで
function nursingAppliesForMonth(birthdate, year, month){
  if(!birthdate) return false;
  var p = String(birthdate).split('-').map(Number);
  if(p.length < 3 || !p[0]) return false;
  var d40 = new Date(p[0]+40, p[1]-1, p[2]); d40.setDate(d40.getDate()-1);
  var d65 = new Date(p[0]+65, p[1]-1, p[2]); d65.setDate(d65.getDate()-1);
  var cur = year*12 + (month-1);
  return _ymIndex(d40) <= cur && cur < _ymIndex(d65);
}

// 等級行を探す：ID一致 → 保存済み等級番号 → 既定ID形式（p13 / h19 / hn19 / cs5）から等級番号
var GRADE_ID_RE = /^(p|h|hn|cs)(\d+)$/;
function resolveGradeRow(table, gradeId, gradeNo){
  if(!table || !table.length) return null;
  if(gradeId){
    var byId = table.find(function(r){ return r.id === gradeId; });
    if(byId) return byId;
  }
  var no = parseInt(gradeNo);
  if(!no && gradeId){ var m = GRADE_ID_RE.exec(gradeId); if(m) no = parseInt(m[2]); }
  if(no) return table.find(function(r){ return Number(r.grade) === no; }) || null;
  return null;
}

// 健康保険の等級番号（介護あり・なし どちらの表のIDでも解決）
function resolveHealthGradeNo(staff, healthTable, healthNursingTable){
  var id = staff.health_grade_id;
  if(id){
    var r = (healthTable||[]).find(function(x){ return x.id === id; }) ||
            (healthNursingTable||[]).find(function(x){ return x.id === id; });
    if(r) return Number(r.grade);
  }
  if(staff.health_grade_no) return parseInt(staff.health_grade_no);
  if(id){ var m = GRADE_ID_RE.exec(id); if(m) return parseInt(m[2]); }
  return null;
}

// その月に在籍していたか（月の途中で退職した人も含める）
function isEmployedInMonth(s, year, month){
  var start = monthStartStr(year, month), end = monthEndStr(year, month);
  if(s.hire_date && s.hire_date > end) return false;
  if(s.is_active) return true;
  if(s.retire_date && s.retire_date >= start) return true;
  return false;
}

// 月次入力の勤務時間（分）。未入力は null
// 新形式: work_minutes（分）／旧形式: work_hours（小数=時間、整数は300以下なら時間・超えれば分）
function getMonthlyWorkMinutes(md){
  if(!md) return null;
  if(md.work_minutes !== null && md.work_minutes !== undefined && md.work_minutes !== '') return Math.round(Number(md.work_minutes)) || 0;
  var v = md.work_hours;
  if(v === null || v === undefined || v === '') return null;
  v = Number(v);
  if(isNaN(v)) return null;
  if(!Number.isInteger(v)) return Math.round(v*60);
  return v <= 300 ? v*60 : v;
}

// 有休残（asOf 時点）。付与日から2年で時効消滅、使用は古い付与分から消化
function _addYears(dateStr, n){
  var p = dateStr.split('-').map(Number);
  var d = new Date(p[0]+n, p[1]-1, p[2]);
  return d.getFullYear()+'-'+_pad2(d.getMonth()+1)+'-'+_pad2(d.getDate());
}
function calcLeaveBalance(leaves, asOf){
  var ev = (leaves||[]).filter(function(l){ return l.date && l.date <= asOf && (l.type==='grant' || l.type==='use'); })
    .slice().sort(function(a,b){
      if(a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.type === 'grant' ? -1 : 1; // 同日は付与を先に
    });
  var grants = [], granted = 0, used = 0, deficit = 0;
  ev.forEach(function(l){
    var days = parseFloat(l.days) || 0;
    if(l.type === 'grant'){
      granted += days;
      grants.push({ remaining: days, expires: _addYears(l.date, 2) });
    } else {
      used += days;
      var need = days;
      grants.forEach(function(g){
        if(need <= 0 || g.expires <= l.date || g.remaining <= 0) return;
        var take = Math.min(g.remaining, need); g.remaining -= take; need -= take;
      });
      deficit += need;
    }
  });
  var remaining = 0, expired = 0;
  grants.forEach(function(g){ if(g.expires <= asOf) expired += g.remaining; else remaining += g.remaining; });
  remaining -= deficit;
  var r = function(x){ return Math.round(x*100)/100; };
  return { granted: r(granted), used: r(used), expired: r(expired), remaining: r(remaining) };
}

// ------------------------------------------------------------
// 給与明細の全金額を計算
// p = { staff, records(当月・本人分), year, month, monthlyData, leaves(本人の全有休記録),
//       settings, tables:{pension,health,healthNursing,childSupport}, taxKou, taxOtsu }
// ------------------------------------------------------------
function computePayslipData(p){
  var staff = p.staff, year = p.year, month = p.month;
  var t = p.tables || {};
  var md = p.monthlyData || {};
  var settings = p.settings || {};
  var isHourly = staff.type === 'hourly';

  // ---- 社会保険 ----
  var pensionRow = resolveGradeRow(t.pension, staff.pension_grade_id, staff.pension_grade_no);
  var childRow   = resolveGradeRow(t.childSupport, staff.child_support_grade_id, staff.child_support_grade_no);
  var hGrade     = resolveHealthGradeNo(staff, t.health, t.healthNursing);
  var hRow  = hGrade ? (t.health||[]).find(function(r){ return Number(r.grade) === hGrade; }) : null;
  var hnRow = hGrade ? (t.healthNursing||[]).find(function(r){ return Number(r.grade) === hGrade; }) : null;
  var nursingOn = staff.birthdate ? nursingAppliesForMonth(staff.birthdate, year, month)
                                  : staff.health_table_type === 'health_nursing';
  var pension = pensionRow ? (pensionRow.employee||0) : 0;
  var childSupport = childRow ? (childRow.employee||0) : 0;
  var health = hRow ? (hRow.employee||0) : 0;
  var nursingCare = (nursingOn && hnRow) ? Math.max(0, (hnRow.employee||0) - health) : 0;

  // ---- 勤務日数・時間 ----
  var totalMins = 0, dayRows = [], workDates = {};
  (p.records||[]).slice().sort(function(a,b){ return a.date < b.date ? -1 : 1; }).forEach(function(r){
    var out = r.clock_out_actual || r.clock_out_calc;
    var lb = r.lunch_break !== undefined ? r.lunch_break : staff.lunch_break;
    var ls = r.lunch_start || staff.lunch_start, le = r.lunch_end || staff.lunch_end;
    var mins = out ? calcWorkMinutes(r.clock_in_calc, out, lb, ls, le) : 0;
    totalMins += mins;
    if(r.clock_in_actual) workDates[r.date] = true;
    dayRows.push({ record: r, mins: mins, daily: isHourly ? Math.floor(mins/60*(staff.wage||0)) : 0 });
  });
  var workDays = Object.keys(workDates).length;
  var grossPay = isHourly ? Math.floor(totalMins/60*(staff.wage||0)) : (staff.monthly_salary||0);

  // ---- 月次入力 ----
  if(md.work_days !== null && md.work_days !== undefined && md.work_days !== '') workDays = parseInt(md.work_days) || 0;
  var manualMins = isHourly ? getMonthlyWorkMinutes(md) : null;
  if(manualMins !== null){
    totalMins = manualMins;
    grossPay = Math.floor(totalMins/60*(staff.wage||0));
  }
  // 有休時間は勤務時間・基本給に加算しない（含み済み）

  // ---- 有休 ----
  var ym = year+'-'+_pad2(month);
  var leaves = p.leaves || [];
  var monthUsed = leaves.filter(function(l){ return l.type==='use' && l.date && l.date.indexOf(ym)===0; })
    .reduce(function(s,l){ return s + (parseFloat(l.days)||0); }, 0);
  var leaveInfo = calcLeaveBalance(leaves, monthEndStr(year, month));

  // ---- 通勤費 ----
  var psType = staff.payslip_type || staff.type || 'hourly';
  var isOfficer = (psType === 'officer' || staff.type === 'officer');
  var commute = isOfficer ? calcOfficerCommuteFixed(staff)
    : (staff.commute_daily_amount ? calcCommuteAllowance(staff.commute_daily_amount, workDays, staff.commute_distance||0)
                                  : {total:0, taxFree:0, taxable:0});

  // ---- 明細設定の追加項目 ----
  var typeKey = psType==='officer' ? 'pay_items_officer' : psType==='employee' ? 'pay_items_employee' : 'pay_items_hourly';
  var varItems = md.variable_items || [];
  // 時給スタッフで当月の勤務が無い場合、固定項目（食事手当など）はかけない（月次入力した項目のみ）
  var noWork = isHourly && workDays === 0 && totalMins === 0;
  var items = (settings[typeKey] || settings.pay_items || []).filter(function(i){
    return AUTO_CALC_ITEM_NAMES.indexOf(i.name) === -1;
  }).map(function(i){
    var mi = varItems.find(function(x){ return x.name === i.name; });
    if (mi) return Object.assign({}, i, { amount: mi.amount });
    return noWork ? null : Object.assign({}, i);
  }).filter(Boolean);
  var payItems = [], dedItems = [], attItems = [], otherItems = [];
  items.forEach(function(i){
    var c = i.category || 'pay';
    if(c === 'deduction') dedItems.push(i);
    else if(c === 'attendance') attItems.push(i);
    else if(c === 'other') otherItems.push(i);
    else payItems.push(i);
  });
  var extraTotalPay = 0, extraTaxable = 0, nontaxableExtra = 0;
  payItems.forEach(function(i){
    var a = i.amount || 0;
    if(i.calc_add === 'sub'){ extraTotalPay -= a; extraTaxable -= a; }
    else {
      extraTotalPay += a;
      if(i.tax_type === 'nontaxable') nontaxableExtra += a; else extraTaxable += a;
    }
  });
  var extraDeduction = dedItems.reduce(function(s,i){ return s + (i.amount||0); }, 0);
  var contributionBonus = staff.contribution_bonus ? 1000 : 0;

  // ---- 雇用保険・所得税 ----
  var empInsBase = grossPay + extraTotalPay + contributionBonus + commute.taxFree + commute.taxable;
  var empIns = calcEmploymentInsurance(empInsBase, staff.employment_insurance);
  var socialIns = pension + health + nursingCare + childSupport + empIns;
  var taxableIncome = grossPay + commute.taxable + extraTaxable + contributionBonus - socialIns;
  var taxRows = staff.tax_type === 'otsu' ? p.taxOtsu : p.taxKou;
  var tax = calcTax(Math.max(0, taxableIncome), taxRows, staff.tax_type || 'kou', staff.dependents || 0);

  var totalPay = grossPay + commute.taxFree + commute.taxable + extraTotalPay + contributionBonus;
  var totalDeduction = tax + socialIns + extraDeduction;

  return {
    staff: staff, year: year, month: month, psType: psType, isOfficer: isOfficer,
    workDays: workDays, totalMins: totalMins, manualMins: manualMins, dayRows: dayRows,
    grossPay: grossPay, commute: commute, contributionBonus: contributionBonus,
    payItems: payItems, dedItems: dedItems, attItems: attItems, otherItems: otherItems,
    extraTotalPay: extraTotalPay, extraDeduction: extraDeduction,
    pension: pension, health: health, nursingCare: nursingCare, childSupport: childSupport, empIns: empIns,
    socialIns: socialIns, tax: tax, taxableIncome: taxableIncome,
    taxablePay: grossPay + commute.taxable + extraTaxable + contributionBonus,
    nontaxablePay: commute.taxFree + nontaxableExtra,
    totalPay: totalPay, totalDeduction: totalDeduction, netPay: totalPay - totalDeduction,
    monthUsed: monthUsed, leaveBalance: leaveInfo.remaining, leaveInfo: leaveInfo,
    note: md.note || staff.payslip_note || ''
  };
}

if (typeof module !== 'undefined') {
  module.exports = { nursingAppliesForMonth: nursingAppliesForMonth, resolveGradeRow: resolveGradeRow,
    resolveHealthGradeNo: resolveHealthGradeNo, isEmployedInMonth: isEmployedInMonth,
    getMonthlyWorkMinutes: getMonthlyWorkMinutes, calcLeaveBalance: calcLeaveBalance,
    computePayslipData: computePayslipData, monthEndStr: monthEndStr };
}
