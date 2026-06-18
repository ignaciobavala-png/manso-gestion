DROP POLICY IF EXISTS "financial_owner_only" ON financial_ingresos;
DROP POLICY IF EXISTS "financial_owner_only" ON financial_egresos;
DROP POLICY IF EXISTS "financial_owner_only" ON financial_inversiones_socio;

CREATE POLICY "financial_owner_only" ON financial_ingresos
  FOR ALL USING (auth.jwt() ->> 'email' = 'owner@manso.internal');

CREATE POLICY "financial_owner_only" ON financial_egresos
  FOR ALL USING (auth.jwt() ->> 'email' = 'owner@manso.internal');

CREATE POLICY "financial_owner_only" ON financial_inversiones_socio
  FOR ALL USING (auth.jwt() ->> 'email' = 'owner@manso.internal');
