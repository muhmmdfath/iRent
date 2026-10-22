// Generate once; never overwrite encryption keys belonging to an existing DB.
const { randomBytes, createECDH } = require("node:crypto");
const { mkdirSync, writeFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const target = path.resolve(
  process.argv[2] || "backend/storage/deployment/production",
);
const domain = process.argv[3];
if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))
  throw new Error("Valid domain required");
mkdirSync(target, { recursive: true, mode: 0o700 });
if (
  existsSync(path.join(target, "app.env")) ||
  existsSync(path.join(target, "compose.env"))
) {
  throw new Error("Production secrets already exist; preserve them");
}
const password = randomBytes(32).toString("hex");
const curve = createECDH("prime256v1");
curve.generateKeys();
const app = {
  NODE_ENV: "production",
  PORT: "3030",
  DATABASE_URL: `postgresql://irent:${password}@db:5432/irent`,
  CORS_ORIGINS: `https://${domain}`,
  CSRF_SECRET: randomBytes(32).toString("base64"),
  NIK_KEYS: `'${JSON.stringify({ v1: randomBytes(32).toString("base64") })}'`,
  NIK_ACTIVE_KEY: "v1",
  PROOF_STORAGE_DIR: "/data/proofs",
  MEDIA_STORAGE_DIR: "/data/media",
  PAYMENT_WORKER_ENABLED: "true",
  NO_SHOW_WORKER_ENABLED: "true",
  EXTENSION_WORKER_ENABLED: "true",
  RISK_WORKER_ENABLED: "true",
  NOTIFICATION_WORKER_ENABLED: "true",
  VAPID_PUBLIC_KEY: curve.getPublicKey().toString("base64url"),
  VAPID_PRIVATE_KEY: Buffer.concat([
    Buffer.alloc(32 - curve.getPrivateKey().length),
    curve.getPrivateKey(),
  ]).toString("base64url"),
  VAPID_SUBJECT: `https://${domain}`,
};
writeFileSync(
  path.join(target, "app.env"),
  Object.entries(app)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600, flag: "wx" },
);
writeFileSync(
  path.join(target, "compose.env"),
  `DOMAIN=${domain}\nPOSTGRES_PASSWORD=${password}\n`,
  { mode: 0o600, flag: "wx" },
);
console.log("Production secrets created in private deployment storage.");
