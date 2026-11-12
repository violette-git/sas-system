import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/admin/client_detail_screen.dart';
import '../features/admin/clients_screen.dart';
import '../features/admin/dashboard_screen.dart';
import '../features/admin/employee_detail_screen.dart';
import '../features/admin/employees_screen.dart';
import '../features/admin/schedule_detail_screen.dart';
import '../features/admin/schedules_screen.dart';
import '../features/admin/settings_screen.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/set_password_screen.dart';
import '../features/auth/splash_screen.dart';
import '../features/employee/clock_screen.dart';
import '../features/employee/visit_detail_screen.dart';
import '../features/employee/visits_screen.dart';
import '../features/owner/companies_screen.dart';
import '../features/owner/company_detail_screen.dart';
import '../models/models.dart';
import '../shared/profile_screen.dart';
import '../shared/widgets/portal_shell.dart';
import 'theme.dart';

/// Route paths. Use these constants instead of string literals.
class Routes {
  static const splash = '/splash';
  static const login = '/login';
  static const forgotPassword = '/forgot-password';
  static const setPassword = '/set-password';

  static const ownerCompanies = '/owner/companies';
  static String ownerCompany(String id) => '/owner/companies/$id';
  static const ownerSettings = '/owner/settings';

  static const adminDashboard = '/admin/dashboard';
  static const adminSchedules = '/admin/schedules';
  static String adminSchedule(String id) => '/admin/schedules/$id';
  static const adminClients = '/admin/clients';
  static String adminClient(String id) => '/admin/clients/$id';
  static const adminEmployees = '/admin/employees';
  static String adminEmployee(String id) => '/admin/employees/$id';
  static const adminSettings = '/admin/settings';

  static const employeeVisits = '/employee/visits';
  static String employeeVisit(String id) => '/employee/visits/$id';
  static const employeeClock = '/employee/clock';
  static const employeeProfile = '/employee/profile';

  static String homeFor(UserRole role) => switch (role) {
        UserRole.owner => ownerCompanies,
        UserRole.admin => adminDashboard,
        UserRole.employee => employeeVisits,
      };

  static String prefixFor(UserRole role) => switch (role) {
        UserRole.owner => '/owner',
        UserRole.admin => '/admin',
        UserRole.employee => '/employee',
      };
}

final _rootKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.read(authProvider);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.splash,
    refreshListenable: auth,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      const public = {Routes.login, Routes.forgotPassword};

      if (auth.loading) return loc == Routes.splash ? null : Routes.splash;

      // Invite / recovery: signed in via the email link, must pick a password.
      if (auth.needsPasswordSetup && auth.session != null) {
        return loc == Routes.setPassword ? null : Routes.setPassword;
      }

      if (!auth.isSignedIn) {
        return public.contains(loc) ? null : Routes.login;
      }

      final role = auth.role!;
      final home = Routes.homeFor(role);
      if (public.contains(loc) ||
          loc == Routes.splash ||
          loc == Routes.setPassword ||
          loc == '/') {
        return home;
      }
      // Keep each role inside its own portal.
      if (!loc.startsWith(Routes.prefixFor(role))) return home;
      return null;
    },
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.explore_off_outlined,
                size: 48, color: AppColors.textMuted),
            const SizedBox(height: 12),
            const Text('Page not found'),
            TextButton(
              onPressed: () => context.go(Routes.splash),
              child: const Text('Go home'),
            ),
          ],
        ),
      ),
    ),
    routes: [
      GoRoute(path: '/', redirect: (_, __) => Routes.splash),
      GoRoute(path: Routes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: Routes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: Routes.setPassword,
        builder: (_, __) => const SetPasswordScreen(),
      ),

      // ── Owner portal ──────────────────────────────────────────────
      GoRoute(path: '/owner', redirect: (_, __) => Routes.ownerCompanies),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => PortalShell(
          shell: shell,
          portalName: 'OWNER PORTAL',
          portalColor: AppColors.owner,
          destinations: const [
            PortalDestination(
                'Companies', Icons.business_outlined, Icons.business),
            PortalDestination('Profile', Icons.person_outline, Icons.person),
          ],
        ),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.ownerCompanies,
              builder: (_, __) => const OwnerCompaniesScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, s) =>
                      OwnerCompanyDetailScreen(companyId: s.pathParameters['id']!),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.ownerSettings,
              builder: (_, __) => const ProfileScreen(),
            ),
          ]),
        ],
      ),

      // ── Admin portal ──────────────────────────────────────────────
      GoRoute(path: '/admin', redirect: (_, __) => Routes.adminDashboard),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => PortalShell(
          shell: shell,
          portalName: 'ADMIN PORTAL',
          portalColor: AppColors.admin,
          destinations: const [
            PortalDestination(
                'Dashboard', Icons.grid_view_outlined, Icons.grid_view_rounded),
            PortalDestination('Schedules', Icons.calendar_month_outlined,
                Icons.calendar_month),
            PortalDestination('Clients', Icons.home_work_outlined,
                Icons.home_work),
            PortalDestination(
                'Employees', Icons.people_outline, Icons.people),
            PortalDestination(
                'Settings', Icons.settings_outlined, Icons.settings),
          ],
        ),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.adminDashboard,
              builder: (_, __) => const AdminDashboardScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.adminSchedules,
              builder: (_, __) => const SchedulesScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, s) =>
                      ScheduleDetailScreen(scheduleId: s.pathParameters['id']!),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.adminClients,
              builder: (_, __) => const ClientsScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, s) =>
                      ClientDetailScreen(clientId: s.pathParameters['id']!),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.adminEmployees,
              builder: (_, __) => const EmployeesScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, s) =>
                      EmployeeDetailScreen(employeeId: s.pathParameters['id']!),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.adminSettings,
              builder: (_, __) => const AdminSettingsScreen(),
            ),
          ]),
        ],
      ),

      // ── Employee portal ───────────────────────────────────────────
      GoRoute(path: '/employee', redirect: (_, __) => Routes.employeeVisits),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => PortalShell(
          shell: shell,
          portalName: 'EMPLOYEE PORTAL',
          portalColor: AppColors.employee,
          destinations: const [
            PortalDestination('My Visits', Icons.event_note_outlined,
                Icons.event_note),
            PortalDestination('Clock', Icons.timer_outlined, Icons.timer),
            PortalDestination('Profile', Icons.person_outline, Icons.person),
          ],
        ),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.employeeVisits,
              builder: (_, __) => const MyVisitsScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, s) =>
                      VisitDetailScreen(scheduleId: s.pathParameters['id']!),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.employeeClock,
              builder: (_, __) => const ClockScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.employeeProfile,
              builder: (_, __) => const ProfileScreen(),
            ),
          ]),
        ],
      ),
    ],
  );
});
