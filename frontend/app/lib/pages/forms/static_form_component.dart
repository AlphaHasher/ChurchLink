import 'package:flutter/material.dart';

class StaticFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;

  const StaticFormComponent({super.key, required this.field});

  @override
  Widget build(BuildContext context) {
    final asValue = (field['as'] ?? 'p').toString();
    TextStyle style = const TextStyle(fontSize: 14);
    if (asValue == 'h1') {
      style = const TextStyle(fontSize: 22, fontWeight: FontWeight.bold);
    } else if (asValue == 'h2') {
      style = const TextStyle(fontSize: 18, fontWeight: FontWeight.w600);
    } else if (asValue == 'small') {
      style = const TextStyle(fontSize: 12, color: Colors.grey);
    }
    final content =
        (field['content'] ?? field['label'] ?? field['name'] ?? '').toString();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Text(content, style: style),
    );
  }
}
