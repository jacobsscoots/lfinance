/**
 * Energy CSV Parser
 * Parses energy readings from CSV files
 */

export interface ParsedReading {
  date: string;
  fuel_type: 'electricity' | 'gas';
  consumption_kwh: number;
  cost?: number;
}

export interface ParseResult {
  success: boolean;
  readings: ParsedReading[];
  errors: string[];
}

function parseDate(dateStr: string): string | null {
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year: string, month: string, day: string;

      if (format === formats[0]) {
        [, year, month, day] = match;
      } else {
        [, day, month, year] = match;
      }

      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  return null;
}

function parseNumber(str: string): number | null {
  const cleaned = str.replace(/[£$€,\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function detectFuelType(headers: string[], row: string[]): 'electricity' | 'gas' | null {
  // Check headers for fuel type indicator
  const headerStr = headers.join(' ').toLowerCase();
  
  if (headerStr.includes('electric') || headerStr.includes('elec')) {
    return 'electricity';
  }
  if (headerStr.includes('gas')) {
    return 'gas';
  }

  // Check if row contains fuel type
  for (const cell of row) {
    const lower = cell.toLowerCase();
    if (lower === 'electricity' || lower === 'electric' || lower === 'elec') {
      return 'electricity';
    }
    if (lower === 'gas') {
      return 'gas';
    }
  }

  return null;
}

function findColumnIndex(headers: string[], ...names: string[]): number {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const name of names) {
    const idx = lowerHeaders.findIndex(
      (h) => h.includes(name.toLowerCase())
    );
    if (idx !== -1) return idx;
  }

  return -1;
}

export function parseEnergyCsv(csvContent: string): ParseResult {
  const lines = csvContent.trim().split('\n');
  const readings: ParsedReading[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    return { success: false, readings: [], errors: ['Empty CSV file'] };
  }

  // Parse headers
  const headers = lines[0].split(',').map((h) => h.trim());

  // Find column indices
  const dateCol = findColumnIndex(headers, 'date', 'reading_date', 'day');
  const electricCol = findColumnIndex(headers, 'electricity', 'electric', 'elec_kwh', 'electricity_kwh');
  const gasCol = findColumnIndex(headers, 'gas', 'gas_kwh');
  const kwhCol = findColumnIndex(headers, 'kwh', 'consumption', 'usage');
  const costCol = findColumnIndex(headers, 'cost', 'price', 'amount', '£');
  const fuelTypeCol = findColumnIndex(headers, 'fuel', 'type', 'fuel_type');

  if (dateCol === -1) {
    errors.push('Could not find date column');
    return { success: false, readings: [], errors };
  }

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map((p) => p.trim());
    const lineNum = i + 1;

    // Parse date
    const date = parseDate(parts[dateCol]);
    if (!date) {
      errors.push(`Line ${lineNum}: Invalid date "${parts[dateCol]}"`);
      continue;
    }

    // Determine fuel type and consumption
    if (electricCol !== -1) {
      const consumption = parseNumber(parts[electricCol]);
      if (consumption !== null && consumption > 0) {
        readings.push({
          date,
          fuel_type: 'electricity',
          consumption_kwh: consumption,
          cost: costCol !== -1 ? parseNumber(parts[costCol]) || undefined : undefined,
        });
      }
    }

    if (gasCol !== -1) {
      const consumption = parseNumber(parts[gasCol]);
      if (consumption !== null && consumption > 0) {
        readings.push({
          date,
          fuel_type: 'gas',
          consumption_kwh: consumption,
        });
      }
    }

    // If no separate columns, try single consumption with fuel type
    if (electricCol === -1 && gasCol === -1 && kwhCol !== -1) {
      const consumption = parseNumber(parts[kwhCol]);
      if (consumption !== null && consumption > 0) {
        let fuelType = fuelTypeCol !== -1 
          ? detectFuelType(headers, parts)
          : detectFuelType(headers, parts);

        // Default to electricity if can't determine
        if (!fuelType) {
          fuelType = 'electricity';
        }

        readings.push({
          date,
          fuel_type: fuelType,
          consumption_kwh: consumption,
          cost: costCol !== -1 ? parseNumber(parts[costCol]) || undefined : undefined,
        });
      }
    }
  }

  return {
    success: errors.length === 0 && readings.length > 0,
    readings,
    errors,
  };
}

/**
 * Generate a sample CSV template
 */
export function generateEnergyTemplate(): string {
  return `date,electricity_kwh,gas_kwh,cost
2025-01-01,12.5,8.2,4.50
2025-01-02,10.8,7.5,3.95
2025-01-03,14.2,9.0,5.10`;
}
