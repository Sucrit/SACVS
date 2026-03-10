import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function TopNavPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const container = document.getElementById('top-nav-search-portal');
  if (!container) return null;

  return createPortal(children, container);
}