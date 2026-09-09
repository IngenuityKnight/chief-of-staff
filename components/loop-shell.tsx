'use client';
import { usePathname } from 'next/navigation';

// Keep the narrow loop free of legacy agent controls and mock household signals.
export function LoopShell({ children, legacy }: { children: React.ReactNode; legacy: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/loop') return <main id="main" className="min-h-screen">{children}</main>;
  return legacy;
}
