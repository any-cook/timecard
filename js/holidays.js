let _holidayCache = null;

async function fetchHolidays() {
  if (_holidayCache) return _holidayCache;
  _holidayCache = new Set();
  try {
    const url = 'https://holidays-jp.github.io/api/v1/date.json';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      Object.keys(data).forEach(d => _holidayCache.add(d));
    }
  } catch (e) {
    const fallback = [
      '2024-01-01','2024-01-08','2024-02-11','2024-02-12','2024-02-23',
      '2024-03-20','2024-04-29','2024-05-03','2024-05-04','2024-05-05',
      '2024-05-06','2024-07-15','2024-08-11','2024-08-12','2024-09-16',
      '2024-09-22','2024-09-23','2024-10-14','2024-11-03','2024-11-04',
      '2024-11-23','2025-01-01','2025-01-13','2025-02-11','2025-02-23',
      '2025-02-24','2025-03-20','2025-04-29','2025-05-03','2025-05-04',
      '2025-05-05','2025-05-06','2025-07-21','2025-08-11','2025-09-15',
      '2025-09-23','2025-10-13','2025-11-03','2025-11-23','2025-11-24',
    ];
    fallback.forEach(d => _holidayCache.add(d));
  }
  return _holidayCache;
}

async function isHoliday(dateStr) {
  const holidays = await fetchHolidays();
  return holidays.has(dateStr);
}

async function isPreHoliday(dateStr) {
  const d = parseDate(dateStr);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  const nextStr = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
  return isHoliday(nextStr);
}

async function isSpecialDay(dateStr, manualSpecialDays = []) {
  if (manualSpecialDays.some(d => d.date === dateStr)) return true;
  const d = parseDate(dateStr);
  const dow = d.getDay();
  if (dow === 5 || dow === 6 || dow === 0) return true;
  if (await isHoliday(dateStr)) return true;
  if (await isPreHoliday(dateStr)) return true;
  return false;
}

async function buildSpecialDayMap(year, month, manualSpecialDays = []) {
  const result = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    result[dateStr] = await isSpecialDay(dateStr, manualSpecialDays);
  }
  return result;
}
