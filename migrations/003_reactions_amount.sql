
-- 003_reactions_amount.sql
-- Agrega amount para permitir N points por post sin duplicar filas
ALTER TABLE reactions ADD COLUMN amount INTEGER NOT NULL DEFAULT 1;

-- Normaliza tipos antiguos (si existieran)
UPDATE reactions
SET type = 'point'
WHERE type IN ('points');

-- (Opcional) Asegura que amount nunca sea <1
UPDATE reactions
SET amount = 1
WHERE amount IS NULL OR amount < 1;

