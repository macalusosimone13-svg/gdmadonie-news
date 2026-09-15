const KEY = 'gdm_read_articles';

export function getReadIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function markRead(id) {
  if (!id) return;
  const ids = getReadIds();
  if (ids.has(id)) return;
  ids.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {}
}

export function isUnread(id) {
  return !getReadIds().has(id);
}

// True se nella lista c'e' almeno un contenuto non ancora letto.
export function hasUnread(posts) {
  if (!Array.isArray(posts)) return false;
  return posts.some((p) => p && p.id && isUnread(p.id));
}
