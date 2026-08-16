# Tech Stack

## Tooling

- **Package manager:** always use `pnpm`. Install, run scripts and add dependencies with `pnpm`,
  never `npm` or `yarn`, and keep `pnpm-lock.yaml` as the only lockfile in the repo.

## State & Data

- **Global state:** always use `zustand`. No context-provider-per-feature, no reducers hand-rolled
  for state a store already covers.
- **Server data:** always use TanStack Query (`@tanstack/react-query`) for fetching, refetching and
  cache invalidation. Every query gets an explicit, structured query key so mutations can invalidate
  it precisely.
- **Tables:** build every table with TanStack Table (`@tanstack/react-table`), with pagination wired
  up from the start. No bare `.map()` over rows once sorting, filtering or paging is in play.
- **Charts:** always use TanStack Charts. No second charting library in the same project.

## UI Components

- **Components:** use [Kumo UI](https://kumo-ui.com/) (`@cloudflare/kumo`) for buttons, inputs, dialogs,
  tables, sidebars, and other UI primitives. Install new pieces with `pnpm add @cloudflare/kumo` or
  the Kumo CLI for blocks. Thin adapters in `src/components/ui/` may wrap Kumo to keep existing import
  paths stable during migration.
- **Icons:** use `@phosphor-icons/react` with Kumo components. Lucide remains acceptable in app-specific
  views until migrated.
- **Cards:** prefer Kumo `LayerCard`. Cult-ui cutout cards may remain where the design depends on them.
- **Text animations:** use https://www.cult-ui.com/docs/components/text-animate.
- **Arrows:** use https://www.cult-ui.com/docs/components/squiggle-arrow.
- **Loaders:** use Kumo `Loader` from `@cloudflare/kumo`, or https://loading-ui.com/ for decorative spinners.

## Forms & Notifications

- **Toasts and notifications:** always use `react-hot-toast` (https://react-hot-toast.com/),
  mounted once via `components/providers/ToastProvider.jsx`. No other toast library, no ad-hoc
  inline banners for transient feedback.
- **Forms:** build every form with `react-hook-form` + `zod` (via `@hookform/resolvers`). Submit
  through a TanStack Query `useMutation`, never a bare `fetch` in `onSubmit`: throw the API's error
  message inside `mutationFn`, `toast.error(...)` it in `onError`, and invalidate the affected query
  keys (plus `toast.success(...)`) in `onSuccess`. See Stack.md for the canonical mutation and form
  code.
- **Form design:** follow the patterns at https://www.formscn.space/ for layout, labelling and
  error placement.

## Copy

- Never use em dashes (—) or en dashes (–) in user-facing copy (UI strings, emails,
  headings, marketing). Rewrite with a comma, period, parentheses, or a reworded
  sentence. Hyphens in compound words (e.g. "cross-posting") are fine.

## Security

- After each feature, run CodeRabbit, read the findings, and apply the fixes that are real. Do not
  close out a feature with an unreviewed diff.
