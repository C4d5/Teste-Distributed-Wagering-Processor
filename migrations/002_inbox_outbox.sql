
CREATE TABLE inbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    message_id TEXT NOT NULL,

    consumer_name TEXT NOT NULL,

    payload_hash TEXT NOT NULL,

    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    processed_at TIMESTAMPTZ,

    CONSTRAINT uq_inbox_consumer_message UNIQUE (consumer_name, message_id)
);

COMMENT ON TABLE inbox_messages IS 'Deduplicação de mensagens recebidas (padrão Transactional Inbox).';

CREATE INDEX idx_inbox_messages_unprocessed
    ON inbox_messages (received_at)
    WHERE processed_at IS NULL;

CREATE TABLE outbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    aggregate_id UUID NOT NULL,

    event_type TEXT NOT NULL,

    payload JSONB NOT NULL,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    attempts INTEGER NOT NULL DEFAULT 0,

    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    published_at TIMESTAMPTZ,

    last_error TEXT
);

COMMENT ON TABLE outbox_messages IS 'Eventos de integração pendentes de publicação (padrão Transactional Outbox).';
COMMENT ON COLUMN outbox_messages.last_error IS 'Texto do último erro de publicação — nunca deixamos uma falha sem rastro.';

CREATE INDEX idx_outbox_messages_pending
    ON outbox_messages (next_attempt_at)
    WHERE published_at IS NULL;