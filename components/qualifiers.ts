export const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];
export const HEALTH_EMOJIS = ['🤒', '😔', '😐', '🙂', '💪'];

export function emojiForLevel(emojis: string[], level: number | null): string | null {
  if (!level || level < 1 || level > 5) return null;
  return emojis[level - 1];
}
