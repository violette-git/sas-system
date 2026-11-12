import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Dark premium design tokens, ported 1:1 from the Expo app's src/theme.
class AppColors {
  static const bg = Color(0xFF0D0F12);
  static const card = Color(0xFF141720);
  static const elevated = Color(0xFF1A1D27);
  static const border = Color(0xFF2D3148);

  static const accent = Color(0xFF6366F1);
  static const accentLight = Color(0xFF818CF8);
  static const accentDim = Color(0x266366F1);

  static const success = Color(0xFF22C55E);
  static const successDim = Color(0x2622C55E);
  static const warning = Color(0xFFF59E0B);
  static const warningDim = Color(0x26F59E0B);
  static const danger = Color(0xFFEF4444);
  static const dangerDim = Color(0x26EF4444);
  static const info = Color(0xFF3B82F6);
  static const pink = Color(0xFFEC4899);

  static const text = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFF9CA3AF);
  static const textMuted = Color(0xFF6B7280);
  static const placeholder = Color(0xFF4B5563);

  /// Portal accent colors (match the architecture doc).
  static const owner = warning;
  static const admin = Color(0xFF10B981);
  static const employee = info;
}

class Space {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const xxl = 24.0;
  static const xxxl = 32.0;
}

class Radii {
  static const sm = 6.0;
  static const md = 10.0;
  static const lg = 12.0;
  static const xl = 16.0;
}

class Breakpoints {
  static const tablet = 768.0;
  static const desktop = 1024.0;
}

class AppTheme {
  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.bg,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.accent,
        secondary: AppColors.accentLight,
        surface: AppColors.card,
        error: AppColors.danger,
        onPrimary: Colors.white,
        onSurface: AppColors.text,
      ),
    );

    final textTheme = GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: AppColors.text,
      displayColor: AppColors.text,
    );

    OutlineInputBorder border(Color c) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.md),
          borderSide: BorderSide(color: c),
        );

    return base.copyWith(
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.bg,
        foregroundColor: AppColors.text,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          fontSize: 20,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.elevated,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.lg),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.border, space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.card,
        hintStyle: const TextStyle(color: AppColors.placeholder),
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: border(AppColors.border),
        enabledBorder: border(AppColors.border),
        focusedBorder: border(AppColors.accent),
        errorBorder: border(AppColors.danger),
        focusedErrorBorder: border(AppColors.danger),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.card,
        indicatorColor: AppColors.accentDim,
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.all(
          const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        ),
      ),
      navigationRailTheme: const NavigationRailThemeData(
        backgroundColor: AppColors.card,
        indicatorColor: AppColors.accentDim,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.xl),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.card,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.elevated,
        contentTextStyle: TextStyle(color: AppColors.text),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AppColors.card,
        selectedColor: AppColors.accentDim,
        side: const BorderSide(color: AppColors.border),
        labelStyle: const TextStyle(color: AppColors.text, fontSize: 13),
      ),
      progressIndicatorTheme:
          const ProgressIndicatorThemeData(color: AppColors.accent),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
      ),
    );
  }
}
