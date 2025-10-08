import 'package:flutter/material.dart';

class SelectOption {
  final String value;
  final String label;

  const SelectOption({required this.value, required this.label});
}

class SelectFormComponent extends StatelessWidget {
  final String label;
  final String? placeholder;
  final String? helperText;
  final bool requiredField;
  final List<SelectOption> options;
  final bool multiple;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;
  final ValueChanged<dynamic> onSaved;

  const SelectFormComponent({
    super.key,
    required this.label,
    this.placeholder,
    this.helperText,
    this.requiredField = false,
    required this.options,
    this.multiple = false,
    this.value,
    required this.onChanged,
    required this.onSaved,
  });

  @override
  Widget build(BuildContext context) {
    final helper = helperText?.trim().isEmpty ?? true ? null : helperText;
    if (multiple) {
      final current =
          (value as List?)?.map((e) => e.toString()).toList() ?? <String>[];
      return FormField<List<String>>(
        initialValue: current,
        validator:
            requiredField
                ? (v) => (v != null && v.isNotEmpty) ? null : 'Required'
                : null,
        onSaved: (v) => onSaved(v ?? <String>[]),
        builder: (state) {
          final selections = state.value ?? <String>[];
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
                      if (requiredField)
                        const Padding(
                          padding: EdgeInsets.only(left: 4),
                          child: Text('*', style: TextStyle(color: Colors.red)),
                        ),
                    ],
                  ),
                ),
              Wrap(
                spacing: 6,
                runSpacing: -8,
                children:
                    selections.isEmpty
                        ? [const Chip(label: Text('None selected'))]
                        : selections
                            .map((v) => Chip(label: Text(_labelFor(v))))
                            .toList(),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () async {
                    final updated = await _pickMulti(context, selections);
                    if (updated != null) {
                      state.didChange(updated);
                      onChanged(updated);
                    }
                  },
                  child: Text(
                    placeholder?.isNotEmpty == true ? placeholder! : 'Choose',
                  ),
                ),
              ),
              if (helper != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    helper,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
                  ),
                ),
              if (state.hasError)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
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

    final current = value?.toString();
    return DropdownButtonFormField<String>(
      initialValue: current?.isNotEmpty == true ? current : null,
      decoration: InputDecoration(
        labelText: label,
        hintText: placeholder?.trim().isEmpty ?? true ? null : placeholder,
        helperText: helper,
      ),
      validator:
          requiredField
              ? (v) => (v == null || v.isEmpty) ? 'Required' : null
              : null,
      items:
          options
              .map(
                (opt) => DropdownMenuItem<String>(
                  value: opt.value,
                  child: Text(opt.label),
                ),
              )
              .toList(),
      onChanged: (v) {
        onChanged(v);
      },
      onSaved: (v) => onSaved(v),
    );
  }

  String _labelFor(String value) {
    return options
        .firstWhere(
          (o) => o.value == value,
          orElse: () => SelectOption(value: value, label: value),
        )
        .label;
  }

  Future<List<String>?> _pickMulti(
    BuildContext context,
    List<String> current,
  ) async {
    final temp = current.toSet();
    return showDialog<List<String>>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setState) {
            return AlertDialog(
              title: Text('Select $label'),
              content: SizedBox(
                width: double.maxFinite,
                child: ListView(
                  shrinkWrap: true,
                  children:
                      options.map((opt) {
                        final checked = temp.contains(opt.value);
                        return CheckboxListTile(
                          value: checked,
                          title: Text(opt.label),
                          onChanged: (v) {
                            setState(() {
                              if (v == true) {
                                temp.add(opt.value);
                              } else {
                                temp.remove(opt.value);
                              }
                            });
                          },
                        );
                      }).toList(),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx, temp.toList()),
                  child: const Text('OK'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
