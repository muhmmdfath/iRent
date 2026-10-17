const path = require("node:path");
const root = path.resolve(__dirname, "..");
require(path.join(root, "backend/node_modules/dotenv")).config({
  path: path.join(root, "backend/.env"),
  quiet: true,
});
const { Client } = require(path.join(root, "backend/node_modules/pg"));
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL belum diisi di backend/.env.");
  const url = new URL(process.env.DATABASE_URL);
  const client = new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log(
      `PostgreSQL terhubung: ${url.hostname}:${url.port || "5432"}${url.pathname}`,
    );
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "PostgreSQL belum terhubung. Pastikan service lokal aktif, database tersedia, dan DATABASE_URL di backend/.env benar.",
  );
  process.exitCode = 1;
});
