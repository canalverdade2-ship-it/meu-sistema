-- Drop the existing constraint if it exists
ALTER TABLE transferencias DROP CONSTRAINT IF EXISTS transferencias_status_check;

-- Create the new constraint with all required statuses
ALTER TABLE transferencias ADD CONSTRAINT transferencias_status_check 
CHECK (status IN ('em_analise', 'aprovado', 'recusado', 'reprovado', 'concluido', 'estornado', 'cancelado'));
