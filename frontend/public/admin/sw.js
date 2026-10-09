self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    /* Always show a visible notification. */
  }
  const title =
    typeof payload.title === "string"
      ? payload.title.slice(0, 160)
      : "iRent Admin";
  const body =
    typeof payload.body === "string"
      ? payload.body.slice(0, 400)
      : "Ada pembaruan untuk diperiksa.";
  let url = "/admin/";
  try {
    const target = new URL(payload.url, self.location.origin);
    if (
      target.origin === self.location.origin &&
      target.pathname.startsWith("/admin/")
    )
      url = target.pathname + target.search;
  } catch {
    /* Use the authenticated admin entry point. */
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/admin/icon-192.png",
      badge: "/admin/icon-192.png",
      tag:
        typeof payload.tag === "string" ? payload.tag.slice(0, 128) : undefined,
      renotify: false,
      data: { url },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      let url = new URL("/admin/", self.location.origin);
      try {
        const target = new URL(
          event.notification.data?.url,
          self.location.origin,
        );
        if (
          target.origin === url.origin &&
          target.pathname.startsWith("/admin/")
        )
          url = target;
      } catch {
        /* Keep the local admin entry point. */
      }
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (
          new URL(client.url).origin === url.origin &&
          new URL(client.url).pathname.startsWith("/admin/")
        ) {
          const navigated = await client.navigate(url.href);
          if (navigated) return navigated.focus();
        }
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});
// No fetch handler or offline cache for operational or private data.
