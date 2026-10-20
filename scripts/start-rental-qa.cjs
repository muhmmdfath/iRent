// Local, disposable backend for the real rental browser/API simulations.
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
const dependency = (name) => require(path.join(backend, "node_modules", name));
const compiled = (name) => require(path.join(backend, "dist", name));
dependency("dotenv").config({ path: path.join(backend, ".env"), quiet: true });
const { Client } = dependency("pg");
const suffix = randomBytes(6).toString("hex");
const database = "irent_qa_browser_" + suffix;
const directory = path.join(backend, "storage", "rental-qa-" + suffix);
let controlUrl,
  app,
  created = false,
  stopping = false;
async function sqlControl(query) {
  const client = new Client({
    connectionString: controlUrl,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    return await client.query(query);
  } finally {
    await client.end();
  }
}
async function stop() {
  if (stopping) return;
  stopping = true;
  if (app) await app.close();
  if (created) {
    if (!/^irent_qa_browser_[a-f0-9]{12}$/.test(database))
      throw new Error("Unsafe QA database");
    await sqlControl("DROP DATABASE " + database);
    created = false;
  }
}
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Configure backend/.env first");
  if (!fs.existsSync(path.join(backend, "dist", "app.module.js")))
    throw new Error("Build the backend first");
  // Check before creating fixtures; never replace another process on this port.
  await new Promise((resolve, reject) => {
    const probe = require("node:net").createServer();
    probe.once("error", reject);
    probe.listen(3031, "127.0.0.1", () => probe.close(resolve));
  });
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/postgres";
  controlUrl = url.href;
  await sqlControl("CREATE DATABASE " + database);
  created = true;
  url.pathname = "/" + database;
  const client = new Client({ connectionString: url.href });
  try {
    await client.connect();
    const migrations = path.join(backend, "prisma", "migrations");
    for (const entry of fs
      .readdirSync(migrations, { withFileTypes: true })
      .filter((x) => x.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      await client.query(
        fs.readFileSync(
          path.join(migrations, entry.name, "migration.sql"),
          "utf8",
        ),
      );
    }
  } finally {
    await client.end();
  }
  fs.mkdirSync(directory, { recursive: true });
  const cfg = {
    adminEmail: "qa-admin@example.test",
    adminPassword: randomBytes(24).toString("hex"),
    clockFile: path.join(directory, "clock.json"),
    database,
    serverPid: process.pid,
  };
  fs.writeFileSync(cfg.clockFile, JSON.stringify({ instant: null }), {
    mode: 0o600,
  });
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: url.href,
    PORT: "3031",
    CORS_ORIGINS: "http://127.0.0.1:5181",
    CSRF_SECRET: randomBytes(32).toString("base64"),
    NIK_KEYS: JSON.stringify({ v1: randomBytes(32).toString("base64") }),
    NIK_ACTIVE_KEY: "v1",
    PROOF_STORAGE_DIR: path.join(directory, "proofs"),
    MEDIA_STORAGE_DIR: path.join(directory, "media"),
    PAYMENT_WORKER_ENABLED: "false",
    NO_SHOW_WORKER_ENABLED: "false",
    EXTENSION_WORKER_ENABLED: "false",
    RISK_WORKER_ENABLED: "false",
    NOTIFICATION_WORKER_ENABLED: "false",
  });
  dependency("reflect-metadata");
  const { NestFactory } = dependency("@nestjs/core");
  app = await NestFactory.create(compiled("app.module").AppModule, {
    logger: false,
  });
  // The QA harness owns signals so database cleanup completes before process exit.
  const registerShutdownHooks = app.enableShutdownHooks.bind(app);
  app.enableShutdownHooks = () => app;
  compiled("setup-app").setupApp(app);
  app.enableShutdownHooks = registerShutdownHooks;
  const { wibNow } = compiled("shared/time/wib");
  app.get(compiled("shared/time/business-clock").BusinessClock).now = () => {
    const { instant } = JSON.parse(fs.readFileSync(cfg.clockFile, "utf8"));
    return wibNow(instant ? new Date(instant) : new Date());
  };
  const prisma = app.get(compiled("prisma/prisma.service").PrismaService);
  await compiled("auth/bootstrap-admin").createFirstAdmin(prisma, {
    name: "Admin QA Simulasi",
    email: cfg.adminEmail,
    password: cfg.adminPassword,
  });
  const item = await prisma.item.create({
    data: {
      name: "iPhone Simulasi QA",
      category: "iphone",
      includes: ["Kabel fixture"],
      price6h: 60000n,
      price12h: 100000n,
      price24h: 150000n,
      units: { create: { code: "QA-IPHONE-1" } },
    },
    include: { units: true },
  });
  cfg.itemId = item.id;
  cfg.unitId = item.units[0].id;
  const controlFile = path.join(directory, "control.json");
  fs.writeFileSync(controlFile, JSON.stringify(cfg), { mode: 0o600 });
  await app.listen(3031, "127.0.0.1");
  console.log("QA backend ready: http://127.0.0.1:3031");
  console.log("IRENT_QA_CONTROL=" + controlFile);
  console.log(
    "Stop with Ctrl+C, then run scripts/cleanup-rental-qa.cjs with the same IRENT_QA_CONTROL.",
  );
  const shutdown = () =>
    stop()
      .then(() => process.exit(0))
      .catch(() => {
        console.error("QA cleanup failed; inspect the local QA database.");
        process.exit(1);
      });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
main().catch(async (error) => {
  console.error(
    "QA startup failed (" +
      (error.code || error.name) +
      "). Check build, database access and port 3031.",
  );
  try {
    await stop();
  } catch {
    console.error("QA cleanup incomplete.");
  }
  process.exitCode = 1;
});
