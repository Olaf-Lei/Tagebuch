import { getDb } from './schema';

export interface DayCount { day: string; count: number; }
export interface NameCount { name: string; count: number; }

export type PeriodGroupBy = 'hour' | 'day' | 'week' | 'month';

export interface Stats {
  total: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  perDay: DayCount[];
  perPeriod: { label: string; count: number }[];
  perCategory: NameCount[];
  perTag: NameCount[];
}

export interface TrendPoint {
  label: string;
  avgMood: number | null;
  avgHealth: number | null;
}

function localDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function computeStreaks(sortedDays: string[]): { current: number; longest: number } {
  if (!sortedDays.length) return { current: 0, longest: 0 };

  const today = localDateStr(new Date());
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  const last = sortedDays[sortedDays.length - 1];

  let current = 0;
  if (last === today || last === yesterday) {
    current = 1;
    for (let i = sortedDays.length - 2; i >= 0; i--) {
      const diff = (new Date(sortedDays[i + 1]).getTime() - new Date(sortedDays[i]).getTime()) / 86400000;
      if (diff === 1) current++;
      else break;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const diff = (new Date(sortedDays[i]).getTime() - new Date(sortedDays[i - 1]).getTime()) / 86400000;
    if (diff === 1) { run++; if (run > longest) longest = run; }
    else run = 1;
  }

  return { current, longest: Math.max(longest, current) };
}

function periodSql(groupBy: PeriodGroupBy): string {
  switch (groupBy) {
    case 'hour':
      return `strftime('%H:00', timestamp/1000, 'unixepoch', 'localtime')`;
    case 'week':
      return `strftime('%Y-W%W', timestamp/1000, 'unixepoch', 'localtime')`;
    case 'month':
      return `strftime('%Y-%m', timestamp/1000, 'unixepoch', 'localtime')`;
    default:
      return `date(timestamp/1000, 'unixepoch', 'localtime')`;
  }
}

export async function getStats(from: number, to: number, groupBy: PeriodGroupBy): Promise<Stats> {
  const db = await getDb();

  const totalRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM entries WHERE timestamp >= ? AND timestamp <= ?`, [from, to]
  );
  const total = totalRow?.count ?? 0;

  const activeDaysRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT date(timestamp/1000, 'unixepoch', 'localtime')) as count
     FROM entries WHERE timestamp >= ? AND timestamp <= ?`, [from, to]
  );
  const activeDays = activeDaysRow?.count ?? 0;

  const perDay = await db.getAllAsync<DayCount>(
    `SELECT date(timestamp/1000, 'unixepoch', 'localtime') as day, COUNT(*) as count
     FROM entries WHERE timestamp >= ? AND timestamp <= ? GROUP BY day ORDER BY day`,
    [from, to]
  );

  const allDayRows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT date(timestamp/1000, 'unixepoch', 'localtime') as day
     FROM entries WHERE timestamp >= ? AND timestamp <= ? ORDER BY day`,
    [from, to]
  );
  const { current: currentStreak, longest: longestStreak } = computeStreaks(allDayRows.map(r => r.day));

  const expr = periodSql(groupBy);
  const perPeriod = await db.getAllAsync<{ label: string; count: number }>(
    `SELECT ${expr} as label, COUNT(*) as count
     FROM entries WHERE timestamp >= ? AND timestamp <= ? GROUP BY label ORDER BY label`,
    [from, to]
  );

  const perCategory = await db.getAllAsync<NameCount>(
    `SELECT c.name, COUNT(*) as count FROM categories c
     JOIN entry_categories ec ON c.id = ec.category_id
     JOIN entries e ON e.id = ec.entry_id
     WHERE e.timestamp >= ? AND e.timestamp <= ?
     GROUP BY c.id ORDER BY count DESC LIMIT 5`,
    [from, to]
  );

  const perTag = await db.getAllAsync<NameCount>(
    `SELECT t.name, COUNT(*) as count FROM tags t
     JOIN entry_tags et ON t.id = et.tag_id
     JOIN entries e ON e.id = et.entry_id
     WHERE e.timestamp >= ? AND e.timestamp <= ?
     GROUP BY t.id ORDER BY count DESC LIMIT 5`,
    [from, to]
  );

  return { total, activeDays, currentStreak, longestStreak, perDay, perPeriod, perCategory, perTag };
}

export async function getMoodHealthTrend(from: number, to: number, groupBy: PeriodGroupBy): Promise<TrendPoint[]> {
  const db = await getDb();
  const expr = periodSql(groupBy);
  return db.getAllAsync<TrendPoint>(
    `SELECT ${expr} as label, AVG(mood) as avgMood, AVG(health) as avgHealth
     FROM entries
     WHERE timestamp >= ? AND timestamp <= ? AND (mood IS NOT NULL OR health IS NOT NULL)
     GROUP BY label ORDER BY label`,
    [from, to]
  );
}
