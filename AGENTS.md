# AGENTS.md

## Build & Dev

- `npm run dev` — dev server
- `npm run build` — static export (outputs to `./out`)
- `npm run lint` — ESLint (standalone only; **build skips lint**)
- **Build skips typecheck too** (`ignoreBuildErrors: true`). Run `npx tsc --noEmit` separately if you want type checking.
- No test framework or test scripts exist.

## Package Manager

- **Use npm.** Both `package-lock.json` and `pnpm-lock.yaml` exist, but CI runs `npm ci`. Do not introduce pnpm.

## Architecture

- Single-page Next.js 15 app in **static export mode** (`output: 'export'`). No API routes, no server-side runtime.
- **Purpose:** Visualizes a 5-step methodology: AVL tree → level-order traversal → disk storage → heap indexing → binary search. See `busca-de-valores-eficiente.md` for the reference document.
- Entrypoint: `app/page.tsx` → renders `components/heap-visualizer.tsx` (all app logic, `"use client"`).
  - Contains `AVLTree` class (insert with rotations, level-order traversal with null placeholders).
  - 4 visualization tabs: AVL Tree (Graphviz), Disk Array, Heap Indexing, DOT Source.
  - Binary search navigates the heap-indexed array (parent=(i-1)/2, left=2i+1, right=2i+2).
- `components/level-array-element.tsx` — sub-component for level-array visualization (handles null/∅ slots).
- `components/ui/` — shadcn/ui primitives (managed by shadcn CLI, don't hand-edit).
- `lib/graphviz-types.d.ts` — manual type declarations for `@hpcc-js/wasm` (Graphviz WASM). The package lacks its own types.
- Path alias: `@/*` → project root.

## Key Gotchas

- **`@hpcc-js/wasm`** loads asynchronously in the browser. The Graphviz instance must be awaited via `Graphviz.load()` before use. The component handles this with a loading state.
- **`dangerouslySetInnerHTML`** is used in `heap-visualizer.tsx` to render Graphviz SVG output. Sanitization is not applied — the DOT source is generated internally, not from user free-text.
- **Level-order traversal includes null placeholders** (`∅`) to preserve heap index arithmetic. Without nulls, the parent/child index formulas (2i+1, 2i+2, (i-1)/2) would be incorrect.
- This project originated from **v0.dev** and can receive auto-pushed changes from that platform.

## Adding UI Components

shadcn/ui is configured (`components.json`). Add new components with:
```
npx shadcn@latest add <component-name>
```

## CI

GitHub Actions deploys to GitHub Pages on push to `main`. Uses Node 20, `npm ci`, `npx next build`. No typecheck or lint step in CI.
