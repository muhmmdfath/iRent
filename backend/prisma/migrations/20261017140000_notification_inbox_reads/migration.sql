CREATE TABLE "notification_reads" (
  "user_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "read_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("user_id", "event_id"),
  CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "notification_reads_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
