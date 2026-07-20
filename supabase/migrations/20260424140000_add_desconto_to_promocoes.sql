-- Add desconto fields to promocoes table
ALTER TABLE promocoes 
ADD COLUMN IF NOT EXISTS tipo_desconto TEXT CHECK (tipo_desconto IN ('valor', 'porcentagem', 'nenhum')) DEFAULT 'nenhum',
ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(10,2) DEFAULT 0;
