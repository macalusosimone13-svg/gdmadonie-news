// Service worker minimo: la sua sola presenza (registrata + un ascoltatore
// "fetch") è ciò che Chrome/Android richiede per considerare il sito
// "installabile" come app, con tanto di banner automatico "Installa app".
// Non mette nulla in cache: ogni richiesta passa dritta alla rete, così il
// sito continua a mostrare sempre i dati aggiornati (comunicati, sondaggi,
// ecc.) invece di una versione vecchia salvata.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
