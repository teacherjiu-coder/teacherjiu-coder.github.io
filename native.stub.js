/** GitHub Pages 등 브라우저용 (Capacitor 번들 없을 때) */
window.ComhwalNative = {
  ready: () => Promise.resolve(),
  isNative: () => false,
  openExternal: (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
};
