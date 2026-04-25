import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getEntries } from '../db/entries';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function exportJSON(): Promise<void> {
  const entries = await getEntries();
  const data = entries.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    timestamp_readable: formatDate(e.timestamp),
    text: e.text,
    categories: e.categories,
    tags: e.tags,
    created_at: e.created_at,
  }));
  const json = JSON.stringify(data, null, 2);
  const path = FileSystem.cacheDirectory + 'tagebuch_export.json';
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Tagebuch exportieren' });
}

export async function exportCSV(): Promise<void> {
  const entries = await getEntries();
  const header = 'ID;Datum;Text;Kategorien;Tags';
  const rows = entries.map((e) => {
    const text = `"${e.text.replace(/"/g, '""')}"`;
    return `${e.id};${formatDate(e.timestamp)};${text};${e.categories.join('|')};${e.tags.join('|')}`;
  });
  const csv = [header, ...rows].join('\n');
  const path = FileSystem.cacheDirectory + 'tagebuch_export.csv';
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Tagebuch exportieren' });
}
