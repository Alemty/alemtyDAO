-- =========================================================
-- 011: aura_claimed — seguimiento de AURA reclamado off-chain
-- Permite calcular auraReclamable = auraAccumulado - auraClaimed
-- sin depender del balance on-chain total (que puede incluir
-- mints iniciales, transfers directos, etc.)
-- =========================================================

ALTER TABLE user_stats ADD COLUMN aura_claimed INTEGER NOT NULL DEFAULT 0;
