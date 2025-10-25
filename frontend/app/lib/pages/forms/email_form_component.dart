import 'package:flutter/material.dart';
import 'package:app/pages/forms/text_form_component.dart';

class EmailFormComponent extends StatelessWidget {
  final String label;
  final String? placeholder;
  final String? helperText;
  final bool requiredField;
  final String? initialValue;
  final ValueChanged<String> onChanged;
  final FormFieldSetter<String?> onSaved;
  final int? minLength;
  final int? maxLength;

  const EmailFormComponent({
    super.key,
    required this.label,
    this.placeholder,
    this.helperText,
    this.requiredField = false,
    this.initialValue,
    required this.onChanged,
    required this.onSaved,
    this.minLength,
    this.maxLength,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormComponent(
      label: label,
      placeholder: placeholder,
      helperText: helperText,
      requiredField: requiredField,
      initialValue: initialValue,
      onChanged: onChanged,
      onSaved: onSaved,
      validators: [
        (v) {
          final value = (v ?? '').trim();
          if (value.isEmpty) return null;
          final reg = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
          return reg.hasMatch(value) ? null : 'Invalid email';
        },
      ],
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.next,
      enableSuggestions: false,
      autocorrect: false,
      minLength: minLength,
      maxLength: maxLength,
    );
  }
}
