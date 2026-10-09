/**
 * Text utility helpers for location calculation and terminal styling.
 */

export interface LocationInfo {
  line: number;
  column: number;
  lineSnippet: string;
}

export function getLocationFromIndex(content: string, index: number): LocationInfo {
  if (index < 0 || index > content.length) {
    return { line: 1, column: 1, lineSnippet: '' };
  }

  const lines = content.slice(0, index).split('\n');
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;

  // Extract the specific line content
  const allLines = content.split('\n');
  const lineSnippet = (allLines[line - 1] ?? '').trim();

  return { line, column, lineSnippet };
}

let colorsEnabled = !process.env.NO_COLOR && process.stdout.isTTY !== false;

export function setColorsEnabled(enabled: boolean): void {
  colorsEnabled = enabled;
}

export function areColorsEnabled(): boolean {
  return colorsEnabled;
}

function colorize(open: number, close: number, text: string): string {
  if (!colorsEnabled) return text;
  return `\x1b[${open}m${text}\x1b[${close}m`;
}

export const c = {
  bold: (t: string) => colorize(1, 22, t),
  dim: (t: string) => colorize(2, 22, t),
  red: (t: string) => colorize(31, 39, t),
  green: (t: string) => colorize(32, 39, t),
  yellow: (t: string) => colorize(33, 39, t),
  blue: (t: string) => colorize(34, 39, t),
  magenta: (t: string) => colorize(35, 39, t),
  cyan: (t: string) => colorize(36, 39, t),
  gray: (t: string) => colorize(90, 39, t),
};
