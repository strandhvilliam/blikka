import { createColorScheme, createLocalStorage } from "@ui-sdk/core";

// System, light or dark, kept in this browser. Preferences in __root.tsx puts the choice on <html>
// as data-color-scheme before the first paint, and styles.css turns it into color-scheme.
export const colorScheme = createColorScheme({ global: true, storage: createLocalStorage("blikka-color-scheme") });
