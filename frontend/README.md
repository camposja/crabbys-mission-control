# React + Vite

> **Package manager: pnpm 11+ (supply-chain hardening).**
> Install with `mise exec -- corepack pnpm install` — never `npm`/`yarn`;
> `pnpm-lock.yaml` is the only lockfile this project keeps. Pinned to `pnpm@11.19.0` via `packageManager` and
> configured in `pnpm-workspace.yaml` to: enforce a **7-day** minimum release age,
> block exotic transitive dependencies, and hard-fail any unreviewed dependency
> build/postinstall script. Always launch it through Corepack: `corepack pnpm dev`
> interactively, `mise exec -- corepack pnpm …` from scripts, Procfiles and CI
> (a bare `pnpm` is not on PATH). Scripts: `dev`, `build`, `lint`, `test`.
>
> The dev server binds to **127.0.0.1** explicitly (`VITE_BIND`, see
> `src/lib/devServer.js`); a non-loopback bind is refused unless
> `VITE_ENABLE_LAN_MODE=true`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
