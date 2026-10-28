/**
 * How far to scroll the page so a row's centre sits midway between the top of
 * the visible area and the top of the sheet. Positive scrolls down.
 */
export function centreScrollDelta(m: {
  visibleTop: number;
  sheetTop: number;
  rowTop: number;
  rowHeight: number;
}): number {
  const target = m.visibleTop + (m.sheetTop - m.visibleTop) / 2;
  return m.rowTop + m.rowHeight / 2 - target;
}
