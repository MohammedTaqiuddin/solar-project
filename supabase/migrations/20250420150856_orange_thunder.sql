/*
  # Create sensor data table and policies

  1. New Tables
    - `sensor_data`
      - `id` (integer, primary key, auto-increment)
      - `created_at` (timestamp with time zone, default: now())
      - `voltage` (numeric, not null)
      - `current` (numeric, not null)
      - `temperature` (numeric, not null)
      - `power` (numeric, not null)
  
  2. Security
    - Enable RLS on `sensor_data` table
    - Add policy for authenticated users to read all data
    - Add policy for authenticated users to insert data
*/

CREATE TABLE IF NOT EXISTS sensor_data (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  voltage NUMERIC NOT NULL,
  current NUMERIC NOT NULL,
  temperature NUMERIC NOT NULL,
  power NUMERIC NOT NULL
);

-- Enable row level security
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read all sensor data" ON sensor_data;
DROP POLICY IF EXISTS "Allow authenticated users to insert sensor data" ON sensor_data;

-- Create policy for reading data
CREATE POLICY "Allow authenticated users to read all sensor data"
  ON sensor_data
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for inserting data
CREATE POLICY "Allow authenticated users to insert sensor data"
  ON sensor_data
  FOR INSERT
  TO authenticated
  WITH CHECK (true);