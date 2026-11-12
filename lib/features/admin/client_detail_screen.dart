// Admin client detail, ported from app/(admin)/client/[id]/index.tsx and
// app/(admin)/client/[id]/authorizations.tsx (authorizations are inline
// here instead of on a separate page). Usage bars follow
// useAuthorizationTracking.ts + AuthorizationUsageCard.tsx.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/formatters.dart';
import '../../core/router.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'clients/authorization_form.dart';
import 'clients/client_form.dart';
import 'clients/clients_repository.dart';

class ClientDetailScreen extends ConsumerWidget {
  const ClientDetailScreen({super.key, required this.clientId});
  final String clientId;

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(clientProvider(clientId));
    ref.invalidate(clientAuthorizationsProvider(clientId));
    ref.invalidate(clientRecentVisitsProvider(clientId));
    try {
      await ref.read(clientProvider(clientId).future);
    } catch (_) {
      // Rendered by the error state.
    }
  }

  Future<void> _toggleActive(
      BuildContext context, WidgetRef ref, Client client) async {
    final deactivate = client.isActive;
    final ok = await confirmDialog(
      context,
      title: deactivate ? 'Deactivate client' : 'Reactivate client',
      message: deactivate
          ? '"${client.name}" will be hidden from scheduling. Existing visits and history are kept.'
          : 'Make "${client.name}" available for scheduling again?',
      confirmLabel: deactivate ? 'Deactivate' : 'Reactivate',
      destructive: deactivate,
    );
    if (!ok) return;
    try {
      await ref
          .read(clientsRepositoryProvider)
          .setActive(client.id, !client.isActive);
      invalidateClients(ref, client.id);
      if (context.mounted) {
        showSnack(context,
            deactivate ? 'Client deactivated' : 'Client reactivated');
      }
    } catch (e) {
      if (context.mounted) showSnack(context, friendlyError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(clientProvider(clientId));
    final client = async.valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(client?.name ?? 'Client'),
        actions: [
          if (client != null) ...[
            IconButton(
              tooltip: 'Edit',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => showClientForm(context, ref, client: client),
            ),
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'toggle') _toggleActive(context, ref, client);
              },
              itemBuilder: (_) => [
                PopupMenuItem<String>(
                  value: 'toggle',
                  child: Row(
                    children: [
                      Icon(
                        client.isActive
                            ? Icons.block
                            : Icons.check_circle_outline,
                        size: 20,
                        color: client.isActive
                            ? AppColors.danger
                            : AppColors.success,
                      ),
                      const SizedBox(width: Space.md),
                      Text(client.isActive ? 'Deactivate' : 'Reactivate'),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
      body: AsyncView<Client?>(
        value: async,
        onRetry: () => ref.invalidate(clientProvider(clientId)),
        data: (c) {
          if (c == null) {
            return const EmptyState(
              icon: Icons.home_work_outlined,
              title: 'Client not found',
              message: 'It may have been removed or you may not have access.',
            );
          }
          return RefreshIndicator(
            onRefresh: () => _refresh(ref),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                  Space.lg, Space.sm, Space.lg, Space.xxxl),
              children: [
                ContentWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Header(client: c),
                      _ContactSection(client: c),
                      _AuthorizationsSection(clientId: c.id),
                      _RecentVisitsSection(clientId: c.id),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({required this.client});
  final Client client;

  @override
  Widget build(BuildContext context) {
    final address = client.address;
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              color: AppColors.accentDim,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.home_work,
                color: AppColors.accentLight, size: 26),
          ),
          const SizedBox(width: Space.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  client.name,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: Space.xs),
                Wrap(
                  spacing: Space.sm,
                  runSpacing: Space.xs,
                  children: [
                    client.isActive
                        ? const Pill('Active', color: AppColors.success)
                        : const Pill('Inactive', color: AppColors.textMuted),
                    if (client.latitude != null && client.longitude != null)
                      const Pill('Geofenced', color: AppColors.info),
                  ],
                ),
                if (address.isNotEmpty) ...[
                  const SizedBox(height: Space.sm),
                  Text(address,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 13)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Contact ───────────────────────────────────────────────────────────────

Future<void> _launch(BuildContext context, Uri uri) async {
  try {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      showSnack(context, 'Could not open ${uri.scheme} link.', error: true);
    }
  } catch (_) {
    if (context.mounted) {
      showSnack(context, 'Could not open ${uri.scheme} link.', error: true);
    }
  }
}

class _ContactSection extends StatelessWidget {
  const _ContactSection({required this.client});
  final Client client;

  @override
  Widget build(BuildContext context) {
    final c = client;
    final phone = c.contactPhone?.trim() ?? '';
    final email = c.contactEmail?.trim() ?? '';
    final address = c.address;
    final hasCoords = c.latitude != null && c.longitude != null;
    final mapsQuery =
        address.isNotEmpty ? address : (hasCoords ? '${c.latitude},${c.longitude}' : '');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader('Contact'),
        AppCard(
          padding: const EdgeInsets.symmetric(
              horizontal: Space.lg, vertical: Space.sm),
          child: Column(
            children: [
              InfoRow(
                  icon: Icons.person_outline,
                  label: 'Contact',
                  value: c.contactName),
              _TapRow(
                enabled: phone.isNotEmpty,
                actionIcon: Icons.call,
                onTap: () => _launch(
                    context,
                    Uri(
                        scheme: 'tel',
                        path: phone.replaceAll(RegExp(r'[^0-9+]'), ''))),
                child: InfoRow(
                    icon: Icons.call_outlined, label: 'Phone', value: phone),
              ),
              _TapRow(
                enabled: email.isNotEmpty,
                actionIcon: Icons.send_outlined,
                onTap: () =>
                    _launch(context, Uri(scheme: 'mailto', path: email)),
                child: InfoRow(
                    icon: Icons.mail_outline, label: 'Email', value: email),
              ),
              _TapRow(
                enabled: mapsQuery.isNotEmpty,
                actionIcon: Icons.map_outlined,
                onTap: () => _launch(
                  context,
                  Uri.https('www.google.com', '/maps/search/',
                      {'api': '1', 'query': mapsQuery}),
                ),
                child: InfoRow(
                    icon: Icons.place_outlined,
                    label: 'Address',
                    value: address),
              ),
              if (hasCoords)
                InfoRow(
                  icon: Icons.my_location,
                  label: 'Geofence',
                  value:
                      '${c.latitude!.toStringAsFixed(5)}, ${c.longitude!.toStringAsFixed(5)}',
                ),
            ],
          ),
        ),
        if (c.notes?.trim().isNotEmpty == true) ...[
          const SectionHeader('Notes'),
          AppCard(
            child: Text(c.notes!,
                style: const TextStyle(fontSize: 14, height: 1.4)),
          ),
        ],
      ],
    );
  }
}

/// InfoRow that is tappable (call / email / maps) when it has a value.
class _TapRow extends StatelessWidget {
  const _TapRow({
    required this.child,
    required this.enabled,
    required this.onTap,
    required this.actionIcon,
  });

  final Widget child;
  final bool enabled;
  final VoidCallback onTap;
  final IconData actionIcon;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    return InkWell(
      borderRadius: BorderRadius.circular(Radii.sm),
      onTap: onTap,
      child: Row(
        children: [
          Expanded(child: child),
          Icon(actionIcon, size: 18, color: AppColors.accentLight),
        ],
      ),
    );
  }
}

// ── Authorizations ────────────────────────────────────────────────────────

const _sectionLoading = SizedBox(height: 190, child: SkeletonList(count: 2));

class _AuthorizationsSection extends ConsumerWidget {
  const _AuthorizationsSection({required this.clientId});
  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(clientAuthorizationsProvider(clientId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          'Authorizations',
          trailing: TextButton.icon(
            onPressed: () =>
                showAuthorizationForm(context, ref, clientId: clientId),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add'),
          ),
        ),
        AsyncView<List<AuthorizationUsage>>(
          value: async,
          loading: _sectionLoading,
          onRetry: () => ref.invalidate(clientAuthorizationsProvider(clientId)),
          data: (list) {
            if (list.isEmpty) {
              return const AppCard(
                child: Text(
                  'No authorizations yet. Add a DHS or funding authorization to track hours used.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              );
            }
            return Column(
              children: [
                for (final u in list)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Space.md),
                    child: _AuthorizationCard(
                      usage: u,
                      onTap: () => showAuthorizationForm(
                        context,
                        ref,
                        clientId: clientId,
                        authorization: u.auth,
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

/// Status from statusColor() in authorizations.tsx.
(String, Color) _authStatus(Authorization a) {
  if (!a.isActive) return ('Inactive', AppColors.textMuted);
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final end = DateTime(a.endDate.year, a.endDate.month, a.endDate.day);
  if (end.isBefore(today)) return ('Expired', AppColors.danger);
  if (!end.isAfter(today.add(const Duration(days: 30)))) {
    return ('Expiring soon', AppColors.warning);
  }
  return ('Active', AppColors.success);
}

class _AuthorizationCard extends StatelessWidget {
  const _AuthorizationCard({required this.usage, required this.onTap});
  final AuthorizationUsage usage;
  final VoidCallback onTap;

  static String _hrs(num units) => (units / 4).toStringAsFixed(1);

  @override
  Widget build(BuildContext context) {
    final a = usage.auth;
    final (statusLabel, statusColor) = _authStatus(a);
    final pct = usage.percentUsed;
    final barColor = usage.isOverLimit
        ? AppColors.danger
        : (usage.isNearLimit ? AppColors.warning : AppColors.success);
    final shortCode = usage.serviceShortCode;

    return AppCard(
      onTap: onTap,
      accentColor: a.isActive ? barColor : AppColors.textMuted,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      a.authNumber.isEmpty ? 'Authorization' : 'Auth #${a.authNumber}',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (shortCode != null && shortCode.isNotEmpty) ...[
                          Pill(shortCode, color: AppColors.accentLight),
                          const SizedBox(width: Space.sm),
                        ],
                        Flexible(
                          child: Text(
                            a.serviceTypeName ?? 'Service',
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: AppColors.textSecondary, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: Space.sm),
              Wrap(
                spacing: Space.xs,
                runSpacing: Space.xs,
                alignment: WrapAlignment.end,
                children: [
                  if (usage.isOverLimit)
                    const Pill('Over limit', color: AppColors.danger)
                  else if (usage.isNearLimit)
                    const Pill('Near limit', color: AppColors.warning),
                  Pill(statusLabel, color: statusColor),
                ],
              ),
            ],
          ),
          const SizedBox(height: Space.sm),
          Row(
            children: [
              const Icon(Icons.date_range,
                  size: 14, color: AppColors.textMuted),
              const SizedBox(width: 6),
              Text(
                '${Fmt.date(a.startDate)} - ${Fmt.date(a.endDate)}',
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: Space.md),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: (pct / 100).clamp(0.0, 1.0).toDouble(),
              minHeight: 8,
              color: barColor,
              backgroundColor: AppColors.card,
            ),
          ),
          const SizedBox(height: Space.xs),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${usage.usedUnits} of ${usage.authorizedUnits} units used',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
              Text(
                '${pct.toStringAsFixed(0)}% used',
                style: TextStyle(
                    fontSize: 12,
                    color: barColor,
                    fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: Space.md),
          Container(
            padding: const EdgeInsets.symmetric(vertical: Space.sm),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Row(
              children: [
                _Stat(label: 'Used', value: '${_hrs(usage.usedUnits)} hrs'),
                const _StatDivider(),
                _Stat(
                    label: 'Authorized',
                    value: '${_hrs(usage.authorizedUnits)} hrs'),
                const _StatDivider(),
                _Stat(
                  label: 'Remaining',
                  value: '${_hrs(usage.remainingUnits)} hrs',
                  color: usage.isOverLimit
                      ? AppColors.danger
                      : AppColors.success,
                ),
              ],
            ),
          ),
          if (a.notes?.trim().isNotEmpty == true) ...[
            const SizedBox(height: Space.sm),
            Text(a.notes!,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary)),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: color ?? AppColors.text)),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(
                    fontSize: 11, color: AppColors.textMuted)),
          ],
        ),
      );
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 30, color: AppColors.border);
}

// ── Recent visits ─────────────────────────────────────────────────────────

class _RecentVisitsSection extends ConsumerWidget {
  const _RecentVisitsSection({required this.clientId});
  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(clientRecentVisitsProvider(clientId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader('Recent visits'),
        AsyncView<List<Schedule>>(
          value: async,
          loading: _sectionLoading,
          onRetry: () => ref.invalidate(clientRecentVisitsProvider(clientId)),
          data: (list) {
            if (list.isEmpty) {
              return const AppCard(
                child: Text('No visits scheduled for this client yet.',
                    style: TextStyle(color: AppColors.textSecondary)),
              );
            }
            return Column(
              children: [
                for (final s in list)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Space.sm),
                    child: AppCard(
                      accentColor: scheduleStatusColor(s.status),
                      padding: const EdgeInsets.all(Space.md),
                      // Schedules live in another tab's branch; go() switches
                      // to it and shows the detail there.
                      onTap: () => context.go(Routes.adminSchedule(s.id)),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  s.displayTitle,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${Fmt.dateShort(s.startTime)}, ${Fmt.timeRange(s.startTime, s.endTime)}',
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary),
                                ),
                                if (s.employeeName != null)
                                  Text(
                                    s.employeeName!,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textMuted),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(width: Space.sm),
                          ScheduleStatusPill(s.status),
                          const Icon(Icons.chevron_right,
                              color: AppColors.textMuted),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
