import 'package:flutter/material.dart';

class CheckboxFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final bool value;
  final ValueChanged<bool> onChanged;

  const CheckboxFormComponent({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final label = (field['label'] ?? field['name'] ?? '').toString();
    return CheckboxListTile(
      value: value,
      title: Text(label),
      controlAffinity: ListTileControlAffinity.leading,
      onChanged: (val) => onChanged(val ?? false),
    );
  }
}
