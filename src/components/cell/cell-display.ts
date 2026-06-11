import type { TabMLCell } from '../../types/tabml';

export function cellHasImage(cell: TabMLCell): boolean {
  if (cell.image) return true;
  return cell.content.some((item) => item.type === 'image');
}

export function shouldShowCellEditor(
  cell: TabMLCell,
  isFocused: boolean,
  isEditing: boolean,
  frozen = false
): boolean {
  if (!isFocused || frozen) return false;
  return isEditing || !cellHasImage(cell);
}
