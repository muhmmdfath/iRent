ALTER TABLE notification_deliveries
  ADD COLUMN context JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN lease_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMP(3);
CREATE INDEX notification_deliveries_status_lease_expires_at_idx
  ON notification_deliveries(status, lease_expires_at);
