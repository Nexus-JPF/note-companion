import NextLink, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

export type AppLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: ReactNode;
  };

/**
 * Next.js Link wrapper for React 19 JSX compatibility.
 * The default next/link export fails strict JSX checks with @types/react 19.
 */
export function Link({ children, ...props }: AppLinkProps) {
  const NextLinkComponent = NextLink as React.FC<AppLinkProps>;
  return <NextLinkComponent {...props}>{children}</NextLinkComponent>;
}
