import 'package:flutter/material.dart';

class SwitchFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final bool value;
  final ValueChanged<bool> onChanged;

  const SwitchFormComponent({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final label = (field['label'] ?? field['name'] ?? '').toString();
    return SwitchListTile(
      value: value,
      title: Text(label),
      onChanged: onChanged,
    );
  }
}
