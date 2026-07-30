import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import styles from '~/styles.css?url'

/**
 * Full-document SSR. `shellComponent` owns <html>, <head> and <body>, so the
 * server streams a real document (no client-side shell swap) and <HeadContent>
 * picks up `head()` from whichever route matched.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'SubIt' },
      { name: 'description', content: 'Track what you are paying for every month.' },
    ],
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="panel">
      <p>No such subscription.</p>
      <Link to="/">Back to the list</Link>
    </div>
  ),
})

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="wrap">
          <header className="top">
            <h1>
              <Link to="/">SubIt</Link>
            </h1>
            <nav>
              <Link to="/" activeOptions={{ exact: true }}>
                Subscriptions
              </Link>
              <Link to="/stats">Stats</Link>
              <Link to="/settings">Settings</Link>
            </nav>
          </header>
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  )
}
