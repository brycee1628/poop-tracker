/**
 * 與 functions/index.js 內 filterEntryByMonth 邏輯一致，
 * 用於前端「本月」僅顯示當月區間，避免換月後資料庫未及清空時誤顯示上月。
 */
export function filterEntryByMonth(entry, year, month) {
  if (entry == null || typeof entry === 'number') return entry;

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const filteredDailyRecords = {};
  Object.entries(entry.dailyRecords || {}).forEach(([date, record]) => {
    if (date.startsWith(monthPrefix)) {
      filteredDailyRecords[date] = record;
    }
  });

  const count = Object.values(filteredDailyRecords).reduce((sum, record) => {
    if (typeof record === 'number') return sum + record;
    return sum + (record?.count || 0);
  }, 0);

  const hasDailyRecords = entry.dailyRecords && typeof entry.dailyRecords === 'object';
  return {
    ...entry,
    count:
      Object.keys(filteredDailyRecords).length > 0
        ? count
        : hasDailyRecords
          ? 0
          : typeof entry.count === 'number'
            ? entry.count
            : 0,
    dailyRecords: filteredDailyRecords
  };
}

/** 台北日曆年月日（與 Cloud incrementCounterAtPath 同一時區概念） */
export function getTaipeiCalendarParts() {
  const now = new Date();
  const taipeiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  return {
    year: taipeiTime.getFullYear(),
    month: taipeiTime.getMonth() + 1,
    day: taipeiTime.getDate()
  };
}
