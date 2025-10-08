import 'package:flutter/material.dart';

class NumberFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final String? value;
  final ValueChanged<String> onChanged;
  final FormFieldSetter<String?> onSaved;

  const NumberFormComponent({
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

    String? validator(String? v) {
      if (requiredField && (v == null || v.trim().isEmpty)) {
        return 'Required';
      }
      if (v != null && v.isNotEmpty && double.tryParse(v) == null) {
        return 'Invalid number';
      }
      if (v != null && v.isNotEmpty) {
        final n = double.tryParse(v);
        if (n != null) {
          final min = (field['min'] is num) ? (field['min'] as num).toDouble() : null;
          final max = (field['max'] is num) ? (field['max'] as num).toDouble() : null;
          if (min != null && n < min) {
            final dec = min.truncateToDouble() == min ? 0 : 2;
            return 'Must be ≥ ${min.toStringAsFixed(dec)}';
          }
          if (max != null && n > max) {
            final dec = max.truncateToDouble() == max ? 0 : 2;
            return 'Must be ≤ ${max.toStringAsFixed(dec)}';
          }
          if (field['allowedValues'] is String) {
            final allowed = (field['allowedValues'] as String)
                .split(',')
                .map((s) => s.trim())
                .where((s) => s.isNotEmpty)
                .map(double.tryParse)
                .whereType<double>()
                .toList();
            if (allowed.isNotEmpty && !allowed.contains(n)) {
              final fmt = allowed
                  .map((x) => x.truncateToDouble() == x ? x.toStringAsFixed(0) : x.toString())
                  .join(', ');
              return 'Must be one of: $fmt';
            }
          }
        }
      }
      return null;
    }

    return TextFormField(
      initialValue: value,
  decoration: InputDecoration(labelText: label),
      keyboardType: TextInputType.number,
      validator: validator,
      onChanged: onChanged,
      onSaved: onSaved,
    );
  }
}
