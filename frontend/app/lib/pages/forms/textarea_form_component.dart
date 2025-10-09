import 'package:flutter/material.dart';

import 'text_form_component.dart';

class TextareaFormComponent extends StatelessWidget {
  final String label;
  final String? placeholder;
  final String? helperText;
  final bool requiredField;
  final String? initialValue;
  final ValueChanged<String> onChanged;
  final FormFieldSetter<String?> onSaved;
  final List<TextFieldValidator> validators;
  final int? minLines;
  final int? maxLines;
  final int? minLength;
  final int? maxLength;

  const TextareaFormComponent({
    super.key,
    required this.label,
    this.placeholder,
    this.helperText,
    this.requiredField = false,
    this.initialValue,
    required this.onChanged,
    required this.onSaved,
    this.validators = const [],
    this.minLines,
    this.maxLines,
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
      validators: validators,
      keyboardType: TextInputType.multiline,
      textCapitalization: TextCapitalization.sentences,
      minLines: minLines ?? 3,
      maxLines: maxLines ?? 5,
      minLength: minLength,
      maxLength: maxLength,
    );
  }
}
