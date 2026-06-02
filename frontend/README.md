# React + Vite

> **Package manager: pnpm 11+ (supply-chain hardening).**
> Use `pnpm install`, **not** `npm install`. This project is pinned to
> `pnpm@11.1.3` via `packageManager` and configured in `pnpm-workspace.yaml` to:
> enforce a 24h minimum release age, block exotic transitive dependencies, and
> hard-fail any unreviewed dependency build/postinstall script. Run `pnpm dev`,
> `pnpm build`, `pnpm lint`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
