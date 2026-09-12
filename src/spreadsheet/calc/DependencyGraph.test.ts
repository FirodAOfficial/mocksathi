import { describe, expect, it } from 'vitest';
import { DependencyGraph, nodeId, parseNodeId, type Reference } from './DependencyGraph';

/**
 * The rule these tests exist to hold: editing a cell recalculates the formulas
 * that read it, in precedent-first order, and nothing else.
 */

const SHEET = 'sheet1';

function cell(row: number, col: number): Reference {
  return { kind: 'cell', sheetId: SHEET, address: { row, col } };
}

function range(fromRow: number, fromCol: number, toRow: number, toCol: number): Reference {
  return {
    kind: 'range',
    sheetId: SHEET,
    range: { start: { row: fromRow, col: fromCol }, end: { row: toRow, col: toCol } },
  };
}

function at(row: number, col: number): { sheetId: string; address: { row: number; col: number } } {
  return { sheetId: SHEET, address: { row, col } };
}

describe('DependencyGraph', () => {
  it('round-trips a node id', () => {
    const parsed = parseNodeId(nodeId('sheet 1!odd', 4, 7));

    expect(parsed).toEqual({ sheetId: 'sheet 1!odd', address: { row: 4, col: 7 } });
  });

  it('finds the formulas that read a cell', () => {
    const graph = new DependencyGraph();
    // A3 = A1 + A2
    graph.setDependencies(nodeId(SHEET, 2, 0), [cell(0, 0), cell(1, 0)]);

    expect(graph.directDependents(SHEET, { row: 0, col: 0 })).toEqual([nodeId(SHEET, 2, 0)]);
    expect(graph.directDependents(SHEET, { row: 5, col: 5 })).toEqual([]);
  });

  it('matches a cell against a range without expanding the range', () => {
    // =SUM(A1:A1048576) must not become a million edges.
    const graph = new DependencyGraph();
    graph.setDependencies(nodeId(SHEET, 0, 5), [range(0, 0, 1_048_575, 0)]);

    expect(graph.directDependents(SHEET, { row: 900_000, col: 0 })).toEqual([nodeId(SHEET, 0, 5)]);
    expect(graph.directDependents(SHEET, { row: 900_000, col: 1 })).toEqual([]);
  });

  it('stops recalculating a cell the formula no longer reads', () => {
    // The stale-edge bug: `=A1+B1` edited to `=A1` keeps firing on B1.
    const graph = new DependencyGraph();
    const formula = nodeId(SHEET, 2, 0);

    graph.setDependencies(formula, [cell(0, 0), cell(0, 1)]);
    graph.setDependencies(formula, [cell(0, 0)]);

    expect(graph.directDependents(SHEET, { row: 0, col: 1 })).toEqual([]);
    expect(graph.directDependents(SHEET, { row: 0, col: 0 })).toEqual([formula]);
  });

  it('forgets a cell that is no longer a formula', () => {
    const graph = new DependencyGraph();
    graph.setDependencies(nodeId(SHEET, 2, 0), [cell(0, 0), range(0, 0, 9, 0)]);

    graph.clear(nodeId(SHEET, 2, 0));

    expect(graph.directDependents(SHEET, { row: 0, col: 0 })).toEqual([]);
    expect(graph.size).toBe(0);
  });

  describe('planRecalc', () => {
    it('follows the chain and orders precedents first', () => {
      // A3 = SUM(A1:A2), A4 = A3 * 2. Editing A1 must do A3 then A4.
      const graph = new DependencyGraph();
      const a3 = nodeId(SHEET, 2, 0);
      const a4 = nodeId(SHEET, 3, 0);

      graph.setDependencies(a3, [range(0, 0, 1, 0)]);
      graph.setDependencies(a4, [cell(2, 0)]);

      const plan = graph.planRecalc([at(0, 0)]);

      expect(plan.order).toEqual([a3, a4]);
      expect(plan.cycles).toEqual([]);
    });

    it('leaves unrelated formulas alone', () => {
      const graph = new DependencyGraph();
      graph.setDependencies(nodeId(SHEET, 2, 0), [cell(0, 0)]);
      graph.setDependencies(nodeId(SHEET, 2, 5), [cell(0, 5)]);

      expect(graph.planRecalc([at(0, 0)]).order).toEqual([nodeId(SHEET, 2, 0)]);
    });

    it('reports a cycle instead of recursing into it', () => {
      // A1 = B1, B1 = A1. Excel refuses and says so; hanging is not an option.
      const graph = new DependencyGraph();
      const a1 = nodeId(SHEET, 0, 0);
      const b1 = nodeId(SHEET, 0, 1);

      graph.setDependencies(a1, [cell(0, 1)]);
      graph.setDependencies(b1, [cell(0, 0)]);

      const plan = graph.planRecalc([at(0, 0)]);

      expect(plan.order).toEqual([]);
      expect(plan.cycles.sort()).toEqual([a1, b1].sort());
    });

    it('orders the healthy part of a sheet that also contains a cycle', () => {
      const graph = new DependencyGraph();
      const a1 = nodeId(SHEET, 0, 0);
      const b1 = nodeId(SHEET, 0, 1);
      const c1 = nodeId(SHEET, 0, 2);

      graph.setDependencies(a1, [cell(0, 1)]);
      graph.setDependencies(b1, [cell(0, 0)]);
      graph.setDependencies(c1, [cell(5, 5)]);

      const plan = graph.planRecalc([at(5, 5), at(0, 0)]);

      expect(plan.order).toContain(c1);
      expect(plan.cycles).toContain(a1);
    });

    it('visits a diamond once, with both branches before the join', () => {
      // B1 = A1, C1 = A1, D1 = B1 + C1.
      const graph = new DependencyGraph();
      const b1 = nodeId(SHEET, 0, 1);
      const c1 = nodeId(SHEET, 0, 2);
      const d1 = nodeId(SHEET, 0, 3);

      graph.setDependencies(b1, [cell(0, 0)]);
      graph.setDependencies(c1, [cell(0, 0)]);
      graph.setDependencies(d1, [cell(0, 1), cell(0, 2)]);

      const plan = graph.planRecalc([at(0, 0)]);

      expect(plan.order).toHaveLength(3);
      expect(plan.order.indexOf(d1)).toBe(2);
    });
  });
});
