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
function pinDelete() { pinInput = pinInput.slice(0, -1); updatePinDisplay(); }
function updatePinDisplay() {
  document.querySelectorAll('.pin-dot').forEach(function(d, i) { d.classList.toggle('filled', i < pinInput.length); });
}
function checkPin() {
  if (pinInput === ADMIN_PIN) {
    document.getElementById('pinScreen').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    initAdminTabs();
  } else {
    document.getElementById('pinError').style.display = 'block';
    pinInput = ''; updatePinDisplay();
    setTimeout(function() { document.getElementById('pinError').style.display = 'none'; }, 2000);
  }
}
function initAdminTabs() { switchTab('staff'); }
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === tab); });
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.toggle('active', p.id === 'tab-' + tab); });
  var loaders = { staff: loadStaffTab, attendance: loadAttendanceTab, special: loadSpecialTab, payroll: loadPayrollTab, tax: loadTaxTab, leave: loadLeaveTab };
  if (loaders[tab]) loaders[tab]();
}

// ============================================================
// 折りたたみ機能
// ============================================================
function toggleCollapsible(id) {
  var body = document.getElementById(id);
  var arrow = document.getElementById(id + 'Arrow');
  if (!body) return;
  var isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (arrow) arrow.classList.toggle('open', !isOpen);
}

function openCollapsible(id) {
  var body = document.getElementById(id);
  var arrow = document.getElementById(id + 'Arrow');
  if (body) body.classList.add('open');
  if (arrow) arrow.classList.add('open');
}

// ============================================================
// 介護保険区分ヘルパー
// ============================================================
function calcAge(birthdate) {
  if (!birthdate) return null;
  var today = new Date(), birth = new Date(birthdate);
  var age = today.getFullYear() - birth.getFullYear();
  var m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
function isNursingCare(birthdate) {
  var age = calcAge(birthdate);
  return age !== null && age >= 40 && age <= 64;
}
function getHealthTableType(staff) {
  if (!staff.social_insurance) return 'health';
  return isNursingCare(staff.birthdate) ? 'health_nursing' : 'health';
}

// ============================================================
// タブ1: スタッフ管理
// ============================================================
var editingStaff = null;
var _pensionTable = [], _healthTable = [], _healthNursingTable = [];

async function loadStaffTab() {
  var results = await Promise.all([DB.getInsuranceTable('pension'), DB.getInsuranceTable('health'), DB.getInsuranceTable('health_nursing')]);
  _pensionTable = results[0]; _healthTable = results[1]; _healthNursingTable = results[2];
  var staff = await DB.getStaff();
  var tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = '';
  if (!staff.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">スタッフが登録されていません</td></tr>'; return; }
  staff.forEach(function(s) {
    var age = calcAge(s.birthdate);
    var ageStr = age !== null ? age + '歳' : '-';
    var nursing = s.birthdate ? (isNursingCare(s.birthdate)
      ? '<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #d97706;">介護2号（40-64歳）</span>'
      : '<span class="badge badge-inactive">非該当</span>') : '-';
    var tr = document.createElement('tr');
    if (!s.is_active) tr.classList.add('inactive-row');
    tr.innerHTML = '<td>' + s.name + '</td>' +
      '<td><span class="badge badge-type">' + staffTypeLabel(s.type) + '</span></td>' +
      '<td>' + (s.type === 'hourly' ? formatCurrency(s.wage) + '/時' : formatCurrency(s.monthly_salary) + '/月') + '</td>' +
      '<td>' + ageStr + '</td><td>' + nursing + '</td>' +
      '<td>' + (s.social_insurance ? '<span class="badge badge-insurance">加入</span>' : '<span class="badge badge-inactive">未加入</span>') + '</td>' +
      '<td><span class="badge ' + (s.is_active ? 'badge-active' : 'badge-inactive') + '">' + (s.is_active ? '在籍' : '退職') + '</span></td>' +
      '<td><button class="btn-sm btn-edit" onclick="openStaffModal(\'' + s.id + '\')">✏️ 編集</button> ' +
      '<button class="btn-sm btn-toggle" onclick="toggleStaffActive(\'' + s.id + '\',' + (!s.is_active) + ')">' + (s.is_active ? '退職処理' : '在籍に戻す') + '</button></td>';
    tbody.appendChild(tr);
  });
}

async function toggleStaffActive(id, newState) {
  var staff = await DB.getStaff();
  var s = staff.find(function(x) { return x.id === id; });
  if (!s || !confirmAction(s.name + ' さんを' + (newState ? '在籍に戻します' : '退職処理します') + '。よろしいですか？')) return;
  s.is_active = newState;
  await DB.saveStaff(s); showToast('更新しました'); loadStaffTab();
}

async function openStaffModal(id) {
  editingStaff = null;
  document.getElementById('staffModalTitle').textContent = id ? 'スタッフ編集' : 'スタッフ追加';
  document.getElementById('staffForm').reset();
  document.getElementById('staffWageSection').style.display = 'block';
  document.getElementById('staffSalarySection').style.display = 'none';
  document.getElementById('socialInsuranceFields').style.display = 'none';
  document.getElementById('nursingCareStatus').textContent = '生年月日を入力すると自動判定';
  document.getElementById('nursingCareStatus').style.background = '#f1f5f9';
  document.getElementById('nursingCareStatus').style.color = 'var(--text-muted)';
  await buildGradeSelects('health');
  if (id) {
    var staff = await DB.getStaff();
    editingStaff = staff.find(function(s) { return s.id === id; });
    if (editingStaff) {
      document.getElementById('staffName').value = editingStaff.name;
      document.getElementById('staffBirthdate').value = editingStaff.birthdate || '';
      document.getElementById('staffType').value = editingStaff.type;
      document.getElementById('staffWage').value = editingStaff.wage || '';
      document.getElementById('staffSalary').value = editingStaff.monthly_salary || '';
      document.getElementById('staffActive').checked = editingStaff.is_active;
      document.getElementById('staffSocialInsurance').checked = editingStaff.social_insurance || false;
      document.getElementById('staffTaxType').value = editingStaff.tax_type || 'kou';
      if (editingStaff.birthdate) updateNursingCareStatus();
      if (editingStaff.social_insurance) {
        document.getElementById('socialInsuranceFields').style.display = 'block';
        var tableType = getHealthTableType(editingStaff);
        await buildGradeSelects(tableType);
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

async function buildGradeSelects(tableType) {
  if (!_pensionTable.length) _pensionTable = await DB.getInsuranceTable('pension');
  if (!_healthTable.length) _healthTable = await DB.getInsuranceTable('health');
  if (!_healthNursingTable.length) _healthNursingTable = await DB.getInsuranceTable('health_nursing');
  var useTable = tableType === 'health_nursing' ? _healthNursingTable : _healthTable;
  var pensionSel = document.getElementById('staffPensionGrade');
  var healthSel = document.getElementById('staffHealthGrade');
  pensionSel.innerHTML = '<option value="">選択してください</option>';
  healthSel.innerHTML = '<option value="">選択してください</option>';
  _pensionTable.slice().sort(function(a,b){return a.grade-b.grade;}).forEach(function(r) {
    pensionSel.innerHTML += '<option value="' + r.id + '">' + r.label + '（標準報酬 ' + formatCurrency(r.standard) + '・本人負担 ' + formatCurrency(r.employee) + '）</option>';
  });
  useTable.slice().sort(function(a,b){return a.grade-b.grade;}).forEach(function(r) {
    healthSel.innerHTML += '<option value="' + r.id + '">' + r.label + '（標準報酬 ' + formatCurrency(r.standard) + '・本人負担 ' + formatCurrency(r.employee) + '）</option>';
  });
  var label = document.getElementById('nursingCareLabel');
  var healthLbl = document.getElementById('healthLabel');
  if (tableType === 'health_nursing') {
    label.textContent = '介護保険込み（40〜64歳）';
    label.style.background = '#fef3c7'; label.style.color = '#92400e';
    healthLbl.textContent = '健康保険（介護保険込み・本人負担）';
  } else {
    label.textContent = '介護保険なし（39歳以下・65歳以上）';
    label.style.background = '#dbeafe'; label.style.color = '#1d4ed8';
    healthLbl.textContent = '健康保険（本人負担）';
  }
  window._currentHealthTableType = tableType;
}

function updateNursingCareStatus() {
  var birthdate = document.getElementById('staffBirthdate').value;
  var statusEl = document.getElementById('nursingCareStatus');
  if (!birthdate) { statusEl.textContent = '生年月日を入力すると自動判定'; statusEl.style.background = '#f1f5f9'; statusEl.style.color = 'var(--text-muted)'; return; }
  var age = calcAge(birthdate);
  var nursing = isNursingCare(birthdate);
  if (nursing) {
    statusEl.textContent = age + '歳 ／ 介護保険第2号被保険者（40〜64歳）→ 健康保険料に介護保険料が加算されます';
    statusEl.style.background = '#fef3c7'; statusEl.style.color = '#92400e';
  } else {
    statusEl.textContent = age + '歳 ／ 介護保険非該当（39歳以下または65歳以上）→ 通常の健康保険料が適用されます';
    statusEl.style.background = '#f0fdf4'; statusEl.style.color = '#166534';
  }
  if (document.getElementById('staffSocialInsurance').checked) {
    buildGradeSelects(nursing ? 'health_nursing' : 'health');
  }
}

function updateStaffTypeFields() {
  var type = document.getElementById('staffType').value;
  document.getElementById('staffWageSection').style.display = type === 'hourly' ? 'block' : 'none';
  document.getElementById('staffSalarySection').style.display = type !== 'hourly' ? 'block' : 'none';
}

function toggleSocialInsurance() {
  var checked = document.getElementById('staffSocialInsurance').checked;
  document.getElementById('socialInsuranceFields').style.display = checked ? 'block' : 'none';
  if (checked) {
    var birthdate = document.getElementById('staffBirthdate').value;
    buildGradeSelects((birthdate && isNursingCare(birthdate)) ? 'health_nursing' : 'health');
    updateInsurancePreview();
  }
}

function updateInsurancePreview() {
  var pensionId = document.getElementById('staffPensionGrade').value;
  var healthId = document.getElementById('staffHealthGrade').value;
  var tableType = window._currentHealthTableType || 'health';
  var useTable = tableType === 'health_nursing' ? _healthNursingTable : _healthTable;
  var pensionAmt = getInsuranceAmountByGrade(pensionId, _pensionTable);
  var healthAmt = getInsuranceAmountByGrade(healthId, useTable);
  var emp = parseInt(document.getElementById('staffEmploymentInsurance').value) || 0;
  document.getElementById('insurancePreviewPension').textContent = formatCurrency(pensionAmt);
  document.getElementById('insurancePreviewHealth').textContent = formatCurrency(healthAmt);
  document.getElementById('insurancePreviewTotal').textContent = formatCurrency(pensionAmt + healthAmt + emp);
}

function autoSelectGradeByMonthly() {
  var monthly = parseInt(document.getElementById('staffSalary').value) || parseInt(document.getElementById('staffWage').value) * 160 || 0;
  if (!monthly) return;
  var tableType = window._currentHealthTableType || 'health';
  var useTable = tableType === 'health_nursing' ? _healthNursingTable : _healthTable;
  var pension = findInsuranceGradeByMonthly(monthly, _pensionTable);
  var health = findInsuranceGradeByMonthly(monthly, useTable);
  if (pension) document.getElementById('staffPensionGrade').value = pension.id;
  if (health) document.getElementById('staffHealthGrade').value = health.id;
  updateInsurancePreview();
  showToast('報酬月額から等級を自動選択しました');
}

async function saveStaff() {
  var name = document.getElementById('staffName').value.trim();
  var birthdate = document.getElementById('staffBirthdate').value;
  var type = document.getElementById('staffType').value;
  var wage = parseInt(document.getElementById('staffWage').value) || 0;
  var salary = parseInt(document.getElementById('staffSalary').value) || 0;
  var isActive = document.getElementById('staffActive').checked;
  var socialInsurance = document.getElementById('staffSocialInsurance').checked;
  var taxType = document.getElementById('staffTaxType').value;
  var pensionGradeId = document.getElementById('staffPensionGrade').value;
  var healthGradeId = document.getElementById('staffHealthGrade').value;
  var employmentInsurance = parseInt(document.getElementById('staffEmploymentInsurance').value) || 0;
  if (!name) { showToast('スタッフ名を入力してください', 'error'); return; }
  var tableType = (birthdate && isNursingCare(birthdate)) ? 'health_nursing' : 'health';
  var useTable = tableType === 'health_nursing' ? _healthNursingTable : _healthTable;
  var record = editingStaff ? Object.assign({}, editingStaff) : {};
  record.name = name; record.birthdate = birthdate; record.type = type;
  record.wage = wage; record.monthly_salary = salary; record.is_active = isActive;
  record.social_insurance = socialInsurance; record.tax_type = taxType;
  record.pension_grade_id = pensionGradeId; record.health_grade_id = healthGradeId;
  record.health_table_type = tableType; record.employment_insurance = employmentInsurance;
  record.pension = getInsuranceAmountByGrade(pensionGradeId, _pensionTable);
  record.health_insurance = getInsuranceAmountByGrade(healthGradeId, useTable);
  await DB.saveStaff(record);
  closeModal('staffModal'); showToast('スタッフ情報を保存しました'); loadStaffTab();
}

// ============================================================
// タブ2: 勤怠管理
// ============================================================
var attendanceFilters = { year: currentYear(), month: currentMonth(), staff_id: '' };

async function loadAttendanceTab() {
  document.getElementById('filterYear').value = attendanceFilters.year;
  document.getElementById('filterMonth').value = attendanceFilters.month;
  var staff = await DB.getStaff();
  var sel = document.getElementById('filterStaff');
  sel.innerHTML = '<option value="">全スタッフ</option>';
  staff.forEach(function(s) {
    var opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.name;
    if (s.id === attendanceFilters.staff_id) opt.selected = true; sel.appendChild(opt);
  });
  loadAttendanceRecords();
}

async function loadAttendanceRecords() {
  attendanceFilters.year = parseInt(document.getElementById('filterYear').value);
  attendanceFilters.month = parseInt(document.getElementById('filterMonth').value);
  attendanceFilters.staff_id = document.getElementById('filterStaff').value;
  var records = await DB.getAttendance(attendanceFilters);
  var staff = await DB.getStaff();
  var staffMap = {};
  staff.forEach(function(s) { staffMap[s.id] = s; });
  var tbody = document.getElementById('attendanceTableBody'); tbody.innerHTML = '';
  var totalWage = 0, totalMins = 0, staffSummary = {};
  records.forEach(function(r) {
    var s = staffMap[r.staff_id] || {};
    var workMins = calcWorkMinutes(r.clock_in_calc, r.clock_out_calc);
    var dailyWage = r.clock_out_calc ? calcDailyWage(r.clock_in_calc, r.clock_out_calc, r.wage_at_date || 0, r.is_special_day) : 0;
    totalWage += dailyWage; totalMins += workMins;
    if (!staffSummary[r.staff_id]) staffSummary[r.staff_id] = { name: s.name || '不明', mins: 0, wage: 0 };
    staffSummary[r.staff_id].mins += workMins; staffSummary[r.staff_id].wage += dailyWage;
    var isMissingOut = r.clock_in_actual && !r.clock_out_actual;
    var tr = document.createElement('tr');
    if (isMissingOut) tr.classList.add('missing-clockout');
    if (r.is_special_day) tr.classList.add('special-day-row');
    tr.innerHTML = '<td>' + formatDateJP(r.date) + '</td><td>' + (s.name || '不明') + '</td>' +
      '<td>' + (r.clock_in_actual || '-') + '</td>' +
      '<td>' + (r.clock_out_actual || (isMissingOut ? '<span class="alert-text">⚠️ 退勤忘れ</span>' : '-')) + '</td>' +
      '<td>' + (r.clock_in_calc || '-') + '</td><td>' + (r.clock_out_calc || '-') + '</td>' +
      '<td>' + (workMins ? formatWorkTime(workMins) : '-') + '</td>' +
      '<td>' + (r.clock_out_calc ? formatCurrency(dailyWage) : '-') + '</td>' +
      '<td>' + (r.is_special_day ? '<span class="badge badge-special">⭐ 特別</span>' : '-') + '</td>' +
      '<td><button class="btn-sm btn-edit" onclick="openAttendanceEditModal(\'' + r.id + '\')">✏️ 修正</button> ' +
      '<button class="btn-sm btn-delete" onclick="deleteAttendance(\'' + r.id + '\')">🗑️ 削除</button></td>';
    tbody.appendChild(tr);
  });
  document.getElementById('attendanceTotalTime').textContent = formatWorkTime(totalMins);
  document.getElementById('attendanceTotalWage').textContent = formatCurrency(totalWage);
  var summaryBody = document.getElementById('staffSummaryBody'); summaryBody.innerHTML = '';
  var keys = Object.keys(staffSummary);
  if (!keys.length) { summaryBody.innerHTML = '<tr><td colspan="3" class="empty-cell">データがありません</td></tr>'; }
  else keys.forEach(function(k) {
    var s = staffSummary[k]; var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + s.name + '</td><td>' + formatWorkTime(s.mins) + '</td><td>' + formatCurrency(s.wage) + '</td>';
    summaryBody.appendChild(tr);
  });
}

async function openAttendanceAddModal() {
  document.getElementById('attendanceModalTitle').textContent = '打刻の手動追加';
  document.getElementById('attendanceId').value = '';
  var staff = await DB.getStaff(); var sel = document.getElementById('attendanceStaff'); sel.innerHTML = '';
  staff.filter(function(s){return s.is_active;}).forEach(function(s){var opt=document.createElement('option');opt.value=s.id;opt.textContent=s.name;sel.appendChild(opt);});
  document.getElementById('attendanceDate').value = todayStr();
  ['attendanceClockIn','attendanceClockOut','attendanceWage','attendanceNotes'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('attendanceSpecial').checked = false;
  openModal('attendanceModal');
}

async function openAttendanceEditModal(id) {
  var records = await DB.getAttendance({});
  var r = records.find(function(x){return x.id===id;}); if (!r) return;
  document.getElementById('attendanceModalTitle').textContent = '打刻の修正';
  document.getElementById('attendanceId').value = r.id;
  var staff = await DB.getStaff(); var sel = document.getElementById('attendanceStaff'); sel.innerHTML = '';
  staff.forEach(function(s){var opt=document.createElement('option');opt.value=s.id;opt.textContent=s.name;if(s.id===r.staff_id)opt.selected=true;sel.appendChild(opt);});
  document.getElementById('attendanceDate').value = r.date;
  document.getElementById('attendanceClockIn').value = r.clock_in_actual || '';
  document.getElementById('attendanceClockOut').value = r.clock_out_actual || '';
  document.getElementById('attendanceWage').value = r.wage_at_date || '';
  document.getElementById('attendanceSpecial').checked = r.is_special_day || false;
  document.getElementById('attendanceNotes').value = r.notes || '';
  openModal('attendanceModal');
}

async function saveAttendance() {
  var id = document.getElementById('attendanceId').value;
  var staff_id = document.getElementById('attendanceStaff').value;
  var date = document.getElementById('attendanceDate').value;
  var clockIn = document.getElementById('attendanceClockIn').value;
  var clockOut = document.getElementById('attendanceClockOut').value;
  var wage = parseInt(document.getElementById('attendanceWage').value) || 0;
  var isSpecial = document.getElementById('attendanceSpecial').checked;
  var notes = document.getElementById('attendanceNotes').value;
  if (!date || !staff_id) { showToast('日付とスタッフを入力してください', 'error'); return; }
  if (!clockIn) { showToast('出勤時刻を入力してください', 'error'); return; }
  var record = { staff_id:staff_id, date:date, clock_in_actual:clockIn, clock_out_actual:clockOut||null,
    clock_in_calc:roundUpClockIn(clockIn), clock_out_calc:clockOut?roundDownClockOut(clockOut):null,
    wage_at_date:wage, is_special_day:isSpecial, notes:notes };
  if (id) record.id = id;
  await DB.saveAttendance(record); closeModal('attendanceModal'); showToast('保存しました'); loadAttendanceRecords();
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
var csvParsedData = [];
async function previewCsv() {
  var file = document.getElementById('csvFile').files[0];
  if (!file) { showToast('CSVファイルを選択してください', 'error'); return; }
  var text = await file.text();
  var lines = text.split('\n').filter(function(l){return l.trim();});
  var staff = await DB.getStaff();
  csvParsedData = [];
  var tbody = document.getElementById('csvPreviewBody'); tbody.innerHTML = '';
  var dataLines = (lines[0].indexOf('スタッフ')>=0||lines[0].indexOf('date')>=0||lines[0].indexOf('日付')>=0)?lines.slice(1):lines;
  for (var i=0;i<dataLines.length;i++) {
    var cols=dataLines[i].split(',').map(function(c){return c.trim().replace(/"/g,'');});
    if (cols.length<3) continue;
    var staffName=cols[0],date=cols[1],clockIn=cols[2],clockOut=cols[3];
    var matchedStaff=staff.find(function(s){return s.name===staffName;});
    var isValid=matchedStaff&&date&&clockIn;
    var tr=document.createElement('tr'); tr.style.color=isValid?'':'#dc2626';
    tr.innerHTML='<td>'+staffName+' '+(matchedStaff?'✅':'❌未登録')+'</td><td>'+date+'</td><td>'+clockIn+'</td><td>'+(clockOut||'-')+'</td>';
    tbody.appendChild(tr);
    if (isValid) csvParsedData.push({staff_id:matchedStaff.id,date:date,clock_in_actual:clockIn,clock_out_actual:clockOut||null,
      clock_in_calc:roundUpClockIn(clockIn),clock_out_calc:clockOut?roundDownClockOut(clockOut):null,
      wage_at_date:matchedStaff.wage||0,is_special_day:false,notes:'CSVインポート'});
  }
  document.getElementById('csvPreviewArea').style.display = 'block';
  document.getElementById('csvImportCount').textContent = csvParsedData.length + '件インポート可能';
}
async function importCsv() {
  if (!csvParsedData.length) { showToast('インポートできるデータがありません', 'error'); return; }
  if (!confirmAction(csvParsedData.length + '件インポートしますか？')) return;
  for (var i=0;i<csvParsedData.length;i++) await DB.saveAttendance(csvParsedData[i]);
  closeModal('csvModal'); showToast(csvParsedData.length + '件インポートしました'); loadAttendanceRecords();
}
function downloadCsvTemplate() {
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['スタッフ名,日付,出勤時刻,退勤時刻\n田中 花子,2026-05-01,09:00,18:00'],{type:'text/csv;charset=utf-8;'}));
  a.download='timecard_template.csv'; a.click();
}

// ============================================================
// タブ3: 特別日設定
// ============================================================
async function loadSpecialTab() {
  var days = await DB.getSpecialDays();
  var tbody = document.getElementById('specialTableBody'); tbody.innerHTML = '';
  if (!days.length) { tbody.innerHTML='<tr><td colspan="3" class="empty-cell">手動追加の特別日はありません</td></tr>'; }
  else days.slice().sort(function(a,b){return a.date>b.date?-1:1;}).forEach(function(d){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+formatDateJP(d.date)+'</td><td>'+(d.reason||'-')+'</td><td><button class="btn-sm btn-delete" onclick="deleteSpecialDay(\''+d.id+'\')">🗑️ 削除</button></td>';
    tbody.appendChild(tr);
  });
  document.getElementById('autoRulesList').innerHTML='<li>🗓️ 金曜日・土曜日・日曜日</li><li>🎌 日本の祝日</li><li>📅 祝日の前日</li>';
}
async function addSpecialDay() {
  var date=document.getElementById('newSpecialDate').value;
  var reason=document.getElementById('newSpecialReason').value.trim();
  if (!date) { showToast('日付を入力してください', 'error'); return; }
  var existing=await DB.getSpecialDays();
  if (existing.some(function(d){return d.date===date;})) { showToast('この日付はすでに登録済みです', 'error'); return; }
  await DB.saveSpecialDay({date:date,reason:reason});
  document.getElementById('newSpecialDate').value=''; document.getElementById('newSpecialReason').value='';
  showToast('特別日を追加しました'); loadSpecialTab();
}
async function deleteSpecialDay(id) {
  if (!confirmAction('削除しますか？')) return;
  await DB.deleteSpecialDay(id); showToast('削除しました'); loadSpecialTab();
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
  var year=parseInt(document.getElementById('payrollYear').value);
  var month=parseInt(document.getElementById('payrollMonth').value);
  var results=await Promise.all([DB.getStaff(),DB.getAttendance({year:year,month:month}),
    DB.getTaxTable('kou'),DB.getInsuranceTable('pension'),
    DB.getInsuranceTable('health'),DB.getInsuranceTable('health_nursing')]);
  var allStaff=results[0],records=results[1],taxKou=results[2];
  var pensionTable=results[3],healthTable=results[4],healthNursingTable=results[5];
  var tbody=document.getElementById('payrollTableBody'); tbody.innerHTML=''; var grandTotal=0;
  allStaff.filter(function(s){return s.is_active;}).forEach(function(staff){
    var staffRecords=records.filter(function(r){return r.staff_id===staff.id;});
    var grossPay=0,totalMins=0,specialCount=0;
    if (staff.type==='hourly') {
      staffRecords.forEach(function(r){
        var mins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc);
        totalMins+=mins; if(r.is_special_day) specialCount++;
        grossPay+=calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||staff.wage,r.is_special_day);
      });
    } else { grossPay=staff.monthly_salary||0; }
    var tax=calcTax(grossPay,taxKou);
    var useHealthTable=(staff.health_table_type==='health_nursing')?healthNursingTable:healthTable;
    var pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
    var health=getInsuranceAmountByGrade(staff.health_grade_id,useHealthTable);
    var emp=staff.employment_insurance||0;
    var socialDeduction=pension+health+emp;
    var netPay=grossPay-tax-socialDeduction;
    grandTotal+=grossPay;
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+staff.name+(staff.health_table_type==='health_nursing'?' 🏥':'')+'</td>'+
      '<td><span class="badge badge-type">'+staffTypeLabel(staff.type)+'</span></td>'+
      '<td>'+(staff.type==='hourly'?formatWorkTime(totalMins):'月額固定')+'</td>'+
      '<td>'+(staff.type==='hourly'?specialCount+'日':'-')+'</td>'+
      '<td>'+formatCurrency(grossPay)+'</td>'+
      '<td>'+formatCurrency(tax)+'</td>'+
      '<td>'+formatCurrency(socialDeduction)+'</td>'+
      '<td><strong>'+formatCurrency(netPay)+'</strong></td>'+
      '<td><button class="btn-sm btn-edit" onclick="showPayslip(\''+staff.id+'\','+year+','+month+')">📄 明細</button></td>';
    tbody.appendChild(tr);
  });
  document.getElementById('payrollGrandTotal').textContent='支給合計: '+formatCurrency(grandTotal);
}

async function showPayslip(staffId, year, month) {
  var results=await Promise.all([DB.getStaff(),DB.getAttendance({year:year,month:month,staff_id:staffId}),
    DB.getTaxTable('kou'),DB.getInsuranceTable('pension'),
    DB.getInsuranceTable('health'),DB.getInsuranceTable('health_nursing')]);
  var allStaff=results[0],records=results[1],taxKou=results[2];
  var pensionTable=results[3],healthTable=results[4],healthNursingTable=results[5];
  var staff=allStaff.find(function(s){return s.id===staffId;}); if (!staff) return;
  var useHealthTable=(staff.health_table_type==='health_nursing')?healthNursingTable:healthTable;
  var grossPay=0,totalMins=0,detailRows='';
  if (staff.type==='hourly') {
    records.forEach(function(r){
      var mins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc); totalMins+=mins;
      var daily=calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||staff.wage,r.is_special_day);
      grossPay+=daily;
      detailRows+='<tr><td>'+formatDateJP(r.date)+'</td><td>'+(r.clock_in_actual||'-')+'</td><td>'+(r.clock_out_actual||'-')+'</td>'+
        '<td>'+(r.clock_in_calc||'-')+'</td><td>'+(r.clock_out_calc||'-')+'</td>'+
        '<td>'+formatWorkTime(mins)+'</td><td>'+(r.is_special_day?'⭐':'')+' '+formatCurrency(r.wage_at_date||staff.wage)+'</td>'+
        '<td>'+formatCurrency(daily)+'</td></tr>';
    });
  } else { grossPay=staff.monthly_salary||0; detailRows='<tr><td colspan="8" style="text-align:center;">月額固定給: '+formatCurrency(grossPay)+'</td></tr>'; }
  var tax=calcTax(grossPay,taxKou);
  var pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
  var health=getInsuranceAmountByGrade(staff.health_grade_id,useHealthTable);
  var emp=staff.employment_insurance||0;
  var netPay=grossPay-tax-pension-health-emp;
  var pensionRow=pensionTable.find(function(r){return r.id===staff.pension_grade_id;});
  var healthRow=useHealthTable.find(function(r){return r.id===staff.health_grade_id;});
  var age=calcAge(staff.birthdate);
  var nursingStr=staff.birthdate?(isNursingCare(staff.birthdate)?'介護保険第2号（40〜64歳）':'介護保険非該当'):'';
  document.getElementById('payslipContent').innerHTML=
    '<div class="payslip"><div class="payslip-header"><h2>給与明細書</h2><p>'+year+'年'+month+'月分</p></div>'+
    '<div class="payslip-info">'+
    '<div><strong>氏名:</strong> '+staff.name+'</div>'+
    '<div><strong>種別:</strong> '+staffTypeLabel(staff.type)+'</div>'+
    (age!==null?'<div><strong>年齢:</strong> '+age+'歳'+(nursingStr?'（'+nursingStr+'）':'')+'</div>':'')+
    (staff.type==='hourly'?'<div><strong>基本時給:</strong> '+formatCurrency(staff.wage)+'</div><div><strong>労働時間:</strong> '+formatWorkTime(totalMins)+'</div>':'')+
    (staff.social_insurance&&pensionRow?'<div><strong>厚生年金等級:</strong> '+pensionRow.label+'（標準報酬 '+formatCurrency(pensionRow.standard)+'）</div>':'')+
    (staff.social_insurance&&healthRow?'<div><strong>健康保険等級:</strong> '+healthRow.label+'（標準報酬 '+formatCurrency(healthRow.standard)+'）</div>':'')+
    '</div>'+
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>日付</th><th>出勤(実)</th><th>退勤(実)</th><th>出勤(計)</th><th>退勤(計)</th><th>労働時間</th><th>時給</th><th>日給</th></tr></thead><tbody>'+detailRows+'</tbody></table></div>'+
    '<div class="payslip-summary">'+
    '<div class="summary-row"><span>支給額（税引前）</span><strong>'+formatCurrency(grossPay)+'</strong></div>'+
    '<div class="summary-row deduction"><span>源泉徴収税</span><span>- '+formatCurrency(tax)+'</span></div>'+
    (pension>0?'<div class="summary-row deduction"><span>厚生年金保険料</span><span>- '+formatCurrency(pension)+'</span></div>':'')+
    (health>0?'<div class="summary-row deduction"><span>健康保険料'+(staff.health_table_type==='health_nursing'?'（介護保険込み）':'')+'</span><span>- '+formatCurrency(health)+'</span></div>':'')+
    (emp>0?'<div class="summary-row deduction"><span>雇用保険料</span><span>- '+formatCurrency(emp)+'</span></div>':'')+
    '<div class="summary-row total"><span>差引支給額</span><strong class="net-pay">'+formatCurrency(netPay)+'</strong></div>'+
    '</div></div>';
  openModal('payslipModal');
}
function printPayslip() { window.print(); }

// ============================================================
// タブ5: 税額表・保険料管理（折りたたみ対応）
// ============================================================
var currentTaxType = 'kou';
var currentInsuranceType = 'pension';
var insuranceTypeLabels = {
  pension: '厚生年金', health: '健康保険（介護なし）',
  health_nursing: '健康保険（介護込み・40〜64歳）', child_support: '子ども・子育て支援金'
};

async function loadTaxTab() {
  loadTaxTable('kou');
  loadInsuranceTable('pension');
}

async function loadTaxTable(type) {
  currentTaxType = type;
  document.querySelectorAll('.tax-type-btn').forEach(function(b){b.classList.toggle('active',b.dataset.type===type);});
  var rows = await DB.getTaxTable(type);
  var tbody = document.getElementById('taxTableBody'); tbody.innerHTML = '';
  rows.slice().sort(function(a,b){return a.income_from-b.income_from;}).forEach(function(r){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+formatCurrency(r.income_from)+' ～</td><td>'+formatCurrency(r.tax_amount)+'</td>'+
      '<td><button class="btn-sm btn-edit" onclick="openTaxEditModal(\''+r.id+'\')">✏️</button> '+
      '<button class="btn-sm btn-delete" onclick="deleteTaxRow(\''+r.id+'\')">🗑️</button></td>';
    tbody.appendChild(tr);
  });
  // タイトル更新してテーブルを自動展開
  var title = type === 'kou' ? '甲欄' : '乙欄';
  document.getElementById('taxTableTitle').textContent = '📄 ' + title + ' 税額一覧（' + rows.length + '件）';
  openCollapsible('taxTableSection');
}

async function loadInsuranceTable(type) {
  currentInsuranceType = type;
  document.querySelectorAll('.insurance-type-btn').forEach(function(b){b.classList.toggle('active',b.dataset.type===type);});
  var rows = await DB.getInsuranceTable(type);
  var tbody = document.getElementById('insuranceTableBody'); tbody.innerHTML = '';
  rows.slice().sort(function(a,b){return a.grade-b.grade;}).forEach(function(r){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+r.label+'</td><td>'+formatCurrency(r.standard)+'</td>'+
      '<td>'+formatCurrency(r.monthly_min)+' 〜 '+(r.monthly_max>=999999?'上限なし':formatCurrency(r.monthly_max))+'</td>'+
      '<td>'+formatCurrency(r.employee)+'</td><td>'+formatCurrency(r.employer)+'</td>';
    tbody.appendChild(tr);
  });
  // タイトル更新してテーブルを自動展開
  document.getElementById('insuranceTableTitle').textContent = '📄 ' + (insuranceTypeLabels[type] || type) + ' 保険料一覧（' + rows.length + '件）';
  openCollapsible('insuranceTableSection');
}

function openTaxCsvModal() {
  document.getElementById('taxCsvType').value = currentTaxType;
  document.getElementById('taxCsvFile').value = '';
  document.getElementById('taxCsvPreview').style.display = 'none';
  document.getElementById('taxCsvPreviewBody').innerHTML = '';
  openModal('taxCsvModal');
}
var taxCsvParsed = [];
async function previewTaxCsv() {
  var file=document.getElementById('taxCsvFile').files[0];
  if (!file) { showToast('ファイルを選択してください', 'error'); return; }
  var text=await file.text();
  var lines=text.split('\n').filter(function(l){return l.trim();});
  taxCsvParsed=[];
  var tbody=document.getElementById('taxCsvPreviewBody'); tbody.innerHTML='';
  var first=lines[0].split(',')[0];
  var dataLines=(isNaN(parseInt(first))||lines[0].indexOf('月収')>=0||lines[0].indexOf('income')>=0)?lines.slice(1):lines;
  for (var i=0;i<dataLines.length;i++) {
    var cols=dataLines[i].split(',').map(function(c){return c.trim().replace(/["\u00a5]/g,'');});
    if (cols.length<2) continue;
    var income_from=parseInt(cols[0]),tax_amount=parseInt(cols[1]);
    if (isNaN(income_from)||isNaN(tax_amount)) continue;
    taxCsvParsed.push({income_from:income_from,tax_amount:tax_amount});
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+formatCurrency(income_from)+' ～</td><td>'+formatCurrency(tax_amount)+'</td>';
    tbody.appendChild(tr);
  }
  document.getElementById('taxCsvPreview').style.display='block';
  document.getElementById('taxCsvCount').textContent=taxCsvParsed.length+'行読み込み済み';
}
async function importTaxCsv() {
  if (!taxCsvParsed.length) { showToast('データがありません', 'error'); return; }
  var type=document.getElementById('taxCsvType').value;
  if (!confirmAction(taxCsvParsed.length+'行で税額表（'+(type==='kou'?'甲欄':'乙欄')+'）を上書きしますか？')) return;
  await DB.replaceTaxTable(type,taxCsvParsed.map(function(r){return Object.assign({},r,{id:_uid()});}));
  closeModal('taxCsvModal'); showToast('税額表を更新しました'); loadTaxTable(type);
}
function downloadTaxCsvTemplate() {
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['月収以上,税額\n88000,130\n89000,220'],{type:'text/csv;charset=utf-8;'}));
  a.download='tax_template.csv'; a.click();
}

function openInsuranceCsvModal() {
  document.getElementById('insuranceCsvType').value = currentInsuranceType;
  document.getElementById('insuranceCsvFile').value = '';
  document.getElementById('insuranceCsvPreview').style.display = 'none';
  document.getElementById('insuranceCsvPreviewBody').innerHTML = '';
  openModal('insuranceCsvModal');
}
var insuranceCsvParsed = [];
async function previewInsuranceCsv() {
  var file=document.getElementById('insuranceCsvFile').files[0];
  if (!file) { showToast('ファイルを選択してください', 'error'); return; }
  var text=await file.text();
  var lines=text.split('\n').filter(function(l){return l.trim();});
  insuranceCsvParsed=[];
  var tbody=document.getElementById('insuranceCsvPreviewBody'); tbody.innerHTML='';
  var first=lines[0].split(',')[0];
  var dataLines=isNaN(parseInt(first))?lines.slice(1):lines;
  var grade=1;
  for (var i=0;i<dataLines.length;i++) {
    var cols=dataLines[i].split(',').map(function(c){return c.trim().replace(/["\u00a5円,]/g,'');});
    if (cols.length<4) continue;
    var standard=parseInt(cols[1])||parseInt(cols[0]);
    var monthly_min=parseInt(cols[2])||0;
    var monthly_max=parseInt(cols[3])||999999;
    var employee=parseInt(cols[4])||parseInt(cols[2]);
    var employer=parseInt(cols[5])||employee;
    if (isNaN(standard)||isNaN(employee)) continue;
    var label=grade+'等級';
    insuranceCsvParsed.push({grade:grade,label:label,standard:standard,monthly_min:monthly_min,monthly_max:monthly_max,employee:employee,employer:employer});
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+label+'</td><td>'+formatCurrency(standard)+'</td><td>'+formatCurrency(employee)+'</td>';
    tbody.appendChild(tr); grade++;
  }
  document.getElementById('insuranceCsvPreview').style.display='block';
  document.getElementById('insuranceCsvCount').textContent=insuranceCsvParsed.length+'等級分読み込み済み';
}
async function importInsuranceCsv() {
  if (!insuranceCsvParsed.length) { showToast('データがありません', 'error'); return; }
  var type=document.getElementById('insuranceCsvType').value;
  var label=insuranceTypeLabels[type]||type;
  if (!confirmAction(insuranceCsvParsed.length+'等級で'+label+'料額表を上書きしますか？')) return;
  await DB.replaceInsuranceTable(type,insuranceCsvParsed.map(function(r){return Object.assign({},r,{id:_uid()});}));
  closeModal('insuranceCsvModal'); showToast(label+'料額表を更新しました'); loadInsuranceTable(type);
  _pensionTable=[]; _healthTable=[]; _healthNursingTable=[];
}
function downloadInsuranceCsvTemplate() {
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['等級,標準報酬月額,月収下限,月収上限,被保険者負担,事業主負担\n1,88000,0,93000,8052,8052'],{type:'text/csv;charset=utf-8;'}));
  a.download='insurance_template.csv'; a.click();
}

async function openTaxModal(id) {
  document.getElementById('taxId').value=id||'';
  document.getElementById('taxIncomeFrom').value='';
  document.getElementById('taxAmount').value='';
  if (id) {
    var rows=await DB.getTaxTable(currentTaxType);
    var row=rows.find(function(r){return r.id===id;});
    if (row){document.getElementById('taxIncomeFrom').value=row.income_from;document.getElementById('taxAmount').value=row.tax_amount;}
  }
  openModal('taxModal');
}
function openTaxEditModal(id){openTaxModal(id);}
async function saveTaxRow() {
  var id=document.getElementById('taxId').value;
  var income_from=parseInt(document.getElementById('taxIncomeFrom').value);
  var tax_amount=parseInt(document.getElementById('taxAmount').value);
  if (isNaN(income_from)||isNaN(tax_amount)){showToast('金額を正しく入力してください','error');return;}
  var row={income_from:income_from,tax_amount:tax_amount}; if(id) row.id=id;
  await DB.saveTaxRow(currentTaxType,row); closeModal('taxModal'); showToast('保存しました'); loadTaxTable(currentTaxType);
}
async function deleteTaxRow(id) {
  if (!confirmAction('この行を削除しますか？')) return;
  await DB.deleteTaxRow(currentTaxType,id); showToast('削除しました'); loadTaxTable(currentTaxType);
}

// ============================================================
// タブ6: 有休管理
// ============================================================
async function loadLeaveTab() {
  var staff=await DB.getStaff();
  var sel=document.getElementById('leaveStaffSelect'); var currentVal=sel.value;
  sel.innerHTML='<option value="">全スタッフ</option>';
  staff.filter(function(s){return s.is_active;}).forEach(function(s){
    var opt=document.createElement('option');opt.value=s.id;opt.textContent=s.name;
    if(s.id===currentVal)opt.selected=true;sel.appendChild(opt);
  });
  await loadLeaveList();
}
async function loadLeaveList() {
  var staffId=document.getElementById('leaveStaffSelect').value;
  var staff=await DB.getStaff();
  var tbody=document.getElementById('leaveTableBody');
  var leaveData=await DB.getLeaveAll();
  if (!staffId) {
    document.getElementById('leaveDetailSection').style.display='none';
    tbody.closest('table').querySelector('thead tr').innerHTML='<th>スタッフ</th><th>付与日数</th><th>使用日数</th><th>残日数</th><th>詳細</th>';
    tbody.innerHTML='';
    staff.filter(function(s){return s.is_active;}).forEach(function(s){
      var leaves=leaveData.filter(function(l){return l.staff_id===s.id;});
      var granted=leaves.filter(function(l){return l.type==='grant';}).reduce(function(sum,l){return sum+(l.days||0);},0);
      var used=leaves.filter(function(l){return l.type==='use';}).reduce(function(sum,l){return sum+(l.days||0);},0);
      var remaining=granted-used;
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+s.name+'</td><td>'+granted+'日</td><td>'+used+'日</td>'+
        '<td><strong style="color:'+(remaining<3?'#dc2626':'#16a34a')+'">'+remaining+'日</strong></td>'+
        '<td><button class="btn-sm btn-edit" onclick="selectLeaveStaff(\''+s.id+'\')">詳細</button></td>';
      tbody.appendChild(tr);
    });
    if (!staff.filter(function(s){return s.is_active;}).length) tbody.innerHTML='<tr><td colspan="5" class="empty-cell">スタッフが登録されていません</td></tr>';
    return;
  }
  var s=staff.find(function(x){return x.id===staffId;});
  var leaves=leaveData.filter(function(l){return l.staff_id===staffId;});
  var granted=leaves.filter(function(l){return l.type==='grant';}).reduce(function(sum,l){return sum+(l.days||0);},0);
  var used=leaves.filter(function(l){return l.type==='use';}).reduce(function(sum,l){return sum+(l.days||0);},0);
  var remaining=granted-used;
  document.getElementById('leaveDetailSection').style.display='block';
  document.getElementById('leaveStaffName').textContent=s?s.name:'';
  document.getElementById('leaveGranted').textContent=granted+'日';
  document.getElementById('leaveUsed').textContent=used+'日';
  document.getElementById('leaveRemaining').textContent=remaining+'日';
  document.getElementById('leaveRemaining').style.color=remaining<3?'#dc2626':'#16a34a';
  tbody.closest('table').querySelector('thead tr').innerHTML='<th>日付</th><th>種別</th><th>日数</th><th>理由</th><th>操作</th>';
  tbody.innerHTML='';
  leaves.slice().sort(function(a,b){return a.date>b.date?-1:1;}).forEach(function(l){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+formatDateJP(l.date)+'</td>'+
      '<td><span class="badge '+(l.type==='grant'?'badge-active':'badge-special')+'">'+(l.type==='grant'?'付与':'使用')+'</span></td>'+
      '<td>'+l.days+'日</td><td>'+(l.reason||'-')+'</td>'+
      '<td><button class="btn-sm btn-delete" onclick="deleteLeave(\''+l.id+'\')">🗑️ 削除</button></td>';
    tbody.appendChild(tr);
  });
  if (!leaves.length) tbody.innerHTML='<tr><td colspan="5" class="empty-cell">有休記録がありません</td></tr>';
}
function selectLeaveStaff(staffId){document.getElementById('leaveStaffSelect').value=staffId;loadLeaveList();}
async function openLeaveModal() {
  var staffId=document.getElementById('leaveStaffSelect').value;
  var staff=await DB.getStaff(); var sel=document.getElementById('leaveModalStaff'); sel.innerHTML='';
  staff.filter(function(s){return s.is_active;}).forEach(function(s){
    var opt=document.createElement('option');opt.value=s.id;opt.textContent=s.name;
    if(s.id===staffId)opt.selected=true;sel.appendChild(opt);
  });
  document.getElementById('leaveDate').value=todayStr();
  document.getElementById('leaveType').value='grant';
  document.getElementById('leaveDays').value='1';
  document.getElementById('leaveReason').value='';
  openModal('leaveModal');
}
async function saveLeave() {
  var staff_id=document.getElementById('leaveModalStaff').value;
  var date=document.getElementById('leaveDate').value;
  var type=document.getElementById('leaveType').value;
  var days=parseFloat(document.getElementById('leaveDays').value)||0;
  var reason=document.getElementById('leaveReason').value.trim();
  if (!staff_id||!date||days<=0){showToast('スタッフ・日付・日数を正しく入力してください','error');return;}
  await DB.saveLeave({staff_id:staff_id,date:date,type:type,days:days,reason:reason});
  closeModal('leaveModal'); showToast('保存しました'); loadLeaveList();
}
async function deleteLeave(id) {
  if (!confirmAction('この有休記録を削除しますか？')) return;
  await DB.deleteLeave(id); showToast('削除しました'); loadLeaveList();
}

function _uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
