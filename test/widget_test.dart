import 'package:flutter_test/flutter_test.dart';
import 'package:sas_system/core/formatters.dart';
import 'package:sas_system/core/password_validation.dart';
import 'package:sas_system/models/models.dart';

void main() {
  group('Fmt', () {
    test('minutes', () {
      expect(Fmt.minutes(125), '2h 5m');
      expect(Fmt.minutes(45), '45m');
      expect(Fmt.minutes(120), '2h');
      expect(Fmt.minutes(null), '-');
    });
    test('clock', () {
      expect(Fmt.clock(const Duration(hours: 1, minutes: 2, seconds: 3)),
          '01:02:03');
    });
    test('units as hours (1 unit = 15 min)', () {
      expect(Fmt.unitsAsHours(8), '2 h');
      expect(Fmt.unitsAsHours(10), '2.50 h');
    });
    test('initials', () {
      expect(Fmt.initials('Jane Q Public'), 'JP');
      expect(Fmt.initials('cher'), 'C');
      expect(Fmt.initials(''), '?');
    });
  });

  test('password rules', () {
    expect(PasswordCheck('abc').isValid, false);
    expect(PasswordCheck('Abcdef1!').isValid, true);
    expect(PasswordCheck('Abcdef1!').label, 'Very strong');
  });

  test('schedule parses joins', () {
    final s = Schedule.fromJson({
      'id': 's1',
      'company_id': 'c1',
      'employee_id': 'e1',
      'client_id': 'k1',
      'start_time': '2026-01-01T15:00:00Z',
      'end_time': '2026-01-01T17:00:00Z',
      'status': 'in_progress',
      'users': {'full_name': 'Ann Lee'},
      'clients': {'name': 'Smith Home', 'city': 'Birmingham', 'state': 'AL'},
      'service_types': {'name': 'Respite'},
    });
    expect(s.status, ScheduleStatus.inProgress);
    expect(s.employeeName, 'Ann Lee');
    expect(s.clientAddress, 'Birmingham, AL');
    expect(s.plannedDuration, const Duration(hours: 2));
    expect(s.displayTitle, 'Respite');
  });
}
