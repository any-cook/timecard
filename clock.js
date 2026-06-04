var allStaff = [];
var selectedStaff = null;
var inputNumber = '';
var cachedRecord = null; // 出勤時に保存したレコード（IDを保持）

// ============================================================
// 初期化
// ============================================================
async function initClock() {
  startClock();
  allStaff = await DB.getStaff();
  allStaff = allStaff.filter(function(s) {
    return s.is_active && s.type !== 'officer';
  });
  resetNumberInput();
}

// ============================================================
// 時計
// ============================================================
function startClock() {
  function update() {
    var now = new Date();
    document.getElementById('clockDisplay').textContent =
      String(now.getHours()).padStart(2,'0') + ':' +
      String(now.getMinutes()).padStart(2,'0') + ':' +
      String(now.getSeconds()).padStart(2,'0');
    var days = ['日','月','火','水','木','金','土'];
    document.getElementById('dateDisplay').textContent =
      now.getFullYear() + '年' + (now.getMonth()+1) + '月' +
      now.getDate() + '日（' + days[now.getDay()] + '）';
  }
  update();
  setInterval(update, 1000);
}

// ============================================================
// 番号入力
// ============================================================
function resetNumberInput() {
  inputNumber = '';
  selectedStaff = null;
  cachedRecord = null;
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
  document.getElementById('btnConfirm').disabled = false;
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
  var inputTrimmed = inputNumber.replace(/^0+/, '') || '0';
  var found = allStaff.find(function(s) {
    var sn = String(s.staff_number != null ? s.staff_number : '').trim();
    var snTrimmed = sn.replace(/^0+/, '') || '0';
    return sn === inputNumber || snTrimmed === inputTrimmed;
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
  document.getElementById('selectedStaffNumber').textContent =
    '登録番号: ' + (selectedStaff.staff_number || '-');
  await updateClockStatus();
}

// ============================================================
// 今日のレコードを取得（最も確実な方法）
// ============================================================
async function getTodayRecord() {
  var today = todayStr();
  var now = new Date();

  // キャッシュが今日のものなら使う
  if (cachedRecord && cachedRecord.date === today && cachedRecord.staff_id === selectedStaff.id) {
    return cachedRecord;
  }

  // Firestoreから: 年月フィルターで取得してJS側でスタッフ・日付を絞る
  try {
    var records = await DB.getAttendance({
      year: now.getFullYear(),
      month: now.getMonth() + 1
    });
    var r = records.find(function(x) {
      return x.staff_id === selectedStaff.id && x.date === today;
    });
    if (r) cachedRecord = r;
    return r || null;
  } catch(e) {
    console.error('getAttendance error:', e);
    return null;
  }
}

// ============================================================
// 打刻状況表示
// ============================================================
async function updateClockStatus() {
  if (!selectedStaff) return;

  var r = await getTodayRecord();
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
      '<div style="font-size:.85rem;color:var(--text-muted);margin-top:6px;">' +
      '出勤: ' + r.clock_in_actual + '　退勤: ' + r.clock_out_actual + '</div>';
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

  try {
    var now   = nowTimeStr();
    var today = todayStr();
    var specialDays = await DB.getSpecialDays();
    var isSpecial   = isSpecialDay(today, specialDays);

    var newRecord = {
      staff_id:         selectedStaff.id,
      date:             today,
      clock_in_actual:  now,
      clock_in_calc:    roundUpClockIn(now),
      clock_out_actual: null,
      clock_out_calc:   null,
      wage_at_date:     selectedStaff.wage || 0,
      is_special_day:   isSpecial,
      notes:            ''
    };

    var saved = await DB.saveAttendance(newRecord);
    // 保存結果（IDつき）をキャッシュ
    cachedRecord = saved || newRecord;

    await updateClockStatus();
    showPunchMessage('✅ 出勤しました！', now, '#16a34a', '本日もよろしくお願い致します。😊');

  } catch(e) {
    console.error('clockIn error:', e);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🟢</span>出 勤';
    showPunchMessage('⚠️ エラーが発生しました', '', '#dc2626');
  }
}

// ============================================================
// 退勤
// ============================================================
async function clockOut() {
  if (!selectedStaff) return;
  var btn = document.getElementById('btnClockOut');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span>処理中...';

  try {
    var now   = nowTimeStr();
    var today = todayStr();

    // 必ず最新のレコードを取得（キャッシュを無効化して再取得）
    cachedRecord = null;
    var r = await getTodayRecord();

    if (!r) {
      showPunchMessage('⚠️ 出勤データが見つかりません', '', '#dc2626');
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">🔴</span>退 勤';
      return;
    }

    // 退勤情報を上書き保存
    var updated = {
      id:               r.id,
      staff_id:         r.staff_id,
      date:             r.date,
      clock_in_actual:  r.clock_in_actual,
      clock_in_calc:    r.clock_in_calc,
      clock_out_actual: now,
      clock_out_calc:   now, // 分単位そのまま（繰り上げ・繰り下げなし）
      wage_at_date:     r.wage_at_date,
      is_special_day:   r.is_special_day,
      notes:            r.notes || ''
    };

    await DB.saveAttendance(updated);
    cachedRecord = updated;

    await updateClockStatus();
    showPunchMessage('✅ 退勤しました！', now, '#dc2626', '本日もご苦労様でした。🌸');

    // 3秒後に番号入力画面へ戻る
    setTimeout(function() { backToNumberInput(); }, 3000);

  } catch(e) {
    console.error('clockOut error:', e);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔴</span>退 勤';
    showPunchMessage('⚠️ エラーが発生しました', '', '#dc2626');
  }
}

// ============================================================
// メッセージ表示
// ============================================================
function showPunchMessage(msg, time, color, subMsg) {
  document.getElementById('clockStatus').innerHTML =
    '<div style="text-align:center;padding:10px 0;">' +
    '<div style="font-size:1.5rem;font-weight:900;color:' + color + ';margin-bottom:8px;">' + msg + '</div>' +
    (time ? '<div style="font-size:1.15rem;font-weight:700;color:#555;margin-bottom:14px;">' + time + '</div>' : '') +
    (subMsg ?
      '<div style="font-size:1.1rem;font-weight:800;' +
      'color:#fff;background:' + color + ';' +
      'border-radius:16px;padding:12px 24px;' +
      'display:inline-block;letter-spacing:0.02em;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.15);">' +
      subMsg + '</div>'
      : '') +
    '</div>';
}

// ============================================================
// 特別日判定
// ============================================================
function isSpecialDay(dateStr, specialDays) {
  var day = new Date(dateStr).getDay();
  if (day === 0 || day === 5 || day === 6) return true;
  return specialDays.some(function(s) { return s.date === dateStr; });
}
