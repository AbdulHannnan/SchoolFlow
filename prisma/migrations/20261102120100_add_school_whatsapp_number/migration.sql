-- AddColumn
-- The school's own WhatsApp sender number (E.164), shown as the "from" of
-- weekly-report messages. Nullable: left blank until the school connects its
-- WhatsApp Business number, and the weekly-report send is gated on it.
ALTER TABLE "schools" ADD COLUMN "whatsappNumber" TEXT;
