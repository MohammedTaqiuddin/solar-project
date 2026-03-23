CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  message TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable row level security for the new alerts table
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own alerts
CREATE POLICY "Allow authenticated users to read alerts"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert alerts
CREATE POLICY "Allow authenticated users to insert alerts"
  ON alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update alerts
CREATE POLICY "Allow authenticated users to update alerts"
  ON alerts
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete alerts
CREATE POLICY "Allow authenticated users to delete alerts"
  ON alerts
  FOR DELETE
  TO authenticated
  USING (true);