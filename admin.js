let pinInput = '';
function initPin() {
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('adminContent').style.display = 'none';
  updatePinDisplay();
}
function pinPress(val) {
  if (pinInput.length >= 4) return;
  pinInput += val; updatePinDisplay();
  if (pinInput.length === 4) setTimeout(checkPin, 200);
}
function pinDelete() { pinInput = pinInput.slice(0,-1); updatePinDisplay(); }
function updatePinDisplay() {
  document.querySelectorAll('.pin-dot').forEach((d,i) => d.classList.toggle('filled', i < pinInput.length));
}
function checkPin() {
  if (pinInput === ADMIN_PIN) {
    document.getElementById('pinScreen').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    initAdminTabs();
  } else {
    document.getElementById('pinError').style.display = 'block';
    pinInput = ''; updatePinDisplay();
    setTimeout(() => document.getElementById('pinError').style.display = 'none', 2000);
  }
}
function initAdminTabs() { switchTab('staff'); }
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  const loaders = { staff:loadStaffTab, attendance:loadAttendanceTab, special:loadSpecialTab,
    payroll:loadPayrollTab, tax:loadTaxTab, leave:loadLeaveTab };
  if (loaders[tab]) loaders[tab]();
}

let editingStaff = null;
let _pensionTable = [], _healthTable = [];

async function loadStaffTab() {
  [_pensionTable, _healthTable] = await Promise.all([
    DB.getInsuranceTable('pension'), DB.getInsuranceTable('health')
  ]);
  const staff = await DB.getStaff();
  const tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = '';
  if (!staff.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">スタッフが登録されていません</td></tr>'; return; }
  staff.forEach(s => {
    const tr = document.createElement('tr');
    if (!s.is_active) tr.classList.add('inactive-row');
    tr.innerHTML = `
      <td>${s.name}</td>
      <td><span class="badge badge-type">${staffTypeLabel(s.type)}</span></td>
      <td>${s.type==='hourly' ? formatCurrency(s.wage)+'/時' : formatCurrency(s.monthly_salary)+'/月'}</td>
      <td>${s.social_insurance ? '<span class="badge badge-insurance">加入</span>' : '<span class="badge badge-inactive">未加入</span>'}</td>
      <td><span class="badge ${s.is_active ? 'badge-active':'badge-inactive'}">${s.is_active?'在籍':'退職'}</span></td>
      <td>
        <button class="btn-sm btn-edit" onclick="openStaffModal('${s.id}')">✏️ 編集</button>
        <button class="btn-sm btn-toggle" onclick="toggleStaffActive('${s.id}',${!s.is_active})">${s.is_active?'退職処理':'在籍に戻す'}</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function toggleStaffActive(id, newState) {
  const staff = await DB.getStaff();
  const s = staff.find(x => x.id===id);
  if (!s || !confirmAction(`${s.name} さんを${newState?'在籍に戻します':'退職処理します'}。よろしいですか？`)) return;
  s.is_active = newState;
  await DB.saveStaff(s); showToast('更新しました'); loadStaffTab();
}

async function openStaffModal(id=null) {
  editingStaff = null;
  document.getElementById('staffModalTitle').textContent = id ? 'スタッフ編集' : 'スタッフ追加';
  document.getElementById('staffForm').reset();
  document.getElementById('staffWageSection').style.display = 'block';
  document.getElementById('staffSalarySection').style.display = 'none';
  document.getElementById('socialInsuranceFields').style.display = 'none';
  await buildGradeSelects();
  if (id) {
    const staff = await DB.getStaff();
    editingStaff = staff.find(s => s.id===id);
    if (editingStaff) {
      document.getElementById('staffName').value = editingStaff.name;
      document.getElementById('staffType').value = editingStaff.type;
      document.getElementById('staffWage').value = editingStaff.wage || '';
      document.getElementById('staffSalary').value = editingStaff.monthly_salary || '';
      document.getElementById('staffActive').checked = editingStaff.is_active;
      document.getElementById('staffSocialInsurance').checked = editingStaff.social_insurance || false;
      document.getElementById('staffTaxType').value = editingStaff.tax_type || 'kou';
      if (editingStaff.social_insurance) {
        document.getElementById('socialInsuranceFields').style.display = 'block';
        document.getElementById('staffPensionGrade').value = editingStaff.pension_grade_id || '';
        document.getElementById('staffHealthGrade').value = editingStaff.health_grade_id || '';
        document.getElementById('staffEmploymentInsurance').value = editingStaff.employment_insurance || '';
        updateInsurancePreview();
      }
      updateStaffTypeFields();
    }
  }
  openModal('staffModal');
}

async function buildGradeSelects() {
  if (!_pensionTable.length) _pensionTable = await DB.getInsuranceTable('pension');
  if (!_healthTable.length) _healthTable = await DB.getInsuranceTable('health');
  const pensionSel = document.getElementById('staffPensionGrade');
  const healthSel = document.getElementById('staffHealthGrade');
  pensionSel.innerHTML = '<option value="">選択してください</option>';
  healthSel.innerHTML = '<option value="">選択してください</option>';
  _pensionTable.sort((a,b)=>a.grade-b.grade).forEach(r => {
    pensionSel.innerHTML += `<option value="${r.id}">${r.label}（標準報酬 ${formatCurrency(r.standard)}・本人負担 ${formatCurrency(r.employee)}）</option>`;
  });
  _healthTable.sort((a,b)=>a.grade-b.grade).forEach(r => {
    healthSel.innerHTML += `<option value="${r.id}">${r.label}（標準報酬 ${formatCurrency(r.standard)}・本人負担 ${formatCurrency(r.employee)}）</option>`;
  });
}

function updateStaffTypeFields() {
  const type = document.getElementById('staffType').value;
  document.getElementById('staffWageSection').style.display = type==='hourly' ? 'block':'none';
  document.getElementById('staffSalarySection').style.display = type!=='hourly' ? 'block':'none';
}

function toggleSocialInsurance() {
  const checked = document.getElementById('staffSocialInsurance').checked;
  document.getElementById('socialInsuranceFields').style.display = checked ? 'block':'none';
  if (checked) updateInsurancePreview();
}

function updateInsurancePreview() {
  const pensionId = document.getElementById('staffPensionGrade').value;
  const healthId = document.getElementById('staffHealthGrade').value;
  const pensionAmt = getInsuranceAmountByGrade(pensionId, _pensionTable);
  const healthAmt = getInsuranceAmountByGrade(healthId, _healthTable);
  const emp = parseInt(document.getElementById('staffEmploymentInsurance').value)||0;
  document.getElementById('insurancePreviewPension').textContent = formatCurrency(pensionAmt);
  document.getElementById('insurancePreviewHealth').textContent = formatCurrency(healthAmt);
  document.getElementById('insurancePreviewTotal').textContent = formatCurrency(pensionAmt+healthAmt+emp);
}

function autoSelectGradeByMonthly() {
  const monthly = parseInt(document.getElementById('staffSalary').value||document.getElementById('staffWage').value*160)||0;
  if (!monthly) return;
  const pension = findInsuranceGradeByMonthly(monthly, _pensionTable);
  const health = findInsuranceGradeByMonthly(monthly, _healthTable);
  if (pension) document.getElementById('staffPensionGrade').value = pension.id;
  if (health) document.getElementById('staffHealthGrade').value = health.id;
  updateInsurancePreview();
  showToast('報酬月額から等級を自動選択しました');
}

async function saveStaff() {
  const name = document.getElementById('staffName').value.trim();
  const type = document.getElementById('staffType').value;
  const wage = parseInt(document.getElementById('staffWage').value)||0;
  const salary = parseInt(document.getElementById('staffSalary').value)||0;
  const isActive = document.getElementById('staffActive').checked;
  const socialInsurance = document.getElementById('staffSocialInsurance').checked;
  const taxType = document.getElementById('staffTaxType').value;
  const pensionGradeId = document.getElementById('staffPensionGrade').value;
  const healthGradeId = document.getElementById('staffHealthGrade').value;
  const employmentInsurance = parseInt(document.getElementById('staffEmploymentInsurance').value)||0;
  if (!name) { showToast('スタッフ名を入力してください','error'); return; }
  const record = editingStaff ? {...editingStaff} : {};
  record.name=name; record.type=type; record.wage=wage; record.monthly_salary=salary;
  record.is_active=isActive; record.social_insurance=socialInsurance; record.tax_type=taxType;
  record.pension_grade_id=pensionGradeId; record.health_grade_id=healthGradeId;
  record.employment_insurance=employmentInsurance;
  record.pension = getInsuranceAmountByGrade(pensionGradeId, _pensionTable);
  record.health_insurance = getInsuranceAmountByGrade(healthGradeId, _healthTable);
  await DB.saveStaff(record);
  closeModal('staffModal'); showToast('スタッフ情報を保存しました'); loadStaffTab();
}

let attendanceFilters = { year:currentYear(), month:currentMonth(), staff_id:'' };

async function loadAttendanceTab() {
  document.getElementById('filterYear').value = attendanceFilters.year;
  document.getElementById('filterMonth').value = attendanceFilters.month;
  const staff = await DB.getStaff();
  const sel = document.getElementById('filterStaff');
  sel.innerHTML = '<option value="">全スタッフ</option>';
  staff.forEach(s => {
    const opt = document.createElement('option');
    opt.value=s.id; opt.textContent=s.name;
    if (s.id===attendanceFilters.staff_id) opt.selected=true;
    sel.appendChild(opt);
  });
  loadAttendanceRecords();
}

async function loadAttendanceRecords() {
  attendanceFilters.year = parseInt(document.getElementById('filterYear').value);
  attendanceFilters.month = parseInt(document.getElementById('filterMonth').value);
  attendanceFilters.staff_id = document.getElementById('filterStaff').value;
  const records = await DB.getAttendance(attendanceFilters);
  const staff = await DB.getStaff();
  const staffMap = Object.fromEntries(staff.map(s=>[s.id,s]));
  const tbody = document.getElementById('attendanceTableBody');
  tbody.innerHTML = '';
  let totalWage=0, totalMins=0;
  const staffSummary = {};
  records.forEach(r => {
    const s = staffMap[r.staff_id]||{};
    const workMins = calcWorkMinutes(r.clock_in_calc, r.clock_out_calc);
    const dailyWage = r.clock_out_calc ? calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||0,r.is_special_day) : 0;
    totalWage+=dailyWage; totalMins+=workMins;
    if (!staffSummary[r.staff_id]) staffSummary[r.staff_id]={name:s.name||'不明',mins:0,wage:0};
    staffSummary[r.staff_id].mins+=workMins; staffSummary[r.staff_id].wage+=dailyWage;
    const isMissingOut = r.clock_in_actual && !r.clock_out_actual;
    const tr = document.createElement('tr');
    if (isMissingOut) tr.classList.add('missing-clockout');
    if (r.is_special_day) tr.classList.add('special-day-row');
    tr.innerHTML = `
      <td>${formatDateJP(r.date)}</td><td>${s.name||'不明'}</td>
      <td>${r.clock_in_actual||'-'}</td>
      <td>${r.clock_out_actual||(isMissingOut?'<span class="alert-text">⚠️ 退勤忘れ</span>':'-')}</td>
      <td>${r.clock_in_calc||'-'}</td><td>${r.clock_out_calc||'-'}</td>
      <td>${workMins?formatWorkTime(workMins):'-'}</td>
      <td>${r.clock_out_calc?formatCurrency(dailyWage):'-'}</td>
      <td>${r.is_special_day?'<span class="badge badge-special">⭐ 特別</span>':'-'}</td>
      <td>
        <button class="btn-sm btn-edit" onclick="openAttendanceEditModal('${r.id}')">✏️ 修正</button>
        <button class="btn-sm btn-delete" onclick="deleteAttendance('${r.id}')">🗑️ 削除</button>
      </td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('attendanceTotalTime').textContent = formatWorkTime(totalMins);
  document.getElementById('attendanceTotalWage').textContent = formatCurrency(totalWage);
  const summaryBody = document.getElementById('staffSummaryBody');
  summaryBody.innerHTML = '';
  if (!Object.keys(staffSummary).length) {
    summaryBody.innerHTML = '<tr><td colspan="3" class="empty-cell">データがありません</td></tr>';
  } else {
    Object.values(staffSummary).forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${formatWorkTime(s.mins)}</td><td>${formatCurrency(s.wage)}</td>`;
      summaryBody.appendChild(tr);
    });
  }
}

async function openAttendanceAddModal() {
  document.getElementById('attendanceModalTitle').textContent = '打刻の手動追加';
  document.getElementById('attendanceId').value = '';
  const staff = await DB.getStaff();
  const sel = document.getElementById('attendanceStaff');
  sel.innerHTML = '';
  staff.filter(s=>s.is_active).forEach(s => {
    const opt=document.createElement('option'); opt.value=s.id; opt.textContent=s.name; sel.appendChild(opt);
  });
  document.getElementById('attendanceDate').value = todayStr();
  document.getElementById('attendanceClockIn').value = '';
  document.getElementById('attendanceClockOut').value = '';
  document.getElementById('attendanceWage').value = '';
  document.getElementById('attendanceSpecial').checked = false;
  document.getElementById('attendanceNotes').value = '';
  openModal('attendanceModal');
}

async function openAttendanceEditModal(id) {
  const records = await DB.getAttendance({});
  const r = records.find(x=>x.id===id);
  if (!r) return;
  document.getElementById('attendanceModalTitle').textContent = '打刻の修正';
  document.getElementById('attendanceId').value = r.id;
  const staff = await DB.getStaff();
  const sel = document.getElementById('attendanceStaff');
  sel.innerHTML = '';
  staff.forEach(s => {
    const opt=document.createElement('option'); opt.value=s.id; opt.textContent=s.name;
    if (s.id===r.staff_id) opt.selected=true; sel.appendChild(opt);
  });
  document.getElementById('attendanceDate').value = r.date;
  document.getElementById('attendanceClockIn').value = r.clock_in_actual||'';
  document.getElementById('attendanceClockOut').value = r.clock_out_actual||'';
  document.getElementById('attendanceWage').value = r.wage_at_date||'';
  document.getElementById('attendanceSpecial').checked = r.is_special_day||false;
  document.getElementById('attendanceNotes').value = r.notes||'';
  openModal('attendanceModal');
}

async function saveAttendance() {
  const id = document.getElementById('attendanceId').value;
  const staff_id = document.getElementById('attendanceStaff').value;
  const date = document.getElementById('attendanceDate').value;
  const clockIn = document.getElementById('attendanceClockIn').value;
  const clockOut = document.getElementById('attendanceClockOut').value;
  const wage = parseInt(document.getElementById('attendanceWage').value)||0;
  const isSpecial = document.getElementById('attendanceSpecial').checked;
  const notes = document.getElementById('attendanceNotes').value;
  if (!date||!staff_id) { showToast('日付とスタッフを入力してください','error'); return; }
  if (!clockIn) { showToast('出勤時刻を入力してください','error'); return; }
  const record = { staff_id, date, clock_in_actual:clockIn, clock_out_actual:clockOut||null,
    clock_in_calc:roundUpClockIn(clockIn), clock_out_calc:clockOut?roundDownClockOut(clockOut):null,
    wage_at_date:wage, is_special_day:isSpecial, notes };
  if (id) record.id = id;
  await DB.saveAttendance(record);
  closeModal('attendanceModal'); showToast('保存しました'); loadAttendanceRecords();
}

async function deleteAttendance(id) {
  if (!confirmAction('この打刻記録を削除しますか？')) return;
  await DB.deleteAttendance(id); showToast('削除しました'); loadAttendanceRecords();
}

function openCsvModal() {
  document.getElementById('csvPreviewArea').style.display = 'none';
  document.getElementById('csvFile').value = '';
  document.getElementById('csvPreviewBody').innerHTML = '';
  openModal('csvModal');
}

let csvParsedData = [];

async function previewCsv() {
  const file = document.getElementById('csvFile').files[0];
  if (!file) { showToast('CSVファイルを選択してください','error'); return; }
  const text = await file.text();
  const lines = text.split('\n').filter(l=>l.trim());
  const staff = await DB.getStaff();
  csvParsedData = [];
  const tbody = document.getElementById('csvPreviewBody');
  tbody.innerHTML = '';
  const dataLines = (lines[0].includes('スタッフ')||lines[0].includes('date')||lines[0].includes('日付')) ? lines.slice(1) : lines;
  for (const line of dataLines) {
    const cols = line.split(',').map(c=>c.trim().replace(/"/g,''));
    if (cols.length < 3) continue;
    const [staffName,date,clockIn,clockOut] = cols;
    const matchedStaff = staff.find(s=>s.name===staffName);
    const isValid = matchedStaff && date && clockIn;
    const tr = document.createElement('tr');
    tr.style.color = isValid ? '' : '#dc2626';
    tr.innerHTML = `<td>${staffName} ${matchedStaff?'✅':'❌未登録'}</td><td>${date}</td><td>${clockIn}</td><td>${clockOut||'-'}</td>`;
    tbody.appendChild(tr);
    if (isValid) csvParsedData.push({
      staff_id:matchedStaff.id, date, clock_in_actual:clockIn, clock_out_actual:clockOut||null,
      clock_in_calc:roundUpClockIn(clockIn), clock_out_calc:clockOut?roundDownClockOut(clockOut):null,
      wage_at_date:matchedStaff.wage||0, is_special_day:false, notes:'CSVインポート'
    });
  }
  document.getElementById('csvPreviewArea').style.display = 'block';
  document.getElementById('csvImportCount').textContent = `${csvParsedData.length}件インポート可能`;
}

async function importCsv() {
  if (!csvParsedData.length) { showToast('インポートできるデータがありません','error'); return; }
  if (!confirmAction(`${csvParsedData.length}件インポートしますか？`)) return;
  for (const r of csvParsedData) await DB.saveAttendance(r);
  closeModal('csvModal'); showToast(`${csvParsedData.length}件インポートしました`); loadAttendanceRecords();
}

function downloadCsvTemplate() {
  const content = `スタッフ名,日付,出勤時刻,退勤時刻\n田中 花子,2026-05-01,09:00,18:00\n鈴木 次郎,2026-05-01,10:00,17:00`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));
  a.download = 'timecard_template.csv'; a.click();
}

async function loadSpecialTab() {
  const days = await DB.getSpecialDays();
  const tbody = document.getElementById('specialTableBody');
  tbody.innerHTML = '';
  if (!days.length) { tbody.innerHTML='<tr><td colspan="3" class="empty-cell">手動追加の特別日はありません</td></tr>'; }
  else days.sort((a,b)=>a.date>b.date?-1:1).forEach(d => {
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${formatDateJP(d.date)}</td><td>${d.reason||'-'}</td><td><button class="btn-sm btn-delete" onclick="deleteSpecialDay('${d.id}')">🗑️ 削除</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('autoRulesList').innerHTML=`
    <li>🗓️ 金曜日・土曜日・日曜日</li>
    <li>🎌 日本の祝日（内閣府データより自動取得）</li>
    <li>📅 祝日の前日（祝前日）</li>`;
}

async function addSpecialDay() {
  const date=document.getElementById('newSpecialDate').value;
  const reason=document.getElementById('newSpecialReason').value.trim();
  if (!date) { showToast('日付を入力してください','error'); return; }
  const existing=await DB.getSpecialDays();
  if (existing.some(d=>d.date===date)) { showToast('この日付はすでに登録済みです','error'); return; }
  await DB.saveSpecialDay({date,reason});
  document.getElementById('newSpecialDate').value='';
  document.getElementById('newSpecialReason').value='';
  showToast('特別日を追加しました'); loadSpecialTab();
}

async function deleteSpecialDay(id) {
  if (!confirmAction('この特別日設定を削除しますか？')) return;
  await DB.deleteSpecialDay(id); showToast('削除しました'); loadSpecialTab();
}

async function loadPayrollTab() {
  document.getElementById('payrollYear').value = currentYear();
  document.getElementById('payrollMonth').value = currentMonth();
  await loadPayrollSummary();
}

async function loadPayrollSummary() {
  const year=parseInt(document.getElementById('payrollYear').value);
  const month=parseInt(document.getElementById('payrollMonth').value);
  const [allStaff,records,taxKou,pensionTable,healthTable] = await Promise.all([
    DB.getStaff(), DB.getAttendance({year,month}), DB.getTaxTable('kou'),
    DB.getInsuranceTable('pension'), DB.getInsuranceTable('health')
  ]);
  const tbody=document.getElementById('payrollTableBody');
  tbody.innerHTML=''; let grandTotal=0;
  allStaff.filter(s=>s.is_active).forEach(staff => {
    const staffRecords=records.filter(r=>r.staff_id===staff.id);
    let grossPay=0,totalMins=0,specialCount=0;
    if (staff.type==='hourly') {
      staffRecords.forEach(r => {
        const mins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc);
        totalMins+=mins; if(r.is_special_day) specialCount++;
        grossPay+=calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||staff.wage,r.is_special_day);
      });
    } else { grossPay=staff.monthly_salary||0; }
    const tax=calcTax(grossPay,taxKou);
    const pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
    const health=getInsuranceAmountByGrade(staff.health_grade_id,healthTable);
    const emp=staff.employment_insurance||0;
    const socialDeduction=pension+health+emp;
    const netPay=grossPay-tax-socialDeduction;
    grandTotal+=grossPay;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${staff.name}</td>
      <td><span class="badge badge-type">${staffTypeLabel(staff.type)}</span></td>
      <td>${staff.type==='hourly'?formatWorkTime(totalMins):'月額固定'}</td>
      <td>${staff.type==='hourly'?`${specialCount}日`:'-'}</td>
      <td>${formatCurrency(grossPay)}</td>
      <td>${formatCurrency(tax)}</td>
      <td title="年金:${formatCurrency(pension)} 健保:${formatCurrency(health)} 雇用:${formatCurrency(emp)}">${formatCurrency(socialDeduction)}</td>
      <td><strong>${formatCurrency(netPay)}</strong></td>
      <td><button class="btn-sm btn-edit" onclick="showPayslip('${staff.id}',${year},${month})">📄 明細</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('payrollGrandTotal').textContent=`支給合計: ${formatCurrency(grandTotal)}`;
}

async function showPayslip(staffId, year, month) {
  const [allStaff,records,taxKou,pensionTable,healthTable] = await Promise.all([
    DB.getStaff(), DB.getAttendance({year,month,staff_id:staffId}), DB.getTaxTable('kou'),
    DB.getInsuranceTable('pension'), DB.getInsuranceTable('health')
  ]);
  const staff=allStaff.find(s=>s.id===staffId);
  if (!staff) return;
  let grossPay=0,totalMins=0,detailRows='';
  if (staff.type==='hourly') {
    records.forEach(r => {
      const mins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc);
      totalMins+=mins;
      const daily=calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||staff.wage,r.is_special_day);
      grossPay+=daily;
      detailRows+=`<tr><td>${formatDateJP(r.date)}</td><td>${r.clock_in_actual||'-'}</td><td>${r.clock_out_actual||'-'}</td>
        <td>${r.clock_in_calc||'-'}</td><td>${r.clock_out_calc||'-'}</td>
        <td>${formatWorkTime(mins)}</td><td>${r.is_special_day?'⭐':''} ${formatCurrency(r.wage_at_date||staff.wage)}</td>
        <td>${formatCurrency(daily)}</td></tr>`;
    });
  } else {
    grossPay=staff.monthly_salary||0;
    detailRows=`<tr><td colspan="8" style="text-align:center;">月額固定給: ${formatCurrency(grossPay)}</td></tr>`;
  }
  const tax=calcTax(grossPay,taxKou);
  const pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
  const health=getInsuranceAmountByGrade(staff.health_grade_id,healthTable);
  const emp=staff.employment_insurance||0;
  const socialDeduction=pension+health+emp;
  const netPay=grossPay-tax-socialDeduction;
  const pensionRow=pensionTable.find(r=>r.id===staff.pension_grade_id);
  const healthRow=healthTable.find(r=>r.id===staff.health_grade_id);
  document.getElementById('payslipContent').innerHTML=`
    <div class="payslip">
      <div class="payslip-header"><h2>給与明細書</h2><p>${year}年${month}月分</p></div>
      <div class="payslip-info">
        <div><strong>氏名:</strong> ${staff.name}</div>
        <div><strong>種別:</strong> ${staffTypeLabel(staff.type)}</div>
        ${staff.type==='hourly'?`<div><strong>基本時給:</strong> ${formatCurrency(staff.wage)}</div><div><strong>労働時間:</strong> ${formatWorkTime(totalMins)}</div>`:''}
        ${staff.social_insurance&&pensionRow?`<div><strong>厚生年金等級:</strong> ${pensionRow.label}（標準報酬 ${formatCurrency(pensionRow.standard)}）</div>`:''}
        ${staff.social_insurance&&healthRow?`<div><strong>健康保険等級:</strong> ${healthRow.label}（標準報酬 ${formatCurrency(healthRow.standard)}）</div>`:''}
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>日付</th><th>出勤(実)</th><th>退勤(実)</th><th>出勤(計)</th><th>退勤(計)</th><th>労働時間</th><th>時給</th><th>日給</th></tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
      <div class="payslip-summary">
        <div class="summary-row"><span>支給額（税引前）</span><strong>${formatCurrency(grossPay)}</strong></div>
        <div class="summary-row deduction"><span>源泉徴収税</span><span>- ${formatCurrency(tax)}</span></div>
        ${pension>0?`<div class="summary-row deduction"><span>厚生年金保険料</span><span>- ${formatCurrency(pension)}</span></div>`:''}
        ${health>0?`<div class="summary-row deduction"><span>健康保険料</span><span>- ${formatCurrency(health)}</span></div>`:''}
        ${emp>0?`<div class="summary-row deduction"><span>雇用保険料</span><span>- ${formatCurrency(emp)}</span></div>`:''}
        <div class="summary-row total"><span>差引支給額</span><strong class="net-pay">${formatCurrency(netPay)}</strong></div>
      </div>
    </div>`;
  openModal('payslipModal');
}

function printPayslip() { window.print(); }

let currentTaxType = 'kou';
let currentInsuranceType = 'pension';

async function loadTaxTab() {
  loadTaxTable('kou');
  loadInsuranceTable('pension');
}

async function loadTaxTable(type) {
  currentTaxType = type;
  document.querySelectorAll('.tax-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
  const rows = await DB.getTaxTable(type);
  const tbody = document.getElementById('taxTableBody');
  tbody.innerHTML='';
  rows.sort((a,b)=>a.income_from-b.income_from).forEach(r => {
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${formatCurrency(r.income_from)} ～</td><td>${formatCurrency(r.tax_amount)}</td>
      <td>
        <button class="btn-sm btn-edit" onclick="openTaxEditModal('${r.id}')">✏️</button>
        <button class="btn-sm btn-delete" onclick="deleteTaxRow('${r.id}')">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function loadInsuranceTable(type) {
  currentInsuranceType = type;
  document.querySelectorAll('.insurance-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
  const rows = await DB.getInsuranceTable(type);
  const tbody = document.getElementById('insuranceTableBody');
  tbody.innerHTML='';
  rows.sort((a,b)=>a.grade-b.grade).forEach(r => {
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${r.label}</td>
      <td>${formatCurrency(r.standard)}</td>
      <td>${formatCurrency(r.monthly_min)} 〜 ${r.monthly_max>=999999?'上限なし':formatCurrency(r.monthly_max)}</td>
      <td>${formatCurrency(r.employee)}</td>
      <td>${formatCurrency(r.employer)}</td>`;
    tbody.appendChild(tr);
  });
}

function openTaxCsvModal() {
  document.getElementById('taxCsvType').value = currentTaxType;
  document.getElementById('taxCsvFile').value = '';
  document.getElementById('taxCsvPreview').style.display='none';
  document.getElementById('taxCsvPreviewBody').innerHTML='';
  openModal('taxCsvModal');
}

let taxCsvParsed=[];

async function previewTaxCsv() {
  const file=document.getElementById('taxCsvFile').files[0];
  if (!file) { showToast('ファイルを選択してください','error'); return; }
  const text=await file.text();
  const lines=text.split('\n').filter(l=>l.trim());
  taxCsvParsed=[];
  const tbody=document.getElementById('taxCsvPreviewBody');
  tbody.innerHTML='';
  const dataLines=(lines[0].includes('月収')||lines[0].includes('income')||isNaN(lines[0].split(',')[0]))?lines.slice(1):lines;
  for (const line of dataLines) {
    const cols=line.split(',').map(c=>c.trim().replace(/[",¥]/g,''));
    if (cols.length<2) continue;
    const income_from=parseInt(cols[0]);
    const tax_amount=parseInt(cols[1]);
    if (isNaN(income_from)||isNaN(tax_amount)) continue;
    taxCsvParsed.push({income_from,tax_amount});
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${formatCurrency(income_from)} ～</td><td>${formatCurrency(tax_amount)}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('taxCsvPreview').style.display='block';
  document.getElementById('taxCsvCount').textContent=`${taxCsvParsed.length}行読み込み済み`;
}

async function importTaxCsv() {
  if (!taxCsvParsed.length) { showToast('データがありません','error'); return; }
  const type=document.getElementById('taxCsvType').value;
  if (!confirmAction(`${taxCsvParsed.length}行で税額表（${type==='kou'?'甲欄':'乙欄'}）を上書きしますか？`)) return;
  await DB.replaceTaxTable(type, taxCsvParsed.map(r=>({...r,id:_uid()})));
  closeModal('taxCsvModal'); showToast('税額表を更新しました'); loadTaxTable(type);
}

function downloadTaxCsvTemplate() {
  const content=`月収以上,税額\n88000,130\n89000,220\n90000,310`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));
  a.download='tax_template.csv'; a.click();
}

function openInsuranceCsvModal() {
  document.getElementById('insuranceCsvType').value = currentInsuranceType;
  document.getElementById('insuranceCsvFile').value='';
  document.getElementById('insuranceCsvPreview').style.display='none';
  document.getElementById('insuranceCsvPreviewBody').innerHTML='';
  openModal('insuranceCsvModal');
}

let insuranceCsvParsed=[];

async function previewInsuranceCsv() {
  const file=document.getElementById('insuranceCsvFile').files[0];
  if (!file) { showToast('ファイルを選択してください','error'); return; }
  const text=await file.text();
  const lines=text.split('\n').filter(l=>l.trim());
  insuranceCsvParsed=[];
  const tbody=document.getElementById('insuranceCsvPreviewBody');
  tbody.innerHTML='';
  const dataLines=(isNaN(lines[0].split(',')[0]))?lines.slice(1):lines;
  let grade=1;
  for (const line of dataLines) {
    const cols=line.split(',').map(c=>c.trim().replace(/[",¥,円]/g,''));
    if (cols.length<4) continue;
    const standard=parseInt(cols[1])||parseInt(cols[0]);
    const monthly_min=parseInt(cols[2])||0;
    const monthly_max=parseInt(cols[3])||999999;
    const employee=parseInt(cols[4])||parseInt(cols[2]);
    const employer=parseInt(cols[5])||employee;
    if (isNaN(standard)||isNaN(employee)) continue;
    const label=`${grade}等級`;
    insuranceCsvParsed.push({grade,label,standard,monthly_min,monthly_max,employee,employer});
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${label}</td><td>${formatCurrency(standard)}</td><td>${formatCurrency(employee)}</td>`;
    tbody.appendChild(tr);
    grade++;
  }
  document.getElementById('insuranceCsvPreview').style.display='block';
  document.getElementById('insuranceCsvCount').textContent=`${insuranceCsvParsed.length}等級分読み込み済み`;
}

async function importInsuranceCsv() {
  if (!insuranceCsvParsed.length) { showToast('データがありません','error'); return; }
  const type=document.getElementById('insuranceCsvType').value;
  const label=type==='pension'?'厚生年金':'健康保険';
  if (!confirmAction(`${insuranceCsvParsed.length}等級で${label}料額表を上書きしますか？`)) return;
  await DB.replaceInsuranceTable(type, insuranceCsvParsed.map(r=>({...r,id:_uid()})));
  closeModal('insuranceCsvModal'); showToast(`${label}料額表を更新しました`); loadInsuranceTable(type);
  _pensionTable=[]; _healthTable=[];
}

function downloadInsuranceCsvTemplate() {
  const content=`等級,標準報酬月額,月収下限,月収上限,被保険者負担,事業主負担\n1,88000,0,93000,8052,8052\n2,98000,93000,101000,8967,8967`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));
  a.download='insurance_template.csv'; a.click();
}

async function openTaxModal(id=null) {
  document.getElementById('taxId').value=id||'';
  document.getElementById('taxIncomeFrom').value='';
  document.getElementById('taxAmount').value='';
  if (id) {
    const rows=await DB.getTaxTable(currentTaxType);
    const row=rows.find(r=>r.id===id);
    if (row) { document.getElementById('taxIncomeFrom').value=row.income_from; document.getElementById('taxAmount').value=row.tax_amount; }
  }
  openModal('taxModal');
}

async function openTaxEditModal(id) { openTaxModal(id); }

async function saveTaxRow() {
  const id=document.getElementById('taxId').value;
  const income_from=parseInt(document.getElementById('taxIncomeFrom').value);
  const tax_amount=parseInt(document.getElementById('taxAmount').value);
  if (isNaN(income_from)||isNaN(tax_amount)) { showToast('金額を正しく入力してください','error'); return; }
  const row={income_from,tax_amount}; if(id) row.id=id;
  await DB.saveTaxRow(currentTaxType,row);
  closeModal('taxModal'); showToast('保存しました'); loadTaxTable(currentTaxType);
}

async function deleteTaxRow(id) {
  if (!confirmAction('この行を削除しますか？')) return;
  await DB.deleteTaxRow(currentTaxType,id); showToast('削除しました'); loadTaxTable(currentTaxType);
}

async function loadLeaveTab() {
  const staff=await DB.getStaff();
  const sel=document.getElementById('leaveStaffSelect');
  const currentVal=sel.value;
  sel.innerHTML='<option value="">全スタッフ</option>';
  staff.filter(s=>s.is_active).forEach(s => {
    const opt=document.createElement('option'); opt.value=s.id; opt.textContent=s.name;
    if (s.id===currentVal) opt.selected=true; sel.appendChild(opt);
  });
  await loadLeaveList();
}

async function loadLeaveList() {
  const staffId=document.getElementById('leaveStaffSelect').value;
  const staff=await DB.getStaff();
  const tbody=document.getElementById('leaveTableBody');
  const leaveData=await DB.getLeaveAll();
  if (!staffId) {
    document.getElementById('leaveDetailSection').style.display='none';
    tbody.closest('table').querySelector('thead tr').innerHTML='<th>スタッフ</th><th>付与日数</th><th>使用日数</th><th>残日数</th><th>詳細</th>';
    tbody.innerHTML='';
    staff.filter(s=>s.is_active).forEach(s => {
      const leaves=leaveData.filter(l=>l.staff_id===s.id);
      const granted=leaves.filter(l=>l.type==='grant').reduce((sum,l)=>sum+(l.days||0),0);
      const used=leaves.filter(l=>l.type==='use').reduce((sum,l)=>sum+(l.days||0),0);
      const remaining=granted-used;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${granted}日</td><td>${used}日</td>
        <td><strong style="color:${remaining<3?'#dc2626':'#16a34a'}">${remaining}日</strong></td>
        <td><button class="btn-sm btn-edit" onclick="selectLeaveStaff('${s.id}')">詳細</button></td>`;
      tbody.appendChild(tr);
    });
    if (!staff.filter(s=>s.is_active).length) tbody.innerHTML='<tr><td colspan="5" class="empty-cell">スタッフが登録されていません</td></tr>';
    return;
  }
  const s=staff.find(x=>x.id===staffId);
  const leaves=leaveData.filter(l=>l.staff_id===staffId);
  const granted=leaves.filter(l=>l.type==='grant').reduce((sum,l)=>sum+(l.days||0),0);
  const used=leaves.filter(l=>l.type==='use').reduce((sum,l)=>sum+(l.days||0),0);
  const remaining=granted-used;
  document.getElementById('leaveDetailSection').style.display='block';
  document.getElementById('leaveStaffName').textContent=s?s.name:'';
  document.getElementById('leaveGranted').textContent=`${granted}日`;
  document.getElementById('leaveUsed').textContent=`${used}日`;
  document.getElementById('leaveRemaining').textContent=`${remaining}日`;
  document.getElementById('leaveRemaining').style.color=remaining<3?'#dc2626':'#16a34a';
  tbody.closest('table').querySelector('thead tr').innerHTML='<th>日付</th><th>種別</th><th>日数</th><th>理由</th><th>操作</th>';
  tbody.innerHTML='';
  leaves.sort((a,b)=>a.date>b.date?-1:1).forEach(l => {
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${formatDateJP(l.date)}</td>
      <td><span class="badge ${l.type==='grant'?'badge-active':'badge-special'}">${l.type==='grant'?'付与':'使用'}</span></td>
      <td>${l.days}日</td><td>${l.reason||'-'}</td>
      <td><button class="btn-sm btn-delete" onclick="deleteLeave('${l.id}')">🗑️ 削除</button></td>`;
    tbody.appendChild(tr);
  });
  if (!leaves.length) tbody.innerHTML='<tr><td colspan="5" class="empty-cell">有休記録がありません</td></tr>';
}

function selectLeaveStaff(staffId) { document.getElementById('leaveStaffSelect').value=staffId; loadLeaveList(); }

async function openLeaveModal() {
  const staffId=document.getElementById('leaveStaffSelect').value;
  const staff=await DB.getStaff();
  const sel=document.getElementById('leaveModalStaff');
  sel.innerHTML='';
  staff.filter(s=>s.is_active).forEach(s => {
    const opt=document.createElement('option'); opt.value=s.id; opt.textContent=s.name;
    if (s.id===staffId) opt.selected=true; sel.appendChild(opt);
  });
  document.getElementById('leaveDate').value=todayStr();
  document.getElementById('leaveType').value='grant';
  document.getElementById('leaveDays').value='1';
  document.getElementById('leaveReason').value='';
  openModal('leaveModal');
}

async function saveLeave() {
  const staff_id=document.getElementById('leaveModalStaff').value;
  const date=document.getElementById('leaveDate').value;
  const type=document.getElementById('leaveType').value;
  const days=parseFloat(document.getElementById('leaveDays').value)||0;
  const reason=document.getElementById('leaveReason').value.trim();
  if (!staff_id||!date||days<=0) { showToast('スタッフ・日付・日数を正しく入力してください','error'); return; }
  await DB.saveLeave({staff_id,date,type,days,reason});
  closeModal('leaveModal'); showToast('保存しました'); loadLeaveList();
}

async function deleteLeave(id) {
  if (!confirmAction('この有休記録を削除しますか？')) return;
  await DB.deleteLeave(id); showToast('削除しました'); loadLeaveList();
}

function _uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
