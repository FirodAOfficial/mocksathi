import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSpreadsheetUiStore } from '@/state/spreadsheetUiStore';
import { SpreadsheetShell } from './SpreadsheetShell';

/**
 * The editor as a candidate meets it.
 *
 * The gate these exist for is the one the plan calls the whole product: the
 * grid must put on screen only what is on screen. jsdom does not lay anything
 * out, so the viewport is stubbed — without that `clientHeight` is 0 and the
 * grid would honestly render almost nothing, which would make the bound below
 * pass for the wrong reason.
 */

const VIEWPORT = { width: 1200, height: 600 };

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => VIEWPORT.width,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => VIEWPORT.height,
  });

  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  // Every field, not just the ones a given test touches: the store is a module
  // singleton, so a leftover `readOnly` from one test silently fails the next.
  useSpreadsheetUiStore.setState({
    activeTab: 'home',
    zoom: 1,
    showFormulaBar: true,
    showFormulas: false,
    readOnly: false,
    notice: null,
  });
  cleanup();
});

async function typeIntoActiveCell(text: string): Promise<void> {
  const grid = screen.getByRole('grid');
  grid.focus();
  await userEvent.keyboard(text);
}

describe('SpreadsheetShell', () => {
  it('opens on a blank workbook with Excel’s chrome', () => {
    render(<SpreadsheetShell />);

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByLabelText('Name Box')).toHaveValue('A1');
    expect(screen.getByRole('tab', { name: 'Sheet1' })).toHaveAttribute('aria-selected', 'true');

    for (const tab of ['Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View']) {
      expect(within(screen.getByRole('tablist', { name: 'Ribbon' })).getByRole('tab', { name: tab })).toBeInTheDocument();
    }
  });

  it('renders only the cells that exist, not one element per row', () => {
    // The hard gate. A sheet is a million rows; if this ever scales with the
    // sheet rather than the viewport, the editor is unusable and no amount of
    // UI polish saves it.
    const { container } = render(<SpreadsheetShell />);

    expect(container.querySelectorAll('*').length).toBeLessThan(1_500);
    // A blank sheet has no occupied cells at all, so it has no cell elements.
    expect(screen.queryAllByRole('gridcell')).toHaveLength(0);
  });

  it('takes a typed value and shows it in the cell', async () => {
    render(<SpreadsheetShell />);
    await typeIntoActiveCell('42{Enter}');

    expect(screen.getByRole('gridcell')).toHaveTextContent('42');
  });

  it('evaluates a formula and shows its source in the formula bar', async () => {
    render(<SpreadsheetShell />);

    await typeIntoActiveCell('10{Enter}20{Enter}=SUM(A1:A2){Enter}');

    // The engine loads on demand, so the value arrives a tick later.
    // Scoped to a cell: row header 30 also reads "30".
    expect(await screen.findByRole('gridcell', { name: /^30$/ })).toBeInTheDocument();

    const grid = screen.getByRole('grid');
    grid.focus();
    await userEvent.keyboard('{ArrowUp}');

    expect(screen.getByRole('textbox', { name: /^Formula bar/ })).toHaveValue('=SUM(A1:A2)');
  });

  it('moves the cursor with the arrow keys and says where it is', async () => {
    render(<SpreadsheetShell />);
    const grid = screen.getByRole('grid');
    grid.focus();

    await userEvent.keyboard('{ArrowDown}{ArrowRight}{ArrowRight}');

    expect(screen.getByLabelText('Name Box')).toHaveValue('C2');
  });

  it('formats the selection from the ribbon', async () => {
    render(<SpreadsheetShell />);
    await typeIntoActiveCell('x{Enter}');

    const grid = screen.getByRole('grid');
    grid.focus();
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(screen.getByRole('gridcell')).toHaveStyle({ fontWeight: '700' });
  });

  it('undoes the last action from the Quick Access Toolbar', async () => {
    render(<SpreadsheetShell />);
    await typeIntoActiveCell('hello{Enter}');

    await userEvent.click(screen.getByRole('button', { name: /^Undo/ }));

    expect(screen.queryAllByRole('gridcell')).toHaveLength(0);
  });

  it('adds and names a worksheet', async () => {
    render(<SpreadsheetShell />);

    await userEvent.click(screen.getByRole('button', { name: 'Insert Worksheet' }));

    expect(screen.getByRole('tab', { name: 'Sheet2' })).toHaveAttribute('aria-selected', 'true');
  });

  it('refuses to delete the last sheet, and says why', () => {
    render(<SpreadsheetShell />);

    expect(screen.getByRole('button', { name: 'Delete Sheet' })).toBeDisabled();
  });

  describe('honesty of the controls', () => {
    it('gives every disabled ribbon control a reason', async () => {
      // Same rule the Word ribbon is held to: nothing that looks live is inert,
      // and nothing that is unavailable is silent about why.
      render(<SpreadsheetShell />);

      for (const tab of ['Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View']) {
        await userEvent.click(
          within(screen.getByRole('tablist', { name: 'Ribbon' })).getByRole('tab', { name: tab }),
        );

        for (const button of within(screen.getByRole('tabpanel')).getAllByRole('button')) {
          if (!(button as HTMLButtonElement).disabled) continue;
          expect(button.getAttribute('title')).toMatch(/—/);
        }
      }
    });

    it('puts every group Excel has where Excel puts it', async () => {
      // Half of what a practical paper tests is knowing where a command lives,
      // so the groups are Excel's even where their contents are not.
      render(<SpreadsheetShell />);
      const tabs = screen.getByRole('tablist', { name: 'Ribbon' });

      const groups: Record<string, string[]> = {
        Insert: ['Tables', 'Illustrations', 'Add-ins', 'Charts', 'Sparklines', 'Filters', 'Links', 'Text', 'Symbols'],
        'Page Layout': ['Themes', 'Page Setup', 'Scale to Fit', 'Sheet Options', 'Arrange'],
        Data: ['Get External Data', 'Connections', 'Sort & Filter', 'Data Tools', 'Outline'],
        Review: ['Proofing', 'Language', 'Comments', 'Changes'],
        View: ['Workbook Views', 'Show', 'Zoom', 'Window', 'Macros'],
      };

      for (const [tab, expected] of Object.entries(groups)) {
        await userEvent.click(within(tabs).getByRole('tab', { name: tab }));
        for (const group of expected) {
          expect(screen.getByRole('region', { name: `${group} group` })).toBeInTheDocument();
        }
      }
    });
  });
});

/**
 * Building a formula by pointing at cells.
 *
 * The way almost nobody writes a formula is by typing `A1` out. They type `=`,
 * press an arrow or click the cell, type `+`, and pick the next one — so an
 * editor where the arrow keys only move a caret is one where formulas have to
 * be spelled from memory.
 */
describe('point mode', () => {
  function editorFor(address: string): HTMLElement {
    return screen.getByRole('textbox', { name: `Edit ${address}` });
  }

  it('picks up the cell an arrow key lands on', async () => {
    render(<SpreadsheetShell />);
    await typeIntoActiveCell('10{Enter}20{Enter}');

    await typeIntoActiveCell('=');
    await userEvent.keyboard('{ArrowUp}');
    expect(editorFor('A3')).toHaveValue('=A2');

    // A second arrow walks the reference on rather than adding another one.
    await userEvent.keyboard('{ArrowUp}');
    expect(editorFor('A3')).toHaveValue('=A1');
  });

  it('starts the next reference over after an operator', async () => {
    render(<SpreadsheetShell />);
    await typeIntoActiveCell('10{Enter}20{Enter}');

    await typeIntoActiveCell('=');
    await userEvent.keyboard('{ArrowUp}+{ArrowUp}{ArrowUp}');

    // `+` closes the first reference off: the next arrow starts from the cell
    // being edited again, not from where the last one got to.
    expect(editorFor('A3')).toHaveValue('=A2+A1');

    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('gridcell', { name: /^30$/ })).toBeInTheDocument();
  });

  it('drags out a range with Shift', async () => {
    render(<SpreadsheetShell />);
    await typeIntoActiveCell('10{Enter}20{Enter}');

    await typeIntoActiveCell('=SUM(');
    await userEvent.keyboard('{ArrowUp}{Shift>}{ArrowUp}{/Shift}');

    expect(editorFor('A3')).toHaveValue('=SUM(A1:A2');

    // The closing bracket is the one thing pointing never types, so committing
    // adds it — as Excel does, rather than failing to parse.
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('gridcell', { name: /^30$/ })).toBeInTheDocument();
  });

  it('commits a plain entry and moves on when an arrow is pressed', async () => {
    // How a column of numbers is typed: no reaching for Enter between cells.
    render(<SpreadsheetShell />);
    await typeIntoActiveCell('5{ArrowDown}');

    expect(screen.getByRole('gridcell')).toHaveTextContent('5');
    expect(screen.getByLabelText('Name Box')).toHaveValue('A2');
  });

  it('gives the arrows back to the caret once F2 opens the text', async () => {
    // F2 is Excel's Edit mode: the point of it is fixing a character in the
    // middle of a formula, which an arrow that pointed at cells would prevent.
    render(<SpreadsheetShell />);
    await typeIntoActiveCell('7{Enter}=A1{Enter}');

    const grid = screen.getByRole('grid');
    grid.focus();
    // Up to A2, F2 to open it, then an arrow that must move the caret through
    // `=A1` rather than append a second reference to it.
    await userEvent.keyboard('{ArrowUp}{F2}{ArrowUp}{Enter}{ArrowUp}');

    expect(screen.getByRole('textbox', { name: /^Formula bar/ })).toHaveValue('=A1');
  });
});

describe('the controls the new tabs actually wire', () => {
  async function openTab(name: string): Promise<void> {
    await userEvent.click(
      within(screen.getByRole('tablist', { name: 'Ribbon' })).getByRole('tab', { name }),
    );
  }

  it('protects the sheet from the Review tab, and says so', async () => {
    render(<SpreadsheetShell />);
    await openTab('Review');
    await userEvent.click(screen.getByRole('button', { name: 'Protect Sheet' }));

    // The status bar is where Excel reports it, and it is the only place a
    // candidate can see the state without hunting through the ribbon.
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unprotect Sheet' })).toBeInTheDocument();
  });

  it('refuses edits while the sheet is protected', async () => {
    render(<SpreadsheetShell />);
    await openTab('Review');
    await userEvent.click(screen.getByRole('button', { name: 'Protect Sheet' }));

    const grid = screen.getByRole('grid');
    grid.focus();
    await userEvent.keyboard('42{Enter}');

    expect(screen.queryAllByRole('gridcell')).toHaveLength(0);
  });

  it('disables the formatting controls while protected, with the reason', async () => {
    // Dead rather than gone: a candidate who cannot find Bold needs to be told
    // why, not left hunting for a button that has been removed.
    render(<SpreadsheetShell />);
    await openTab('Review');
    await userEvent.click(screen.getByRole('button', { name: 'Protect Sheet' }));
    await openTab('Home');

    const bold = screen.getByRole('button', { name: 'Bold' });

    expect(bold).toBeDisabled();
    expect(bold.getAttribute('title')).toContain('protected');
  });

  it('hides a sheet and brings it back', async () => {
    render(<SpreadsheetShell />);
    await userEvent.click(screen.getByRole('button', { name: 'Insert Worksheet' }));
    await openTab('View');

    // A workbook must keep one sheet in view, so Hide needs a second one.
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('tab', { name: 'Sheet2' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sheet1' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Unhide' }));
    await userEvent.click(screen.getByRole('button', { name: /Unhide sheet/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Sheet2' }));

    expect(screen.getByRole('tab', { name: 'Sheet2' })).toBeInTheDocument();
  });

  it('will not hide the only visible sheet', async () => {
    render(<SpreadsheetShell />);
    await openTab('View');

    expect(screen.getByRole('button', { name: 'Hide' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unhide' })).toBeDisabled();
  });

  it('inserts a symbol into the active cell', async () => {
    render(<SpreadsheetShell />);
    await openTab('Insert');

    await userEvent.click(screen.getByRole('button', { name: 'Symbol' }));
    await userEvent.click(screen.getByRole('menuitem', { name: '₹' }));

    expect(screen.getByRole('gridcell')).toHaveTextContent('₹');
  });

  it('changes the zoom from the View tab', async () => {
    render(<SpreadsheetShell />);
    await openTab('View');

    await userEvent.click(screen.getByRole('button', { name: 'Zoom' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: '150%' }));

    expect(screen.getByText('150%')).toBeInTheDocument();
  });
});
