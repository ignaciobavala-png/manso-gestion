-- Subcategorías para productos tipo bebida
-- Permite agrupar en la Carta: trago / cerveza / sin_alcohol

ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
