import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import type { EmployeePerformanceRow, ClientReportRow } from '../hooks/useReports';

export function buildEmployeePerformanceCSV(rows: EmployeePerformanceRow[], _period: string): string {
  const headers = ['Employee', 'Scheduled Visits', 'Completed', 'Completion %', 'Total Hours', 'Notes Submitted', 'Notes Approved', 'Approval %'];
  const lines = [headers.join(','), ...rows.map(r => [
    `"${r.full_name}"`,
    r.scheduledVisits,
    r.completedVisits,
    r.completionRate.toFixed(1),
    r.totalHours.toFixed(1),
    r.notesSubmitted,
    r.notesApproved,
    r.approvalRate.toFixed(1),
  ].join(','))];
  return lines.join('\n');
}

export function buildClientReportCSV(rows: ClientReportRow[], _period: string): string {
  const headers = ['Client', 'Scheduled', 'Completed', 'Total Hours', 'Billable Units', 'Total Invoiced'];
  const lines = [headers.join(','), ...rows.map(r => [
    `"${r.client_name}"`,
    r.scheduledVisits,
    r.completedVisits,
    r.totalHours.toFixed(1),
    r.billableUnits,
    r.totalInvoiced.toFixed(2),
  ].join(','))];
  return lines.join('\n');
}

export async function shareCSV(csv: string, filename: string): Promise<void> {
  const path = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sharing = require('expo-sharing') as {
      isAvailableAsync: () => Promise<boolean>;
      shareAsync: (url: string, options?: Record<string, string>) => Promise<void>;
    };
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'text/csv' });
      return;
    }
  } catch {
    /* not available */
  }
  Alert.alert('Saved', `Report saved to:\n${path}`);
}
