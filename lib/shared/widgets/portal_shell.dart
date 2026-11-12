import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import 'ui.dart';

class PortalDestination {
  const PortalDestination(this.label, this.icon, this.selectedIcon);
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

/// Adaptive navigation frame for a portal: bottom bar on phones, side rail
/// on tablets and web. Each tab is its own branch so it keeps scroll and
/// navigation state when you switch away and back.
class PortalShell extends ConsumerWidget {
  const PortalShell({
    super.key,
    required this.shell,
    required this.destinations,
    required this.portalName,
    required this.portalColor,
  });

  final StatefulNavigationShell shell;
  final List<PortalDestination> destinations;
  final String portalName;
  final Color portalColor;

  void _go(int i) =>
      shell.goBranch(i, initialLocation: i == shell.currentIndex);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wide = MediaQuery.sizeOf(context).width >= Breakpoints.tablet;
    final company = ref.watch(companyProvider);
    final profile = ref.watch(profileProvider);

    if (!wide) {
      return Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: _go,
          height: 64,
          destinations: [
            for (final d in destinations)
              NavigationDestination(
                icon: Icon(d.icon),
                selectedIcon: Icon(d.selectedIcon, color: portalColor),
                label: d.label,
              ),
          ],
        ),
      );
    }

    final extended = MediaQuery.sizeOf(context).width >= Breakpoints.desktop;
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: extended,
            minExtendedWidth: 232,
            selectedIndex: shell.currentIndex,
            onDestinationSelected: _go,
            leading: Padding(
              padding: const EdgeInsets.fromLTRB(8, 16, 8, 24),
              child: _Brand(
                extended: extended,
                title: company?.label ?? 'SAS System',
                subtitle: portalName,
                color: portalColor,
              ),
            ),
            trailing: Expanded(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: AppAvatar(name: profile?.fullName ?? '', size: 36),
                ),
              ),
            ),
            destinations: [
              for (final d in destinations)
                NavigationRailDestination(
                  icon: Icon(d.icon),
                  selectedIcon: Icon(d.selectedIcon, color: portalColor),
                  label: Text(d.label),
                ),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: shell),
        ],
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand({
    required this.extended,
    required this.title,
    required this.subtitle,
    required this.color,
  });
  final bool extended;
  final String title;
  final String subtitle;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final mark = Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Icon(Icons.hub_outlined, color: color, size: 20),
    );
    if (!extended) return mark;
    return SizedBox(
      width: 200,
      child: Row(
        children: [
          mark,
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
                Text(subtitle,
                    style: TextStyle(
                        color: color,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
