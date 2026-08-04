import { Toaster } from 'react-hot-toast'

/** Mounted once, in __root. Per CLAUDE.md this is the only toast surface. */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      // Inline styles, because react-hot-toast renders outside any element a
      // class could reach. They read the tokens rather than restating them, so
      // a toast follows the theme like everything else.
      toastOptions={{
        style: {
          background: 'var(--surface-2)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-1)',
        },
        success: { iconTheme: { primary: 'var(--brand)', secondary: 'var(--brand-foreground)' } },
        error: {
          duration: 6000,
          iconTheme: { primary: 'var(--danger)', secondary: 'var(--danger-foreground)' },
        },
      }}
    />
  )
}
