// Runtime config the root route renders into the page (web/src/routes/__root.tsx). Browser only.
export const meta = (name: string) =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;
