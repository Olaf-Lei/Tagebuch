export const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];
export const HEALTH_EMOJIS = ['🤒', '😔', '😐', '🙂', '💪'];

export function emojiForLevel(emojis: string[], level: number | null): string | null {
  if (!level || level < 1 || level > 5) return null;
  return emojis[level - 1];
}

export const EMOJI_PRESETS: Record<string, { label: string; icon: string; emojis: string[] }> = {
  mood:   { label: 'Laune',    icon: '🌤️', emojis: ['😢', '😕', '😐', '🙂', '😄'] },
  health: { label: 'Befinden', icon: '💪',  emojis: ['🤒', '🤧', '😐', '😊', '💪'] },
  sleep:  { label: 'Schlaf',   icon: '💤',  emojis: ['😫', '😪', '😑', '😌', '🌟'] },
  energy: { label: 'Energie',  icon: '⚡',  emojis: ['🪫', '😩', '🌀', '⚡', '🚀'] },
  pain:   { label: 'Schmerz',  icon: '🩹',  emojis: ['😖', '😣', '😬', '😌', '✅'] },
  stress: { label: 'Stress',   icon: '🧘',  emojis: ['🤯', '😤', '😬', '😌', '🧘'] },
};
