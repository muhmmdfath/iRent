/* global self */
// Customer app installation only. Private bookings, proofs and API data are
// always fetched from the server; no fetch handler or offline cache is added.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
