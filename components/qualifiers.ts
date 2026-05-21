import type { Strings } from '../i18n';

export const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];
export const HEALTH_EMOJIS = ['🤒', '😔', '😐', '🙂', '💪'];

export function emojiForLevel(emojis: string[], level: number | null): string | null {
  if (!level || level < 1 || level > 5) return null;
  return emojis[level - 1];
}

export function qualifierLabel(name: string, emojiPreset: string, t: Strings): string {
  return (t.qualifierPresets as Record<string, string>)[emojiPreset] ?? name;
}

const FALLBACK_EMOJIS = ['❓', '❓', '❓', '❓', '❓'];

export function getEmojisForPreset(emojiPreset: string): string[] {
  if (EMOJI_PRESETS[emojiPreset]) return EMOJI_PRESETS[emojiPreset].emojis;
  try {
    const arr = JSON.parse(emojiPreset);
    if (Array.isArray(arr) && arr.length === 5) return arr as string[];
  } catch {}
  return FALLBACK_EMOJIS;
}

export function getIconForPreset(emojiPreset: string): string {
  if (EMOJI_PRESETS[emojiPreset]) return EMOJI_PRESETS[emojiPreset].icon;
  try {
    const arr = JSON.parse(emojiPreset);
    if (Array.isArray(arr) && arr.length >= 3) return arr[2] as string;
  } catch {}
  return '⭐';
}

export const EMOJI_PRESETS: Record<string, { label: string; icon: string; emojis: string[] }> = {
  mood:   { label: 'Laune',    icon: '🌤️', emojis: ['😢', '😕', '😐', '🙂', '😄'] },
  health: { label: 'Befinden', icon: '💪',  emojis: ['🤒', '🤧', '😐', '😊', '💪'] },
  sleep:  { label: 'Schlaf',   icon: '💤',  emojis: ['😫', '😪', '😑', '😌', '🌟'] },
  energy: { label: 'Energie',  icon: '⚡',  emojis: ['🪫', '😩', '🌀', '⚡', '🚀'] },
  pain:   { label: 'Schmerz',  icon: '🩹',  emojis: ['😖', '😣', '😬', '😌', '✅'] },
  stress: { label: 'Stress',   icon: '🧘',  emojis: ['🤯', '😤', '😬', '😌', '🧘'] },
};
