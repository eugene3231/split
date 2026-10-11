import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppFooter } from './AppFooter';

describe('AppFooter', () => {
  it('credits the author and links to the source', () => {
    render(<AppFooter />);

    expect(screen.getByRole('link', { name: 'Made by Eugene' })).toHaveAttribute(
      'href',
      'https://github.com/eugene3231',
    );
    expect(screen.getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/eugene3231/split',
    );
  });
});
