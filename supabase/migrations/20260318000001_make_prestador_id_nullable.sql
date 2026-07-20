-- Make prestador_id nullable in prestador_demandas
ALTER TABLE prestador_demandas ALTER COLUMN prestador_id DROP NOT NULL;
