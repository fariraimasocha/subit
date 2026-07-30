import { Toaster } from 'react-hot-toast'

/** Mounted once, in __root. Per CLAUDE.md this is the only toast surface. */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: { background: '#171717', color: '#fafafa', border: '1px solid #333' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#171717' } },
        error: { duration: 6000 },
      }}
    />
  )
}
