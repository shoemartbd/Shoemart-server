export interface IPeriodSummary {
  today: number;
  yesterday: number;
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  lastMonth: number;
  allTime: number;
}

export const sumByPeriod = (entries: { amount: number; date: Date }[]): IPeriodSummary => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(startOfToday);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const summary: IPeriodSummary = {
    today: 0,
    yesterday: 0,
    thisWeek: 0,
    lastWeek: 0,
    thisMonth: 0,
    lastMonth: 0,
    allTime: 0,
  };

  for (const { amount, date } of entries) {
    summary.allTime += amount;

    if (date >= startOfToday && date < tomorrowStart) summary.today += amount;
    if (date >= startOfYesterday && date < startOfToday) summary.yesterday += amount;
    if (date >= startOfWeek && date < tomorrowStart) summary.thisWeek += amount;
    if (date >= startOfLastWeek && date < startOfWeek) summary.lastWeek += amount;
    if (date >= startOfMonth && date < tomorrowStart) summary.thisMonth += amount;
    if (date >= startOfLastMonth && date < startOfMonth) summary.lastMonth += amount;
  }

  return summary;
};
