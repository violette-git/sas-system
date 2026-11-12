// STUB: replaced by the real screen.
import 'package:flutter/material.dart';

class ScheduleDetailScreen extends StatelessWidget {
  const ScheduleDetailScreen({super.key, required this.scheduleId});
  final String scheduleId;

  @override
  Widget build(BuildContext context) =>
      Scaffold(appBar: AppBar(title: const Text('ScheduleDetailScreen')));
}
