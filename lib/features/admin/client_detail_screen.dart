// STUB: replaced by the real screen.
import 'package:flutter/material.dart';

class ClientDetailScreen extends StatelessWidget {
  const ClientDetailScreen({super.key, required this.clientId});
  final String clientId;

  @override
  Widget build(BuildContext context) =>
      Scaffold(appBar: AppBar(title: const Text('ClientDetailScreen')));
}
