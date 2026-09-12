import FormulaParser, { DepParser } from 'fast-formula-parser';
import { describe, expect, it } from 'vitest';

/**
 * The spike that de-risks the whole calculation engine.
 *
 * `fast-formula-parser` is CJS-only and unmaintained since 2023. If it cannot
 * be imported, typed, or bundled by this toolchain, that must be discovered
 * now — not at the phase where the engine is written against it.
 */
describe('fast-formula-parser', () => {
  const grid: Record<string, number> = { '1,1': 10, '2,1': 20 };
  const parser = new FormulaParser({
    onCell: ({ row, col }) => grid[`${row},${col}`] ?? null,
    onRange: (ref) => {
      const out: number[][] = [];
      for (let row = ref.from.row; row <= ref.to.row; row += 1) {
        const line: number[] = [];
        for (let col = ref.from.col; col <= ref.to.col; col += 1) line.push(grid[`${row},${col}`] ?? 0);
        out.push(line);
      }
      return out;
    },
  });

  const at = { row: 3, col: 1, sheet: 'Sheet1' };

  it('evaluates arithmetic, ranges and conditionals', () => {
    expect(parser.parse('SUM(1,2)', at)).toBe(3);
    expect(parser.parse('SUM(A1:A2)', at)).toBe(30);
    expect(parser.parse('IF(A1>5,"big","small")', at)).toBe('big');
  });

  it('returns Excel error values rather than throwing', () => {
    expect(String(parser.parse('1/0', at))).toContain('#DIV/0!');
  });

  it('counts rows and columns from one, not zero', () => {
    // The engine is zero-based everywhere; this is the boundary, and it is the
    // single easiest place in the project to introduce an off-by-one that looks
    // like data corruption rather than a bug.
    expect(parser.parse('A1', at)).toBe(10);
    expect(grid['1,1']).toBe(10);
  });

  it('extracts the references a formula reads, for the dependency graph', () => {
    const deps = new DepParser().parse('SUM(A1:A2)+B1', at);

    expect(deps).toEqual([
      { from: { row: 1, col: 1 }, to: { row: 2, col: 1 }, sheet: 'Sheet1' },
      { col: 2, row: 1, sheet: 'Sheet1' },
    ]);
  });
});
