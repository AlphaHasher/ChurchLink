import 'package:flutter/material.dart';

class CheckboxFormComponent extends StatelessWidget {
  final String label;
  final String? inlineLabel;
  final String? helperText;
  final bool requiredField;
  final bool value;
  final ValueChanged<bool> onChanged;
  final ValueChanged<bool> onSaved;

  const CheckboxFormComponent({
    super.key,
    required this.label,
    this.inlineLabel,
    this.helperText,
    this.requiredField = false,
    required this.value,
    required this.onChanged,
    required this.onSaved,
  });

  @override
  Widget build(BuildContext context) {
    final helper = helperText?.trim().isEmpty ?? true ? null : helperText;
    final inline = inlineLabel?.trim().isEmpty ?? true ? null : inlineLabel;
    return FormField<bool>(
      initialValue: value,
      validator: requiredField ? (v) => (v ?? false) ? null : 'Required' : null,
      onSaved: (v) => onSaved(v ?? false),
      builder: (state) {
        final current = state.value ?? false;
    final hasError = state.hasError;
    final borderColor =
      hasError ? Colors.red.shade400 : Colors.grey.shade300;
        final backgroundColor = hasError ? Colors.red.withOpacity(0.05) : null;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (label.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            Container(
              decoration: BoxDecoration(
                color: backgroundColor,
                border: Border.all(color: borderColor),
                borderRadius: BorderRadius.circular(8),
              ),
              child: CheckboxListTile(
                value: current,
                contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                title: Text(inline ?? label),
                controlAffinity: ListTileControlAffinity.leading,
                onChanged: (val) {
                  final next = val ?? false;
                  state.didChange(next);
                  onChanged(next);
                },
              ),
            ),
            if (helper != null)
              Padding(
                padding: const EdgeInsets.only(left: 4, top: 2),
                child: Text(
                  helper,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
                ),
              ),
            if (state.hasError)
              Padding(
                padding: const EdgeInsets.only(left: 4, top: 2),
                child: Text(
                  state.errorText ?? '',
                  style: const TextStyle(color: Colors.red, fontSize: 12),
                ),
              ),
          ],
        );
      },
    );
  }
}
