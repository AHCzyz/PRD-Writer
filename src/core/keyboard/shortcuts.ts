export interface KeyboardShortcutLike {
  ctrlKey: boolean;
  metaKey: boolean;
  key: string;
}

export function isSaveShortcut(event: KeyboardShortcutLike): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
}
