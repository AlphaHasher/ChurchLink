import 'package:flutter/material.dart';

typedef TextFieldValidator = String? Function(String? value);

class TextFormComponent extends StatelessWidget {
  final String label;
  final String? placeholder;
  final String? helperText;
  final bool requiredField;
  final String? initialValue;
  final ValueChanged<String> onChanged;
  final FormFieldSetter<String?> onSaved;
  final List<TextFieldValidator> validators;
  final TextInputType keyboardType;
  final bool obscureText;
  final TextCapitalization textCapitalization;
  final int? minLines;
  final int? maxLines;
  final TextInputAction? textInputAction;
  final bool enableSuggestions;
  final bool autocorrect;

  const TextFormComponent({
    super.key,
    required this.label,
    this.placeholder,
    this.helperText,
    this.requiredField = false,
    this.initialValue,
    required this.onChanged,
    required this.onSaved,
    this.validators = const [],
    this.keyboardType = TextInputType.text,
    this.obscureText = false,
    this.textCapitalization = TextCapitalization.none,
    this.minLines,
    this.maxLines = 1,
    this.textInputAction,
    this.enableSuggestions = true,
    this.autocorrect = true,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveHelper =
        helperText?.trim().isEmpty ?? true ? null : helperText;
    final effectivePlaceholder =
        placeholder?.trim().isEmpty ?? true ? null : placeholder;
    return TextFormField(
      initialValue: initialValue,
      decoration: InputDecoration(
        labelText: label,
        hintText: effectivePlaceholder,
        helperText: effectiveHelper,
      ),
      keyboardType: keyboardType,
      obscureText: obscureText,
      textCapitalization: textCapitalization,
      minLines: minLines,
      maxLines: obscureText ? 1 : maxLines,
      textInputAction: textInputAction,
      enableSuggestions: enableSuggestions,
      autocorrect: autocorrect,
      validator: (value) {
        final text = value ?? '';
        if (requiredField && text.trim().isEmpty) {
          return 'Required';
        }
        for (final validator in validators) {
          final result = validator(value);
          if (result != null) return result;
        }
        return null;
      },
      onChanged: onChanged,
      onSaved: onSaved,
    );
  }
}
