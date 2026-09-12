import { describe, expect, it } from 'vitest';
import { fillSeries } from './fillSeries';

/**
 * Auto Fill is a gesture a paper asks for by name, so what it produces is part
 * of what is marked. These pin each of Excel's rules and, more importantly, the
 * order it applies them in.
 */

describe('fillSeries', () => {
  it('continues month names and wraps at the end of the year', () => {
    expect(fillSeries(['Jan'], 11)).toEqual([
      'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]);
    expect(fillSeries(['Dec'], 2)).toEqual(['Jan', 'Feb']);
  });

  it('continues weekday names and the long forms too', () => {
    expect(fillSeries(['Mon'], 2)).toEqual(['Tue', 'Wed']);
    expect(fillSeries(['January'], 1)).toEqual(['February']);
  });

  it('follows the case the candidate typed', () => {
    // Excel continues what is there rather than imposing the list's casing.
    expect(fillSeries(['jan'], 1)).toEqual(['feb']);
    expect(fillSeries(['JAN'], 1)).toEqual(['FEB']);
  });

  it('continues the step two numbers establish', () => {
    expect(fillSeries([1, 2], 3)).toEqual([3, 4, 5]);
    expect(fillSeries([5, 10], 2)).toEqual([15, 20]);
    expect(fillSeries([10, 8], 2)).toEqual([6, 4]);
  });

  it('copies a single number rather than guessing a step', () => {
    // Excel needs Ctrl to step from one number. Guessing +1 would silently
    // change a column of prices into a sequence.
    expect(fillSeries([7], 3)).toEqual([7, 7, 7]);
  });

  it('increments the digits at the end of text, keeping any padding', () => {
    expect(fillSeries(['STU1101'], 2)).toEqual(['STU1102', 'STU1103']);
    expect(fillSeries(['STU007'], 2)).toEqual(['STU008', 'STU009']);
  });

  it('repeats anything it does not recognise', () => {
    expect(fillSeries(['Rahul'], 2)).toEqual(['Rahul', 'Rahul']);
  });

  it('cycles a multi-value source it cannot read as a series', () => {
    expect(fillSeries(['a', 'b'], 4)).toEqual(['a', 'b', 'a', 'b']);
  });

  it('fills blanks from a blank source rather than throwing', () => {
    expect(fillSeries([null], 2)).toEqual([null, null]);
    expect(fillSeries([], 0)).toEqual([]);
  });
});
