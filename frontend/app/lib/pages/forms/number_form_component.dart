import 'package:flutter/material.dart';

class NumberFormComponent extends StatelessWidget {
  final String label;
  final String? placeholder;
  final String? helperText;
  final bool requiredField;
  final num? initialValue;
  final ValueChanged<num?> onChanged;
  final ValueChanged<num?> onSaved;
  final num? min;
  final num? max;
  final num? step;
  final List<num> allowedValues;

  const NumberFormComponent({
    super.key,
    required this.label,
    this.placeholder,
    this.helperText,
    this.requiredField = false,
    this.initialValue,
    required this.onChanged,
    required this.onSaved,
    this.min,
    this.max,
    this.step,
    this.allowedValues = const [],
  });

  String? _validate(String? raw) {
    final value = raw?.trim() ?? '';
    final fieldLabel = label.trim().isEmpty ? 'Value' : label;
    if (requiredField && value.isEmpty) {
      return '$fieldLabel is required';
    }
    if (value.isEmpty) return null;
    final parsed = double.tryParse(value);
    if (parsed == null) {
      return '$fieldLabel must be a valid number';
    }
    if (min != null && parsed < min!) {
      final display =
          min!.truncateToDouble() == min!
              ? min!.toStringAsFixed(0)
              : min!.toString();
      return '$fieldLabel must be at least $display';
    }
    if (max != null && parsed > max!) {
      final display =
          max!.truncateToDouble() == max!
              ? max!.toStringAsFixed(0)
              : max!.toString();
      return '$fieldLabel must be at most $display';
    }
    if (allowedValues.isNotEmpty) {
      final matches = allowedValues.any((v) => v == parsed);
      if (!matches) {
        final fmt = allowedValues
            .map(
              (v) =>
                  v.truncateToDouble() == v
                      ? v.toStringAsFixed(0)
                      : v.toString(),
            )
            .join(', ');
        return '$fieldLabel must be one of: $fmt';
      }
    }
    return null;
  }

  void _handleChanged(String? raw) {
    final value = raw?.trim() ?? '';
    if (value.isEmpty) {
      onChanged(null);
      return;
    }
    final parsed = double.tryParse(value);
    onChanged(parsed);
  }

  void _handleSaved(String? raw) {
    final value = raw?.trim() ?? '';
    if (value.isEmpty) {
      onSaved(null);
      return;
    }
    final parsed = double.tryParse(value);
    onSaved(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final effectiveHelper =
        helperText?.trim().isEmpty ?? true ? null : helperText;
    final effectivePlaceholder =
        placeholder?.trim().isEmpty ?? true ? null : placeholder;
    return TextFormField(
      initialValue: initialValue != null ? initialValue.toString() : '',
      decoration: InputDecoration(
        labelText: label,
        hintText: effectivePlaceholder,
        helperText: effectiveHelper,
      ),
      keyboardType: const TextInputType.numberWithOptions(
        decimal: true,
        signed: false,
      ),
      validator: _validate,
      onChanged: _handleChanged,
      onSaved: _handleSaved,
    );
  }
}
