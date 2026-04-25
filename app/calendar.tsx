import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EntryCard } from '../components/EntryCard';
import { useColors } from '../components/theme';
import { getEntries, getEntryDatesInMonth, type Entry } from '../db/entries';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7; // shift to Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function dayLabel(year: number, month: number, day: number): string {
  return new Date(year, month, day).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function CalendarScreen() {
  const c = useColors();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [markedDays, setMarkedDays] = useState<Set<number>>(new Set());
  const [dayEntries, setDayEntries] = useState<Entry[]>([]);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  useEffect(() => {
    getEntryDatesInMonth(year, month).then((days) => setMarkedDays(new Set(days)));
    setSelectedDay(null);
  }, [year, month]);

  useEffect(() => {
    if (selectedDay === null) { setDayEntries([]); return; }
    const start = new Date(year, month, selectedDay, 0, 0, 0, 0).getTime();
    const end = new Date(year, month, selectedDay, 23, 59, 59, 999).getTime();
    getEntries({ startTime: start, endTime: end }).then(setDayEntries);
  }, [year, month, selectedDay]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1);
  };

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 10,
    },
    navBtn: { padding: 10 },
    navText: { fontSize: 24, color: c.accent, lineHeight: 28 },
    monthTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    weekRow: {
      flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 6,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    weekDay: { flex: 1, textAlign: 'center', fontSize: 12, color: c.muted, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
    cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 4 },
    dayBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    dayBtnSelected: { backgroundColor: c.accent },
    dayBtnToday: { borderWidth: 1.5, borderColor: c.accent },
    dayNum: { fontSize: 14, color: c.text },
    dayNumSelected: { color: '#fff', fontWeight: '700' },
    dayNumToday: { color: c.accent, fontWeight: '600' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent, marginTop: 2 },
    dotSelected: { backgroundColor: '#fff' },
    divider: { height: 1, backgroundColor: c.border, marginTop: 6 },
    dayHeader: { fontSize: 13, color: c.muted, paddingHorizontal: 16, paddingVertical: 10 },
    list: { paddingHorizontal: 14, paddingBottom: 20 },
    empty: { textAlign: 'center', color: c.muted, marginTop: 32, fontSize: 14 },
  }), [c]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.navBtn} onPress={prevMonth}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel(year, month)}</Text>
        <Pressable style={styles.navBtn} onPress={nextMonth}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => <Text key={d} style={styles.weekDay}>{d}</Text>)}
      </View>

      <View style={styles.grid}>
        {grid.map((day, i) => {
          if (day === null) return <View key={`empty-${i}`} style={styles.cell} />;
          const selected = day === selectedDay;
          const todayDay = isToday(day);
          const hasDot = markedDays.has(day);
          return (
            <View key={day} style={styles.cell}>
              <Pressable
                style={[
                  styles.dayBtn,
                  selected && styles.dayBtnSelected,
                  !selected && todayDay && styles.dayBtnToday,
                ]}
                onPress={() => setSelectedDay(selected ? null : day)}
              >
                <Text style={[
                  styles.dayNum,
                  selected && styles.dayNumSelected,
                  !selected && todayDay && styles.dayNumToday,
                ]}>
                  {day}
                </Text>
              </Pressable>
              {hasDot && <View style={[styles.dot, selected && styles.dotSelected]} />}
            </View>
          );
        })}
      </View>

      <View style={styles.divider} />

      <FlatList
        data={dayEntries}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <EntryCard entry={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          selectedDay ? <Text style={styles.dayHeader}>{dayLabel(year, month, selectedDay)}</Text> : null
        }
        ListEmptyComponent={
          selectedDay
            ? <Text style={styles.empty}>Keine Einträge an diesem Tag.</Text>
            : <Text style={styles.empty}>Tag antippen um Einträge zu sehen.</Text>
        }
      />
    </SafeAreaView>
  );
}
