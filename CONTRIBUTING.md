# Contributing

1. Create a branch from `main`.
2. Install dependencies with `pnpm install`.
3. Keep decision rules inside pure functions under `src/lib`.
4. Run `pnpm lint`, `pnpm test`, and `pnpm build`.
5. Include tests for changes to matching, precedence, or the import schema.

Schema changes require a versioned migration and a compatibility note in the changelog.
