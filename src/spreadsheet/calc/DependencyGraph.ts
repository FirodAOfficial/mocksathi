import { cellKey, keyToAddress, rangeContains, type CellAddress, type RangeAddress } from '../model/address';

/**
 * Which formulas read which cells, and therefore what has to be recalculated.
 *
 * The reason this exists rather than "recalculate everything on every edit":
 * everything is seventeen billion cells. Excel's whole model is that typing in
 * A1 recalculates the formulas that read A1 and nothing else, and this is the
 * structure that makes that possible.
 *
 * Ranges are the awkward part. `=SUM(A1:A1048576)` reads a million cells, and
 * expanding that into a million edges would cost more than the recalculation it
 * saves. So a reference is stored the way it was written — a cell edge, or a
 * range watch — and a changed cell is matched against the range watches
 * directly. Real workbooks have few formulas and many cells, which is the
 * direction this trades in.
 */

/** `sheetId!packedRowCol`. A string so it can key a `Map` cheaply. */
export type NodeId = string;

export function nodeId(sheetId: string, row: number, col: number): NodeId {
  return `${sheetId}!${cellKey(row, col)}`;
}

export function parseNodeId(id: NodeId): { sheetId: string; address: CellAddress } | null {
  const split = id.lastIndexOf('!');
  if (split === -1) return null;

  const key = Number(id.slice(split + 1));
  if (!Number.isFinite(key)) return null;

  return { sheetId: id.slice(0, split), address: keyToAddress(key) };
}

/** A reference a formula reads: one cell, or a rectangle. */
export type Reference =
  | { kind: 'cell'; sheetId: string; address: CellAddress }
  | { kind: 'range'; sheetId: string; range: RangeAddress };

interface RangeWatch {
  sheetId: string;
  range: RangeAddress;
  dependent: NodeId;
}

export interface RecalcPlan {
  /**
   * Formula cells to evaluate, precedents before dependents.
   *
   * A cell inside a cycle is absent — it cannot be ordered, and evaluating it
   * would either hang or produce a value that depends on evaluation order.
   */
  order: NodeId[];
  /** Cells that take part in a circular reference, so they can be marked. */
  cycles: NodeId[];
}

export class DependencyGraph {
  /** Formula cell -> the single cells it reads. */
  private readonly precedents = new Map<NodeId, Set<NodeId>>();

  /** Cell -> the formula cells that read it. The direction recalculation walks. */
  private readonly dependents = new Map<NodeId, Set<NodeId>>();

  /** Range references, kept unexpanded. See the note above. */
  private rangeWatches: RangeWatch[] = [];

  /**
   * Records what a formula cell reads, replacing whatever it read before.
   *
   * Replacing rather than adding matters: editing `=A1+B1` to `=A1` must stop
   * the cell recalculating when B1 changes, or a stale edge keeps it alive
   * forever.
   */
  setDependencies(node: NodeId, references: readonly Reference[]): void {
    this.clear(node);

    const cells = new Set<NodeId>();

    for (const reference of references) {
      if (reference.kind === 'cell') {
        const id = nodeId(reference.sheetId, reference.address.row, reference.address.col);
        cells.add(id);

        let readers = this.dependents.get(id);
        if (!readers) {
          readers = new Set();
          this.dependents.set(id, readers);
        }
        readers.add(node);
      } else {
        this.rangeWatches.push({
          sheetId: reference.sheetId,
          range: reference.range,
          dependent: node,
        });
      }
    }

    if (cells.size > 0) this.precedents.set(node, cells);
  }

  /** Forgets a formula cell — because it was deleted, or is no longer a formula. */
  clear(node: NodeId): void {
    const previous = this.precedents.get(node);
    if (previous) {
      for (const id of previous) {
        const readers = this.dependents.get(id);
        readers?.delete(node);
        if (readers && readers.size === 0) this.dependents.delete(id);
      }
      this.precedents.delete(node);
    }

    if (this.rangeWatches.some((watch) => watch.dependent === node)) {
      this.rangeWatches = this.rangeWatches.filter((watch) => watch.dependent !== node);
    }
  }

  /** The formula cells that read a given cell, directly. */
  directDependents(sheetId: string, address: CellAddress): NodeId[] {
    const found = new Set(this.dependents.get(nodeId(sheetId, address.row, address.col)) ?? []);

    for (const watch of this.rangeWatches) {
      if (watch.sheetId === sheetId && rangeContains(watch.range, address)) {
        found.add(watch.dependent);
      }
    }

    return [...found];
  }

  /**
   * Everything to recalculate after some cells changed, in a safe order.
   *
   * Breadth-first to collect what is affected, then a depth-first post-order to
   * put precedents before dependents. Doing it in two passes rather than one
   * keeps the cycle case honest: a cell reached while it is still on the stack
   * is part of a cycle, and is reported instead of being ordered arbitrarily.
   */
  planRecalc(changed: readonly { sheetId: string; address: CellAddress }[]): RecalcPlan {
    const affected = new Set<NodeId>();
    const queue: NodeId[] = [];

    for (const { sheetId, address } of changed) {
      for (const dependent of this.directDependents(sheetId, address)) {
        if (!affected.has(dependent)) {
          affected.add(dependent);
          queue.push(dependent);
        }
      }
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      const parsed = parseNodeId(node);
      if (!parsed) continue;

      for (const dependent of this.directDependents(parsed.sheetId, parsed.address)) {
        if (!affected.has(dependent)) {
          affected.add(dependent);
          queue.push(dependent);
        }
      }
    }

    return this.order(affected);
  }

  /** A recalculation plan for a specific set of formula cells. */
  order(nodes: Iterable<NodeId>): RecalcPlan {
    const order: NodeId[] = [];
    const cycles = new Set<NodeId>();
    const state = new Map<NodeId, 'visiting' | 'done'>();
    const wanted = new Set(nodes);

    const visit = (node: NodeId, stack: NodeId[]): void => {
      const seen = state.get(node);
      if (seen === 'done') return;

      if (seen === 'visiting') {
        // Everything from where this node sits on the stack downwards is in
        // the loop with it.
        const from = stack.indexOf(node);
        for (const member of stack.slice(from === -1 ? 0 : from)) cycles.add(member);
        cycles.add(node);
        return;
      }

      state.set(node, 'visiting');
      stack.push(node);

      for (const precedent of this.precedents.get(node) ?? []) {
        if (wanted.has(precedent)) visit(precedent, stack);
      }

      stack.pop();
      state.set(node, 'done');
      if (!cycles.has(node)) order.push(node);
    };

    for (const node of wanted) visit(node, []);

    return {
      order: order.filter((node) => !cycles.has(node)),
      cycles: [...cycles],
    };
  }

  /** Every formula cell the graph knows about. */
  formulaCells(): NodeId[] {
    const all = new Set<NodeId>(this.precedents.keys());
    for (const watch of this.rangeWatches) all.add(watch.dependent);
    return [...all];
  }

  get size(): number {
    return this.formulaCells().length;
  }
}
