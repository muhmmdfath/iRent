-- AlterTable
ALTER TABLE "return_records" ADD COLUMN     "manual_exemptions" JSONB NOT NULL DEFAULT '[]';

-- Preserve recorded intervals from legacy audits. Derived intervals may appear in
-- the snapshot too; interval union keeps them from being charged/excluded twice.
UPDATE return_records r SET manual_exemptions = audit.intervals
FROM (
  SELECT DISTINCT ON (entity_id) entity_id,
    CASE WHEN action='return.corrected' THEN changes->'after'->'exemptions'
         ELSE changes->'exemptions' END AS intervals
  FROM audit_logs WHERE action IN ('return.verified','return.corrected')
  ORDER BY entity_id,created_at DESC,id DESC
) audit WHERE audit.entity_id=r.booking_item_id AND jsonb_typeof(audit.intervals)='array';
ALTER TABLE return_records ADD CONSTRAINT return_manual_exemptions_array CHECK (jsonb_typeof(manual_exemptions)='array');
