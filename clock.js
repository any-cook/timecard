var allStaff = [];
var selectedStaff = null;
var inputNumber = '';

async function initClock() {
  startClock();
  allStaff = await DB.getStaff();
  allStaff = allStaff.filter(function(s) {
    return s.is_active && s.type !== 'officer';
  });
  resetNumberInput();
}

function startClock() {
  function update() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    var s = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('clockDisplay').textContent = h + ':' + m + ':' + s;
    var days = ['日','月','火','水','木','金','土'];
    document.getElementById('dateDisplay').textContent =
      now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日（' + days[now.getDay()] + '）';
  }
  update();
  setInterval(update, 1000);
}

function resetNumberInput() {
  inputNumber = '';
  updateNumberDisplay();
  document.getElementById('staffNamePreview').textContent = '';
  document.getElementById('staffNamePreview').className = 'staff-name-preview';
  document.getElementById('btnConfirm').disabled = true;
}

function numPress(val) {
  if (inputNumber.length >= 4) return;
  inputNumber += val;
  updateNumberDisplay();
  lookupStaff();
}

function numDelete() {
  inputNumber = inputNumber.slice(0, -1);
  updateNumberDisplay();
  lookupStaff();
}

function numClear() { resetNumberInput(); }

function updateNumberDisplay() {
  var el = document.getElementById('numberDisplay');
  if (!inputNumber) {
    el.textContent = '登録番号を入力';
    el.className = 'number-display placeholder';
  } else {
    el.textContent = inputNumber;
    el.className = 'number-display';
  }
}

function lookupStaff() {
  var previewEl = document.getElementById('staffNamePreview');
  var confirmBtn = document.getElementById('btnConfirm');
  if (!inputNumber) {
    previewEl.textContent = '';
    previewEl.className = 'staff-name-preview';
    confirmBtn.disabled = true;
    return;
  }
  var found = allStaff.find(function(s) {
    return String(s.staff_number) === inputNumber ||
           String(parseInt(s.staff_number||'0')) === String(parseInt(inputNumber));
  });
  if (found) {
    previewEl.textContent = '👤 ' + found.name + ' さん';
    previewEl.className = 'staff-name-preview';
    confirmBtn.disabled = false;
    selectedStaff = found;
  } else {
    previewEl.textContent = '❌ 登録番号が見つかりません';
    previewEl.className = 'staff-name-preview error';
    confirmBtn.disabled = true;
    selectedStaff = null;
  }
}

async function confirmStaff() {
  if (!selectedStaff) return;
  document.getElementById('staffSelectSection').style.display = 'none';
  document.getElementById('clockActionSection').style.display = 'block';
  document.getElementById('selectedStaffName').textContent = selectedStaff.name;
  document.getElementById('selectedStaffNumber').textContent = '登録番号: ' + (selectedStaff.staff_number || '-');
  await updateClockStatus();
}

function backToNumberInput() {
  selectedStaff = null;
  document.getElementById('clockActionSection').style.display = 'none';
  document.getElementById('staffSelectSection').style.display = 'block';
  resetNumberInput();
}

async function updateClockStatus() {
  if (!selectedStaff) return;
  var today = todayStr();
  var records = await DB.getAttendance({ staff_id: selectedStaff.id });
  var todayRecord = records.find(function(r) { return r.date === today; });
  var statusEl = document.getElementById('clockStatus');
  var btnIn = document.getElementById('btnClockIn');
  var btnOut = document.getElementById('btnClockOut');
  btnIn.textContent = ''; btnIn.innerHTML = '<span class="btn-icon">🟢</span>出 勤';
  btnOut.textContent = ''; btnOut.innerHTML = '<span class="btn-icon">🔴</span>退 勤';
  if (!todayRecord || !todayRecord.clock_in_actual) {
    statusEl.innerHTML = '<span class="status-badge status-out">未出勤</span>';
    btnIn.disabled = false; btnOut.disabled = true;
  } else if (todayRecord.clock_in_actual && !todayRecord.clock_out_actual) {
    statusEl.innerHTML = '<span class="status-badge status-in">出勤中</span>' +
      '<div style="font-size:0.85rem;color:var(--text-muted);margin-top:6px;">出勤: ' + todayRecord.clock_in_actual + '</div>';
    btnIn.disabled = true; btnOut.disabled = false;
  } else {
    statusEl.innerHTML = '<span class="status-badge status-done">退勤済み</span>' +
      '<div style="font-size:0.85rem;color:var(--text-muted);margin-top:6px;">出勤: ' + todayRecord.clock_in_actual + '　退勤: ' + todayRecord.clock_out_actual + '</div>';
    btnIn.disabled = true; btnOut.disabled = true;
  }
}

async function clockIn() {
  if (!selectedStaff) return;
  var btn = document.getElementById('btnClockIn');
  btn.disabled = true; btn.innerHTML = '<span class="btn-icon">⏳</span>処理中...';
  var now = nowTimeStr(), today = todayStr();
  var specialDays = await DB.getSpecialDays();
  var isSpecial = isSpecialDay(today, specialDays);
  await DB.saveAttendance({
    staff_id: selectedStaff.id, date: today,
    clock_in_actual: now, clock_in_calc: roundUpClockIn(now),
    clock_out_actual: null, clock_out_calc: null,
    wage_at_date: selectedStaff.wage || 0, is_special_day: isSpecial, notes: ''
  });
  showPunchMessage('✅ 出勤しました！', now, '#16a34a');
  await updateClockStatus();
}

async function clockOut() {
  if (!selectedStaff) return;
  var btn = document.getElementById('btnClockOut');
  btn.disabled = true; btn.innerHTML = '<span class="btn-icon">⏳</span>処理中...';
  var now = nowTimeStr(), today = todayStr();
  var records = await DB.getAttendance({ staff_id: selectedStaff.id });
  var todayRecord = records.find(function(r) { return r.date === today; });
  if (todayRecord) {
    todayRecord.clock_out_actual = now;
    todayRecord.clock_out_calc = roundDownClockOut(now);
    await DB.saveAttendance(todayRecord);
  }
  showPunchMessage('✅ 退勤しました！', now, '#dc2626');
  await updateClockStatus();
  setTimeout(function() { backToNumberInput(); }, 3000);
}

function showPunchMessage(message, time, color) {
  document.getElementById('clockStatus').innerHTML =
    '<div style="text-align:center;">' +
    '<div style="font-size:1.4rem;font-weight:900;color:' + color + ';margin-bottom:4px;">' + message + '</div>' +
    '<div style="font-size:1.1rem;color:var(--text-muted);">' + time + '</div>' +
    '</div>';
}

function isSpecialDay(dateStr, specialDays) {
  var d = new Date(dateStr), day = d.getDay();
  if (day === 5 || day === 6 || day === 0) return true;
  return specialDays.some(function(s) { return s.date === dateStr; });
}
