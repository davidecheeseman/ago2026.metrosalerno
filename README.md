# Metro Salerno 🚇

App web PWA offline-first per la metropolitana leggera di Salerno.
Gli orari programmati e il pianificatore funzionano senza backend; una sorgente
live opzionale può arricchire le partenze senza compromettere il fallback.

## Features

- **Vista Linea**: diagramma schematico con treni in tempo reale
- **Vista Mappa**: Leaflet con overlay linea metro su mappa reale
- **Toggle animato** tra le due viste
- **Geolocalizzazione**: stazione più vicina + distanza
- **Partenze**: prossimi treni con countdown, direzione, stato
- **Duomo-Via Vernieri**: treni regionali linea Napoli-Salerno
- **Fermate future**: ASI, Ospedale, Pontecagnano, S. Antonio, Aeroporto ✈
- **Live opzionale**: endpoint normalizzato configurabile, con cache e fallback
- **PWA**: installabile da browser, funziona offline
- **Dark theme**: design Citymapper-inspired

## Deploy su GitHub Pages

Il workflow `.github/workflows/pages.yml` pubblica automaticamente la cartella
`public/` a ogni push sul branch `main`. Nel repository GitHub abilita
**Settings → Pages → Source → GitHub Actions**.

L'app usa solo percorsi relativi, quindi funziona sia su un dominio principale
sia sotto un percorso come `utente.github.io/metro-salerno/`.

## Architettura

```
public/
├── index.html             # shell e markup dell'interfaccia
├── css/app.css            # presentazione
├── js/
│   ├── app.js             # coordinamento UI
│   ├── config.js          # configurazione del livello live
│   ├── data.js            # stazioni e punti di interesse
│   ├── timetable.js       # dominio offline e orari programmati
│   ├── realtime.js        # live opzionale, timeout e cache
│   └── pwa.js             # registrazione service worker
├── manifest.json
└── sw.js                  # application shell offline
```

Per abilitare una sorgente live, imposta `REALTIME_ENDPOINT` in
`public/js/config.js`. L'endpoint riceve `?station=<id>` e restituisce:

```json
{
  "observedAt": "2026-08-01T14:29:12+02:00",
  "departures": [
    {
      "time": "14:35",
      "destination": "Stadio Arechi",
      "direction": "arechi",
      "delayMinutes": 4,
      "status": "running"
    }
  ]
}
```

Con endpoint assente, offline o irraggiungibile, l'app continua a usare il
cadenzamento locale. L'ultimo snapshot live valido viene conservato sul
dispositivo e mostrato indicando la sua provenienza.

## Deploy alternativo con Portainer

### 1. Push su Forgejo

```bash
cd metro-salerno
git init
git add .
git commit -m "initial commit"
git remote add origin https://git.davideauricchio.it/davide/metro-salerno.git
git push -u origin main
```

### 2. Build immagine Docker

Sul tuo server (o via CI):

```bash
docker build -t metro-salerno .
```

Oppure se hai il Forgejo Container Registry attivo:

```bash
docker build -t git.davideauricchio.it/davide/metro-salerno:latest .
docker push git.davideauricchio.it/davide/metro-salerno:latest
```

### 3. Stack Portainer

In Portainer → Stacks → Add Stack:

- **Nome**: `metro-salerno`
- **Build method**: Upload — carica `portainer-stack.yml`
- Oppure se hai buildato l'immagine, cambia `build: .` con `image: metro-salerno:latest`

### 4. Cloudflare Tunnel

Nel tuo tunnel config, aggiungi:

```yaml
- hostname: metro.davideauricchio.it   # o il dominio che vuoi
  service: http://metro-salerno:80
```

Se il container è nella stessa Docker network del tunnel, usa il nome container.

## Struttura

```
metro-salerno/
├── Dockerfile              # Nginx + app statica
├── nginx.conf              # Gzip, cache, SPA fallback, proxy VT
├── portainer-stack.yml     # Stack per Portainer
├── public/
│   ├── index.html          # Shell HTML
│   ├── css/                # Stili
│   ├── js/                 # Moduli ES
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker offline
└── README.md
```

## Proxy ViaggiaTreno

Il nginx config include un reverse proxy:

```
/api/vt/partenze/S09218/... → viaggiatreno.it/infomobilita/.../partenze/S09218/...
```

Questo risolve il problema CORS. Per usarlo nell'app, cambia le fetch URL da
`https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/...` a `/api/vt/...`.

## Mobile (futuro)

Per Android/iOS con Capacitor:

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/geolocation
npx cap init "Metro Salerno" it.davideauricchio.metrosa --web-dir=public
npx cap add android
npx cap add ios
npx cap sync
```

Le app native non hanno CORS → chiamano ViaggiaTreno direttamente, zero server tuo.

## Licenza

Progetto personale. Dati orari da cadenzamento pubblico Trenitalia.
