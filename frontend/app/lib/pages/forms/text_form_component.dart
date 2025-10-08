import 'package:flutter/material.dart';

class TextFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final String? value;
  final ValueChanged<String> onChanged;
  final FormFieldSetter<String?> onSaved;

  const TextFormComponent({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
    required this.onSaved,
  });

  @override
  Widget build(BuildContext context) {
  final label = (field['label'] ?? field['name'] ?? '').toString();
    final requiredField = field['required'] == true;

    return TextFormField(
      initialValue: value,
  decoration: InputDecoration(labelText: label),
      validator: requiredField
          ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
          : null,
      onChanged: onChanged,
      onSaved: onSaved,
    );
  }
}
