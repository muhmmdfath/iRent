// Opt-in local simulation. Use real business services, transactions, snapshots,
// proof storage and ledger actions; never insert synthetic balances/statuses.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { demoContext, credentials, compiled } = require("./demo-context.cjs");
const json = (value) =>
  JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
async function main() {
  const { app, get, root } = await demoContext();
  const contexts = [];
  try {
    const local = credentials(root);
    if (!local.values?.customers?.length)
      throw new Error(
        "Jalankan seed-accounts.cjs dan seed-demo.cjs terlebih dahulu.",
      );
    const directory = path.join(root, "backend/storage/demo");
    const file = path.join(directory, "scenarios.json");
    const catalogue = JSON.parse(
      fs.readFileSync(path.join(directory, "manifest.json"), "utf8"),
    );
    const manifest = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : { runs: {} };
    const save = () => fs.writeFileSync(file, json(manifest));
    const auth = get("auth/auth.service", "AuthService");
    const prisma = get("prisma/prisma.service", "PrismaService");
    const bookings = get(
      "modules/bookings/bookings.service",
      "BookingsService",
    );
    const payments = get(
      "modules/payments/payments.service",
      "PaymentsService",
    );
    const operations = get(
      "modules/operations/operations.service",
      "OperationsService",
    );
    const extensions = get(
      "modules/extensions/extensions.service",
      "ExtensionsService",
    );
    const refunds = get("modules/payments/refunds.service", "RefundsService");
    const inventory = get(
      "modules/inventory/inventory.service",
      "InventoryService",
    );
    const clock = get("shared/time/business-clock", "BusinessClock");
    const { wibNow, formatWibDateTime: format } = compiled("shared/time/wib");
    const actual = wibNow();
    const day = actual.toISOString().slice(0, 10);
    const label = process.env.IRENT_DEMO_RUN || "";
    if (label && !/^[A-Za-z0-9_-]{1,40}$/.test(label))
      throw new Error(
        "IRENT_DEMO_RUN hanya huruf, angka, underscore atau dash, maksimal 40 karakter.",
      );
    const run = (manifest.runs[day + (label ? "-" + label : "")] ||= {
      now: actual.toISOString(),
      scenarios: {},
    });
    let now = new Date(run.now);
    clock.now = () => new Date(now);
    const dayAt = (hour, offset = 0) =>
      new Date(
        Date.parse(day + "T00:00:00Z") + offset * 86400000 + hour * 3600000,
      );
    async function session(account) {
      const login = await auth.login(account.email, account.password);
      const context = await auth.authenticate(login.token);
      contexts.push(context);
      return context;
    }
    const admin = await session(local.values.admin);
    const customers = [];
    for (const account of local.values.customers)
      customers.push(await session(account));
    const proofBytes = fs.readFileSync(
      path.join(directory, "bukti-pembayaran-demo.png"),
    );
    const proof = () => ({
      buffer: proofBytes,
      size: proofBytes.length,
      mimetype: "image/png",
    });
    const receipt = (amount, label) => ({
      amount: String(amount),
      occurredAt: format(now),
      method: "transfer",
      receivingAccountReference: "REKENING-DEMO-BUKAN-BANK",
      transactionReference: "DEMO-" + label,
      note: "SIMULASI LOKAL: tidak ada dana atau transaksi bank nyata.",
    });
    // Record the UUID before an action. A rerun after interruption reuses its key
    // and payload; completed stages are not executed a second time.
    async function step(record, name, input, execute) {
      const action = (record.steps[name] ||= { key: randomUUID(), input });
      save();
      if (!action.done) {
        const result = await execute(action.input, action.key);
        action.result = JSON.parse(json(result ?? null));
        action.done = true;
        save();
      }
      return action.result;
    }
    async function ensureUnits(slug, count) {
      const id = catalogue.items[slug]?.id;
      if (!id) throw new Error("Model dummy belum tersedia: " + slug);
      const units = await inventory.units(id, { page: 1, limit: 100 });
      const missing = count - units.total;
      if (missing > 0)
        await inventory.addUnits(
          admin,
          id,
          slug.startsWith("iphone")
            ? {
                codes: Array.from(
                  { length: missing },
                  (_, i) =>
                    "DEMO-" + slug.toUpperCase() + "-" + (units.total + i + 1),
                ),
              }
            : { quantity: missing },
        );
      return id;
    }
    const itemIds = {};
    for (const slug of [
      "iphone-13",
      "iphone-14",
      "iphone-15",
      "iphone-15-pro",
      "airpods-pro",
      "tripod",
      "powerbank",
    ])
      itemIds[slug] = await ensureUnits(slug, 8);
    async function bookingScenario(slug, options = {}) {
      const record = (run.scenarios[slug] ||= {
        steps: {},
        customer: options.customer ?? 0,
      });
      save();
      const owner = customers[record.customer];
      const start = options.start || dayAt(10, 1);
      const duration = options.duration || 24;
      now = options.historical
        ? new Date(start.getTime() - 3 * 3600000)
        : new Date(run.now);
      const body = {
        startAt: format(start),
        durationHours: duration,
        items: [
          { itemId: itemIds[options.item || "iphone-13"], quantity: 1 },
          ...(options.accessory
            ? [{ itemId: itemIds[options.accessory], quantity: 1 }]
            : []),
        ],
        deliveryType: options.delivery ? "delivery" : "pickup",
        ...(options.delivery
          ? {
              deliveryZoneId: catalogue.zones["Semarang Tengah"],
              deliveryAddress: "Alamat dummy: Jalan Simulasi 10, Semarang",
            }
          : {}),
        payOption: options.dp ? "dp" : "full",
        termsVersion: compiled("modules/bookings/bookings.dto").TERMS_VERSION,
        agreeTerms: true,
        prepareIdentity: true,
        understandPayment: true,
        agreeOperatingHours: true,
      };
      const created = await step(record, "create", body, (input, key) =>
        bookings.create(owner, input, key),
      );
      record.id = created.id;
      record.code = created.code;
      save();
      if (options.paid || options.pending) {
        const obligation = created.obligations[0];
        const uploaded = await step(
          record,
          "upload",
          { claimedAmount: obligation.amountDue },
          (input, key) =>
            payments.upload(
              owner,
              record.id,
              obligation.id,
              input,
              proof(),
              key,
            ),
        );
        if (options.paid) {
          const pending = uploaded.booking.obligations[0].proofs.find(
            (row) => row.status === "pending",
          );
          await step(
            record,
            "verify",
            {
              ...receipt(obligation.amountDue, record.id + "-initial"),
              proofId: pending.id,
            },
            (input, key) => payments.verify(admin, record.id, input, key),
          );
        }
      }
      if (options.running) {
        now = new Date(start);
        if (!record.steps.handover?.done)
          for (const item of created.items) {
            const current = await prisma.bookingItem.findUniqueOrThrow({
              where: { id: item.id },
              include: { unit: true },
            });
            if (current.unit.physicalStatus !== "ready") {
              const ready = await prisma.itemUnit.findFirstOrThrow({
                where: {
                  itemId: item.itemId,
                  physicalStatus: "ready",
                  conditionStatus: "layak",
                  isActive: true,
                  bookingItems: {
                    none: {
                      useStatus: {
                        in: ["allocated", "in_use", "return_pending"],
                      },
                      booking: {
                        status: {
                          in: [
                            "menunggu_pembayaran",
                            "menunggu_konfirmasi",
                            "dikonfirmasi",
                            "berjalan",
                          ],
                        },
                      },
                    },
                  },
                },
                orderBy: { id: "asc" },
              });
              await step(
                record,
                "replace-" + item.id,
                {
                  itemUnitId: ready.id,
                  reason:
                    "SIMULASI: pilih unit fisik bebas untuk riwayat booking.",
                },
                (input, key) =>
                  operations.replaceUnit(admin, record.id, item.id, input, key),
              );
            }
          }
        await step(
          record,
          "handover",
          {
            pickedUpAt: format(now),
            conditionNote:
              "SIMULASI: kondisi lengkap, layar dan kamera sudah diperiksa.",
          },
          (input, key) => operations.handover(admin, record.id, input, key),
        );
      }
      now = new Date(run.now);
      return { record, owner, created };
    }
    await bookingScenario("belum-bayar", {
      customer: 0,
      item: "iphone-13",
      start: dayAt(10, 2),
      dp: true,
    });
    await bookingScenario("bukti-menunggu-verifikasi", {
      customer: 1,
      item: "iphone-14",
      start: dayAt(10, 2),
      pending: true,
      dp: true,
    });
    await bookingScenario("siap-serah-terima", {
      customer: 2,
      item: "iphone-15",
      start: dayAt(10, 3),
      paid: true,
    });
    const runningStart = actual.getUTCHours() >= 10 ? dayAt(10) : dayAt(10, -1);
    const runningDuration = actual.getUTCHours() >= 10 ? 24 : 48;
    const running = await bookingScenario("sedang-disewa", {
      customer: 0,
      item: "iphone-13",
      start: runningStart,
      duration: runningDuration,
      paid: true,
      historical: true,
      running: true,
    });
    const extensionPending = await bookingScenario(
      "perpanjangan-bukti-pending",
      {
        customer: 1,
        item: "iphone-14",
        start: runningStart,
        duration: runningDuration,
        paid: true,
        historical: true,
        running: true,
      },
    );
    await bookingScenario("quotation-ongkir", {
      customer: 2,
      item: "iphone-15",
      start: runningStart,
      duration: runningDuration,
      delivery: true,
      paid: true,
      historical: true,
      running: true,
    });
    const delivery = await bookingScenario("quotation-ongkir-terpisah", {
      customer: 3,
      item: "iphone-15",
      accessory: "powerbank",
      start: runningStart,
      duration: runningDuration,
      delivery: true,
      paid: true,
      historical: true,
      running: true,
    });
    async function proposal(scenario, kind) {
      const { record, owner, created } = scenario;
      const picked =
        kind === "quote"
          ? created.items.find((item) => item.itemId === itemIds["iphone-15"])
          : created.items[0];
      const requested = await step(
        record,
        kind === "approved" ? "extension-approved-12h" : "extension",
        {
          items: [
            {
              bookingItemId: picked.id,
              addedHours: kind === "approved" ? 12 : 24,
            },
          ],
        },
        (input, key) => extensions.create(owner, record.id, input, key),
      );
      const extension = requested.booking.extensions.at(-1);
      record.extensionId = extension.id;
      save();
      if (kind === "quote")
        await step(
          record,
          "quote",
          {
            extraDeliveryQuote: "15000",
            note: "SIMULASI: biaya pengambilan kembali setelah tambahan waktu.",
          },
          (input, key) =>
            extensions.quote(admin, record.id, extension.id, input, key),
        );
      else {
        const uploaded = await step(
          record,
          "extension-proof",
          { claimedAmount: extension.amountDue },
          (input, key) =>
            extensions.upload(
              owner,
              record.id,
              extension.id,
              input,
              proof(),
              key,
            ),
        );
        if (kind === "approved") {
          const obligation = uploaded.booking.obligations.find(
            (row) => row.extensionId === extension.id,
          );
          const pending = obligation.proofs.find(
            (row) => row.status === "pending",
          );
          await step(
            record,
            "extension-verify",
            {
              ...receipt(extension.amountDue, extension.id),
              proofId: pending.id,
            },
            (input, key) =>
              extensions.verify(admin, record.id, extension.id, input, key),
          );
        }
      }
    }
    await proposal(extensionPending, "pending");
    await proposal(delivery, "quote");
    await proposal(running, "approved");
    const reported = await bookingScenario("laporan-pengembalian", {
      customer: 0,
      item: "airpods-pro",
      start: runningStart,
      duration: runningDuration,
      paid: true,
      historical: true,
      running: true,
    });
    await step(reported.record, "report", {}, (_, key) =>
      operations.report(
        reported.owner,
        reported.record.id,
        reported.created.items[0].id,
        key,
      ),
    );
    const late = await bookingScenario("sewa-terlambat", {
      customer: 1,
      item: "tripod",
      start: dayAt(10, -1),
      paid: true,
      historical: true,
      running: true,
    });
    const finished = await bookingScenario("selesai-lunas", {
      customer: 2,
      item: "powerbank",
      start: dayAt(10, -2),
      paid: true,
      historical: true,
      running: true,
    });
    await step(
      finished.record,
      "return",
      {
        receivedAtStore: format(dayAt(10, -1)),
        condition: "layak",
        conditionNote: "SIMULASI: unit lengkap tanpa kerusakan.",
        damageAmount: "0",
      },
      (input, key) =>
        operations.verifyReturn(
          admin,
          finished.record.id,
          finished.created.items[0].id,
          input,
          key,
        ),
    );
    const refund = await bookingScenario("refund-disetujui", {
      customer: 0,
      item: "iphone-15-pro",
      start: dayAt(10, 4),
      paid: true,
    });
    await step(
      refund.record,
      "cancel",
      { reason: "SIMULASI: acara dibatalkan pelanggan." },
      (input, key) =>
        refunds.cancel(refund.owner, refund.record.id, input.reason, key),
    );
    const request = await prisma.refundRequest.findFirstOrThrow({
      where: { bookingId: refund.record.id },
      orderBy: { createdAt: "desc" },
    });
    refund.record.refundId = request.id;
    save();
    await step(
      refund.record,
      "recipient",
      {
        bankName: "BANK DEMO",
        accountNumber: "000001234567890",
        accountHolder: "Pelanggan Simulasi",
      },
      (input, key) => refunds.recipient(refund.owner, request.id, input, key),
    );
    await step(refund.record, "refund-approve", {}, (_, key) =>
      refunds.approve(admin, request.id, key),
    );
    const transferred = await bookingScenario("refund-sudah-transfer", {
      customer: 1,
      item: "iphone-15-pro",
      start: dayAt(10, 5),
      paid: true,
    });
    await step(
      transferred.record,
      "cancel",
      { reason: "SIMULASI: pembatalan toko dengan pengembalian dana penuh." },
      (input, key) =>
        refunds.cancel(admin, transferred.record.id, input.reason, key, true),
    );
    const transferRequest = await prisma.refundRequest.findFirstOrThrow({
      where: { bookingId: transferred.record.id },
      orderBy: { createdAt: "desc" },
    });
    await step(
      transferred.record,
      "recipient",
      {
        bankName: "BANK DEMO",
        accountNumber: "000009876543210",
        accountHolder: "Nadia Simulasi",
      },
      (input, key) => refunds.recipient(admin, transferRequest.id, input, key),
    );
    await step(transferred.record, "refund-approve", {}, (_, key) =>
      refunds.approve(admin, transferRequest.id, key),
    );
    await step(
      transferred.record,
      "transfer",
      {
        amount: transferRequest.requestedAmount.toString(),
        transferredAt: format(now),
        transactionReference: "DEMO-REFUND-" + transferRequest.id,
        note: "SIMULASI: tidak ada transfer bank nyata.",
      },
      (input, key) =>
        refunds.transfer(admin, transferRequest.id, input, proof(), key),
    );
    // An overdue unit linked to an upcoming allocation gives the risk screen a real case.
    const risky = await bookingScenario("booking-unit-berisiko", {
      customer: 2,
      item: "tripod",
      start: dayAt(10, 1),
      paid: true,
    });
    const lateUse = await prisma.bookingItem.findUniqueOrThrow({
      where: { id: late.created.items[0].id },
    });
    const riskyUse = await prisma.bookingItem.findUniqueOrThrow({
      where: { id: risky.created.items[0].id },
    });
    if (riskyUse.itemUnitId !== lateUse.itemUnitId) {
      now = dayAt(11, -1);
      await step(
        risky.record,
        "risk-allocation",
        {
          itemUnitId: lateUse.itemUnitId,
          reason:
            "SIMULASI: alokasi lanjutan sebelum sewa sebelumnya melewati jadwal.",
        },
        (input, key) =>
          operations.replaceUnit(
            admin,
            risky.record.id,
            risky.created.items[0].id,
            input,
            key,
          ),
      );
      now = new Date(run.now);
    }
    const loss = await bookingScenario("unit-hilang", {
      customer: 3,
      item: "powerbank",
      start: dayAt(10, -1),
      paid: true,
      historical: true,
      running: true,
    });
    await step(
      loss.record,
      "loss",
      {
        lostAt: format(now),
        lossNote:
          "SIMULASI: kehilangan telah diperiksa; bukan kehilangan unit nyata.",
        compensationAmount: "100000",
      },
      (input, key) =>
        operations.verifyLoss(
          admin,
          loss.record.id,
          loss.created.items[0].id,
          input,
          key,
        ),
    );
    const submittedRefund = await bookingScenario("refund-diajukan", {
      customer: 2,
      item: "airpods-pro",
      start: dayAt(10, 6),
      paid: true,
    });
    await step(
      submittedRefund.record,
      "cancel",
      { reason: "SIMULASI: kendala toko, dana perlu dikembalikan seluruhnya." },
      (input, key) =>
        refunds.cancel(
          admin,
          submittedRefund.record.id,
          input.reason,
          key,
          true,
        ),
    );
    const maintenance = (run.scenarios["unit-perawatan"] ||= { steps: {} });
    const ready = await prisma.itemUnit.findFirst({
      where: {
        itemId: itemIds["powerbank"],
        physicalStatus: "ready",
        isActive: true,
      },
      orderBy: { id: "asc" },
    });
    if (!maintenance.steps.maintenance?.done && ready)
      await step(maintenance, "maintenance", { unitId: ready.id }, (input) =>
        inventory.startMaintenance(
          admin,
          input.unitId,
          "SIMULASI: pemeriksaan baterai unit.",
        ),
      );
    const prepare = (run.scenarios["unit-persiapan"] ||= { steps: {} });
    if (!prepare.steps.maintenance?.done) {
      const unit = await prisma.itemUnit.findFirstOrThrow({
        where: { itemId: itemIds["airpods-pro"], physicalStatus: "ready" },
        orderBy: { id: "asc" },
      });
      await step(prepare, "maintenance", { unitId: unit.id }, (input) =>
        inventory.startMaintenance(
          admin,
          input.unitId,
          "SIMULASI: pembersihan aksesori.",
        ),
      );
    }
    await step(prepare, "complete", {}, () =>
      inventory.finishMaintenance(
        admin,
        prepare.steps.maintenance.input.unitId,
      ),
    );
    save();
    console.log(
      "Seed skenario selesai: pembayaran, running, perpanjangan, ongkir, return, overdue, selesai, refund, perawatan/persiapan.",
    );
    console.log(
      "Kode booking dan ID tersimpan di backend/storage/demo/scenarios.json. Pengulangan hari yang sama memakai data dan kunci yang sama.",
    );
    void late;
  } finally {
    for (const context of contexts)
      await app
        .get(compiled("auth/auth.service").AuthService)
        .logout(context)
        .catch(() => {});
    await app.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
