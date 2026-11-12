// Ported from app/(owner)/index.tsx. Lists every tenant company (owner RLS
// sees all), with search, status, access code and user count.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'owner_repository.dart';
import 'owner_widgets.dart';

class OwnerCompaniesScreen extends ConsumerStatefulWidget {
  const OwnerCompaniesScreen({super.key});

  @override
  ConsumerState<OwnerCompaniesScreen> createState() =>
      _OwnerCompaniesScreenState();
}

class _OwnerCompaniesScreenState extends ConsumerState<OwnerCompaniesScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      await ref.refresh(ownerCompaniesProvider.future);
    } catch (_) {
      // The error state renders from the provider.
    }
  }

  Future<void> _create() async {
    final created = await showFormSheet<Company>(
      context,
      title: 'New company',
      builder: (_) => const CompanyForm(),
    );
    if (created == null || !mounted) return;
    ref.invalidate(ownerCompaniesProvider);
    showSnack(context, '${created.label} created. Invite its first admin next.');
    context.push(Routes.ownerCompany(created.id));
  }

  List<OwnerCompany> _filter(List<OwnerCompany> all) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return all;
    return all.where((c) {
      final co = c.company;
      return co.name.toLowerCase().contains(q) ||
          (co.tradeName ?? '').toLowerCase().contains(q) ||
          co.accessCode.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final companies = ref.watch(ownerCompaniesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Companies'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(ownerCompaniesProvider),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add_business_outlined),
        label: const Text('New company'),
      ),
      body: ContentWidth(
        child: AsyncView<List<OwnerCompany>>(
          value: companies,
          onRetry: () => ref.invalidate(ownerCompaniesProvider),
          data: (all) {
            final list = _filter(all);
            final active = all.where((c) => c.company.isActive).length;
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                    Space.lg, Space.sm, Space.lg, 96),
                children: [
                  if (all.isNotEmpty) ...[
                    TextField(
                      controller: _search,
                      onChanged: (v) => setState(() => _query = v),
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: 'Search by name or access code',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: _query.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear',
                                icon: const Icon(Icons.close, size: 18),
                                onPressed: () {
                                  _search.clear();
                                  setState(() => _query = '');
                                },
                              ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                          4, Space.md, 4, Space.md),
                      child: Text(
                        '${all.length} registered, $active active',
                        style: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 13),
                      ),
                    ),
                  ],
                  if (all.isEmpty)
                    EmptyState(
                      icon: Icons.business_outlined,
                      title: 'No companies yet',
                      message:
                          'Create your first client company to get started.',
                      action: AppButton(
                        label: 'New company',
                        icon: Icons.add,
                        onPressed: _create,
                      ),
                    )
                  else if (list.isEmpty)
                    EmptyState(
                      icon: Icons.search_off,
                      title: 'No matches',
                      message: 'Nothing matches "${_query.trim()}".',
                    )
                  else
                    for (final c in list) ...[
                      _CompanyCard(
                        item: c,
                        onTap: () =>
                            context.push(Routes.ownerCompany(c.company.id)),
                      ),
                      const SizedBox(height: Space.md),
                    ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CompanyCard extends StatelessWidget {
  const _CompanyCard({required this.item, required this.onTap});
  final OwnerCompany item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = item.company;
    final hasTrade = (c.tradeName ?? '').trim().isNotEmpty;
    final count = item.userCount;

    return Opacity(
      opacity: c.isActive ? 1 : 0.6,
      child: AppCard(
        onTap: onTap,
        accentColor: c.isActive ? AppColors.owner : AppColors.textMuted,
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.owner.withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(Radii.md),
              ),
              child: const Icon(Icons.business,
                  color: AppColors.owner, size: 22),
            ),
            const SizedBox(width: Space.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hasTrade ? c.tradeName! : c.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  if (hasTrade)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        c.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ),
                  const SizedBox(height: Space.sm),
                  Wrap(
                    spacing: Space.sm,
                    runSpacing: Space.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      AccessCodeChip(code: c.accessCode),
                      if (count != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.people_outline,
                                size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              count == 1 ? '1 user' : '$count users',
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: Space.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                ActivePill(c.isActive),
                const SizedBox(height: Space.md),
                const Icon(Icons.chevron_right, color: AppColors.textMuted),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
