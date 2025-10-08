import 'package:flutter/material.dart';

class SelectFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;

  const SelectFormComponent({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final List options = field['options'] ?? field['choices'] ?? [];
    final bool multiple = field['multiple'] == true;
    final label = (field['label'] ?? field['name'] ?? '').toString();

    if (multiple) {
      final List<String> current =
          (value as List?)?.map((e) => e.toString()).toList() ?? [];

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(label),
            ),
          Wrap(
            spacing: 6,
            runSpacing: -8,
            children: current.isEmpty
                ? [const Chip(label: Text('None selected'))]
                : current.map((v) => Chip(label: Text(v))).toList(),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () async {
                final updated = await showDialog<List<String>>(
                  context: context,
                  builder: (ctx) {
                    final temp = Set<String>.from(current);
                    return StatefulBuilder(
                      builder: (dialogCtx, setState) {
                        return AlertDialog(
                          title: Text('Select $label'),
                          content: SizedBox(
                            width: double.maxFinite,
                            child: ListView(
                              shrinkWrap: true,
                              children: options.map<Widget>((opt) {
                                final val = (opt is Map
                                        ? (opt['value'] ?? opt['id'] ?? opt['label'])
                                        : opt)
                                    .toString();
                                final display = (opt is Map
                                        ? (opt['label'] ?? opt['value'] ?? opt['id'] ?? opt)
                                        : opt)
                                    .toString();
                                final checked = temp.contains(val);
                                return CheckboxListTile(
                                  value: checked,
                                  title: Text(display),
                                  onChanged: (v) {
                                    setState(() {
                                      if (v == true) {
                                        temp.add(val);
                                      } else {
                                        temp.remove(val);
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
                if (updated != null) {
                  onChanged(updated);
                }
              },
              child: const Text('Choose'),
            ),
          ),
        ],
      );
    } else {
      final String? current = value?.toString();
      final requiredField = field['required'] == true;
      return DropdownButtonFormField<String>(
        value: current?.isNotEmpty == true ? current : null,
        decoration: InputDecoration(labelText: label),
        validator: requiredField
            ? (v) => (v == null || v.isEmpty) ? 'Required' : null
            : null,
        items: options.map<DropdownMenuItem<String>>((opt) {
          final val =
              (opt is Map ? (opt['value'] ?? opt['id'] ?? opt['label']) : opt)
                  .toString();
          final display =
              (opt is Map
                      ? (opt['label'] ?? opt['value'] ?? opt['id'] ?? opt)
                      : opt)
                  .toString();
          return DropdownMenuItem<String>(
            value: val,
            child: Text(display),
          );
        }).toList(),
        onChanged: (v) => onChanged(v),
      );
    }
  }
}
