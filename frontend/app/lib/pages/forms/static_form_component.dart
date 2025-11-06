import 'package:flutter/material.dart';

class StaticFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final String? labelOverride;
  final String? helperOverride;

  const StaticFormComponent({
    super.key,
    required this.field,
    this.labelOverride,
    this.helperOverride,
  });

  @override
  Widget build(BuildContext context) {
    final asValue = (field['as'] ?? 'p').toString();
    final theme = Theme.of(context);

    TextStyle style;
    switch (asValue) {
      case 'h1':
        style =
            theme.textTheme.displaySmall ??
            const TextStyle(fontSize: 36, fontWeight: FontWeight.w600);
        break;
      case 'h2':
        style =
            theme.textTheme.headlineMedium ??
            const TextStyle(fontSize: 30, fontWeight: FontWeight.w600);
        break;
      case 'h3':
        style =
            theme.textTheme.headlineSmall ??
            const TextStyle(fontSize: 24, fontWeight: FontWeight.w600);
        break;
      case 'h4':
        style =
            theme.textTheme.titleLarge ??
            const TextStyle(fontSize: 20, fontWeight: FontWeight.w600);
        break;
      case 'small':
        style =
            theme.textTheme.bodySmall ??
            const TextStyle(fontSize: 14, color: Colors.grey);
        break;
      case 'p':
      default:
        style = theme.textTheme.bodyMedium ?? const TextStyle(fontSize: 18);
        break;
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
      decoration: underline ? TextDecoration.underline : style.decoration,
      color: color ?? style.color,
    );

    final primary =
        (labelOverride ??
                field['label'] ??
                field['content'] ??
                field['text'] ??
                field['value'] ??
                field['name'] ??
                'Static Text')
            .toString();
    final helper =
        (helperOverride ??
                field['helpText'] ??
                field['helperText'] ??
                field['description'] ??
                '')
            .toString();
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
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
              ),
            ),
        ],
      ),
    );
  }
}
