/*
  # Enable public access to sensor data

  1. Security Changes
    - Update RLS policies to allow public access for reading sensor data
    - Update RLS policies to allow public access for inserting sensor data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read all sensor data" ON sensor_data;
DROP POLICY IF EXISTS "Allow authenticated users to insert sensor data" ON sensor_data;

-- Create new policies for public access
CREATE POLICY "Allow public to read all sensor data"
  ON sensor_data
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public to insert sensor data"
  ON sensor_data
  FOR INSERT
  TO public
  WITH CHECK (true);