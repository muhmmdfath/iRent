// Local demo only. Never resets passwords or overwrites existing users/settings.
const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const { demoContext, credentials, compiled } = require("./demo-context.cjs");
async function main() {
  const { app, get, root } = await demoContext();
  try {
    const auth = get("auth/auth.service", "AuthService");
    const prisma = get("prisma/prisma.service", "PrismaService");
    const customers = get(
      "modules/customers/customers.service",
      "CustomersService",
    );
    const local = credentials(root);
    const password = () => randomBytes(24).toString("base64url");
    const values = local.values || {
      admin: {
        email: process.env.IRENT_DEMO_ADMIN_EMAIL || "admin@irent.test",
        password: process.env.IRENT_DEMO_ADMIN_PASSWORD || password(),
      },
      customer: { email: "customer@irent.test", password: password() },
    };
    if (
      !local.values &&
      (await prisma.user.count({ where: { role: "admin" } })) &&
      !process.env.IRENT_DEMO_ADMIN_PASSWORD
    )
      throw new Error(
        "Admin sudah ada. Isi IRENT_DEMO_ADMIN_EMAIL/PASSWORD milik admin lokal untuk seed; password tidak direset.",
      );
    if (
      !(await prisma.user.findUnique({ where: { email: values.admin.email } }))
    ) {
      await compiled("auth/bootstrap-admin").createFirstAdmin(prisma, {
        name: "Admin Simulasi",
        ...values.admin,
      });
    }
    const login = await auth.login(values.admin.email, values.admin.password);
    const admin = await auth.authenticate(login.token);
    values.customers ||= [
      {
        name: "Nadia Simulasi",
        email: "nadia@irent.test",
        password: password(),
      },
      { name: "Raka Simulasi", email: "raka@irent.test", password: password() },
      { name: "Dina Simulasi", email: "dina@irent.test", password: password() },
    ];
    if (
      !values.customers.some((account) => account.email === "laila@irent.test")
    )
      values.customers.push({
        name: "Laila Simulasi",
        email: "laila@irent.test",
        password: password(),
      });
    fs.writeFileSync(local.file, JSON.stringify(values, null, 2));
    let index = 0;
    for (const account of [
      { name: "Pelanggan Simulasi", ...values.customer },
      ...values.customers,
    ]) {
      if (!(await prisma.user.findUnique({ where: { email: account.email } })))
        await auth.register(account);
      const session = await auth.login(account.email, account.password);
      const context = await auth.authenticate(session.token);
      if (!(await customers.profile(context))?.completedAt)
        await customers.saveProfile(context, {
          fullName: account.name,
          address: "Alamat dummy: Jalan Simulasi No. " + ++index + ", Semarang",
          phoneActive: "08120000000" + index,
          nik: "000000000000000" + index,
        });
      await auth.logout(context);
    }
    await auth.logout(admin);
    console.log(
      "Akun dan profil simulasi tersedia. Kredensial hanya di backend/.env.simulation (diabaikan Git).",
    );
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
