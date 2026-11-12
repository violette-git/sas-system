// Data models mirroring the Supabase schema (see supabase/schema.sql and
// supabase/migrations). Every model parses defensively: optional columns
// added by later migrations may be absent on older databases.

import '../core/formatters.dart';

enum UserRole { owner, admin, employee }

UserRole parseRole(String? v) => switch (v) {
      'owner' => UserRole.owner,
      'admin' => UserRole.admin,
      _ => UserRole.employee,
    };

double? _num(dynamic v) => v == null ? null : (v as num).toDouble();

class UserProfile {
  final String id;
  final String? companyId;
  final String fullName;
  final String email;
  final UserRole role;
  final bool isActive;
  final String? avatarUrl;
  final String? phone;
  final Map<String, dynamic> permissions;

  const UserProfile({
    required this.id,
    required this.companyId,
    required this.fullName,
    required this.email,
    required this.role,
    required this.isActive,
    this.avatarUrl,
    this.phone,
    this.permissions = const {},
  });

  factory UserProfile.fromJson(Map<String, dynamic> j) => UserProfile(
        id: j['id'] as String,
        companyId: j['company_id'] as String?,
        fullName: (j['full_name'] as String?) ?? '',
        email: (j['email'] as String?) ?? '',
        role: parseRole(j['role'] as String?),
        isActive: (j['is_active'] as bool?) ?? true,
        avatarUrl: j['avatar_url'] as String?,
        phone: j['phone'] as String?,
        permissions: (j['permissions'] as Map?)?.cast<String, dynamic>() ?? {},
      );
}

class Company {
  final String id;
  final String name;
  final String? tradeName;
  final String accessCode;
  final bool isActive;
  final String? primaryColor;
  final String? logoUrl;
  final String? displayName;
  final int geofenceRadiusMeters;
  final String defaultLanguage;
  final DateTime? createdAt;

  const Company({
    required this.id,
    required this.name,
    required this.accessCode,
    required this.isActive,
    this.tradeName,
    this.primaryColor,
    this.logoUrl,
    this.displayName,
    this.geofenceRadiusMeters = 500,
    this.defaultLanguage = 'en',
    this.createdAt,
  });

  /// Name shown in the UI: white-label display name, then DBA, then legal.
  String get label => displayName ?? tradeName ?? name;

  factory Company.fromJson(Map<String, dynamic> j) => Company(
        id: j['id'] as String,
        name: (j['name'] as String?) ?? '',
        tradeName: j['trade_name'] as String?,
        accessCode: (j['access_code'] as String?) ?? '',
        isActive: (j['is_active'] as bool?) ?? true,
        primaryColor: j['primary_color'] as String?,
        logoUrl: j['logo_url'] as String?,
        displayName: j['company_name_display'] as String?,
        geofenceRadiusMeters: (j['geofence_radius_meters'] as num?)?.toInt() ?? 500,
        defaultLanguage: (j['default_language'] as String?) ?? 'en',
        createdAt: parseTs(j['created_at']),
      );
}

class Client {
  final String id;
  final String companyId;
  final String name;
  final String? contactName;
  final String? contactEmail;
  final String? contactPhone;
  final String? addressLine1;
  final String? addressLine2;
  final String? city;
  final String? state;
  final String? zip;
  final String? notes;
  final bool isActive;
  final double? latitude;
  final double? longitude;

  const Client({
    required this.id,
    required this.companyId,
    required this.name,
    this.contactName,
    this.contactEmail,
    this.contactPhone,
    this.addressLine1,
    this.addressLine2,
    this.city,
    this.state,
    this.zip,
    this.notes,
    this.isActive = true,
    this.latitude,
    this.longitude,
  });

  String get address => [
        addressLine1,
        addressLine2,
        [city, state].whereType<String>().where((s) => s.isNotEmpty).join(', '),
        zip,
      ].whereType<String>().where((s) => s.trim().isNotEmpty).join(' ');

  factory Client.fromJson(Map<String, dynamic> j) => Client(
        id: j['id'] as String,
        companyId: j['company_id'] as String,
        name: (j['name'] as String?) ?? '',
        contactName: j['contact_name'] as String?,
        contactEmail: j['contact_email'] as String?,
        contactPhone: j['contact_phone'] as String?,
        addressLine1: j['address_line1'] as String?,
        addressLine2: j['address_line2'] as String?,
        city: j['city'] as String?,
        state: j['state'] as String?,
        zip: j['zip'] as String?,
        notes: j['notes'] as String?,
        isActive: (j['is_active'] as bool?) ?? true,
        latitude: _num(j['latitude']),
        longitude: _num(j['longitude']),
      );
}

class ServiceType {
  final String id;
  final String companyId;
  final String name;
  final String? shortCode;
  final String? description;
  final bool isActive;

  const ServiceType({
    required this.id,
    required this.companyId,
    required this.name,
    this.shortCode,
    this.description,
    this.isActive = true,
  });

  factory ServiceType.fromJson(Map<String, dynamic> j) => ServiceType(
        id: j['id'] as String,
        companyId: j['company_id'] as String,
        name: (j['name'] as String?) ?? '',
        shortCode: j['short_code'] as String?,
        description: j['description'] as String?,
        isActive: (j['is_active'] as bool?) ?? true,
      );
}

class Authorization {
  final String id;
  final String companyId;
  final String clientId;
  final String serviceTypeId;
  final String authNumber;

  /// 1 unit = 15 minutes; hours = units / 4.
  final int authorizedUnits;
  final DateTime startDate;
  final DateTime endDate;
  final String? notes;
  final bool isActive;
  final String? serviceTypeName;

  const Authorization({
    required this.id,
    required this.companyId,
    required this.clientId,
    required this.serviceTypeId,
    required this.authNumber,
    required this.authorizedUnits,
    required this.startDate,
    required this.endDate,
    this.notes,
    this.isActive = true,
    this.serviceTypeName,
  });

  double get authorizedHours => authorizedUnits / 4;

  factory Authorization.fromJson(Map<String, dynamic> j) => Authorization(
        id: j['id'] as String,
        companyId: j['company_id'] as String,
        clientId: j['client_id'] as String,
        serviceTypeId: j['service_type_id'] as String,
        authNumber: (j['auth_number'] as String?) ?? '',
        authorizedUnits: (j['authorized_units'] as num?)?.toInt() ?? 0,
        startDate: DateTime.parse(j['start_date'] as String),
        endDate: DateTime.parse(j['end_date'] as String),
        notes: j['notes'] as String?,
        isActive: (j['is_active'] as bool?) ?? true,
        serviceTypeName: (j['service_types'] as Map?)?['name'] as String?,
      );
}

enum ScheduleStatus { scheduled, inProgress, completed, cancelled }

ScheduleStatus parseScheduleStatus(String? v) => switch (v) {
      'in_progress' => ScheduleStatus.inProgress,
      'completed' => ScheduleStatus.completed,
      'cancelled' => ScheduleStatus.cancelled,
      _ => ScheduleStatus.scheduled,
    };

extension ScheduleStatusX on ScheduleStatus {
  String get db => switch (this) {
        ScheduleStatus.scheduled => 'scheduled',
        ScheduleStatus.inProgress => 'in_progress',
        ScheduleStatus.completed => 'completed',
        ScheduleStatus.cancelled => 'cancelled',
      };
  String get label => switch (this) {
        ScheduleStatus.scheduled => 'Scheduled',
        ScheduleStatus.inProgress => 'In progress',
        ScheduleStatus.completed => 'Completed',
        ScheduleStatus.cancelled => 'Cancelled',
      };
}

/// A schedule row, optionally with joined client / employee / service type.
/// Select with:
///   Schedule.select  (see below)
class Schedule {
  /// Canonical select string with all joins the UI needs.
  static const select =
      '*, users!schedules_employee_id_fkey(full_name), clients(name, address_line1, city, state), service_types(name, short_code)';

  final String id;
  final String companyId;
  final String employeeId;
  final String clientId;
  final String? serviceTypeId;
  final String? title;
  final String? notes;
  final DateTime startTime;
  final DateTime endTime;
  final ScheduleStatus status;
  final String? clientName;
  final String? clientAddress;
  final String? employeeName;
  final String? serviceTypeName;

  const Schedule({
    required this.id,
    required this.companyId,
    required this.employeeId,
    required this.clientId,
    required this.startTime,
    required this.endTime,
    required this.status,
    this.serviceTypeId,
    this.title,
    this.notes,
    this.clientName,
    this.clientAddress,
    this.employeeName,
    this.serviceTypeName,
  });

  Duration get plannedDuration => endTime.difference(startTime);
  String get displayTitle => title?.isNotEmpty == true
      ? title!
      : (serviceTypeName ?? clientName ?? 'Visit');

  factory Schedule.fromJson(Map<String, dynamic> j) {
    final client = j['clients'] as Map?;
    // The employee join may come back under either key depending on the
    // select alias used; accept both.
    final emp = (j['employee'] ?? j['users']) as Map?;
    final svc = j['service_types'] as Map?;
    String? addr;
    if (client != null) {
      addr = [client['address_line1'], client['city'], client['state']]
          .whereType<String>()
          .where((s) => s.isNotEmpty)
          .join(', ');
    }
    return Schedule(
      id: j['id'] as String,
      companyId: j['company_id'] as String,
      employeeId: j['employee_id'] as String,
      clientId: j['client_id'] as String,
      serviceTypeId: j['service_type_id'] as String?,
      title: j['title'] as String?,
      notes: j['notes'] as String?,
      startTime: parseTs(j['start_time'])!,
      endTime: parseTs(j['end_time'])!,
      status: parseScheduleStatus(j['status'] as String?),
      clientName: client?['name'] as String?,
      clientAddress: addr,
      employeeName: emp?['full_name'] as String?,
      serviceTypeName: svc?['name'] as String?,
    );
  }
}

class TimeEntry {
  final String id;
  final String scheduleId;
  final String employeeId;
  final String companyId;
  final DateTime clockedInAt;
  final DateTime? clockedOutAt;

  /// Generated column, never write.
  final int? durationMinutes;

  const TimeEntry({
    required this.id,
    required this.scheduleId,
    required this.employeeId,
    required this.companyId,
    required this.clockedInAt,
    this.clockedOutAt,
    this.durationMinutes,
  });

  bool get isOpen => clockedOutAt == null;
  Duration get elapsed =>
      (clockedOutAt ?? DateTime.now()).difference(clockedInAt);

  factory TimeEntry.fromJson(Map<String, dynamic> j) => TimeEntry(
        id: j['id'] as String,
        scheduleId: j['schedule_id'] as String,
        employeeId: j['employee_id'] as String,
        companyId: j['company_id'] as String,
        clockedInAt: parseTs(j['clocked_in_at'])!,
        clockedOutAt: parseTs(j['clocked_out_at']),
        durationMinutes: (j['duration_minutes'] as num?)?.toInt(),
      );
}

class VisitNote {
  final String id;
  final String scheduleId;
  final String authorId;
  final String companyId;
  final String body;
  final String status;
  final DateTime? createdAt;
  final String? authorName;

  const VisitNote({
    required this.id,
    required this.scheduleId,
    required this.authorId,
    required this.companyId,
    required this.body,
    this.status = 'draft',
    this.createdAt,
    this.authorName,
  });

  factory VisitNote.fromJson(Map<String, dynamic> j) => VisitNote(
        id: j['id'] as String,
        scheduleId: j['schedule_id'] as String,
        authorId: j['author_id'] as String,
        companyId: j['company_id'] as String,
        body: (j['body'] as String?) ?? '',
        status: (j['status'] as String?) ?? 'draft',
        createdAt: parseTs(j['created_at']),
        authorName: (j['users'] as Map?)?['full_name'] as String?,
      );
}
