const fs = require("node:fs");
const path = require("node:path");
const backend = path.resolve(__dirname, "../backend");
require(path.join(backend, "node_modules/dotenv")).config({
  path: path.join(backend, ".env"),
  quiet: true,
});
const { Client } = require(path.join(backend, "node_modules/pg"));
async function main() {
  if (!process.env.IRENT_QA_CONTROL)
    throw new Error("Set IRENT_QA_CONTROL to the private QA control file.");
  const controlFile = fs.realpathSync(process.env.IRENT_QA_CONTROL);
  const directory = path.dirname(controlFile);
  if (
    path.dirname(directory) !== path.join(backend, "storage") ||
    !/^rental-qa-[a-f0-9]{12}$/.test(path.basename(directory)) ||
    path.basename(controlFile) !== "control.json"
  )
    throw new Error("Unexpected QA control path.");
  const cfg = JSON.parse(fs.readFileSync(controlFile, "utf8"));
  const suffix = path.basename(directory).slice("rental-qa-".length);
  if (cfg.database !== "irent_qa_browser_" + suffix)
    throw new Error("Unexpected QA database.");
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/postgres";
  const client = new Client({
    connectionString: url.href,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("DROP DATABASE IF EXISTS " + cfg.database);
    console.log("Disposable QA database removed.");
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(
    error.code === "55006"
      ? "Stop the QA server before cleanup."
      : "QA cleanup failed (" +
          (error.code || error.name) +
          "). Check the local control file and database access.",
  );
  process.exitCode = 1;
});
