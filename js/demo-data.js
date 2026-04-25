function initDemoData() {
  if (localStorage.getItem('staff')) return;

  const staffData = [
    { id: 'demo-staff-1', name: '田中 花子', type: 'hourly', wage: 1050, monthly_salary: 0, is_active: true, created_at: new Date().toISOString() },
    { id: 'demo-staff-2', name: '鈴木 次郎', type: 'hourly', wage: 1100, monthly_salary: 0, is_active: true, created_at: new Date().toISOString() },
    { id: 'demo-staff-3', name: '山田 三郎', type: 'senzoku', wage: 0, monthly_salary: 180000, is_active: true, created_at: new Date().toISOString() },
    { id: 'demo-staff-4', name: '佐藤 四郎', type: 'employee', wage: 0, monthly_salary: 250000, is_active: true, created_at: new Date().toISOString() },
    { id: 'demo-staff-5', name: '高橋 五子', type: 'hourly', wage: 1000, monthly_salary: 0, is_active: false, created_at: new Date().toISOString() },
  ];

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');

  const makeRecord = (staffId, day, inTime, outTime, isSpecial, wage) => {
    const clockInCalc = roundUpClockIn(inTime);
    const clockOutCalc = outTime ? roundDownClockOut(outTime) : null;
    return {
      id: `demo-att-${staffId}-${day}`,
      staff_id: staffId,
      date: `${y}-${m}-${String(day).padStart(2,'0')}`,
      clock_in_actual: inTime,
      clock_out_actual: outTime || null,
      clock_in_calc: clockInCalc,
      clock_out_calc: clockOutCalc,
      wage_at_date: wage,
      is_special_day: isSpecial,
      notes: '',
      created_at: new Date().toISOString()
    };
  };

  const attendanceData = [
    makeRecord('demo-staff-1', 1, '10:05', '17:25', false, 1050),
    makeRecord('demo-staff-1', 2, '09:55', '18:10', false, 1050),
    makeRecord('demo-staff-1', 5, '10:15', '17:50', true,  1050),
    makeRecord('demo-staff-1', 6, '10:00', '18:00', true,  1050),
    makeRecord('demo-staff-2', 1, '09:05', '17:30', false, 1100),
    makeRecord('demo-staff-2', 2, '09:00', '18:00', false, 1100),
    makeRecord('demo-staff-2', 5, '09:10', '17:45', true,  1100),
    makeRecord('demo-staff-2', 7, '09:00', null,    true,  1100),
  ];

  localStorage.setItem('staff', JSON.stringify(staffData));
  localStorage.setItem('attendance', JSON.stringify(attendanceData));
  localStorage.setItem('special_days', JSON.stringify([]));
}
