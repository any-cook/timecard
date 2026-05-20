var allStaff = [];
var selectedStaff = null;
var inputNumber = '';
var todayRecord = null; // 本日の打刻レコードをキャッシュ

async function initClock() {
  startClock();
  allStaff = await DB.getStaff();
  allStaff = allStaff.filter(function(s){ return s.is_active && s.type !== 'officer'; });
  resetNumberInput();
}

function startClock() {
  function update() {
    var now = new Date();
    document.getElementById('clockDisplay').textContent =
      String(now.getHours()).padStart(2,'0') + ':' +
      String(now.getMinutes()).padStart(2,'0') + ':' +
      String(now.getSeconds()).padStart(2,'0');
    var days = ['日','月','火','水','木','金','土'];
    document.getElementById('dateDisplay').textContent =
      now.getFullYear()+'年'+(now.getMonth()+1)+'月'+now.getDate()+'日（'+days[now.getDay()]+'）';
  }
  update();
  setInterval(update, 1000);
}

function resetNumberInput() {
  inputNumber = '';
  selectedStaff = null;
  todayRecord = null;
  document.getElementById('staffSelectSection').style.display = 'block';
  document.getElementById('confirmSection').style.display = 'none';
  document.getElementById('clockActionSection').style.display = 'none';
  document.getElementById('numberError').textContent = '';
  document.getElementById('btnConfirm').disabled = true;
  updateNumberDisplay();
}

function numPress(val) {
  if (inputNumber.length >= 4) return;
  inputNumber += val;
  updateNumberDisplay();
  document.getElementById('numberError').textContent = '';
  document.getElementById('btnConfirm').disabled = inputNumber.length === 0;
}

function numDelete() {
  inputNumber = inputNumber.slice(0, -1);
  updateNumberDisplay();
  document.getElementById('btnConfirm').disabled = inputNumber.length === 0;
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

function confirmNumber() {
  if (!inputNumber) return;
  // 前ゼロあり・なし・数値型・文字列型・スペースすべてに対応
  var inputTrimmed = inputNumber.replace(/^0+/, '') || '0';
  var found = allStaff.find(function(s) {
    var sn = String(s.staff_number != null ? s.staff_number : '').trim();
    var snTrimmed = sn.replace(/^0+/, '') || '0';
    return sn === inputNumber ||       // 完全一致（"001" === "001"）
           snTrimmed === inputTrimmed; // 前ゼロ除去後一致（"001" === "1"）
  });
  if (!found) {
    document.getElementById('numberError').textContent = '❌ 登録番号が見つかりません。もう一度入力してください。';
    inputNumber = '';
    updateNumberDisplay();
    document.getElementById('btnConfirm').disabled = true;
    return;
  }
  selectedStaff = found;
  document.getElementById('confirmName').textContent = '👤 ' + found.name + ' さん';
  document.getElementById('confirmNumberLabel').textContent = '登録番号: ' + (found.staff_number || inputNumber);
  document.getElementById('staffSelectSection').style.display = 'none';
  document.getElementById('confirmSection').style.display = 'block';
}

function backToNumberInput() { resetNumberInput(); }

async function goToClockAction() {
  if (!selectedStaff) return;
  document.getElementById('confirmSection').style.display = 'none';
  document.getElementById('clockActionSection').style.display = 'block';
  document.getElementById('selectedStaffName').textContent = selectedStaff.name;
  document.getElementById('selectedStaffNumber').textContent = '登録番号: ' + (selectedStaff.staff_number || '-');
  await updateClockStatus();
}

// ============================================================
// 本日のレコードを取得（year/monthフィルターなしでstaff_idのみ）
// ============================================================
async function fetchTodayRecord() {
  var today = todayStr();
  var now = new Date();
  // year+monthで絞り込み → JS側でstaff_idとdateを絞る（インデックス不要）
  var records = await DB.getAttendance({ year: now.getFullYear(), month: now.getMonth()+1 });
  var r = records.find(function(x) { return x.staff_id === selectedStaff.id && x.date === today; });
  todayRecord = r || null;
  return todayRecord;
}

async function updateClockStatus() {
  if (!selectedStaff) return;
  var r = await fetchTodayRecord();
  var statusEl = document.getElementById('clockStatus');
  var btnIn  = document.getElementById('btnClockIn');
  var btnOut = document.getElementById('btnClockOut');
  btnIn.innerHTML  = '<span class="btn-icon">🟢</span>出 勤';
  btnOut.innerHTML = '<span class="btn-icon">🔴</span>退 勤';

  if (!r || !r.clock_in_actual) {
    statusEl.innerHTML = '<span class="status-badge status-out">未出勤</span>';
    btnIn.disabled  = false;
    btnOut.disabled = true;
  } else if (!r.clock_out_actual) {
    statusEl.innerHTML =
      '<span class="status-badge status-in">出勤中</span>' +
      '<div style="font-size:.85rem;color:var(--text-muted);margin-top:6px;">出勤: ' + r.clock_in_actual + '</div>';
    btnIn.disabled  = true;
    btnOut.disabled = false;
  } else {
    statusEl.innerHTML =
      '<span class="status-badge status-done">退勤済み</span>' +
      '<div style="font-size:.85rem;color:var(--text-muted);margin-top:6px;">出勤: ' + r.clock_in_actual + '　退勤: ' + r.clock_out_actual + '</div>';
    btnIn.disabled  = true;
    btnOut.disabled = true;
  }
}

// ============================================================
// 出勤
// ============================================================
async function clockIn() {
  if (!selectedStaff) return;
  var btn = document.getElementById('btnClockIn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span>処理中...';

  var now    = nowTimeStr();
  var today  = todayStr();
  var specialDays = await DB.getSpecialDays();
  var isSpecial   = isSpecialDay(today, specialDays);

  var saved = await DB.saveAttendance({
    staff_id:        selectedStaff.id,
    date:            today,
    clock_in_actual: now,
    clock_in_calc:   roundUpClockIn(now),
    clock_out_actual: null,
    clock_out_calc:   null,
    wage_at_date:    selectedStaff.wage || 0,
    is_special_day:  isSpecial,
    notes:           ''
  });
  // 保存結果をキャッシュ（退勤時にIDが必要）
  if (saved && saved.id) todayRecord = saved;

  showPunchMessage('✅ 出勤しました！', now, '#16a34a');
  await updateClockStatus();
}

// ============================================================
// 退勤（キャッシュした todayRecord を使って確実に上書き）
// ============================================================
async function clockOut() {
  if (!selectedStaff) return;
  var btn = document.getElementById('btnClockOut');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span>処理中...';

  var now   = nowTimeStr();
  var today = todayStr();

  // キャッシュを使う。なければ再取得
  var r = todayRecord;
  if (!r || r.date !== today) {
    r = await fetchTodayRecord();
  }

  if (r && r.id) {
    // 既存レコードを上書き
    var updated = Object.assign({}, r, {
      clock_out_actual: now,
      clock_out_calc:   roundDownClockOut(now)
    });
    await DB.saveAttendance(updated);
    showPunchMessage('✅ 退勤しました！', now, '#dc2626');
  } else {
    // レコードが見つからない場合（エラー表示）
    showPunchMessage('⚠️ 出勤データが見つかりません', '', '#dc2626');
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔴</span>退 勤';
    return;
  }

  await updateClockStatus();
  setTimeout(function() { backToNumberInput(); }, 3000);
}

function showPunchMessage(msg, time, color) {
  document.getElementById('clockStatus').innerHTML =
    '<div style="text-align:center;">' +
    '<div style="font-size:1.4rem;font-weight:900;color:' + color + ';margin-bottom:4px;">' + msg + '</div>' +
    (time ? '<div style="font-size:1.1rem;color:var(--text-muted);">' + time + '</div>' : '') +
    '</div>';
}

function isSpecialDay(dateStr, specialDays) {
  var day = new Date(dateStr).getDay();
  if (day === 0 || day === 5 || day === 6) return true;
  return specialDays.some(function(s) { return s.date === dateStr; });
}
