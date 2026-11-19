import type { ComponentProps } from 'react';
import { cn } from '@shared/utils/cn';
import { buttonClass, type ButtonSize, type ButtonVariant } from './classes';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...props} />;
}
