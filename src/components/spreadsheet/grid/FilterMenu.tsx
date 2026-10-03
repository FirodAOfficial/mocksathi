'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  NUMBER_OP_LABELS,
  TEXT_OP_LABELS,
  type FilterCondition,
  type NumberFilterOp,
  type TextFilterOp,
} from '@/spreadsheet/model/autoFilter';
import type { WorkbookStore } from '@/spreadsheet/WorkbookStore';
import styles from './FilterMenu.module.css';

/**
 * A filter column's drop-down: sort, clear, Text or Number Filters, and the
 * checklist of values with a search box — Excel's, in Excel's order.
 */

export interface FilterMenuProps {
  store: WorkbookStore;
  col: number;
  /** The column's heading, for "Clear Filter From". */
  heading: string;
  readOnly: boolean;
  close: () => void;
  onNotice: (message: string) => void;
}

type CustomOp =
  | { kind: 'text'; op: TextFilterOp }
  | { kind: 'number'; op: NumberFilterOp }
  | { kind: 'top' };

type Mode = { view: 'main' } | { view: 'ops' } | { view: 'form'; op: CustomOp };

/** How the checklist shows a value: blanks get Excel's name. */
const label = (value: string): string => (value === '' ? '(Blanks)' : value);

export function FilterMenu({ store, col, heading, readOnly, close, onNotice }: FilterMenuProps) {
  const filter = store.activeSheet().autoFilter;
  const condition = filter?.columns[col];
  const numeric = store.filterIsNumeric(col);
  const values = useMemo(() => store.filterValues(col), [store, col]);

  const [mode, setMode] = useState<Mode>({ view: 'main' });
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(condition?.kind === 'values' ? condition.values.filter((value) => values.includes(value)) : values),
  );

  const shown = search === '' ? values : values.filter((value) => label(value).toLowerCase().includes(search.toLowerCase()));
  const allShownChecked = shown.length > 0 && shown.every((value) => checked.has(value));

  const apply = (next: FilterCondition | null): void => {
    store.setColumnFilter(col, next);
    close();
  };

  const sort = (direction: 'asc' | 'desc'): void => {
    const blocker = store.sortFilterColumn(col, direction);
    if (blocker) onNotice(`The table could not be sorted: ${blocker}.`);
    close();
  };

  const ok = (): void => {
    // While searching, Excel keeps only the ticked values that match the search.
    const kept = values.filter((value) => checked.has(value) && shown.includes(value));
    apply(kept.length === values.length ? null : { kind: 'values', values: kept });
  };

  if (mode.view === 'form') {
    return (
      <div className={styles.menu} {...stopGrid}>
        <CustomFilterForm
          heading={heading}
          op={mode.op}
          initial={condition}
          onCancel={() => setMode({ view: 'main' })}
          onApply={apply}
        />
      </div>
    );
  }

  if (mode.view === 'ops') {
    const ops: { label: string; onSelect: () => void }[] = numeric
      ? [
          ...(Object.keys(NUMBER_OP_LABELS) as NumberFilterOp[]).map((op) => ({
            label: `${NUMBER_OP_LABELS[op]}…`,
            onSelect: () => setMode({ view: 'form', op: { kind: 'number', op } }),
          })),
          { label: 'Top 10…', onSelect: () => setMode({ view: 'form', op: { kind: 'top' } }) },
          { label: 'Above Average', onSelect: () => apply({ kind: 'average', above: true }) },
          { label: 'Below Average', onSelect: () => apply({ kind: 'average', above: false }) },
        ]
      : (Object.keys(TEXT_OP_LABELS) as TextFilterOp[]).map((op) => ({
          label: `${TEXT_OP_LABELS[op]}…`,
          onSelect: () => setMode({ view: 'form', op: { kind: 'text', op } }),
        }));

    return (
      <div className={styles.menu} role="menu" aria-label={numeric ? 'Number Filters' : 'Text Filters'} {...stopGrid}>
        <button type="button" className={styles.item} onClick={() => setMode({ view: 'main' })}>
          <span className={styles.glyph} aria-hidden="true">‹</span>
          {numeric ? 'Number Filters' : 'Text Filters'}
        </button>
        <div className={styles.separator} />
        {ops.map((entry) => (
          <button key={entry.label} type="button" role="menuitem" className={styles.item} onClick={entry.onSelect}>
            <span className={styles.glyph} aria-hidden="true" />
            {entry.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.menu} role="menu" aria-label={`Filter ${heading}`} {...stopGrid}>
      <button type="button" role="menuitem" className={styles.item} disabled={readOnly} onClick={() => sort('asc')}>
        <span className={styles.glyph} aria-hidden="true">A↓</span>
        {numeric ? 'Sort Smallest to Largest' : 'Sort A to Z'}
      </button>
      <button type="button" role="menuitem" className={styles.item} disabled={readOnly} onClick={() => sort('desc')}>
        <span className={styles.glyph} aria-hidden="true">Z↓</span>
        {numeric ? 'Sort Largest to Smallest' : 'Sort Z to A'}
      </button>
      <div className={styles.separator} />
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        disabled={readOnly || !condition}
        onClick={() => apply(null)}
      >
        <span className={styles.glyph} aria-hidden="true">⊘</span>
        Clear Filter From “{heading}”
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        disabled={readOnly}
        onClick={() => setMode({ view: 'ops' })}
      >
        <span className={styles.glyph} aria-hidden="true" />
        {numeric ? 'Number Filters' : 'Text Filters'}
        <span className={styles.more} aria-hidden="true">›</span>
      </button>

      <input
        type="search"
        className={styles.search}
        placeholder="Search"
        aria-label="Search values"
        value={search}
        // The browser's remembered entries would cover the list beneath.
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className={styles.list} role="group" aria-label="Values">
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={allShownChecked}
            disabled={shown.length === 0}
            onChange={(event) => {
              const next = new Set(checked);
              for (const value of shown) {
                if (event.target.checked) next.add(value);
                else next.delete(value);
              }
              setChecked(next);
            }}
          />
          {search === '' ? '(Select All)' : '(Select All Search Results)'}
        </label>
        {shown.map((value) => (
          <label key={value} className={styles.check}>
            <input
              type="checkbox"
              checked={checked.has(value)}
              onChange={(event) => {
                const next = new Set(checked);
                if (event.target.checked) next.add(value);
                else next.delete(value);
                setChecked(next);
              }}
            />
            {label(value)}
          </label>
        ))}
        {shown.length === 0 ? <p className={styles.empty}>No matches</p> : null}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          disabled={readOnly || !shown.some((value) => checked.has(value))}
          onClick={ok}
        >
          OK
        </button>
        <button type="button" className={styles.button} onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Excel's Custom AutoFilter and Top 10 AutoFilter dialogs, shown in the menu. */
function CustomFilterForm({
  heading,
  op,
  initial,
  onCancel,
  onApply,
}: {
  heading: string;
  op: CustomOp;
  initial: FilterCondition | undefined;
  onCancel: () => void;
  onApply: (condition: FilterCondition) => void;
}) {
  const startValue =
    initial?.kind === 'text' ? initial.value : initial?.kind === 'number' ? String(initial.value) : '';
  const [value, setValue] = useState(op.kind === 'top' ? String(initial?.kind === 'top' ? initial.count : 10) : startValue);
  const [value2, setValue2] = useState(initial?.kind === 'number' && initial.value2 !== undefined ? String(initial.value2) : '');
  const [bottom, setBottom] = useState(initial?.kind === 'top' ? initial.bottom : false);
  const [error, setError] = useState<string | null>(null);

  const title =
    op.kind === 'top' ? 'Top 10 AutoFilter' : op.kind === 'text' ? TEXT_OP_LABELS[op.op] : NUMBER_OP_LABELS[op.op];

  const submit = (event: FormEvent): void => {
    event.preventDefault();

    if (op.kind === 'text') {
      if (value === '') return setError('Type the text to compare with.');
      return onApply({ kind: 'text', op: op.op, value });
    }

    if (op.kind === 'top') {
      const count = Math.trunc(Number(value));
      if (!Number.isFinite(count) || count < 1 || count > 500) return setError('Show between 1 and 500 items.');
      return onApply({ kind: 'top', count, bottom });
    }

    const first = Number(value);
    if (value.trim() === '' || !Number.isFinite(first)) return setError('Type a number.');
    if (op.op === 'between') {
      const second = Number(value2);
      if (value2.trim() === '' || !Number.isFinite(second)) return setError('Type both numbers.');
      return onApply({ kind: 'number', op: 'between', value: first, value2: second });
    }
    return onApply({ kind: 'number', op: op.op, value: first });
  };

  return (
    <form className={styles.form} onSubmit={submit} aria-label={title}>
      <p className={styles.formTitle}>
        Show rows where <strong>{heading}</strong>:
      </p>

      {op.kind === 'top' ? (
        <div className={styles.row}>
          <select className={styles.input} value={bottom ? 'bottom' : 'top'} onChange={(event) => setBottom(event.target.value === 'bottom')}>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </select>
          <input
            type="number"
            className={styles.input}
            min={1}
            max={500}
            value={value}
            autoComplete="off"
            autoFocus
            onChange={(event) => setValue(event.target.value)}
          />
          <span>Items</span>
        </div>
      ) : (
        <>
          <div className={styles.row}>
            <span className={styles.opLabel}>{op.kind === 'number' && op.op === 'between' ? 'is greater than or equal to' : title.toLowerCase()}</span>
            <input
              type={op.kind === 'number' ? 'number' : 'text'}
              className={styles.input}
              value={value}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              aria-label="Value"
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          {op.kind === 'number' && op.op === 'between' ? (
            <div className={styles.row}>
              <span className={styles.opLabel}>and is less than or equal to</span>
              <input
                type="number"
                className={styles.input}
                value={value2}
                autoComplete="off"
                aria-label="Second value"
                onChange={(event) => setValue2(event.target.value)}
              />
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" className={styles.button}>
          OK
        </button>
        <button type="button" className={styles.button} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The menu is portalled out of the grid, but React still bubbles its events up
 * the component tree into the grid's handlers — where a click would select a
 * cell and a keystroke in the search box would start typing into one.
 */
const stopGrid = {
  onPointerDown: (event: { stopPropagation: () => void }) => event.stopPropagation(),
  onDoubleClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
  onKeyDown: (event: { stopPropagation: () => void }) => event.stopPropagation(),
};
