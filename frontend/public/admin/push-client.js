function supported() {
  if (
    !window.isSecureContext ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw new Error(
      "Perangkat belum mendukung notifikasi PWA. Pada iPhone, buka aplikasi dari layar utama.",
    );
}
function applicationKey(value) {
  const bytes = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bytes, (char) => char.charCodeAt(0));
}
async function request(apiBase, path, csrfToken, body, method = "POST") {
  const response = await fetch(
    apiBase.replace(/\/$/, "") + "/api/admin/notifications/" + path,
    {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error(
      "Pengaturan notifikasi gagal disimpan. Periksa sesi login dan coba lagi.",
    );
  return response.json();
}
// Invoke directly from the admin's button click, never on page load.
export async function enableAdminPush({ apiBase = "", csrfToken, publicKey }) {
  supported();
  if (!publicKey || !csrfToken)
    throw new Error(
      "Notifikasi belum dikonfigurasi atau sesi login belum tersedia.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Izin notifikasi belum diberikan.");
  const registration = await navigator.serviceWorker.register("/admin/sw.js", {
    scope: "/admin/",
  });
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationKey(publicKey),
    }));
  const value = subscription.toJSON();
  await request(apiBase, "subscriptions", csrfToken, {
    endpoint: value.endpoint,
    keys: value.keys,
  });
  return subscription;
}
export async function disableAdminPush({ apiBase = "", csrfToken }) {
  supported();
  const registration = await navigator.serviceWorker.getRegistration("/admin/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await request(
    apiBase,
    "subscriptions",
    csrfToken,
    { endpoint: subscription.endpoint },
    "DELETE",
  );
  await subscription.unsubscribe();
}
