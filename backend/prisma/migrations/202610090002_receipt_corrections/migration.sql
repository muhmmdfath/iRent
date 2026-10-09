-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "superseded_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "receipt_corrections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "original_payment_id" UUID NOT NULL,
    "replacement_payment_id" UUID NOT NULL,
    "reversal_amount" BIGINT NOT NULL,
    "reversal_effective_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::text),

    CONSTRAINT "receipt_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipt_corrections_original_payment_id_key" ON "receipt_corrections"("original_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_corrections_replacement_payment_id_key" ON "receipt_corrections"("replacement_payment_id");

-- CreateIndex
CREATE INDEX "receipt_corrections_booking_id_created_at_idx" ON "receipt_corrections"("booking_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_corrections_original_payment_id_booking_id_key" ON "receipt_corrections"("original_payment_id", "booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_corrections_replacement_payment_id_booking_id_key" ON "receipt_corrections"("replacement_payment_id", "booking_id");

-- CreateIndex
CREATE INDEX "item_units_physical_status_preparation_until_idx" ON "item_units"("physical_status", "preparation_until");

-- CreateIndex
CREATE INDEX "extensions_status_created_at_id_idx" ON "extensions"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "return_records_status_created_at_id_idx" ON "return_records"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "payment_proofs_status_uploaded_at_id_idx" ON "payment_proofs"("status", "uploaded_at", "id");

-- CreateIndex
CREATE INDEX "payments_occurred_at_id_idx" ON "payments"("occurred_at", "id");

-- CreateIndex
CREATE INDEX "refund_requests_status_created_at_id_idx" ON "refund_requests"("status", "created_at", "id");

-- AddForeignKey
ALTER TABLE "receipt_corrections" ADD CONSTRAINT "receipt_corrections_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_corrections" ADD CONSTRAINT "correction_original_scope" FOREIGN KEY ("original_payment_id", "booking_id") REFERENCES "payments"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_corrections" ADD CONSTRAINT "correction_replacement_scope" FOREIGN KEY ("replacement_payment_id", "booking_id") REFERENCES "payments"("id", "booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The active claim can be corrected without erasing the historical reference.
DROP INDEX "unique_receiving_transaction";
CREATE UNIQUE INDEX "unique_receiving_transaction" ON payments(receiving_account_reference,transaction_reference)
WHERE receiving_account_reference IS NOT NULL AND transaction_reference IS NOT NULL AND superseded_at IS NULL;
ALTER TABLE receipt_corrections ADD CONSTRAINT correction_valid_reversal
CHECK (original_payment_id <> replacement_payment_id AND reversal_amount > 0 AND length(trim(reason)) >= 5);

CREATE FUNCTION protect_receipt_data() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['superseded_at','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['superseded_at','updated_at']) OR
     (OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at) THEN
    RAISE EXCEPTION 'Receipt data is immutable; append a correction' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_receipt_data BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION protect_receipt_data();

CREATE FUNCTION protect_correction_data() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Receipt correction history is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER protect_correction_data BEFORE UPDATE OR DELETE ON receipt_corrections
FOR EACH ROW EXECUTE FUNCTION protect_correction_data();

CREATE FUNCTION validate_receipt_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original payments%ROWTYPE; replacement payments%ROWTYPE;
BEGIN
  SELECT * INTO original FROM payments WHERE id=NEW.original_payment_id;
  SELECT * INTO replacement FROM payments WHERE id=NEW.replacement_payment_id;
  IF original.direction <> 'in' OR replacement.direction <> 'in' OR original.superseded_at IS NULL OR
     NEW.reversal_amount <> original.amount OR NEW.reversal_effective_at <> original.occurred_at OR
     original.payment_obligation_id IS DISTINCT FROM replacement.payment_obligation_id OR
     original.extension_id IS DISTINCT FROM replacement.extension_id THEN
    RAISE EXCEPTION 'Invalid receipt correction scope/reversal' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM payment_applications WHERE incoming_payment_id=original.id AND state <> 'released') OR
     EXISTS(SELECT 1 FROM refund_sources s JOIN refund_requests r ON r.id=s.refund_request_id
       WHERE s.incoming_payment_id=original.id AND r.status <> 'ditolak') THEN
    RAISE EXCEPTION 'Corrected receipt still funds an application or refund' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER validate_receipt_correction AFTER INSERT ON receipt_corrections
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_receipt_correction();

CREATE FUNCTION require_receipt_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.superseded_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM receipt_corrections WHERE original_payment_id=NEW.id) THEN
    RAISE EXCEPTION 'Superseded receipt requires a correction record' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER require_receipt_correction AFTER INSERT OR UPDATE ON payments
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_receipt_correction();
