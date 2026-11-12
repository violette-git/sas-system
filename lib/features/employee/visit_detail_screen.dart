// STUB: replaced by the real screen.
import 'package:flutter/material.dart';

class VisitDetailScreen extends StatelessWidget {
  const VisitDetailScreen({super.key, required this.scheduleId});
  final String scheduleId;

  @override
  Widget build(BuildContext context) =>
      Scaffold(appBar: AppBar(title: const Text('VisitDetailScreen')));
}
