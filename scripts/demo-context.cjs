const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
const dependency = (name) => require(path.join(backend, "node_modules", name));
const compiled = (name) => require(path.join(backend, "dist", name));
async function demoContext() {
  process.chdir(backend);
  dependency("dotenv").config({
    path: path.join(backend, ".env"),
    quiet: true,
  });
  // Only this short-lived seed process uses a simulated business clock. No worker runs.
  process.env.NODE_ENV = "test";
  dependency("reflect-metadata");
  const { NestFactory } = dependency("@nestjs/core");
  const app = await NestFactory.createApplicationContext(
    compiled("app.module").AppModule,
    { logger: false },
  );
  const get = (module, name) => app.get(compiled(module)[name]);
  return { app, get, root, backend };
}
function credentials(root) {
  const file = path.join(root, "backend/.env.simulation");
  return {
    file,
    values: fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""))
      : null,
  };
}
module.exports = { demoContext, credentials, dependency, compiled };
