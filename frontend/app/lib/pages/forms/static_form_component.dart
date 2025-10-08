import 'package:flutter/material.dart';

class StaticFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final String? labelOverride;
  final String? helperOverride;

  const StaticFormComponent({super.key, required this.field, this.labelOverride, this.helperOverride});

  @override
  Widget build(BuildContext context) {
    final asValue = (field['as'] ?? 'p').toString();
    TextStyle style = const TextStyle(fontSize: 14);
    if (asValue == 'h1') {
      style = const TextStyle(fontSize: 22, fontWeight: FontWeight.bold);
    } else if (asValue == 'h2') {
      style = const TextStyle(fontSize: 18, fontWeight: FontWeight.w600);
    } else if (asValue == 'small') {
      style = const TextStyle(fontSize: 12, color: Colors.grey);
    }
    Color? parseColor(String? hex) {
      if (hex == null || hex.isEmpty) return null;
      final cleaned = hex.replaceAll('#', '');
      final value = int.tryParse(cleaned, radix: 16);
      if (value == null) return null;
      if (cleaned.length <= 6) {
        return Color(0xFF000000 | value);
      }
      if (cleaned.length == 8) {
        return Color(value);
      }
      return null;
    }

    final bool bold = field['bold'] == true;
    final bool underline = field['underline'] == true;
    final color = parseColor(field['color']?.toString());
    style = style.copyWith(
      fontWeight: bold ? FontWeight.w600 : style.fontWeight,
      decoration:
          underline ? TextDecoration.underline : style.decoration,
      color: color ?? style.color,
    );

  final primary = (labelOverride ?? field['label'] ?? field['content'] ?? field['name'] ?? '').toString();
  final helper = (helperOverride ?? field['helpText'] ?? field['helperText'] ?? field['description'] ?? '').toString();
    final hasHelper = helper.trim().isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(primary, style: style),
          if (hasHelper)
            Padding(
              padding: const EdgeInsets.only(top: 2.0),
              child: Text(
                helper,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: Colors.grey[600]),
              ),
            ),
        ],
      ),
    );
  }
}
