export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const swUrl = new URL("../sw.js", import.meta.url);
  const scope = new URL("../", import.meta.url).pathname;
  navigator.serviceWorker.register(swUrl, { scope }).catch(() => {});
}
