import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getEntries } from '../db/entries';
import { getActiveQualifiers } from '../db/qualifiers';
import { getDbPath } from '../db/schema';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function exportJSON(): Promise<void> {
  const [entries, qualifiers] = await Promise.all([getEntries(), getActiveQualifiers()]);
  const idToName = Object.fromEntries(qualifiers.map(q => [q.id, q.name]));
  const data = entries.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    timestamp_readable: formatDate(e.timestamp),
    text: e.text,
    categories: e.categories,
    tags: e.tags,
    qualifiers: Object.fromEntries(
      Object.entries(e.qualifierValues).map(([id, val]) => [idToName[Number(id)] ?? id, val])
    ),
    latitude: e.latitude ?? null,
    longitude: e.longitude ?? null,
    location_name: e.locationName ?? null,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));
  const json = JSON.stringify(data, null, 2);
  const path = FileSystem.cacheDirectory + 'tagebuch_export.json';
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Tagebuch exportieren' });
}

export async function exportCSV(): Promise<void> {
  const [entries, qualifiers] = await Promise.all([getEntries(), getActiveQualifiers()]);
  const qualifierNames = qualifiers.map(q => q.name);
  const header = ['ID', 'Datum', 'Text', 'Kategorien', 'Tags', ...qualifierNames, 'Breitengrad', 'Längengrad', 'Ort'].join(';');
  const rows = entries.map((e) => {
    const text = `"${e.text.replace(/"/g, '""')}"`;
    const qCols = qualifiers.map(q => e.qualifierValues[q.id] ?? '');
    return [
      e.id, formatDate(e.timestamp), text,
      e.categories.join('|'), e.tags.join('|'),
      ...qCols,
      e.latitude ?? '', e.longitude ?? '', e.locationName ?? '',
    ].join(';');
  });
  const csv = [header, ...rows].join('\n');
  const path = FileSystem.cacheDirectory + 'tagebuch_export.csv';
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Tagebuch exportieren' });
}

export async function exportDB(): Promise<void> {
  const dbPath = await getDbPath();
  const src = dbPath.startsWith('file://') ? dbPath : `file://${dbPath}`;
  const dest = FileSystem.cacheDirectory + 'tagebuch_export.db';
  await FileSystem.copyAsync({ from: src, to: dest });
  await Sharing.shareAsync(dest, { mimeType: 'application/octet-stream', dialogTitle: 'Datenbank exportieren' });
}
