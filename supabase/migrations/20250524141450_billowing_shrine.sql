/*
  # Add energy and saving columns to sensor_data table

  1. Changes
    - Add `energy` column (numeric, not null, default 0)
    - Add `saving` column (numeric, not null, default 0)
    
  2. Notes
    - Both columns are set as NOT NULL with default values to maintain data consistency
    - Existing policies will automatically apply to the new columns
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sensor_data' AND column_name = 'energy'
  ) THEN
    ALTER TABLE sensor_data ADD COLUMN energy NUMERIC NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sensor_data' AND column_name = 'saving'
  ) THEN
    ALTER TABLE sensor_data ADD COLUMN saving NUMERIC NOT NULL DEFAULT 0;
  END IF;
END $$;