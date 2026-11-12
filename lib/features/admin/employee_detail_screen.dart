// STUB: replaced by the real screen.
import 'package:flutter/material.dart';

class EmployeeDetailScreen extends StatelessWidget {
  const EmployeeDetailScreen({super.key, required this.employeeId});
  final String employeeId;

  @override
  Widget build(BuildContext context) =>
      Scaffold(appBar: AppBar(title: const Text('EmployeeDetailScreen')));
}
