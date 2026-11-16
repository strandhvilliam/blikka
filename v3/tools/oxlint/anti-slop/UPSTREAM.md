# Upstream

- Source: https://github.com/dmmulroy/anti-slop
- Commit: 13909c9 (`src/`, without its `*.test.ts` files), copied on 2026-11-15 by the `install-anti-slop` skill, whose bundled assets match that commit
- Installed plugins: `./index.ts` as `anti-slop`, `./effect/index.ts` as `anti-slop-effect`, registered in `v3/.oxlintrc.json`
- Plugin source: unchanged from upstream

Deviations in `v3/.oxlintrc.json`:

- The `anti-slop-effect` rules are off for `web/**`: the website doesn't depend on `effect`.
