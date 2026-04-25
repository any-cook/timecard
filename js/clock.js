let clockStaffList = [];
let selectedStaff = null;
let clockInterval = null;
let manualSpecialDays = [];

async function initClock() {
  clockStaffList = (await DB.getStaff()).filter(s => s.is_active);
  manualSpecialDays = await DB.getSpecialDays();
  renderStaffButtons();
  startClock();
}

function startClock() {
  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    const days = ['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'];
    const el = document.getElementById('clockDisplay');
    const dateEl = document.getElementById('dateDisplay');
    if (el) el.textContent = `${h}:${m}:${s}`;
    if (dateEl) {
      dateEl.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${days[now.getDay()]}`;
    }
  }
  update();
  clockInterval = setInterval(update, 1000);
}

function renderStaffButtons() {
  const container = document.getElementById('staffButtons');
  if (!container) return;
  container.innerHTML = '';
  clockStaffList.forEach(staff => {
    const btn = document.createElement('button');
    btn.className = 'staff-btn';
    btn.textContent = staff.name;
    btn.onclick = () => selectStaff(staff);
    container.appendChild(btn);
  });
}

async function selectStaff(staff) {
  selectedStaff = staff;
  const today = todayStr();
  const allRecords = await DB.getAttendance({});
  const todayRecord = allRecords.find(r => r.staff_id === staff.id && r.date === today);
  document.getElementById('staffSelectSection').style.display = 'none';
  document.getElementById('clockActionSection').style.display = 'block';
  document.getElementById('selectedStaffName').textContent = staff.name;
  renderClockStatus(todayRecord);
}

function renderClockStatus(record) {
  const statusEl = document.getElementById('clockStatus');
  const btnIn = document.getElementById('btnClockIn');
  const btnOut = document.getElementById('btnClockOut');
  const btnBreak = document.getElementById('btnBreak');
  if (!record) {
    statusEl.innerHTML = '<span class="status-badge status-out">未出勤</span>';
    btnIn.disabled = false;
    btnOut.disabled = true;
    btnBreak.disabled = true;
  } else if (record.clock_in_actual && !record.clock_out_actual) {
    statusEl.innerHTML = `<span class="status-badge status-in">出勤中</span><span class="status-time">出勤: ${record.clock_in_actual}</span>`;
    btnIn.disabled = true;
    btnOut.disabled = false;
    btnBreak.disabled = false;
  } else if (record.clock_out_actual) {
    statusEl.innerHTML = `<span class="status-badge status-done">退勤済み</span><span class="status-time">${record.clock_in_actual} ～ ${record.clock_out_actual}</span>`;
    btnIn.disabled = true;
    btnOut.disabled = true;
    btnBreak.disabled = true;
  }
}

async function clockIn() {
  if (!selectedStaff) return;
  const now = nowTimeStr();
  const today = todayStr();
  const allRecords = await DB.getAttendance({});
  const existing = allRecords.find(r => r.staff_id === selectedStaff.id && r.date === today);
  if (existing) { showToast('本日はすでに出勤打刻済みです', 'error'); return; }
  const isSpecial = await isSpecialDay(today, manualSpecialDays);
  const wage = selectedStaff.type === 'hourly' ? selectedStaff.wage : 0;
  const record = {
    staff_id: selectedStaff.id,
    date: today,
    clock_in_actual: now,
    clock_in_calc: roundUpClockIn(now),
    clock_out_actual: null,
    clock_out_calc: null,
    wage_at_date: wage,
    is_special_day: isSpecial,
    notes: ''
  };
  await DB.saveAttendance(record);
  showToast(`${selectedStaff.name} さん、おはようございます！`);
  renderClockStatus(record);
}

async function clockOut() {
  if (!selectedStaff) return;
  const now = nowTimeStr();
  const today = todayStr();
  const allRecords = await DB.getAttendance({});
  const record = allRecords.find(r => r.staff_id === selectedStaff.id && r.date === today);
  if (!record) { showToast('出勤打刻がありません', 'error'); return; }
  if (record.clock_out_actual) { showToast('すでに退勤打刻済みです', 'error'); return; }
  record.clock_out_actual = now;
  record.clock_out_calc = roundDownClockOut(now);
  await DB.saveAttendance(record);
  const workMins = calcWorkMinutes(record.clock_in_calc, record.clock_out_calc);
  showToast(`${selectedStaff.name} さん、お疲れさまでした！(${formatWorkTime(workMins)})`);
  renderClockStatus(record);
}

function backToStaffSelect() {
  selectedStaff = null;
  document.getElementById('staffSelectSection').style.display = 'block';
  document.getElementById('clockActionSection').style.display = 'none';
}
