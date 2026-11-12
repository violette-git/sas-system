import 'package:flutter/material.dart';

/// Ported from src/lib/passwordValidation.ts.
class PasswordCheck {
  final bool minLength;
  final bool hasUppercase;
  final bool hasLowercase;
  final bool hasNumber;
  final bool hasSpecial;

  PasswordCheck(String p)
      : minLength = p.length >= 8,
        hasUppercase = RegExp(r'[A-Z]').hasMatch(p),
        hasLowercase = RegExp(r'[a-z]').hasMatch(p),
        hasNumber = RegExp(r'[0-9]').hasMatch(p),
        hasSpecial = RegExp(r'''[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]''')
            .hasMatch(p);

  List<(String, bool)> get rules => [
        ('At least 8 characters', minLength),
        ('One uppercase letter (A-Z)', hasUppercase),
        ('One lowercase letter (a-z)', hasLowercase),
        ('One number (0-9)', hasNumber),
        ('One special character (!@#\$%...)', hasSpecial),
      ];

  int get score => rules.where((r) => r.$2).length;
  bool get isValid => score == 5;

  String get label => const [
        'Too short',
        'Weak',
        'Fair',
        'Good',
        'Strong',
        'Very strong'
      ][score];

  Color get color => const [
        Color(0xFFEF4444),
        Color(0xFFF97316),
        Color(0xFFEAB308),
        Color(0xFF84CC16),
        Color(0xFF22C55E),
        Color(0xFF10B981),
      ][score];
}
