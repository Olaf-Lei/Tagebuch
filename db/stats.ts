import { getDb } from './schema';

export interface DayCount { day: string; count: number; }
export interface NameCount { name: string; count: number; color?: string | null; }

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

export interface QualifierTrendSeries {
  qualifier: { id: number; name: string; emoji_preset: string };
  points: { label: string; avg: number | null }[];
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
    `SELECT c.name, c.color, COUNT(*) as count FROM categories c
     JOIN entry_categories ec ON c.id = ec.category_id
     JOIN entries e ON e.id = ec.entry_id
     WHERE e.timestamp >= ? AND e.timestamp <= ?
     GROUP BY c.id ORDER BY count DESC LIMIT 10`,
    [from, to]
  );

  const perTag = await db.getAllAsync<NameCount>(
    `SELECT t.name, COUNT(*) as count FROM tags t
     JOIN entry_tags et ON t.id = et.tag_id
     JOIN entries e ON e.id = et.entry_id
     WHERE e.timestamp >= ? AND e.timestamp <= ?
     GROUP BY t.id ORDER BY count DESC LIMIT 10`,
    [from, to]
  );

  return { total, activeDays, currentStreak, longestStreak, perDay, perPeriod, perCategory, perTag };
}

export interface QualifierDistribution {
  qualifier: { id: number; name: string; emoji_preset: string };
  avg: number | null;
  dist: number[]; // index 0 = level 1, index 4 = level 5
}

export async function getQualifierStats(from: number, to: number): Promise<QualifierDistribution[]> {
  const db = await getDb();
  const qualifiers = await db.getAllAsync<{ id: number; name: string; emoji_preset: string }>(
    'SELECT id, name, emoji_preset FROM qualifiers WHERE deleted = 0 AND active = 1 ORDER BY position, id'
  );
  const results: QualifierDistribution[] = [];
  for (const q of qualifiers) {
    const avgRow = await db.getFirstAsync<{ avg: number | null }>(
      `SELECT AVG(eq.value) as avg FROM entry_qualifiers eq
       JOIN entries e ON e.id = eq.entry_id
       WHERE eq.qualifier_id = ? AND e.timestamp >= ? AND e.timestamp <= ?`,
      [q.id, from, to]
    );
    const distRows = await db.getAllAsync<{ value: number; count: number }>(
      `SELECT eq.value, COUNT(*) as count FROM entry_qualifiers eq
       JOIN entries e ON e.id = eq.entry_id
       WHERE eq.qualifier_id = ? AND e.timestamp >= ? AND e.timestamp <= ?
       GROUP BY eq.value ORDER BY eq.value`,
      [q.id, from, to]
    );
    const dist = [0, 0, 0, 0, 0];
    for (const row of distRows) {
      if (row.value >= 1 && row.value <= 5) dist[row.value - 1] = row.count;
    }
    results.push({ qualifier: q, avg: avgRow?.avg ?? null, dist });
  }
  return results;
}

export async function getHourDistribution(from: number, to: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ hour: number; count: number }>(
    `SELECT CAST(strftime('%H', timestamp/1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
     COUNT(*) as count FROM entries
     WHERE timestamp >= ? AND timestamp <= ? GROUP BY hour ORDER BY hour`,
    [from, to]
  );
  const result = new Array(24).fill(0);
  for (const row of rows) result[row.hour] = row.count;
  return result;
}

export async function getWeekdayDistribution(from: number, to: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ dow: number; count: number }>(
    `SELECT CAST(strftime('%w', timestamp/1000, 'unixepoch', 'localtime') AS INTEGER) as dow,
     COUNT(*) as count FROM entries
     WHERE timestamp >= ? AND timestamp <= ? GROUP BY dow ORDER BY dow`,
    [from, to]
  );
  // SQLite: 0=So. Umrechnen auf 0=Mo
  const result = new Array(7).fill(0);
  for (const row of rows) result[(row.dow + 6) % 7] = row.count;
  return result;
}

export async function getAvgTextLength(from: number, to: number): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ avg: number | null }>(
    `SELECT AVG(LENGTH(text)) as avg FROM entries WHERE timestamp >= ? AND timestamp <= ?`,
    [from, to]
  );
  return row?.avg ?? null;
}

export interface QualifierByCat {
  category: { id: number; name: string; color: string | null };
  qualifierAvgs: { qualifier_id: number; name: string; emoji_preset: string; avg: number }[];
}

export async function getQualifierByCategory(from: number, to: number): Promise<QualifierByCat[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    category_id: number; category_name: string; category_color: string | null;
    qualifier_id: number; qualifier_name: string; emoji_preset: string;
    avg_value: number;
  }>(`
    SELECT c.id as category_id, c.name as category_name, c.color as category_color,
           q.id as qualifier_id, q.name as qualifier_name, q.emoji_preset,
           AVG(eq.value) as avg_value
    FROM categories c
    JOIN entry_categories ec ON c.id = ec.category_id
    JOIN entries e ON e.id = ec.entry_id AND e.timestamp >= ? AND e.timestamp <= ?
    JOIN entry_qualifiers eq ON eq.entry_id = e.id
    JOIN qualifiers q ON q.id = eq.qualifier_id AND q.deleted = 0 AND q.active = 1
    GROUP BY c.id, q.id
    ORDER BY c.id, q.position, q.id
  `, [from, to]);

  const map = new Map<number, QualifierByCat>();
  for (const row of rows) {
    if (!map.has(row.category_id)) {
      map.set(row.category_id, {
        category: { id: row.category_id, name: row.category_name, color: row.category_color },
        qualifierAvgs: [],
      });
    }
    map.get(row.category_id)!.qualifierAvgs.push({
      qualifier_id: row.qualifier_id, name: row.qualifier_name,
      emoji_preset: row.emoji_preset, avg: row.avg_value,
    });
  }
  return Array.from(map.values());
}

export async function getPreviousPeriodCount(from: number, to: number): Promise<number> {
  const db = await getDb();
  const duration = to - from;
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM entries WHERE timestamp >= ? AND timestamp < ?`,
    [from - duration, from]
  );
  return row?.count ?? 0;
}

export async function getQualifierTrend(from: number, to: number, groupBy: PeriodGroupBy): Promise<QualifierTrendSeries[]> {
  const db = await getDb();
  const expr = periodSql(groupBy);

  const qualifiers = await db.getAllAsync<{ id: number; name: string; emoji_preset: string }>(
    'SELECT id, name, emoji_preset FROM qualifiers WHERE deleted = 0 AND active = 1 ORDER BY position, id'
  );

  const results: QualifierTrendSeries[] = [];
  for (const q of qualifiers) {
    const points = await db.getAllAsync<{ label: string; avg: number | null }>(
      `SELECT ${expr} as label, AVG(eq.value) as avg
       FROM entry_qualifiers eq
       JOIN entries e ON e.id = eq.entry_id
       WHERE eq.qualifier_id = ? AND e.timestamp >= ? AND e.timestamp <= ?
       GROUP BY label ORDER BY label`,
      [q.id, from, to]
    );
    results.push({ qualifier: q, points });
  }
  return results;
}
