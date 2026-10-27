-- Manual-chat delivery has no zone or application charge. Historical snapshots
-- without the switch retain the existing zone requirements.
ALTER TABLE "bookings"
  DROP CONSTRAINT "bookings_delivery_fields",
  ADD CONSTRAINT "bookings_delivery_fields" CHECK (
    (
      delivery_type = 'delivery'
      AND delivery_address IS NOT NULL
      AND length(btrim(delivery_address)) > 0
      AND CASE
        WHEN COALESCE(rules_snapshot #> '{rules,values,delivery_fee_enabled}' = 'false'::jsonb, false)
        THEN delivery_zone_id IS NULL AND delivery_zone_name_snapshot IS NULL AND delivery_fee_snapshot = 0
        ELSE delivery_zone_id IS NOT NULL AND delivery_zone_name_snapshot IS NOT NULL
      END
    )
    OR (delivery_type = 'pickup' AND delivery_zone_id IS NULL AND delivery_fee_snapshot = 0)
  );
