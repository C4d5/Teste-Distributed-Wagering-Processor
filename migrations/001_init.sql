
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE,

    balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),

    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

    version INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE wallets IS 'Carteira financeira de um usuário. Saldo sempre em centavos (BIGINT).';
COMMENT ON COLUMN wallets.balance_cents IS 'Saldo atual em centavos. Nunca negativo.';

CREATE TABLE wager_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_id UUID NOT NULL REFERENCES wallets(id),

    type VARCHAR(20) NOT NULL CHECK (
        type IN ('BET', 'WIN', 'DEPOSIT', 'WITHDRAWAL', 'REFUND')
    ),

    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),

    balance_after_cents BIGINT NOT NULL,

    reference_id VARCHAR(100) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (
        status IN ('COMPLETED', 'FAILED', 'REVERSED')
    ),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_wallet_reference UNIQUE (wallet_id, reference_id)
);

COMMENT ON TABLE wager_transactions IS 'Ledger imutável (append-only) de movimentações financeiras por wallet.';
COMMENT ON COLUMN wager_transactions.reference_id IS 'Chave de idempotência externa, única por wallet.';

CREATE INDEX idx_wager_transactions_wallet_id ON wager_transactions (wallet_id);

CREATE INDEX idx_wager_transactions_created_at ON wager_transactions (created_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

INSERT INTO wallets (user_id, balance_cents, currency)
VALUES ('00000000-0000-0000-0000-000000000001', 100000, 'BRL') -- R$ 1.000,00
ON CONFLICT (user_id) DO NOTHING;