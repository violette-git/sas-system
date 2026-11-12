import 'package:intl/intl.dart';

/// Date and time helpers shared across portals. All DB timestamps are UTC;
/// display is always in the device's local time zone.
class Fmt {
  static final _date = DateFormat('MMM d, y');
  static final _dateShort = DateFormat('EEE, MMM d');
  static final _time = DateFormat('h:mm a');
  static final _dateTime = DateFormat('MMM d, h:mm a');
  static final _isoDate = DateFormat('yyyy-MM-dd');

  static String date(DateTime d) => _date.format(d.toLocal());
  static String dateShort(DateTime d) => _dateShort.format(d.toLocal());
  static String time(DateTime d) => _time.format(d.toLocal());
  static String dateTime(DateTime d) => _dateTime.format(d.toLocal());
  static String timeRange(DateTime a, DateTime b) => '${time(a)} - ${time(b)}';

  /// YYYY-MM-DD for `date` columns (authorizations.start_date etc).
  static String isoDate(DateTime d) => _isoDate.format(d);

  /// 125 -> "2h 5m"
  static String minutes(int? mins) {
    if (mins == null) return '-';
    final h = mins ~/ 60;
    final m = mins % 60;
    if (h == 0) return '${m}m';
    return m == 0 ? '${h}h' : '${h}h ${m}m';
  }

  /// Live timer text: 01:02:03
  static String clock(Duration d) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(d.inHours)}:${two(d.inMinutes % 60)}:${two(d.inSeconds % 60)}';
  }

  /// 1 unit = 15 minutes. 10 units -> "2.5 h"
  static String unitsAsHours(num units) {
    final h = units / 4;
    return '${h == h.roundToDouble() ? h.toStringAsFixed(0) : h.toStringAsFixed(2)} h';
  }

  static String initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  static String titleCase(String s) => s
      .split('_')
      .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1))
      .join(' ');
}

DateTime? parseTs(dynamic v) =>
    v == null ? null : DateTime.parse(v as String).toLocal();
