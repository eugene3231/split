import { useMemo } from 'react';

function createOverviewHeader() {
  let scroller: HTMLDivElement | null = null;
  let sticky: HTMLDivElement | null = null;
  let table: HTMLTableElement | null = null;
  let observer: ResizeObserver | null = null;
  let mutations: MutationObserver | null = null;
  const syncScroll = () => {
    const strip = sticky?.querySelector<HTMLElement>('[data-header-people]');
    if (strip && scroller) strip.style.transform = `translateX(${-scroller.scrollLeft}px)`;
  };
  const measure = () => {
    if (!table || !sticky || !scroller || !table.tHead) return;
    const originals = Array.from(table.tHead.querySelectorAll('th'));
    const copies = Array.from(sticky.querySelectorAll<HTMLElement>('[data-header-cell]'));
    const height = table.tHead.getBoundingClientRect().height;
    if (height <= 0 || originals.length !== copies.length) return;
    originals.forEach((cell, index) => {
      copies[index].style.width = `${cell.getBoundingClientRect().width}px`;
      copies[index].style.height = `${height - 2}px`;
    });
    const item = sticky.querySelector<HTMLElement>('[data-header-item]');
    if (item) {
      item.style.width = copies[0].style.width;
      item.style.height = `${height}px`;
    }
    const appbar = document.querySelector('[data-workspace-appbar]');
    sticky.style.top = `${appbar?.getBoundingClientRect().height ?? 0}px`;
    sticky.style.height = `${height}px`;
    sticky.style.marginBottom = `${-height}px`;
    sticky.style.visibility = 'visible';
    table.tHead.style.opacity = '0';
    syncScroll();
  };
  const connect = () => {
    observer?.disconnect();
    mutations?.disconnect();
    if (!table || !sticky || !scroller || typeof ResizeObserver === 'undefined') return;
    observer = new ResizeObserver(measure);
    const appbar = document.querySelector('[data-workspace-appbar]');
    [table, scroller, ...table.querySelectorAll('thead th'), ...(appbar ? [appbar] : [])].forEach(
      (element) => observer?.observe(element),
    );
    mutations = new MutationObserver(connect);
    mutations.observe(table, { childList: true, subtree: true });
    measure();
  };
  return {
    attachTable(node: HTMLTableElement) {
      table = node;
      connect();
      return () => {
        observer?.disconnect();
        mutations?.disconnect();
        table = null;
      };
    },
    attachScroller(node: HTMLDivElement) {
      scroller = node;
      connect();
      return () => {
        observer?.disconnect();
        mutations?.disconnect();
        scroller = null;
      };
    },
    attachStickyHeader(node: HTMLDivElement) {
      sticky = node;
      connect();
      return () => {
        observer?.disconnect();
        mutations?.disconnect();
        sticky = null;
      };
    },
    onScroll: syncScroll,
  };
}

export function useOverviewHeader() {
  return useMemo(() => createOverviewHeader(), []);
}
