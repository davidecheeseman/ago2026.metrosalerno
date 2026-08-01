const STORAGE_KEY = "metro-salerno:install-onboarding:v1";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function platform() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  return ios ? "ios" : android ? "android" : null;
}

export function initInstallPrompt() {
  if (isStandalone() || localStorage.getItem(STORAGE_KEY)) return;
  const device = platform();
  if (!device) return;

  let deferredPrompt = null;
  const overlay = document.createElement("div");
  overlay.className = "install-splash";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "installTitle");
  overlay.innerHTML = `
    <div class="install-card">
      <img class="install-icon" src="./icon-192.png" alt="" width="80" height="80">
      <div class="install-kicker">METRO SALERNO</div>
      <h2 id="installTitle">Portala sempre con te</h2>
      <p>Installala come web app per consultare fermate e orari anche quando la rete non è disponibile.</p>
      <div class="install-how">
        ${device === "ios"
          ? `<strong>Su iPhone e iPad</strong><span>Tocca Condividi in Safari, poi <b>Aggiungi alla schermata Home</b>.</span>`
          : `<strong>Su Android</strong><span>Tocca Installa. Se non compare il prompt, usa il menu del browser e scegli <b>Aggiungi a schermata Home</b>.</span>`}
      </div>
      <div class="install-actions">
        <button class="install-primary" type="button">${device === "ios" ? "Ho capito" : "Installa l’app"}</button>
        <button class="install-later" type="button">Non ora</button>
      </div>
      <div class="install-hint" aria-live="polite"></div>
    </div>`;

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "seen");
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 350);
  };

  const primary = overlay.querySelector(".install-primary");
  const hint = overlay.querySelector(".install-hint");
  primary.addEventListener("click", async () => {
    if (device === "ios") return close();
    if (!deferredPrompt) {
      hint.textContent = "Apri il menu del browser e scegli “Aggiungi a schermata Home”.";
      primary.textContent = "Ho capito";
      primary.addEventListener("click", close, { once: true });
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    close();
  });
  overlay.querySelector(".install-later").addEventListener("click", close);
  document.addEventListener("keydown", event => { if (event.key === "Escape") close(); }, { once: true });
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener("appinstalled", close, { once: true });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add("visible");
    primary.focus();
  }));
}

