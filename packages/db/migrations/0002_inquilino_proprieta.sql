-- 0002: Tabella di associazione inquilino ↔ proprietà
-- Permette a un inquilino di essere associato a più proprietà
-- (es. appartamento + box nello stesso edificio, o edifici diversi).
-- Relazione distinta da "contratti" che richiederebbe dati finanziari.

CREATE TABLE IF NOT EXISTS inquilino_proprieta (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  inquilino_id uuid NOT NULL REFERENCES inquilini(id)  ON DELETE CASCADE,
  proprieta_id uuid NOT NULL REFERENCES proprieta(id)  ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (inquilino_id, proprieta_id)
);

ALTER TABLE inquilino_proprieta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON inquilino_proprieta
  USING (tenant_id = current_tenant_id());
