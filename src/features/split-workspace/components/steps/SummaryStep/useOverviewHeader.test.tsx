import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOverviewHeader } from './useOverviewHeader';

function HeaderFixture() {
  const { attachStickyHeader, attachScroller, attachTable, onScroll } = useOverviewHeader();
  return (
    <>
      <header data-workspace-appbar />
      <div
        ref={attachStickyHeader}
        data-testid="clone"
        aria-hidden="true"
        style={{ visibility: 'hidden', height: 0 }}
      >
        <div data-header-people>
          <div data-header-cell />
          <div data-header-cell />
        </div>
        <div data-header-item />
      </div>
      <div ref={attachScroller} onScroll={onScroll} data-testid="scroller">
        <table ref={attachTable}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Alice</th>
            </tr>
          </thead>
        </table>
      </div>
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('overview header measurements', () => {
  it('keeps the semantic header visible when measurements are unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<HeaderFixture />);
    expect(
      screen.getByRole('columnheader', { name: 'Alice' }).parentElement?.parentElement,
    ).not.toHaveStyle({ opacity: '0' });
    expect(screen.getByTestId('clone')).toHaveStyle({ visibility: 'hidden', height: '0px' });
  });

  it('aligns fractional column widths, follows horizontal scroll and disconnects on unmount', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const height = this.tagName === 'HEADER' ? 61.5 : 68;
      const width = this.textContent === 'Item' ? 128.25 : 73.75;
      return new DOMRect(0, 0, width, height);
    });
    const { unmount } = render(<HeaderFixture />);
    const clone = screen.getByTestId('clone');
    expect(clone).toHaveStyle({
      top: '61.5px',
      height: '68px',
      marginBottom: '-68px',
      visibility: 'visible',
    });
    expect(clone.querySelector('[data-header-item]')).toHaveStyle({ width: '128.25px' });
    const cells = clone.querySelectorAll('[data-header-cell]');
    expect(cells[1]).toHaveStyle({ width: '73.75px' });
    expect(
      screen.getByRole('columnheader', { name: 'Alice' }).parentElement?.parentElement,
    ).toHaveStyle({ opacity: '0' });
    const scroller = screen.getByTestId('scroller');
    scroller.scrollLeft = 45.5;
    fireEvent.scroll(scroller);
    expect(clone.querySelector('[data-header-people]')).toHaveStyle({
      transform: 'translateX(-45.5px)',
    });
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
