// Admin clients list, ported from app/(admin)/clients.tsx.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'clients/client_form.dart';
import 'clients/clients_repository.dart';

enum _ClientFilter { active, inactive, all }

class ClientsScreen extends ConsumerStatefulWidget {
  const ClientsScreen({super.key});

  @override
  ConsumerState<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends ConsumerState<ClientsScreen> {
  final _search = TextEditingController();
  _ClientFilter _filter = _ClientFilter.active;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<Client> _apply(List<Client> all) {
    final q = _search.text.trim().toLowerCase();
    return all.where((c) {
      final statusOk = switch (_filter) {
        _ClientFilter.active => c.isActive,
        _ClientFilter.inactive => !c.isActive,
        _ClientFilter.all => true,
      };
      if (!statusOk) return false;
      if (q.isEmpty) return true;
      return [
        c.name,
        c.contactName,
        c.contactEmail,
        c.contactPhone,
        c.addressLine1,
        c.city,
        c.state,
        c.zip,
      ].whereType<String>().any((s) => s.toLowerCase().contains(q));
    }).toList();
  }

  Future<void> _refresh() async {
    ref.invalidate(clientsProvider);
    try {
      await ref.read(clientsProvider.future);
    } catch (_) {
      // The error state renders it.
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(clientsProvider);
    final count = async.valueOrNull?.where((c) => c.isActive).length;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Clients'),
            if (count != null)
              Text(
                '$count active jobsite${count == 1 ? '' : 's'}',
                style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w400),
              ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showClientForm(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New client'),
      ),
      body: ContentWidth(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  Space.lg, Space.sm, Space.lg, 0),
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search name, contact, address',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _search.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: _search.clear,
                        ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  Space.lg, Space.md, Space.lg, Space.xs),
              child: Row(
                children: [
                  for (final f in _ClientFilter.values) ...[
                    ChoiceChip(
                      label: Text(switch (f) {
                        _ClientFilter.active => 'Active',
                        _ClientFilter.inactive => 'Inactive',
                        _ClientFilter.all => 'All',
                      }),
                      selected: _filter == f,
                      onSelected: (_) => setState(() => _filter = f),
                    ),
                    const SizedBox(width: Space.sm),
                  ],
                ],
              ),
            ),
            Expanded(
              child: AsyncView<List<Client>>(
                value: async,
                onRetry: () => ref.invalidate(clientsProvider),
                data: (all) {
                  final list = _apply(all);
                  return RefreshIndicator(
                    onRefresh: _refresh,
                    child: list.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              all.isEmpty
                                  ? EmptyState(
                                      icon: Icons.home_work_outlined,
                                      title: 'No clients yet',
                                      message:
                                          'Add your first jobsite or client.',
                                      action: AppButton(
                                        label: 'Add client',
                                        icon: Icons.add,
                                        onPressed: () =>
                                            showClientForm(context, ref),
                                      ),
                                    )
                                  : const EmptyState(
                                      icon: Icons.search_off,
                                      title: 'No matching clients',
                                      message:
                                          'Try a different search or filter.',
                                    ),
                            ],
                          )
                        : ListView.separated(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(
                                Space.lg, Space.md, Space.lg, 96),
                            itemCount: list.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: Space.md),
                            itemBuilder: (_, i) => _ClientCard(
                              client: list[i],
                              onTap: () =>
                                  context.push(Routes.adminClient(list[i].id)),
                              onEdit: () =>
                                  showClientForm(context, ref, client: list[i]),
                            ),
                          ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClientCard extends StatelessWidget {
  const _ClientCard({
    required this.client,
    required this.onTap,
    required this.onEdit,
  });

  final Client client;
  final VoidCallback onTap;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final c = client;
    // Same address line as the Expo list: street, city, state, zip.
    final address = [c.addressLine1, c.city, c.state, c.zip]
        .whereType<String>()
        .where((s) => s.trim().isNotEmpty)
        .join(', ');
    return AppCard(
      onTap: onTap,
      accentColor: c.isActive ? null : AppColors.textMuted,
      padding: const EdgeInsets.fromLTRB(Space.lg, Space.md, Space.xs, Space.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        c.name,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: c.isActive
                              ? AppColors.text
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                    if (!c.isActive) ...[
                      const SizedBox(width: Space.sm),
                      const Pill('Inactive', color: AppColors.textMuted),
                    ],
                  ],
                ),
                if (c.contactName?.isNotEmpty == true)
                  _Line(Icons.person_outline, c.contactName!),
                if (address.isNotEmpty) _Line(Icons.place_outlined, address),
                if (c.contactPhone?.isNotEmpty == true)
                  _Line(Icons.call_outlined, c.contactPhone!),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Edit',
            icon: const Icon(Icons.edit_outlined,
                size: 20, color: AppColors.accentLight),
            onPressed: onEdit,
          ),
          const Icon(Icons.chevron_right, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.icon, this.text);
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          children: [
            Icon(icon, size: 13, color: AppColors.textMuted),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary),
              ),
            ),
          ],
        ),
      );
}
