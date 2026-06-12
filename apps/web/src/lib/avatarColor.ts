export const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#FFB86B', '#6BCB77', '#FF8FB1'];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
