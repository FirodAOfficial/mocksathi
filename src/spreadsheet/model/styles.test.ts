import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE_ID, StyleRegistry, type CellStyle } from './styles';

/**
 * Interning is what keeps a formatted column from becoming a million style
 * objects. These tests exist to catch the two ways that guarantee breaks:
 * equal styles that fail to share an id, and a shared style that can be mutated
 * through one cell and silently restyle every other cell holding it.
 */

describe('StyleRegistry', () => {
  it('gives the blank style id 0, and starts with only that', () => {
    const registry = new StyleRegistry();

    expect(registry.intern({})).toBe(DEFAULT_STYLE_ID);
    expect(registry.size).toBe(1);
  });

  it('hands the same id to equal styles', () => {
    const registry = new StyleRegistry();

    const first = registry.intern({ bold: true, fontSize: 12 });
    const second = registry.intern({ bold: true, fontSize: 12 });

    expect(second).toBe(first);
    expect(registry.size).toBe(2);
  });

  it('ignores the order properties were written in', () => {
    // `{bold, italic}` and `{italic, bold}` are the same style; without sorted
    // keys they would intern as two, and the saving would quietly evaporate.
    const registry = new StyleRegistry();

    const first = registry.intern({ bold: true, italic: true });
    const second = registry.intern({ italic: true, bold: true });

    expect(second).toBe(first);
    expect(registry.size).toBe(2);
  });

  it('treats an explicit undefined as absent', () => {
    const registry = new StyleRegistry();

    expect(registry.intern({ bold: undefined })).toBe(DEFAULT_STYLE_ID);
    expect(registry.size).toBe(1);
  });

  it('interns nested borders by value, not by identity', () => {
    const registry = new StyleRegistry();
    const borders = { top: { style: 'thin' as const, color: '#000000' } };

    const first = registry.intern({ borders });
    const second = registry.intern({
      borders: { top: { color: '#000000', style: 'thin' } },
    });

    expect(second).toBe(first);
  });

  it('freezes what it hands out', () => {
    // An id promises the style behind it never changes. Mutating one would
    // restyle every cell sharing it, from anywhere in the app.
    const registry = new StyleRegistry();
    const id = registry.intern({ bold: true });
    const style = registry.get(id) as CellStyle;

    expect(Object.isFrozen(style)).toBe(true);
    expect(() => {
      (style as { bold?: boolean }).bold = false;
    }).toThrow(TypeError);
  });

  it('resolves an unknown id to the default instead of throwing', () => {
    // A cell can outlive a registry in a malformed workbook; rendering it plain
    // beats crashing the grid.
    expect(new StyleRegistry().get(9999)).toEqual({});
  });

  describe('derive', () => {
    it('applies a change on top of an existing style', () => {
      const registry = new StyleRegistry();
      const base = registry.intern({ fontSize: 12 });

      const bolded = registry.derive(base, { bold: true });

      expect(registry.get(bolded)).toEqual({ fontSize: 12, bold: true });
      expect(registry.get(base)).toEqual({ fontSize: 12 });
    });

    it('keeps cells that shared a style sharing one afterwards', () => {
      // Bolding a selection derives per cell; if two cells started equal they
      // must end equal, or the registry grows with the selection size.
      const registry = new StyleRegistry();
      const base = registry.intern({ fontSize: 12 });

      expect(registry.derive(base, { bold: true })).toBe(registry.derive(base, { bold: true }));
    });

    it('clears a property when the change is undefined', () => {
      // "No fill" has to be expressible, and it is not the same as "leave the
      // fill alone".
      const registry = new StyleRegistry();
      const filled = registry.intern({ fillColor: '#ffff00', bold: true });

      const cleared = registry.derive(filled, { fillColor: undefined });

      expect(registry.get(cleared)).toEqual({ bold: true });
    });

    it('returns to the blank style when the last property is cleared', () => {
      const registry = new StyleRegistry();
      const bold = registry.intern({ bold: true });

      expect(registry.derive(bold, { bold: undefined })).toBe(DEFAULT_STYLE_ID);
    });
  });

  it('stays small when a whole column is formatted alike', () => {
    // The point of the whole file: 10,000 cells bolded is one new style.
    const registry = new StyleRegistry();
    const base = registry.intern({});

    for (let row = 0; row < 10_000; row += 1) registry.derive(base, { bold: true });

    expect(registry.size).toBe(2);
  });
});
