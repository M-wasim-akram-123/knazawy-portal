import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function Button({ children, type = 'button', className, ...rest }: ButtonProps) {
  const classes = className ? `kz-button ${className}` : 'kz-button';
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
