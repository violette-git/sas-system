// Compact schedule card shared by the schedules list, dashboard and
// employee detail.

import 'package:flutter/material.dart';

import '../../../core/formatters.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/ui.dart';

/// Compact schedule card: time range, client, employee, status.
class ScheduleListTile extends StatelessWidget {
  const ScheduleListTile({
    super.key,
    required this.schedule,
    this.onTap,
    this.showEmployee = true,
    this.showDate = false,
    this.accentColor,
    this.trailing,
  });

  final Schedule schedule;
  final VoidCallback? onTap;
  final bool showEmployee;
  final bool showDate;
  final Color? accentColor;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final s = schedule;
    final cancelled = s.status == ScheduleStatus.cancelled;
    final subtitle = [
      if (showEmployee) s.employeeName ?? 'Unassigned',
      if (s.serviceTypeName != null) s.serviceTypeName!,
    ].join('  ·  ');

    return AppCard(
      onTap: onTap,
      accentColor: accentColor ?? scheduleStatusColor(s.status),
      padding: const EdgeInsets.symmetric(
          horizontal: Space.lg, vertical: Space.md),
      child: Row(
        children: [
          SizedBox(
            width: 78,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (showDate)
                  Text(
                    Fmt.dateShort(s.startTime),
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted),
                  ),
                Text(
                  Fmt.time(s.startTime),
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700),
                ),
                Text(
                  Fmt.time(s.endTime),
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: Space.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.clientName ?? 'Client',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    decoration:
                        cancelled ? TextDecoration.lineThrough : null,
                    color: cancelled ? AppColors.textSecondary : null,
                  ),
                ),
                if (s.title != null && s.title!.isNotEmpty)
                  Text(
                    s.title!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary),
                  ),
                if (subtitle.isNotEmpty)
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textMuted),
                  ),
              ],
            ),
          ),
          const SizedBox(width: Space.sm),
          trailing ?? ScheduleStatusPill(s.status),
        ],
      ),
    );
  }
}
