import { UxPrototype } from '@features/ux-prototypes';
import type { ComponentProps } from 'react';

export function UxPrototypePage(props: ComponentProps<typeof UxPrototype>) {
  return <UxPrototype {...props} />;
}
