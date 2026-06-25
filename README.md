# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Security hardening

### Package manager enforcement

- `pnpm` is the only supported package manager.
- `packageManager` is pinned to `pnpm@10.33.0`.
- `engines` explicitly require pnpm and reject npm/yarn.

### Frozen lockfile policy

- Lockfiles are frozen by default through `.npmrc`:
  - `prefer-frozen-lockfile=true`
  - `frozen-lockfile=true`
- Standard install command:

```bash
pnpm install
```

- To intentionally update dependencies and regenerate lockfile, append `--no-frozen-lockfile`:

```bash
pnpm install --no-frozen-lockfile
```

Use that flag only when intentionally changing dependency resolution.

### CI security gates

GitHub Actions enforces:

- Biome lint and format check (`lint:check`, no autofix)
- Build
- Tests if a `test` script exists
- Dependency audit with `pnpm audit --audit-level=moderate`

### Vulnerability remediation strategy

To reduce breakage risk, remediation follows a non-breaking policy:

1. Prefer patch/minor updates for direct dependencies.
2. Use `pnpm.overrides` to force patched transitive versions when safe.
3. Avoid major upgrades unless no viable non-breaking remediation exists.

### Local verification

```bash
pnpm install
pnpm run lint:check
pnpm run build
pnpm audit --audit-level=moderate
snyk test
```

For local cleanup, `pnpm run lint` runs Biome lint fixes and formatting.
