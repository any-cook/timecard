// ============================================================
// admin.js - 管理画面ロジック (全5タブ)
// ============================================================

// ============================================================
// PIN認証
// ============================================================
let pinInput = '';

function initPin() {
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('adminContent').style.display = 'none';
  updatePinDisplay();
}

function pinPress(val) {
  if (pinInput.length >= 4) return;
  pinInput += val;
  updatePinDisplay();
  if (pinInput.length === 4) setTimeout(checkPin, 200);
}

function pinDelete() {
  pinInput = pinInput.slice(0, -1);
  updatePinDisplay();
}

function updatePinDisplay() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinInput.length));
}

function checkPin() {
  if (pinInput === ADMIN_PIN) {
    document.getElementById('pinScreen').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    initAdminTabs();
  } else {
    document.getElementById('pinError').style.display = 'block';
    pinInput = '';
    updatePinDisplay();
    setTimeout(() => document.getElementById('pinError').style.display = 'none', 2000);
  }
}

// ============================================================
// タブ切替
// ============================================================
function initAdminTabs() {
  switchTab('staff');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  const loaders = {
    staff: loadStaffTab,
    attendance: loadAttendanceTab,
    special: loadSpecialTab,
    payroll: loadPayrollTab,
    tax: loadTaxTab
  };
  if (loaders[tab]) loaders[tab]();
}

// ============================================================
// タブ1: スタッフ管理
// ============================================================
let editingStaff = null;

async function loadStaffTab() {
  const staff = await DB.getStaff();
  const tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = '';
  staff.forEach(s => {
    const tr = document.createElement('tr');
    if (!s.is_active) tr.classList.add('inactive-row');
    tr.innerHTML = `
      <td>${s.name}</td>
      <td><span class="badge badge-type">${staffTypeLabel(s.type)}</span></td>
      <td>${s.type === 'hourly' ? formatCurrency(s.wage) + '/時' : formatCurrency(s.monthly_salary) + '/月'}</td>
      <td><span class="badge ${s.is_active ? 'badge-active' : 'badge-inactive'}">${s.is_active ? '在籍' : '退職'}</span></td>
      <td>
        <button class="btn-sm btn-edit" onclick="openStaffModal('${s.id}')">✏️ 編集</button>
        <button class="btn-sm btn-toggle" onclick="toggleStaffActive('${s.id}', ${!s.is_active})">${s.is_active ? '退職処理' : '在籍に戻す'}</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function toggleStaffActive(id, newState) {
  const staff = await DB.getStaff();
  const s = staff.find(x => x.id === id);
  if (!s) return;
  if (!confirmAction(`${s.name} さんを${newState ? '在籍に戻します' : '退職処理します'}。よろしいですか？`)) return;
  s.is_active = newState;
  await DB.saveStaff(s);
  showToast('更新しました');
  loadStaffTab();
}

async function openStaffModal(id = null) {
  editingStaff = null;
  document.getElementById('staffModalTitle').textContent = id ? 'スタッフ編集' : 'スタッフ追加';
  document.getElementById('staffForm').reset();
  document.getElementById('staffWageSection').style.display = 'block';
  document.getElementById('staffSalarySection').style.display = 'none';

  if (id) {
    const staff = await DB.getStaff();
    editingStaff = staff.find(s => s.id === id);
    if (editingStaff) {
      document.getElementById('staffName').value = editingStaff.name;
      document.getElementById('staffType').value = editingStaff.type;
      document.getElementById('staffWage').value = editingStaff.wage || '';
      document.getElementById('staffSalary').value = editingStaff.monthly_salary || '';
      document.getElementById('staffActive').checked = editingStaff.is_active;
      updateStaffTypeFields();
    }
  }
  openModal('staffModal');
}

function updateStaffTypeFields() {
  const type = document.getElementById('staffType').value;
  document.getElementById('staffWageSection').style.display = type === 'hourly' ? 'block' : 'none';
  document.getElementById('staffSalarySection').style.display = type !== 'hourly' ? 'block' : 'none';
}

async function saveStaff() {
  const name = document.getElementById('staffName').value.trim();
  const type = document.getElementById('staffType').value;
  const wage = parseInt(document.getElementById('staffWage').value) || 0;
  const salary = parseInt(document.getElementById('staffSalary').value) || 0;
  const isActive = document.getElementById('staffActive').checked;

  if (!name) { showToast('スタッフ名を入力してください', 'error'); return; }

  const record = editingStaff ? { ...editingStaff } : {};
  record.name = name;
  record.type = type;
  record.wage = wage;
  record.monthly_salary = salary;
  record.is_active = isActive;

  await DB.saveStaff(record);
  closeModal('staffModal');
  showToast('スタッフ情報を保存しました');
  loadStaffTab();
}

// ============================================================
// タブ2: 勤怠管理
// ============================================================
let attendanceFilters = {
  year: currentYear(),
  month: currentMonth(),
  staff_id: ''
};
let specialDaysCache = [];

async function loadAttendanceTab() {
  // フィルター初期値セット
  document.getElementById('filterYear').value = attendanceFilters.year;
  document.getElementById('filterMonth').value = attendanceFilters.month;

  // スタッフ選択肢を構築
  const staff = await DB.getStaff();
  const sel = document.getElementById('filterStaff');
  sel.innerHTML = '<option value="">全スタッフ</option>';
  staff.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === attendanceFilters.staff_id) opt.selected = true;
    sel.appendChild(opt);
  });

  // 手動特別日取得
  specialDaysCache = await DB.getSpecialDays();

  loadAttendanceRecords();
}

async function loadAttendanceRecords() {
  attendanceFilters.year = parseInt(document.getElementById('filterYear').value);
  attendanceFilters.month = parseInt(document.getElementById('filterMonth').value);
  attendanceFilters.staff_id = document.getElementById('filterStaff').value;

  const records = await DB.getAttendance(attendanceFilters);
  const staff = await DB.getStaff();
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s]));

  const tbody = document.getElementById('attendanceTableBody');
  tbody.innerHTML = '';

  let totalWage = 0;
  let totalMins = 0;

  records.forEach(r => {
    const s = staffMap[r.staff_id] || {};
    const workMins = calcWorkMinutes(r.clock_in_calc, r.clock_out_calc);
    const dailyWage = r.clock_out_calc ? calcDailyWage(r.clock_in_calc, r.clock_out_calc, r.wage_at_date || 0, r.is_special_day) : 0;
    totalWage += dailyWage;
    totalMins += workMins;

    const isMissingOut = r.clock_in_actual && !r.clock_out_actual;

    const tr = document.createElement('tr');
    if (isMissingOut) tr.classList.add('missing-clockout');
    if (r.is_special_day) tr.classList.add('special-day-row');

    tr.innerHTML = `
      <td>${formatDateJP(r.date)}</td>
      <td>${s.name || '不明'}</td>
      <td>${r.clock_in_actual || '-'}</td>
      <td>${r.clock_out_actual || (isMissingOut ? '<span class="alert-text">⚠️ 退勤忘れ</span>' : '-')}</td>
      <td>${r.clock_in_calc || '-'}</td>
      <td>${r.clock_out_calc || '-'}</td>
      <td>${workMins ? formatWorkTime(workMins) : '-'}</td>
      <td>${r.clock_out_calc ? formatCurrency(dailyWage) : '-'}</td>
      <td>${r.is_special_day ? '<span class="badge badge-special">⭐ 特別</span>' : '-'}</td>
      <td>
        <button class="btn-sm btn-edit" onclick="openAttendanceEditModal('${r.id}')">✏️ 修正</button>
        <button class="btn-sm btn-delete" onclick="deleteAttendance('${r.id}')">🗑️ 削除</button>
      </td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('attendanceSummary').innerHTML =
    `合計: ${formatWorkTime(totalMins)} / ${formatCurrency(totalWage)}`;
}

async function openAttendanceAddModal() {
  document.getElementById('attendanceModalTitle').textContent = '打刻の手動追加';
  document.getElementById('attendanceId').value = '';

  const staff = await DB.getStaff();
  const sel = document.getElementById('attendanceStaff');
  sel.innerHTML = '';
  staff.filter(s => s.is_active).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    sel.appendChild(opt);
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
  const r = records.find(x => x.id === id);
  if (!r) return;

  document.getElementById('attendanceModalTitle').textContent = '打刻の修正';
  document.getElementById('attendanceId').value = r.id;

  const staff = await DB.getStaff();
  const sel = document.getElementById('attendanceStaff');
  sel.innerHTML = '';
  staff.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === r.staff_id) opt.selected = true;
    sel.appendChild(opt);
  });

  document.getElementById('attendanceDate').value = r.date;
  document.getElementById('attendanceClockIn').value = r.clock_in_actual || '';
  document.getElementById('attendanceClockOut').value = r.clock_out_actual || '';
  document.getElementById('attendanceWage').value = r.wage_at_date || '';
  document.getElementById('attendanceSpecial').checked = r.is_special_day || false;
  document.getElementById('attendanceNotes').value = r.notes || '';

  openModal('attendanceModal');
}

async function saveAttendance() {
  const id = document.getElementById('attendanceId').value;
  const staff_id = document.getElementById('attendanceStaff').value;
  const date = document.getElementById('attendanceDate').value;
  const clockIn = document.getElementById('attendanceClockIn').value;
  const clockOut = document.getElementById('attendanceClockOut').value;
  const wage = parseInt(document.getElementById('attendanceWage').value) || 0;
  const isSpecial = document.getElementById('attendanceSpecial').checked;
  const notes = document.getElementById('attendanceNotes').value;

  if (!date || !staff_id) { showToast('日付とスタッフを入力してください', 'error'); return; }
  if (!clockIn) { showToast('出勤時刻を入力してください', 'error'); return; }

  const record = {
    staff_id,
    date,
    clock_in_actual: clockIn,
    clock_out_actual: clockOut || null,
    clock_in_calc: roundUpClockIn(clockIn),
    clock_out_calc: clockOut ? roundDownClockOut(clockOut) : null,
    wage_at_date: wage,
    is_special_day: isSpecial,
    notes
  };
  if (id) record.id = id;

  await DB.saveAttendance(record);
  closeModal('attendanceModal');
  showToast('保存しました');
  loadAttendanceRecords();
}

async function deleteAttendance(id) {
  if (!confirmAction('この打刻記録を削除しますか？')) return;
  await DB.deleteAttendance(id);
  showToast('削除しました');
  loadAttendanceRecords();
}

// ============================================================
// タブ3: 特別日設定
// ============================================================
async function loadSpecialTab() {
  const days = await DB.getSpecialDays();
  const tbody = document.getElementById('specialTableBody');
  tbody.innerHTML = '';

  if (days.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">手動追加の特別日はありません</td></tr>';
    return;
  }

  days.sort((a,b) => a.date > b.date ? -1 : 1).forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateJP(d.date)}</td>
      <td>${d.reason || '-'}</td>
      <td><button class="btn-sm btn-delete" onclick="deleteSpecialDay('${d.id}')">🗑️ 削除</button></td>`;
    tbody.appendChild(tr);
  });

  renderAutoSpecialRules();
}

function renderAutoSpecialRules() {
  document.getElementById('autoRulesList').innerHTML = `
    <li>🗓️ 金曜日・土曜日・日曜日</li>
    <li>🎌 日本の祝日（内閣府データより自動取得）</li>
    <li>📅 祝日の前日（祝前日）</li>`;
}

async function addSpecialDay() {
  const date = document.getElementById('newSpecialDate').value;
  const reason = document.getElementById('newSpecialReason').value.trim();

  if (!date) { showToast('日付を入力してください', 'error'); return; }

  const existing = await DB.getSpecialDays();
  if (existing.some(d => d.date === date)) {
    showToast('この日付はすでに登録済みです', 'error'); return;
  }

  await DB.saveSpecialDay({ date, reason });
  document.getElementById('newSpecialDate').value = '';
  document.getElementById('newSpecialReason').value = '';
  showToast('特別日を追加しました');
  loadSpecialTab();
}

async function deleteSpecialDay(id) {
  if (!confirmAction('この特別日設定を削除しますか？')) return;
  await DB.deleteSpecialDay(id);
  showToast('削除しました');
  loadSpecialTab();
}

// ============================================================
// タブ4: 集計・給与明細
// ============================================================
async function loadPayrollTab() {
  document.getElementById('payrollYear').value = currentYear();
  document.getElementById('payrollMonth').value = currentMonth();
  await loadPayrollSummary();
}

async function loadPayrollSummary() {
  const year = parseInt(document.getElementById('payrollYear').value);
  const month = parseInt(document.getElementById('payrollMonth').value);

  const [allStaff, records, specialDays, taxKou, taxOtsu] = await Promise.all([
    DB.getStaff(),
    DB.getAttendance({ year, month }),
    DB.getSpecialDays(),
    DB.getTaxTable('kou'),
    DB.getTaxTable('otsu')
  ]);

  const activeStaff = allStaff.filter(s => s.is_active);
  const tbody = document.getElementById('payrollTableBody');
  tbody.innerHTML = '';

  let grandTotal = 0;

  activeStaff.forEach(staff => {
    const staffRecords = records.filter(r => r.staff_id === staff.id);

    let grossPay = 0;
    let totalMins = 0;
    let specialDays2 = 0;

    if (staff.type === 'hourly') {
      staffRecords.forEach(r => {
        const mins = calcWorkMinutes(r.clock_in_calc, r.clock_out_calc);
        totalMins += mins;
        if (r.is_special_day) specialDays2++;
        grossPay += calcDailyWage(r.clock_in_calc, r.clock_out_calc, r.wage_at_date || staff.wage, r.is_special_day);
      });
    } else {
      grossPay = staff.monthly_salary || 0;
    }

    const tax = calcTax(grossPay, taxKou);
    const netPay = grossPay - tax;
    grandTotal += grossPay;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${staff.name}</td>
      <td><span class="badge badge-type">${staffTypeLabel(staff.type)}</span></td>
      <td>${staff.type === 'hourly' ? formatWorkTime(totalMins) : '月額固定'}</td>
      <td>${staff.type === 'hourly' ? `${specialDays2}日` : '-'}</td>
      <td>${formatCurrency(grossPay)}</td>
      <td>${formatCurrency(tax)}</td>
      <td><strong>${formatCurrency(netPay)}</strong></td>
      <td><button class="btn-sm btn-edit" onclick="showPayslip('${staff.id}', ${year}, ${month})">📄 明細</button></td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('payrollGrandTotal').textContent = `支給合計: ${formatCurrency(grandTotal)}`;
}

async function showPayslip(staffId, year, month) {
  const [allStaff, records, taxKou] = await Promise.all([
    DB.getStaff(),
    DB.getAttendance({ year, month, staff_id: staffId }),
    DB.getTaxTable('kou')
  ]);

  const staff = allStaff.find(s => s.id === staffId);
  if (!staff) return;

  let grossPay = 0;
  let totalMins = 0;
  let detailRows = '';

  if (staff.type === 'hourly') {
    records.forEach(r => {
      const mins = calcWorkMinutes(r.clock_in_calc, r.clock_out_calc);
      totalMins += mins;
      const daily = calcDailyWage(r.clock_in_calc, r.clock_out_calc, r.wage_at_date || staff.wage, r.is_special_day);
      grossPay += daily;
      detailRows += `<tr>
        <td>${formatDateJP(r.date)}</td>
        <td>${r.clock_in_actual || '-'}</td>
        <td>${r.clock_out_actual || '-'}</td>
        <td>${r.clock_in_calc || '-'}</td>
        <td>${r.clock_out_calc || '-'}</td>
        <td>${formatWorkTime(mins)}</td>
        <td>${r.is_special_day ? '⭐' : ''} ${formatCurrency(r.wage_at_date || staff.wage)}</td>
        <td>${formatCurrency(daily)}</td>
      </tr>`;
    });
  } else {
    grossPay = staff.monthly_salary || 0;
    detailRows = `<tr><td colspan="8" style="text-align:center;">月額固定給: ${formatCurrency(grossPay)}</td></tr>`;
  }

  const tax = calcTax(grossPay, taxKou);
  const netPay = grossPay - tax;

  document.getElementById('payslipContent').innerHTML = `
    <div class="payslip">
      <div class="payslip-header">
        <h2>給与明細書</h2>
        <p>${year}年${month}月分</p>
      </div>
      <div class="payslip-info">
        <div><strong>氏名:</strong> ${staff.name}</div>
        <div><strong>種別:</strong> ${staffTypeLabel(staff.type)}</div>
        ${staff.type === 'hourly' ? `<div><strong>基本時給:</strong> ${formatCurrency(staff.wage)}</div>` : ''}
        ${staff.type === 'hourly' ? `<div><strong>労働時間:</strong> ${formatWorkTime(totalMins)}</div>` : ''}
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>日付</th><th>出勤(実)</th><th>退勤(実)</th>
              <th>出勤(計)</th><th>退勤(計)</th>
              <th>労働時間</th><th>時給</th><th>日給</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
      <div class="payslip-summary">
        <div class="summary-row"><span>支給額（税引前）</span><strong>${formatCurrency(grossPay)}</strong></div>
        <div class="summary-row deduction"><span>源泉徴収税</span><span>- ${formatCurrency(tax)}</span></div>
        <div class="summary-row total"><span>差引支給額</span><strong class="net-pay">${formatCurrency(netPay)}</strong></div>
      </div>
    </div>`;

  openModal('payslipModal');
}

function printPayslip() {
  window.print();
}

// ============================================================
// タブ5: 税額表管理
// ============================================================
let currentTaxType = 'kou';

async function loadTaxTab() {
  loadTaxTable('kou');
}

async function loadTaxTable(type) {
  currentTaxType = type;
  document.querySelectorAll('.tax-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));

  const rows = await DB.getTaxTable(type);
  const tbody = document.getElementById('taxTableBody');
  tbody.innerHTML = '';

  rows.sort((a,b) => a.income_from - b.income_from).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatCurrency(r.income_from)} ～</td>
      <td>${formatCurrency(r.tax_amount)}</td>
      <td>
        <button class="btn-sm btn-edit" onclick="openTaxEditModal('${r.id}')">✏️ 編集</button>
        <button class="btn-sm btn-delete" onclick="deleteTaxRow('${r.id}')">🗑️ 削除</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function openTaxModal(id = null) {
  document.getElementById('taxId').value = id || '';
  document.getElementById('taxIncomeFrom').value = '';
  document.getElementById('taxAmount').value = '';

  if (id) {
    const rows = await DB.getTaxTable(currentTaxType);
    const row = rows.find(r => r.id === id);
    if (row) {
      document.getElementById('taxIncomeFrom').value = row.income_from;
      document.getElementById('taxAmount').value = row.tax_amount;
    }
  }
  openModal('taxModal');
}

async function openTaxEditModal(id) { openTaxModal(id); }

async function saveTaxRow() {
  const id = document.getElementById('taxId').value;
  const income_from = parseInt(document.getElementById('taxIncomeFrom').value);
  const tax_amount = parseInt(document.getElementById('taxAmount').value);

  if (isNaN(income_from) || isNaN(tax_amount)) {
    showToast('金額を正しく入力してください', 'error'); return;
  }

  const row = { income_from, tax_amount };
  if (id) row.id = id;

  await DB.saveTaxRow(currentTaxType, row);
  closeModal('taxModal');
  showToast('保存しました');
  loadTaxTable(currentTaxType);
}

async function deleteTaxRow(id) {
  if (!confirmAction('この行を削除しますか？')) return;
  await DB.deleteTaxRow(currentTaxType, id);
  showToast('削除しました');
  loadTaxTable(currentTaxType);
}
