# General

- Never run SST cli commands unless strictly specified by user
- Do not try to build to verify the apps are working
- Do not run drizzle-kit or any other db cli tool. This should be done manually

## Vendored Repositories

This project vendors external repositories under @repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - application code should continue importing from normal package dependencies

### Effect

When writing Effect code, inspect @repos/effect/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

Always read @repos/effect/LLMS.md before writing any Effect code.
