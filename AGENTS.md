# General

- Never run SST cli commands unless strictly specified by user
- Do not try to build to verify the apps working

## Effect

The Effect V4 repository is cloned to `~/.codesource/effect-v4` for reference.
Use this to explore APIs, find usage examples, and understand implementation
details when the documentation isn't enough.

When writing Effect code, you should strive to follow the patterns in `~/.codesource/effect-v4/LLMS.md` as much as you can. Use effect for all code running on the server.

# Next.js - React (apps/web/)

## Base

- Nextjs with tailwind v4, shadcn, lucide react
- Server components uses Effect based custom utils found in the app root. These runs in a effect based managed server-runtime.
- If running effect client side use the client-runtime specified in the app root.
- Use React Compiler and minimize useMemo/useCallback/memo unless necessary for some reason
- Prefer composable components over large do-it-all components.
- Avoid prop drilling where possible
- Use arrow syntax for functions inside component. Use function syntax for functions outside components

## Folder Structure React/Next App

- Aim to colocate components, hooks and util with routes/pages. Use \_components, \_hooks and \_lib folders.
- For reusable or general stuff place in general components/, hooks/ and lib/ folder
- Place any non react code but client code in the lib (or \_lib for colocated) and name the files in a descriptive way. Like 'file-processing.ts' or 'validation.ts' and so on. For very general small utilities place them in the 'utils.ts' file in lib/ (or \_lib)

## Packages to use

- Use Tanstack Form for most type of forms, unless very simple or not fitting
- Go for zustand if bit complex state management, go for nuqs for queryparams state
- Zod for client side schema validation, Effect Schema for server side schema validation
