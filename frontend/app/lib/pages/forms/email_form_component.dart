import 'package:flutter/material.dart';

class EmailFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final String? value;
  final ValueChanged<String> onChanged;
  final FormFieldSetter<String?> onSaved;

  const EmailFormComponent({
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
      keyboardType: TextInputType.emailAddress,
      validator: (v) {
        if (requiredField && (v == null || v.trim().isEmpty)) {
          return 'Required';
        }
        if (v != null && v.isNotEmpty) {
          final reg = RegExp(r"^[^@\s]+@[^@\s]+\.[^@\s]+$");
          if (!reg.hasMatch(v)) {
            return 'Invalid email';
          }
        }
        return null;
      },
      onChanged: onChanged,
      onSaved: onSaved,
    );
  }
}
