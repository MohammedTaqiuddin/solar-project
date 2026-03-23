import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(url, key);

// ============================================================
// CONFIGURATION — Update these values as needed
// ============================================================
const EXCEL_FILE_PATH = 'E:/solar_panel_dataset.xlsx';  // Path to your Excel file
const SHEET_NAME = 'Hourly_Data';            // Sheet name to read from
const TARGET_TABLE = 'ml_training_data';     // Supabase table to insert into
const CHUNK_SIZE = 500;                      // Rows per batch insert
// ============================================================

async function uploadData() {
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`\n❌ File not found: ${EXCEL_FILE_PATH}`);
    console.error(`   Please place your Excel file in the project folder and name it "data.xlsx".\n`);
    return;
  }

  console.log(`\n📂 Reading Excel file: ${EXCEL_FILE_PATH}`);
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);

  // Try the specified sheet, fall back to first sheet
  const sheet = workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];
  const usedSheet = workbook.Sheets[SHEET_NAME] ? SHEET_NAME : workbook.SheetNames[0];
  console.log(`📋 Using sheet: "${usedSheet}"`);

  const rawData = XLSX.utils.sheet_to_json(sheet);
  console.log(`📊 Found ${rawData.length} rows. Mapping columns...\n`);

  const formattedData = rawData.map(row => {
    // Handle Excel serial date numbers
    let timestamp = row['Timestamp'];
    if (typeof timestamp === 'number') {
      timestamp = new Date((timestamp - 25569) * 86400 * 1000).toISOString();
    } else if (timestamp instanceof Date) {
      timestamp = timestamp.toISOString();
    }

    let date = row['Date'];
    if (typeof date === 'number') {
      date = new Date((date - 25569) * 86400 * 1000).toISOString().split('T')[0];
    } else if (date instanceof Date) {
      date = date.toISOString().split('T')[0];
    }

    return {
      timestamp: timestamp,
      date: date,
      hour: row['Hour'] != null ? Number(row['Hour']) : null,
      month: row['Month'] != null ? Number(row['Month']) : null,
      season: row['Season'] || null,
      solar_irradiance_w_m2: Number(row['Solar_Irradiance_W_m2'] || 0),
      cloud_cover_pct: Number(row['Cloud_Cover_pct'] || 0),
      ambient_temperature_c: Number(row['Ambient_Temperature_C'] || 0),
      panel_temperature_c: Number(row['Panel_Temperature_C'] || 0),
      wind_speed_m_s: Number(row['Wind_Speed_m_s'] || 0),
      humidity_pct: Number(row['Humidity_pct'] || 0),
      voltage_v: Number(row['Voltage_V'] || 0),
      current_a: Number(row['Current_A'] || 0),
      power_output_kw: Number(row['Power_Output_kW'] || 0),
      energy_kwh: Number(row['Energy_kWh'] || 0),
      saving_inr: Number(row['Saving_INR'] || 0),
      household_demand_kw: Number(row['Household_Demand_kW'] || 0),
      grid_import_kw: Number(row['Grid_Import_kW'] || 0),
      grid_export_kw: Number(row['Grid_Export_kW'] || 0),
      self_sufficiency_pct: Number(row['Self_Sufficiency_pct'] || 0),
    };
  });

  console.log(`🚀 Starting bulk upload to Supabase table "${TARGET_TABLE}"...\n`);

  let totalUploaded = 0;
  for (let i = 0; i < formattedData.length; i += CHUNK_SIZE) {
    const chunk = formattedData.slice(i, i + CHUNK_SIZE);

    const { error } = await supabase.from(TARGET_TABLE).insert(chunk);

    if (error) {
      console.error(`❌ Error uploading rows ${i + 1}–${i + chunk.length}:`, error.message);
      return;
    }

    totalUploaded += chunk.length;
    const pct = ((totalUploaded / formattedData.length) * 100).toFixed(1);
    console.log(`   ✅ Uploaded rows ${i + 1}–${i + chunk.length}  (${pct}%)`);
  }

  console.log(`\n🎉 Upload complete! ${totalUploaded} rows inserted into "${TARGET_TABLE}".\n`);
}

uploadData().catch(console.error);
