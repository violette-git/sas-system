import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import type { TimesheetRow } from '../hooks/useTimesheets';
import type { PayRate } from '../hooks/usePayRates';

export function buildPayrollCSV(
  rows: TimesheetRow[],
  payRateMap: Map<string, PayRate>,
  weekStart: string,
  weekEnd: string,
): string {
  // weekEnd used in CSV header comment
  const headers = [
    'Employee', 'Regular Hours', 'OT Hours', 'Billable Units',
    'Hourly Rate', 'OT Rate', 'Regular Pay', 'OT Pay', 'Total Pay',
  ];

  const lines = [
    `# Payroll Export: ${weekStart} to ${weekEnd}`,
    headers.join(','),
  ];

  for (const row of rows) {
    const rate = payRateMap.get(row.employee_id);
    const hourlyRate = rate?.hourly_rate ?? 0;
    const otRate     = rate?.overtime_rate ?? hourlyRate * 1.5;
    const regularPay = row.regularHours  * hourlyRate;
    const otPay      = row.overtimeHours * otRate;
    const totalPay   = regularPay + otPay;

    lines.push([
      `"${row.full_name}"`,
      row.regularHours.toFixed(2),
      row.overtimeHours.toFixed(2),
      row.billableUnits.toString(),
      hourlyRate.toFixed(2),
      otRate.toFixed(2),
      regularPay.toFixed(2),
      otPay.toFixed(2),
      totalPay.toFixed(2),
    ].join(','));
  }

  return lines.join('\n');
}

export async function sharePayrollCSV(
  csv: string,
  weekStart: string,
): Promise<void> {
  const filename = `payroll_${weekStart}.csv`;
  const path = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  try {
    // expo-sharing may not be installed — import dynamically with require to avoid
    // TS module-not-found errors when the package is absent
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sharing = require('expo-sharing') as {
      isAvailableAsync: () => Promise<boolean>;
      shareAsync: (url: string, options?: Record<string, string>) => Promise<void>;
    };
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Payroll CSV' });
      return;
    }
  } catch {
    // expo-sharing not available — fall through to Alert
  }

  // Fallback: Alert with file path
  Alert.alert('Export Saved', `Payroll CSV saved to:\n${path}`);
}
