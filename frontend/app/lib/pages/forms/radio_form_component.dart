import 'package:flutter/material.dart';

class RadioFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final String? value;
  final ValueChanged<String> onChanged;

  const RadioFormComponent({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final label = (field['label'] ?? field['name'] ?? '').toString();
    final List options = field['options'] ?? field['choices'] ?? [];
    final requiredField = field['required'] == true;

    return FormField<String>(
      initialValue: value,
      validator:
          requiredField
              ? (v) => (v == null || v.isEmpty) ? 'Required' : null
              : null,
      builder:
          (state) {
            final hasError = state.hasError;
      final borderColor =
        hasError ? Colors.red.shade400 : Colors.grey.shade300;
            final backgroundColor = hasError ? Colors.red.withOpacity(0.05) : null;
            return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (label.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              Container(
                decoration: BoxDecoration(
                  color: backgroundColor,
                  border: Border.all(color: borderColor),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  children: options.map<Widget>((opt) {
                    final val =
                        opt is Map
                            ? (opt['value'] ?? opt['id'] ?? opt['label'])
                            : opt;
                    final display =
                        opt is Map
                            ? (opt['label'] ??
                                opt['value'] ??
                                opt['id'] ??
                                opt.toString())
                            : opt.toString();
                    final sel = state.value == val.toString();
                    return ListTile(
                      leading: Icon(
                        sel
                            ? Icons.radio_button_checked
                            : Icons.radio_button_unchecked,
                        color:
                            sel ? Theme.of(context).colorScheme.primary : null,
                      ),
                      title: Text(display.toString()),
                      onTap: () {
                        final vstr = val.toString();
                        state.didChange(vstr);
                        onChanged(vstr);
                      },
                    );
                  }).toList(),
                ),
              ),
              if (state.hasError)
                Padding(
                  padding: const EdgeInsets.only(left: 12.0, top: 4),
                  child: Text(
                    state.errorText ?? '',
                    style: TextStyle(color: Colors.red[700], fontSize: 12),
                  ),
                ),
            ],
          );
          },
    );
  }
}
