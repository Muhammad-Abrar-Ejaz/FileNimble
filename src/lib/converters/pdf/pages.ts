/** Parse one-based page numbers/ranges, preserving order and rejecting duplicates. */
export function parsePages(value: string, count: number): number[] {
  if (!value.trim()) throw new Error('Enter page numbers, such as 1, 3-5.');
  const result: number[] = [];
  for (const part of value.split(',')) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);
    if (!match) throw new Error('Use page numbers and ascending ranges, such as 1, 3-5.');
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (start < 1 || end > count || start > end) throw new Error(`Choose pages between 1 and ${count}, using ascending ranges.`);
    for (let page = start; page <= end; page++) {
      if (result.includes(page - 1)) throw new Error(`Page ${page} is selected more than once.`);
      result.push(page - 1);
    }
  }
  return result;
}

export function validatePages(pages: number[], count: number): number[] {
  if (!pages.length || pages.some(page => !Number.isInteger(page) || page < 0 || page >= count) || new Set(pages).size !== pages.length) {
    throw new Error('Select valid, non-repeating pages.');
  }
  return pages;
}
