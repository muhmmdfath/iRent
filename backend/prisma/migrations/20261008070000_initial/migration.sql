-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('customer', 'admin');

-- CreateEnum
CREATE TYPE "item_category" AS ENUM ('iphone', 'accessory');

-- CreateEnum
CREATE TYPE "unit_condition" AS ENUM ('layak', 'maintenance', 'lost');

-- CreateEnum
CREATE TYPE "physical_status" AS ENUM ('ready', 'in_use', 'awaiting_check', 'in_transit', 'preparing', 'lost');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'berjalan', 'selesai', 'kedaluwarsa', 'ditolak', 'dibatalkan');

-- CreateEnum
CREATE TYPE "delivery_type" AS ENUM ('pickup', 'delivery');

-- CreateEnum
CREATE TYPE "pay_option" AS ENUM ('dp', 'full');

-- CreateEnum
CREATE TYPE "unit_use_status" AS ENUM ('allocated', 'in_use', 'return_pending', 'returned', 'lost_closed');

-- CreateEnum
CREATE TYPE "allocation_kind" AS ENUM ('rental', 'extension_hold');

-- CreateEnum
CREATE TYPE "allocation_state" AS ENUM ('active', 'released');

-- CreateEnum
CREATE TYPE "extension_status" AS ENUM ('draft_quote', 'menunggu_pembayaran', 'menunggu_konfirmasi', 'disetujui', 'ditolak', 'kedaluwarsa', 'dibatalkan');

-- CreateEnum
CREATE TYPE "return_status" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "charge_kind" AS ENUM ('rental', 'delivery', 'extension', 'extra_delivery', 'late', 'damage', 'loss', 'adjustment');

-- CreateEnum
CREATE TYPE "charge_direction" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "obligation_purpose" AS ENUM ('initial_dp', 'initial_full', 'settlement', 'extension');

-- CreateEnum
CREATE TYPE "obligation_status" AS ENUM ('open', 'proof_pending', 'satisfied', 'closed');

-- CreateEnum
CREATE TYPE "proof_status" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "money_direction" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "payment_type" AS ENUM ('dp', 'full', 'settlement', 'extension', 'refund', 'reconciliation');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('qris', 'cash', 'transfer');

-- CreateEnum
CREATE TYPE "application_state" AS ENUM ('reserved', 'applied', 'released');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('diajukan', 'disetujui', 'ditolak', 'sudah_dikembalikan');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('processing', 'succeeded');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('push', 'whatsapp');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('queued', 'sending', 'sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'customer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone_active" TEXT NOT NULL,
    "nik_ciphertext" TEXT NOT NULL,
    "phone_alt" TEXT,
    "instagram" TEXT,
    "email_contact" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" "item_category" NOT NULL,
    "name" TEXT NOT NULL,
    "photo_path" TEXT,
    "includes" JSONB NOT NULL,
    "price_6h" BIGINT NOT NULL,
    "price_12h" BIGINT NOT NULL,
    "price_24h" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "condition_status" "unit_condition" NOT NULL DEFAULT 'layak',
    "physical_status" "physical_status" NOT NULL DEFAULT 'ready',
    "preparation_until" TIMESTAMP(3),
    "maintenance_completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "item_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "fee" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'menunggu_pembayaran',
    "initial_start_at" TIMESTAMP(3) NOT NULL,
    "initial_end_at" TIMESTAMP(3) NOT NULL,
    "delivery_type" "delivery_type" NOT NULL,
    "delivery_zone_id" UUID,
    "delivery_zone_name_snapshot" TEXT,
    "delivery_address" TEXT,
    "delivery_fee_snapshot" BIGINT NOT NULL,
    "initial_rental_total" BIGINT NOT NULL,
    "initial_grand_total" BIGINT NOT NULL,
    "dp_snapshot" BIGINT NOT NULL,
    "pay_option" "pay_option" NOT NULL,
    "amount_due_now" BIGINT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "uploaded_at" TIMESTAMP(3),
    "confirmation_due_at" TIMESTAMP(3),
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "no_show_due_at" TIMESTAMP(3) NOT NULL,
    "delivery_ready_at" TIMESTAMP(3),
    "customer_failure_confirmed_at" TIMESTAMP(3),
    "delivery_failure_reason" TEXT,
    "shop_delay_seconds" INTEGER NOT NULL DEFAULT 0,
    "rejected_reason" TEXT,
    "cancel_reason" TEXT,
    "terms_version" TEXT NOT NULL,
    "agreed_terms_at" TIMESTAMP(3) NOT NULL,
    "rules_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "item_unit_id" UUID NOT NULL,
    "item_name_snapshot" TEXT NOT NULL,
    "unit_code_snapshot" TEXT NOT NULL,
    "initial_start_at" TIMESTAMP(3) NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "initial_end_at" TIMESTAMP(3) NOT NULL,
    "current_end_at" TIMESTAMP(3) NOT NULL,
    "shop_delay_seconds" INTEGER NOT NULL DEFAULT 0,
    "unit_price_snapshot" BIGINT NOT NULL,
    "tariff_6h_snapshot" BIGINT NOT NULL,
    "tariff_12h_snapshot" BIGINT NOT NULL,
    "tariff_24h_snapshot" BIGINT NOT NULL,
    "use_status" "unit_use_status" NOT NULL DEFAULT 'allocated',
    "picked_up_at" TIMESTAMP(3),
    "picked_up_by" UUID,
    "handover_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_item_id" UUID NOT NULL,
    "item_unit_id" UUID NOT NULL,
    "extension_item_id" UUID,
    "allocation_kind" "allocation_kind" NOT NULL,
    "state" "allocation_state" NOT NULL DEFAULT 'active',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "block_start_at" TIMESTAMP(3) NOT NULL,
    "block_end_at" TIMESTAMP(3) NOT NULL,
    "hold_expires_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "released_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "unit_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extensions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "status" "extension_status" NOT NULL,
    "rental_quote_total" BIGINT NOT NULL,
    "extra_delivery_quote" BIGINT NOT NULL DEFAULT 0,
    "amount_due" BIGINT NOT NULL,
    "delivery_quote_note" TEXT,
    "quoted_by" UUID,
    "quoted_at" TIMESTAMP(3),
    "delivery_agreed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3),
    "confirmation_due_at" TIMESTAMP(3),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "extension_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "booking_item_id" UUID NOT NULL,
    "old_end_at" TIMESTAMP(3) NOT NULL,
    "proposed_end_at" TIMESTAMP(3) NOT NULL,
    "expected_item_version" INTEGER NOT NULL,
    "added_hours" INTEGER NOT NULL,
    "unit_price_snapshot" BIGINT NOT NULL,
    "confirmation_due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "extension_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_item_id" UUID NOT NULL,
    "status" "return_status" NOT NULL DEFAULT 'pending',
    "reported_at" TIMESTAMP(3),
    "received_by_courier_at" TIMESTAMP(3),
    "received_at_store" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "fee_return_at" TIMESTAMP(3),
    "condition_note" TEXT,
    "damage_amount" BIGINT NOT NULL DEFAULT 0,
    "damage_note" TEXT,
    "late_seconds" INTEGER NOT NULL DEFAULT 0,
    "late_fee" BIGINT NOT NULL DEFAULT 0,
    "admin_delay_exemption_seconds" INTEGER NOT NULL DEFAULT 0,
    "courier_delay_exemption_seconds" INTEGER NOT NULL DEFAULT 0,
    "exemption_reason" TEXT,
    "preparation_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "return_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loss_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_item_id" UUID NOT NULL,
    "lost_at" TIMESTAMP(3) NOT NULL,
    "verified_by" UUID NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "loss_note" TEXT NOT NULL,
    "compensation_amount" BIGINT NOT NULL,
    "late_fee" BIGINT NOT NULL,
    "policy_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "loss_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "booking_item_id" UUID,
    "extension_id" UUID,
    "kind" "charge_kind" NOT NULL,
    "direction" "charge_direction" NOT NULL,
    "amount" BIGINT NOT NULL,
    "related_charge_id" UUID,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_by" UUID,
    "source_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "booking_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_obligations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "extension_id" UUID,
    "purpose" "obligation_purpose" NOT NULL,
    "amount_due" BIGINT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "status" "obligation_status" NOT NULL DEFAULT 'open',
    "pending_proof_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "payment_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proofs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_obligation_id" UUID NOT NULL,
    "proof_path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "claimed_amount" BIGINT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "status" "proof_status" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "payment_obligation_id" UUID,
    "extension_id" UUID,
    "proof_id" UUID,
    "refund_request_id" UUID,
    "direction" "money_direction" NOT NULL,
    "type" "payment_type" NOT NULL,
    "method" "payment_method" NOT NULL,
    "amount" BIGINT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "recorded_by" UUID NOT NULL,
    "receiving_account_reference" TEXT,
    "transaction_reference" TEXT,
    "attachment_path" TEXT,
    "source_key" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incoming_payment_id" UUID NOT NULL,
    "payment_obligation_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "state" "application_state" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "extension_id" UUID,
    "status" "refund_status" NOT NULL DEFAULT 'diajukan',
    "reason_code" TEXT NOT NULL,
    "reason_note" TEXT,
    "requested_amount" BIGINT NOT NULL,
    "approved_amount" BIGINT,
    "policy_snapshot" JSONB NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "recipient_details" JSONB NOT NULL,
    "transferred_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "refund_request_id" UUID NOT NULL,
    "incoming_payment_id" UUID NOT NULL,
    "payment_application_id" UUID,
    "booking_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "refund_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "from_status" "booking_status",
    "to_status" "booking_status" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "booking_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "typed_value" JSONB NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "status" "idempotency_status" NOT NULL DEFAULT 'processing',
    "result_reference" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_key" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "dispatched_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outbox_event_id" UUID,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "recipient_admin_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retry_at" TIMESTAMP(3),
    "provider_reference" TEXT,
    "error" TEXT,
    "deduplication_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_counters" (
    "key" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "business_counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_units_code_key" ON "item_units"("code");

-- CreateIndex
CREATE INDEX "item_units_item_id_is_active_condition_status_idx" ON "item_units"("item_id", "is_active", "condition_status");

-- CreateIndex
CREATE UNIQUE INDEX "item_units_id_item_id_key" ON "item_units"("id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_name_key" ON "delivery_zones"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE INDEX "bookings_status_initial_start_at_idx" ON "bookings"("status", "initial_start_at");

-- CreateIndex
CREATE INDEX "bookings_user_id_status_idx" ON "bookings"("user_id", "status");

-- CreateIndex
CREATE INDEX "bookings_expires_at_idx" ON "bookings"("expires_at");

-- CreateIndex
CREATE INDEX "bookings_confirmation_due_at_idx" ON "bookings"("confirmation_due_at");

-- CreateIndex
CREATE INDEX "bookings_no_show_due_at_idx" ON "bookings"("no_show_due_at");

-- CreateIndex
CREATE INDEX "booking_items_booking_id_use_status_idx" ON "booking_items"("booking_id", "use_status");

-- CreateIndex
CREATE INDEX "booking_items_item_unit_id_current_end_at_idx" ON "booking_items"("item_unit_id", "current_end_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_items_booking_id_item_unit_id_key" ON "booking_items"("booking_id", "item_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_items_id_booking_id_key" ON "booking_items"("id", "booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_items_id_item_unit_id_key" ON "booking_items"("id", "item_unit_id");

-- CreateIndex
CREATE INDEX "unit_allocations_item_unit_id_state_block_start_at_idx" ON "unit_allocations"("item_unit_id", "state", "block_start_at");

-- CreateIndex
CREATE INDEX "unit_allocations_hold_expires_at_idx" ON "unit_allocations"("hold_expires_at");

-- CreateIndex
CREATE INDEX "extensions_status_expires_at_idx" ON "extensions"("status", "expires_at");

-- CreateIndex
CREATE INDEX "extensions_confirmation_due_at_idx" ON "extensions"("confirmation_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_id_booking_id_key" ON "extensions"("id", "booking_id");

-- CreateIndex
CREATE INDEX "extension_items_booking_item_id_idx" ON "extension_items"("booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "extension_items_extension_id_booking_item_id_key" ON "extension_items"("extension_id", "booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "extension_items_id_booking_item_id_key" ON "extension_items"("id", "booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_records_booking_item_id_key" ON "return_records"("booking_item_id");

-- CreateIndex
CREATE INDEX "return_records_status_idx" ON "return_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "loss_records_booking_item_id_key" ON "loss_records"("booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_charges_source_key_key" ON "booking_charges"("source_key");

-- CreateIndex
CREATE INDEX "booking_charges_booking_id_extension_id_effective_at_idx" ON "booking_charges"("booking_id", "extension_id", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_obligations_pending_proof_id_key" ON "payment_obligations"("pending_proof_id");

-- CreateIndex
CREATE INDEX "payment_obligations_booking_id_status_idx" ON "payment_obligations"("booking_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_obligations_id_booking_id_key" ON "payment_obligations"("id", "booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_obligations_id_extension_id_key" ON "payment_obligations"("id", "extension_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_obligations_pending_proof_id_id_key" ON "payment_obligations"("pending_proof_id", "id");

-- CreateIndex
CREATE INDEX "payment_proofs_payment_obligation_id_status_idx" ON "payment_proofs"("payment_obligation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_proofs_id_payment_obligation_id_key" ON "payment_proofs"("id", "payment_obligation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_refund_request_id_key" ON "payments"("refund_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_source_key_key" ON "payments"("source_key");

-- CreateIndex
CREATE INDEX "payments_booking_id_extension_id_occurred_at_idx" ON "payments"("booking_id", "extension_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_booking_id_key" ON "payments"("id", "booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_refund_request_id_booking_id_key" ON "payments"("refund_request_id", "booking_id");

-- CreateIndex
CREATE INDEX "payment_applications_payment_obligation_id_state_idx" ON "payment_applications"("payment_obligation_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "payment_applications_incoming_payment_id_payment_obligation_key" ON "payment_applications"("incoming_payment_id", "payment_obligation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_applications_id_incoming_payment_id_key" ON "payment_applications"("id", "incoming_payment_id");

-- CreateIndex
CREATE INDEX "refund_requests_booking_id_status_idx" ON "refund_requests"("booking_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refund_requests_id_booking_id_key" ON "refund_requests"("id", "booking_id");

-- CreateIndex
CREATE INDEX "refund_sources_incoming_payment_id_idx" ON "refund_sources"("incoming_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_refund_source_part" ON "refund_sources"("refund_request_id", "incoming_payment_id", "payment_application_id");

-- CreateIndex
CREATE INDEX "booking_status_logs_booking_id_created_at_idx" ON "booking_status_logs"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_requests_actor_id_operation_key_key" ON "idempotency_requests"("actor_id", "operation", "key");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_key_key" ON "outbox_events"("event_key");

-- CreateIndex
CREATE INDEX "outbox_events_dispatched_at_occurred_at_idx" ON "outbox_events"("dispatched_at", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_deduplication_key_key" ON "notification_deliveries"("deduplication_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_retry_at_due_at_idx" ON "notification_deliveries"("status", "retry_at", "due_at");

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_item_unit_matches_item" FOREIGN KEY ("item_unit_id", "item_id") REFERENCES "item_units"("id", "item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_picked_up_by_fkey" FOREIGN KEY ("picked_up_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_allocations" ADD CONSTRAINT "unit_allocations_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_allocations" ADD CONSTRAINT "unit_allocations_item_unit_id_fkey" FOREIGN KEY ("item_unit_id") REFERENCES "item_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_allocations" ADD CONSTRAINT "allocation_extension_matches_item" FOREIGN KEY ("extension_item_id", "booking_item_id") REFERENCES "extension_items"("id", "booking_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_quoted_by_fkey" FOREIGN KEY ("quoted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_items" ADD CONSTRAINT "extension_item_matches_parent" FOREIGN KEY ("extension_id", "booking_id") REFERENCES "extensions"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_items" ADD CONSTRAINT "extension_item_matches_booking" FOREIGN KEY ("booking_item_id", "booking_id") REFERENCES "booking_items"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_records" ADD CONSTRAINT "return_records_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_records" ADD CONSTRAINT "return_records_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_records" ADD CONSTRAINT "loss_records_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_records" ADD CONSTRAINT "loss_records_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_charges" ADD CONSTRAINT "booking_charges_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_charges" ADD CONSTRAINT "charge_item_scope" FOREIGN KEY ("booking_item_id", "booking_id") REFERENCES "booking_items"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_charges" ADD CONSTRAINT "booking_charges_extension_scope" FOREIGN KEY ("extension_id", "booking_id") REFERENCES "extensions"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_charges" ADD CONSTRAINT "booking_charges_related_charge_id_fkey" FOREIGN KEY ("related_charge_id") REFERENCES "booking_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_charges" ADD CONSTRAINT "booking_charges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_obligations" ADD CONSTRAINT "payment_obligations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_obligations" ADD CONSTRAINT "payment_obligations_extension_scope" FOREIGN KEY ("extension_id", "booking_id") REFERENCES "extensions"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_obligations" ADD CONSTRAINT "pending_proof_belongs_to_obligation" FOREIGN KEY ("pending_proof_id", "id") REFERENCES "payment_proofs"("id", "payment_obligation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_payment_obligation_id_fkey" FOREIGN KEY ("payment_obligation_id") REFERENCES "payment_obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_obligation_scope" FOREIGN KEY ("payment_obligation_id", "booking_id") REFERENCES "payment_obligations"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_extension_scope" FOREIGN KEY ("extension_id", "booking_id") REFERENCES "extensions"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payment_proof_scope" FOREIGN KEY ("proof_id", "payment_obligation_id") REFERENCES "payment_proofs"("id", "payment_obligation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payment_refund_scope" FOREIGN KEY ("refund_request_id", "booking_id") REFERENCES "refund_requests"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payment_obligation_extension_scope" FOREIGN KEY ("payment_obligation_id", "extension_id") REFERENCES "payment_obligations"("id", "extension_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_incoming_scope" FOREIGN KEY ("incoming_payment_id", "booking_id") REFERENCES "payments"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_obligation_scope" FOREIGN KEY ("payment_obligation_id", "booking_id") REFERENCES "payment_obligations"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_extension_scope" FOREIGN KEY ("extension_id", "booking_id") REFERENCES "extensions"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_sources" ADD CONSTRAINT "refund_source_booking_scope" FOREIGN KEY ("refund_request_id", "booking_id") REFERENCES "refund_requests"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_sources" ADD CONSTRAINT "refund_sources_incoming_scope" FOREIGN KEY ("incoming_payment_id", "booking_id") REFERENCES "payments"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_sources" ADD CONSTRAINT "refund_application_payment_scope" FOREIGN KEY ("payment_application_id", "incoming_payment_id") REFERENCES "payment_applications"("id", "incoming_payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_requests" ADD CONSTRAINT "idempotency_requests_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_outbox_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_admin_id_fkey" FOREIGN KEY ("recipient_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Additional PostgreSQL integrity rules not expressible in Prisma schema.
-- Capacity, overlap/expiry, role checks, and business transitions still require locked services.
ALTER TABLE "items" ADD CONSTRAINT "items_nonnegative_amounts" CHECK ("price_6h" >= 0 AND "price_12h" >= 0 AND "price_24h" >= 0);
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_nonnegative_amounts" CHECK ("fee" >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_nonnegative_amounts" CHECK ("delivery_fee_snapshot" >= 0 AND "initial_rental_total" >= 0 AND "initial_grand_total" >= 0 AND "dp_snapshot" >= 0 AND "amount_due_now" >= 0);
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_nonnegative_amounts" CHECK ("unit_price_snapshot" >= 0 AND "tariff_6h_snapshot" >= 0 AND "tariff_12h_snapshot" >= 0 AND "tariff_24h_snapshot" >= 0);
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_nonnegative_amounts" CHECK ("rental_quote_total" >= 0 AND "extra_delivery_quote" >= 0 AND "amount_due" >= 0);
ALTER TABLE "extension_items" ADD CONSTRAINT "extension_items_nonnegative_amounts" CHECK ("unit_price_snapshot" >= 0);
ALTER TABLE "return_records" ADD CONSTRAINT "return_records_nonnegative_amounts" CHECK ("damage_amount" >= 0 AND "late_fee" >= 0);
ALTER TABLE "loss_records" ADD CONSTRAINT "loss_records_nonnegative_amounts" CHECK ("compensation_amount" >= 0 AND "late_fee" >= 0);
ALTER TABLE "booking_charges" ADD CONSTRAINT "booking_charges_nonnegative_amounts" CHECK ("amount" >= 0);
ALTER TABLE "payment_obligations" ADD CONSTRAINT "payment_obligations_nonnegative_amounts" CHECK ("amount_due" >= 0);
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_nonnegative_amounts" CHECK ("claimed_amount" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_nonnegative_amounts" CHECK ("amount" >= 0);
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_nonnegative_amounts" CHECK ("amount" >= 0);
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_nonnegative_amounts" CHECK ("requested_amount" >= 0 AND "approved_amount" >= 0);
ALTER TABLE "refund_sources" ADD CONSTRAINT "refund_sources_nonnegative_amounts" CHECK ("amount" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "users_login_identity" CHECK (COALESCE(NULLIF(email, ''), NULLIF(phone, '')) IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "users_normalized_email" CHECK (email IS NULL OR (email = lower(btrim(email)) AND length(email) > 0));
ALTER TABLE "users" ADD CONSTRAINT "users_normalized_phone" CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$');
ALTER TABLE "customer_profiles" ADD CONSTRAINT "profiles_required_fields" CHECK (length(btrim(full_name)) > 0 AND length(btrim(address)) > 0 AND phone_active ~ '^\+[1-9][0-9]{6,14}$' AND length(nik_ciphertext) > 0);
ALTER TABLE "item_units" ADD CONSTRAINT "units_ready_condition" CHECK (physical_status <> 'ready' OR condition_status = 'layak');
ALTER TABLE "item_units" ADD CONSTRAINT "units_preparation_deadline" CHECK (physical_status <> 'preparing' OR preparation_until IS NOT NULL);
ALTER TABLE "item_units" ADD CONSTRAINT "units_lost_condition" CHECK ((condition_status = 'lost') = (physical_status = 'lost') AND (condition_status <> 'lost' OR NOT is_active));
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_initial_interval" CHECK (initial_end_at > initial_start_at AND expires_at >= created_at AND no_show_due_at >= initial_start_at AND shop_delay_seconds >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_delivery_fields" CHECK ((delivery_type = 'delivery' AND delivery_zone_id IS NOT NULL AND delivery_zone_name_snapshot IS NOT NULL AND delivery_address IS NOT NULL AND length(btrim(delivery_address)) > 0) OR (delivery_type = 'pickup' AND delivery_zone_id IS NULL AND delivery_fee_snapshot = 0));
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_totals" CHECK (initial_grand_total = initial_rental_total + delivery_fee_snapshot AND ((pay_option = 'full' AND amount_due_now = initial_grand_total) OR (pay_option = 'dp' AND initial_grand_total > dp_snapshot AND amount_due_now = dp_snapshot)));
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_confirmation_pair" CHECK ((confirmed_by IS NULL) = (confirmed_at IS NULL) AND (status NOT IN ('dikonfirmasi','berjalan','selesai') OR confirmed_at IS NOT NULL));
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_valid_interval" CHECK (initial_end_at > initial_start_at AND current_end_at > start_at AND version >= 0 AND shop_delay_seconds >= 0);
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_handover" CHECK ((picked_up_by IS NULL) = (picked_up_at IS NULL) AND (use_status = 'allocated' OR picked_up_at IS NOT NULL));
ALTER TABLE "unit_allocations" ADD CONSTRAINT "allocations_valid_interval" CHECK (end_at > start_at AND block_start_at <= start_at AND block_end_at >= end_at);
ALTER TABLE "unit_allocations" ADD CONSTRAINT "allocations_extension_scope" CHECK ((allocation_kind = 'extension_hold') = (extension_item_id IS NOT NULL));
ALTER TABLE "unit_allocations" ADD CONSTRAINT "allocations_release" CHECK ((state = 'released') = (released_at IS NOT NULL));
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_quote_total" CHECK (amount_due = rental_quote_total + extra_delivery_quote);
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_submit_deadline" CHECK ((status <> 'draft_quote' AND submitted_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at >= submitted_at) OR (status IN ('draft_quote','dibatalkan','ditolak') AND submitted_at IS NULL AND expires_at IS NULL));
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_approval" CHECK ((approved_by IS NULL) = (approved_at IS NULL) AND (status <> 'disetujui' OR approved_at IS NOT NULL));
ALTER TABLE "extension_items" ADD CONSTRAINT "extension_items_valid_duration" CHECK (added_hours IN (6,12,24) AND proposed_end_at = old_end_at + added_hours * INTERVAL '1 hour' AND expected_item_version >= 0);
ALTER TABLE "return_records" ADD CONSTRAINT "returns_nonnegative_durations" CHECK (late_seconds >= 0 AND admin_delay_exemption_seconds >= 0 AND courier_delay_exemption_seconds >= 0);
ALTER TABLE "return_records" ADD CONSTRAINT "returns_verified_fields" CHECK (status <> 'verified' OR (received_at_store IS NOT NULL AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND fee_return_at IS NOT NULL AND condition_note IS NOT NULL));
ALTER TABLE "return_records" ADD CONSTRAINT "returns_timestamp_order" CHECK (received_at_store <= verified_at AND received_by_courier_at <= received_at_store AND preparation_started_at >= verified_at AND fee_return_at <= verified_at);
ALTER TABLE "loss_records" ADD CONSTRAINT "loss_timestamp_order" CHECK (lost_at <= verified_at AND length(btrim(loss_note)) > 0);
ALTER TABLE "payment_obligations" ADD CONSTRAINT "obligations_extension_scope" CHECK ((purpose = 'extension') = (extension_id IS NOT NULL));
ALTER TABLE "payment_obligations" ADD CONSTRAINT "obligations_pending_proof" CHECK ((status = 'proof_pending') = (pending_proof_id IS NOT NULL));
ALTER TABLE "payment_proofs" ADD CONSTRAINT "proof_file_limits" CHECK (size > 0 AND size <= 2097152 AND mime IN ('image/jpeg','image/png','application/pdf') AND file_hash ~ '^[a-f0-9]{64}$' AND length(proof_path) > 0);
ALTER TABLE "payment_proofs" ADD CONSTRAINT "proof_review_fields" CHECK ((status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND (status <> 'rejected' OR (rejected_reason IS NOT NULL AND length(btrim(rejected_reason)) > 0))));
ALTER TABLE "payments" ADD CONSTRAINT "payments_positive" CHECK (amount > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_direction_scope" CHECK ((direction = 'out' AND type = 'refund' AND refund_request_id IS NOT NULL AND method = 'transfer' AND attachment_path IS NOT NULL AND length(attachment_path) > 0) OR (direction = 'in' AND type <> 'refund' AND refund_request_id IS NULL));
ALTER TABLE "payments" ADD CONSTRAINT "payments_reference_account" CHECK (transaction_reference IS NULL OR (receiving_account_reference IS NOT NULL AND length(transaction_reference) > 0));
ALTER TABLE "payment_applications" ADD CONSTRAINT "applications_positive" CHECK (amount > 0);
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_approval_fields" CHECK (status NOT IN ('disetujui','sudah_dikembalikan') OR (approved_amount IS NOT NULL AND approved_amount > 0 AND approved_at IS NOT NULL AND approved_by IS NOT NULL));
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_transfer_state" CHECK ((status = 'sudah_dikembalikan') = (transferred_at IS NOT NULL));
ALTER TABLE "refund_sources" ADD CONSTRAINT "refund_sources_positive" CHECK (amount > 0);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_attempts_nonnegative" CHECK (attempts >= 0);
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notifications_attempts_nonnegative" CHECK (attempts >= 0);
CREATE UNIQUE INDEX "one_active_rental_per_booking_item" ON "unit_allocations" ("booking_item_id") WHERE state = 'active' AND allocation_kind = 'rental';
CREATE UNIQUE INDEX "one_pending_proof_per_obligation" ON "payment_proofs" ("payment_obligation_id") WHERE status = 'pending';
CREATE UNIQUE INDEX "unique_receiving_transaction" ON "payments" ("receiving_account_reference", "transaction_reference") WHERE receiving_account_reference IS NOT NULL AND transaction_reference IS NOT NULL;

-- Prisma's @updatedAt uses UTC instants; these Timestamp fields intentionally hold WIB.
CREATE FUNCTION "set_updated_at_wib"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta';
  RETURN NEW;
END;
$$;
CREATE TRIGGER "set_users_updated_at" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_customer_profiles_updated_at" BEFORE UPDATE ON "customer_profiles" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_items_updated_at" BEFORE UPDATE ON "items" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_item_units_updated_at" BEFORE UPDATE ON "item_units" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_delivery_zones_updated_at" BEFORE UPDATE ON "delivery_zones" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_bookings_updated_at" BEFORE UPDATE ON "bookings" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_booking_items_updated_at" BEFORE UPDATE ON "booking_items" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_unit_allocations_updated_at" BEFORE UPDATE ON "unit_allocations" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_extensions_updated_at" BEFORE UPDATE ON "extensions" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_extension_items_updated_at" BEFORE UPDATE ON "extension_items" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_return_records_updated_at" BEFORE UPDATE ON "return_records" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_loss_records_updated_at" BEFORE UPDATE ON "loss_records" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_booking_charges_updated_at" BEFORE UPDATE ON "booking_charges" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_payment_obligations_updated_at" BEFORE UPDATE ON "payment_obligations" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_payment_proofs_updated_at" BEFORE UPDATE ON "payment_proofs" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_payments_updated_at" BEFORE UPDATE ON "payments" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_payment_applications_updated_at" BEFORE UPDATE ON "payment_applications" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_refund_requests_updated_at" BEFORE UPDATE ON "refund_requests" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_refund_sources_updated_at" BEFORE UPDATE ON "refund_sources" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_booking_status_logs_updated_at" BEFORE UPDATE ON "booking_status_logs" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_audit_logs_updated_at" BEFORE UPDATE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_settings_updated_at" BEFORE UPDATE ON "settings" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_push_subscriptions_updated_at" BEFORE UPDATE ON "push_subscriptions" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_idempotency_requests_updated_at" BEFORE UPDATE ON "idempotency_requests" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_outbox_events_updated_at" BEFORE UPDATE ON "outbox_events" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();
CREATE TRIGGER "set_notification_deliveries_updated_at" BEFORE UPDATE ON "notification_deliveries" FOR EACH ROW EXECUTE FUNCTION "set_updated_at_wib"();

ALTER TABLE "payments" ADD CONSTRAINT "payment_proof_requires_obligation" CHECK (proof_id IS NULL OR payment_obligation_id IS NOT NULL);


-- Released allocations retain the old physical unit when a booking gets a replacement.
-- Deferred checks validate the final active allocation after all transactional updates.
CREATE FUNCTION check_active_allocation_unit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected_booking_item uuid;
BEGIN
  IF TG_TABLE_NAME = 'booking_items' THEN
    affected_booking_item := NEW.id;
  ELSE
    affected_booking_item := NEW.booking_item_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM unit_allocations a JOIN booking_items bi ON bi.id = a.booking_item_id
    WHERE a.booking_item_id = affected_booking_item AND a.state = 'active' AND a.item_unit_id <> bi.item_unit_id
  ) THEN
    RAISE EXCEPTION 'Active allocation must match current booking unit'
      USING ERRCODE = '23514', CONSTRAINT = 'allocation_matches_booking_unit';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER active_allocation_unit_check AFTER INSERT OR UPDATE ON unit_allocations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_active_allocation_unit();
CREATE CONSTRAINT TRIGGER booking_unit_allocation_check AFTER UPDATE ON booking_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_active_allocation_unit();

DROP INDEX "unique_refund_source_part";
CREATE UNIQUE INDEX "unique_refund_source_part" ON "refund_sources" ("refund_request_id", "incoming_payment_id", "payment_application_id") NULLS NOT DISTINCT;
