// Local simulation data goes through the same business API as the application.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const sharp = require(path.join(root, "backend/node_modules/sharp"));
const base = "http://127.0.0.1:5173";
const directory = path.join(root, "backend/storage/demo");
const manifestPath = path.join(directory, "manifest.json");
fs.mkdirSync(directory, { recursive: true });
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { id: randomUUID(), items: {}, zones: {}, bookings: {} };
const save = () =>
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const products = [
  {
    slug: "iphone-13",
    name: "iPhone 13",
    category: "iphone",
    prices: ["75000", "100000", "150000"],
    quantity: 3,
    image:
      "https://www.apple.com/newsroom/images/product/iphone/standard/Apple_iphone13_hero_09142021_inline.jpg.slideshow-large.jpg",
  },
  {
    slug: "iphone-14",
    name: "iPhone 14",
    category: "iphone",
    prices: ["90000", "125000", "180000"],
    quantity: 3,
    image:
      "https://www.apple.com/newsroom/images/product/iphone/standard/Apple-iPhone-14-iPhone-14-Plus-hero-220907_Full-Bleed-Image.jpg.medium.jpg",
  },
  {
    slug: "iphone-15",
    name: "iPhone 15",
    category: "iphone",
    prices: ["110000", "150000", "220000"],
    quantity: 3,
    image:
      "https://www.apple.com/newsroom/images/2023/09/apple-debuts-iphone-15-and-iphone-15-plus/article/Apple-iPhone-15-lineup-hero-230912_inline.jpg.medium.jpg",
  },
  {
    slug: "iphone-15-pro",
    name: "iPhone 15 Pro",
    category: "iphone",
    prices: ["150000", "200000", "300000"],
    quantity: 2,
    image:
      "https://www.apple.com/newsroom/images/2023/09/apple-unveils-iphone-15-pro-and-iphone-15-pro-max/article/Apple-iPhone-15-Pro-lineup-hero-230912_Full-Bleed-Image.jpg.medium.jpg",
  },
  {
    slug: "airpods-pro",
    name: "AirPods Pro",
    category: "accessory",
    prices: ["15000", "25000", "40000"],
    quantity: 3,
    image:
      "https://www.apple.com/newsroom/images/product/airpods/standard/Apple_AirPods-Pro_New-Design_102819_big.jpg.medium.jpg",
  },
  {
    slug: "tripod",
    name: "Tripod & Phone Holder",
    category: "accessory",
    prices: ["10000", "15000", "25000"],
    quantity: 4,
  },
  {
    slug: "powerbank",
    name: "Powerbank 20.000 mAh",
    category: "accessory",
    prices: ["10000", "15000", "20000"],
    quantity: 4,
  },
];

function illustration(kind) {
  const artwork =
    kind === "tripod"
      ? '<rect x="325" y="95" width="250" height="130" rx="20" fill="#30343b"/><rect x="340" y="110" width="220" height="100" rx="12" fill="#c6d9ce"/><rect x="432" y="215" width="36" height="230" rx="10" fill="#535a62"/><path d="M450 425L285 605M450 425L615 605M450 425V620" stroke="#30343b" stroke-width="24" stroke-linecap="round"/><circle cx="450" cy="420" r="35" fill="#7d858f"/>'
      : '<rect x="315" y="105" width="270" height="470" rx="42" fill="#333b45"/><rect x="340" y="130" width="220" height="415" rx="28" fill="#465262"/><rect x="385" y="155" width="130" height="55" rx="12" fill="#18212c"/><text x="450" y="192" text-anchor="middle" fill="#a7e0c4" font-size="26" font-family="sans-serif">100%</text><path d="M465 290L425 360H456L436 425L483 346H451Z" fill="#f4d5df"/><rect x="372" y="552" width="35" height="8" rx="4" fill="#111"/><rect x="425" y="552" width="50" height="8" rx="4" fill="#111"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><rect width="900" height="700" fill="#f8eef2"/><ellipse cx="450" cy="640" rx="200" ry="20" fill="#e8dce2"/>${artwork}</svg>`;
}

async function imageFor(product) {
  const file = path.join(directory, product.slug + ".png");
  if (!fs.existsSync(file)) {
    let input;
    if (product.image) {
      const response = await fetch(product.image, {
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok)
        throw new Error(`Foto ${product.name}: HTTP ${response.status}`);
      input = Buffer.from(await response.arrayBuffer());
    } else input = Buffer.from(illustration(product.slug));
    await sharp(input)
      .resize({
        width: 1200,
        height: 900,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toFile(file);
  }
  return fs.readFileSync(file);
}

async function login(account) {
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: account.email,
      password: account.password,
    }),
  });
  if (!response.ok)
    throw new Error(`Login simulasi gagal: HTTP ${response.status}`);
  const result = await response.json();
  return {
    cookie: response.headers.get("set-cookie").split(";")[0],
    csrf: result.csrfToken,
  };
}

async function api(session, route, method = "GET", body, action) {
  const headers = {
    Origin: base,
    Cookie: session.cookie,
    "X-CSRF-Token": session.csrf,
  };
  if (action) headers["Idempotency-Key"] = `demo-${manifest.id}-${action}`;
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(base + "/api" + route, {
    method,
    headers,
    signal: AbortSignal.timeout(60000),
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "";
    try {
      message = JSON.stringify((await response.json()).message);
    } catch {}
    throw new Error(`${method} ${route}: HTTP ${response.status} ${message}`);
  }
  const content = await response.text();
  return content.trim() ? JSON.parse(content) : null;
}

function wibNow() {
  return (
    new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 23) + "+07:00"
  );
}
function futureDate(days) {
  return (
    new Date(Date.now() + 7 * 3600000 + days * 86400000)
      .toISOString()
      .slice(0, 10) + "T10:00:00+07:00"
  );
}

async function main() {
  const credentials = JSON.parse(
    fs
      .readFileSync(path.join(root, "backend/.env.simulation"), "utf8")
      .replace(/^\uFEFF/, ""),
  );
  const admin = await login(credentials.admin);
  const customer = await login(credentials.customer);
  try {
    const existing = await api(admin, "/admin/items?limit=100");
    for (const product of products) {
      let item = existing.data.find(
        (value) => value.id === manifest.items[product.slug]?.id,
      );
      if (!item) {
        // Match a prior partial run without touching unrelated catalogue entries.
        item = existing.data.find(
          (value) =>
            value.name === product.name &&
            value.includes.includes("Paket simulasi lokal iRent"),
        );
      }
      if (!item)
        item = await api(admin, "/admin/items", "POST", {
          category: product.category,
          name: product.name,
          includes:
            product.category === "iphone"
              ? [
                  "Unit iPhone",
                  "Kabel charger",
                  "Case pelindung",
                  "Paket simulasi lokal iRent",
                ]
              : [
                  "Unit aksesori",
                  "Tas penyimpanan",
                  "Paket simulasi lokal iRent",
                ],
          price6h: product.prices[0],
          price12h: product.prices[1],
          price24h: product.prices[2],
        });
      manifest.items[product.slug] = { id: item.id };
      save();
      const units = await api(admin, `/admin/items/${item.id}/units?limit=100`);
      const missing = product.quantity - units.total;
      if (missing > 0)
        await api(
          admin,
          `/admin/items/${item.id}/units`,
          "POST",
          product.category === "iphone"
            ? {
                codes: Array.from(
                  { length: missing },
                  (_, index) =>
                    `DEMO-${product.slug.toUpperCase()}-${units.total + index + 1}`,
                ),
              }
            : { quantity: missing },
        );
      if (!item.photoPath) {
        const form = new FormData();
        form.append(
          "file",
          new Blob([await imageFor(product)], { type: "image/png" }),
          product.slug + ".png",
        );
        await api(admin, `/admin/items/${item.id}/photo`, "POST", form);
      }
      console.log(`Item tersedia: ${product.name}, ${product.quantity} unit.`);
    }
    const zones = await api(admin, "/admin/delivery-zones");
    for (const [name, fee] of [
      ["Semarang Tengah", "20000"],
      ["Semarang Selatan", "25000"],
      ["Banyumanik", "35000"],
      ["Tembalang", "35000"],
    ]) {
      let zone = zones.find((value) => value.name === name);
      if (!zone)
        zone = await api(admin, "/admin/delivery-zones", "POST", { name, fee });
      manifest.zones[name] = zone.id;
      save();
    }
    const profile = await api(customer, "/customer/profile");
    if (!profile?.completedAt)
      await api(customer, "/customer/profile", "PUT", {
        fullName: "Pelanggan Simulasi",
        address: "Alamat dummy: Jalan Simulasi No. 10, Semarang",
        phoneActive: "081200000001",
        nik: "0000000000000000",
      });
    const proofPath = path.join(directory, "bukti-pembayaran-demo.png");
    if (!fs.existsSync(proofPath))
      await sharp(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100"><rect width="900" height="1100" fill="#fff5f8"/><text x="450" y="170" text-anchor="middle" font-family="sans-serif" font-size="55" fill="#a34b70">BUKTI SIMULASI</text><text x="450" y="260" text-anchor="middle" font-family="sans-serif" font-size="27">Bukan transaksi atau pembayaran nyata</text><text x="450" y="470" text-anchor="middle" font-family="sans-serif" font-size="64">Rp20.000</text><text x="450" y="550" text-anchor="middle" font-family="sans-serif" font-size="27">DP booking dummy iRent</text><text x="450" y="820" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#a34b70">HANYA UNTUK DEMO LOKAL</text></svg>',
        ),
      )
        .png()
        .toFile(proofPath);
    const scenarios = [
      { slug: "belum-bayar", days: 1, phone: "iphone-13", stage: "unpaid" },
      {
        slug: "menunggu-verifikasi",
        days: 2,
        phone: "iphone-14",
        stage: "pending",
      },
      {
        slug: "dp-dikonfirmasi",
        days: 3,
        phone: "iphone-15",
        stage: "approved",
      },
    ];
    for (const scenario of scenarios) {
      let record = manifest.bookings[scenario.slug];
      if (!record) {
        record = { startAt: futureDate(scenario.days) };
        manifest.bookings[scenario.slug] = record;
        save();
      }
      if (!record.id) {
        const booking = await api(
          customer,
          "/bookings",
          "POST",
          {
            startAt: record.startAt,
            durationHours: 6,
            items: [
              { itemId: manifest.items[scenario.phone].id, quantity: 1 },
              { itemId: manifest.items.tripod.id, quantity: 1 },
            ],
            deliveryType: "pickup",
            payOption: "dp",
            termsVersion: "irent-phase1-v1",
            agreeTerms: true,
            prepareIdentity: true,
            understandPayment: true,
            agreeOperatingHours: true,
          },
          "booking-" + scenario.slug,
        );
        record.id = booking.id;
        record.code = booking.code;
        save();
      }
      let financial = await api(customer, `/bookings/${record.id}/payments`);
      if (
        scenario.stage !== "unpaid" &&
        financial.booking.status === "menunggu_pembayaran"
      ) {
        const obligation = financial.booking.obligations.find(
          (value) => value.purpose === "initial_dp",
        );
        const form = new FormData();
        form.append(
          "file",
          new Blob([fs.readFileSync(proofPath)], { type: "image/png" }),
          "bukti-simulasi.png",
        );
        form.append("claimedAmount", "20000");
        financial = await api(
          customer,
          `/bookings/${record.id}/obligations/${obligation.id}/proofs`,
          "POST",
          form,
          "proof-" + scenario.slug,
        );
      }
      if (
        scenario.stage === "approved" &&
        financial.booking.status === "menunggu_konfirmasi"
      ) {
        const proof = financial.booking.obligations
          .flatMap((value) => value.proofs)
          .find((value) => value.status === "pending");
        record.occurredAt ||= wibNow();
        save();
        financial = await api(
          admin,
          `/admin/bookings/${record.id}/payments/verify`,
          "POST",
          {
            proofId: proof.id,
            amount: "20000",
            occurredAt: record.occurredAt,
            method: "transfer",
            receivingAccountReference: "demo-irent",
            transactionReference: "DEMO-" + record.id,
            note: "Dana dummy untuk simulasi lokal; tidak ada uang nyata masuk.",
          },
          "verify-" + scenario.slug,
        );
        save();
      }
      console.log(`Booking ${record.code}: ${financial.booking.status}`);
    }
    console.log(
      "Seed demo selesai. Gambar dan bukti tersimpan lokal di backend/storage/demo.",
    );
  } finally {
    await Promise.allSettled([
      api(admin, "/auth/logout", "POST", {}),
      api(customer, "/auth/logout", "POST", {}),
    ]);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
