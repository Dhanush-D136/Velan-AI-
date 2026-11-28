/**
 * Numeric-aware register number comparator.
 * Compares purely-numeric register numbers numerically (e.g. 113024243001 < 113024243002 < 113024243301).
 * Non-numeric formats are placed after numeric ones in stable lexicographical order.
 */
export function compareRegisterNo(aRaw: string | null | undefined, bRaw: string | null | undefined, desc = false): number {
  const a = String(aRaw || '').trim();
  const b = String(bRaw || '').trim();

  const aIsNum = /^\d+$/.test(a);
  const bIsNum = /^\d+$/.test(b);

  let cmp = 0;
  if (aIsNum && bIsNum) {
    if (a.length !== b.length) {
      cmp = a.length - b.length;
    } else {
      cmp = a < b ? -1 : a > b ? 1 : 0;
    }
  } else if (aIsNum && !bIsNum) {
    cmp = -1;
  } else if (!aIsNum && bIsNum) {
    cmp = 1;
  } else {
    cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  return desc ? -cmp : cmp;
}

export function sortStudentsByRegisterNo<T extends { registerNo?: string | null }>(
  list: T[],
  desc = false
): T[] {
  return [...list].sort((a, b) => compareRegisterNo(a.registerNo, b.registerNo, desc));
}
