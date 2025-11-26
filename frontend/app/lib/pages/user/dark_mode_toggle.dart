import 'package:flutter/material.dart';
import 'package:app/theme/theme_controller.dart';
import 'package:app/helpers/localized_widgets.dart';

/// Light / System / Dark mode toggle widget.
class DarkModeToggle extends StatelessWidget {
  const DarkModeToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final c = ThemeController.instance;

    return AnimatedBuilder(
      animation: c,
      builder: (context, _) {
        final mode = c.mode;

        return ListTile(
          leading: const Icon(Icons.dark_mode),
          title: Text('Appearance').localized(),
          subtitle: Text(
            switch (mode) {
              ThemeMode.light => 'Light',
              ThemeMode.system => 'System default',
              ThemeMode.dark => 'Dark',
            },
          ).localized(),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          trailing: SegmentedButton<ThemeMode>(
            segments: [
              ButtonSegment(value: ThemeMode.light, label: Text('Light').localized()),
              ButtonSegment(value: ThemeMode.system, label: Text('System').localized()),
              ButtonSegment(value: ThemeMode.dark, label: Text('Dark').localized()),
            ],
            selected: {mode},
            onSelectionChanged: (s) => c.setMode(s.first),
          ),
        );
      },
    );
  }
}
