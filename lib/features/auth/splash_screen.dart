import 'package:flutter/material.dart';

import '../../core/theme.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.accentDim,
                borderRadius: BorderRadius.circular(Radii.xl),
                border: Border.all(color: AppColors.accent.withValues(alpha: 0.5)),
              ),
              child: const Icon(Icons.hub_outlined,
                  color: AppColors.accentLight, size: 32),
            ),
            const SizedBox(height: 24),
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ],
        ),
      ),
    );
  }
}
