export const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];
export const HEALTH_EMOJIS = ['🤒', '😔', '😐', '🙂', '💪'];

export function emojiForLevel(emojis: string[], level: number | null): string | null {
  if (!level || level < 1 || level > 5) return null;
  return emojis[level - 1];
}

export const EMOJI_PRESETS: Record<string, { label: string; emojis: string[] }> = {
  mood:   { label: 'Laune',    emojis: ['😞', '😕', '😐', '🙂', '😄'] },
  health: { label: 'Befinden', emojis: ['🤒', '😔', '😐', '🙂', '💪'] },
  sleep:  { label: 'Schlaf',   emojis: ['😴', '😪', '😐', '🌙', '✨'] },
  energy: { label: 'Energie',  emojis: ['🪫', '😩', '😐', '⚡', '🚀'] },
  pain:   { label: 'Schmerz',  emojis: ['🔥', '😣', '😐', '😌', '✅'] },
  stress: { label: 'Stress',   emojis: ['🤯', '😤', '😐', '😌', '🧘'] },
};
