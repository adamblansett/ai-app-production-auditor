export interface SuppressionMap {
  isSuppressed(line: number | null, ruleId: string): boolean;
}

export function parseSuppressions(fileContent: string): SuppressionMap {
  const lines = fileContent.split('\n');

  // Map of line number (1-based) to set of disabled rule IDs ('*' means all rules)
  const lineSuppressions = new Map<number, Set<string>>();

  // Ranges of block suppressions: { startLine, endLine, rules: Set<string> }
  const blockSuppressions: Array<{
    startLine: number;
    endLine: number;
    rules: Set<string>;
  }> = [];

  const activeBlocks = new Map<string, number>(); // ruleId -> startLine

  const NEXT_LINE_REGEX =
    /(?:\/\/|#|\/\*)\s*auditor-disable-next-line(?:\s+([A-Za-z0-9_,\s]+))?(?:--.*)?(?:\*\/)?/i;
  const DISABLE_BLOCK_REGEX =
    /(?:\/\/|#|\/\*)\s*auditor-disable(?:\s+([A-Za-z0-9_,\s]+))?(?:--.*)?(?:\*\/)?/i;
  const ENABLE_BLOCK_REGEX =
    /(?:\/\/|#|\/\*)\s*auditor-enable(?:\s+([A-Za-z0-9_,\s]+))?(?:--.*)?(?:\*\/)?/i;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineText = lines[i] ?? '';

    // Check disable-next-line first
    const nextLineMatch = NEXT_LINE_REGEX.exec(lineText);
    if (nextLineMatch) {
      const targetLine = lineNum + 1;
      const rules = parseRuleList(nextLineMatch[1]);
      const set = lineSuppressions.get(targetLine) ?? new Set<string>();
      for (const r of rules) set.add(r);
      lineSuppressions.set(targetLine, set);
      continue;
    }

    // Check enable-block
    const enableMatch = ENABLE_BLOCK_REGEX.exec(lineText);
    if (enableMatch) {
      const rules = parseRuleList(enableMatch[1]);
      for (const r of rules) {
        if (activeBlocks.has(r)) {
          const startLine = activeBlocks.get(r)!;
          blockSuppressions.push({
            startLine,
            endLine: lineNum,
            rules: new Set([r]),
          });
          activeBlocks.delete(r);
        }
      }
      continue;
    }

    // Check disable-block
    const disableMatch = DISABLE_BLOCK_REGEX.exec(lineText);
    if (disableMatch) {
      const rules = parseRuleList(disableMatch[1]);
      for (const r of rules) {
        activeBlocks.set(r, lineNum);
      }
      continue;
    }
  }

  // Any open active blocks remain active until end of file
  for (const [r, startLine] of activeBlocks.entries()) {
    blockSuppressions.push({
      startLine,
      endLine: lines.length + 1,
      rules: new Set([r]),
    });
  }

  return {
    isSuppressed(line: number | null, ruleId: string): boolean {
      if (line === null) {
        // If line is null (project-level), check if file has whole-file disable
        return blockSuppressions.some(
          (b) => b.startLine === 1 && (b.rules.has('*') || b.rules.has(ruleId)),
        );
      }

      // 1. Check line-specific suppression (e.g. disable-next-line)
      const lineRules = lineSuppressions.get(line);
      if (lineRules && (lineRules.has('*') || lineRules.has(ruleId))) {
        return true;
      }

      // 2. Check block suppressions covering this line
      for (const block of blockSuppressions) {
        if (line >= block.startLine && line <= block.endLine) {
          if (block.rules.has('*') || block.rules.has(ruleId)) {
            return true;
          }
        }
      }

      return false;
    },
  };
}

function parseRuleList(raw?: string): string[] {
  if (!raw || raw.trim().length === 0) {
    return ['*'];
  }
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}
