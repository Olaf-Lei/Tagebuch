import { getDb } from './schema';

export interface DayCount { day: string; count: number; }
export interface MonthCount { month: string; count: number; }
export interface NameCount { name: string; count: number; }

export interface Stats {
  total: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  avgMood: number | null;
  avgHealth: number | null;
  perDay: DayCount[];
  perMonth: MonthCount[];
  perCategory: NameCount[];
  perTag: NameCount[];
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

export async function getStats(): Promise<Stats> {
  const db = await getDb();

  const totalRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM entries`);
  const total = totalRow?.count ?? 0;

  const activeDaysRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT date(timestamp/1000, 'unixepoch', 'localtime')) as count FROM entries`
  );
  const activeDays = activeDaysRow?.count ?? 0;

  const since182 = Date.now() - 182 * 86400000;
  const perDay = await db.getAllAsync<DayCount>(
    `SELECT date(timestamp/1000, 'unixepoch', 'localtime') as day, COUNT(*) as count
     FROM entries WHERE timestamp >= ? GROUP BY day ORDER BY day`,
    [since182]
  );

  const allDayRows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT date(timestamp/1000, 'unixepoch', 'localtime') as day FROM entries ORDER BY day`
  );
  const { current: currentStreak, longest: longestStreak } = computeStreaks(allDayRows.map((r) => r.day));

  const perMonth = await db.getAllAsync<MonthCount>(
    `SELECT strftime('%Y-%m', timestamp/1000, 'unixepoch', 'localtime') as month, COUNT(*) as count
     FROM entries GROUP BY month ORDER BY month DESC LIMIT 6`
  );

  const perCategory = await db.getAllAsync<NameCount>(
    `SELECT c.name, COUNT(*) as count FROM categories c
     JOIN entry_categories ec ON c.id = ec.category_id
     GROUP BY c.id ORDER BY count DESC LIMIT 5`
  );

  const perTag = await db.getAllAsync<NameCount>(
    `SELECT t.name, COUNT(*) as count FROM tags t
     JOIN entry_tags et ON t.id = et.tag_id
     GROUP BY t.id ORDER BY count DESC LIMIT 5`
  );

  const avgMoodRow = await db.getFirstAsync<{ avg: number | null }>(
    `SELECT AVG(mood) as avg FROM entries WHERE mood IS NOT NULL`
  );
  const avgHealthRow = await db.getFirstAsync<{ avg: number | null }>(
    `SELECT AVG(health) as avg FROM entries WHERE health IS NOT NULL`
  );

  return {
    total, activeDays, currentStreak, longestStreak,
    avgMood: avgMoodRow?.avg ?? null,
    avgHealth: avgHealthRow?.avg ?? null,
    perDay, perMonth, perCategory, perTag,
  };
}
