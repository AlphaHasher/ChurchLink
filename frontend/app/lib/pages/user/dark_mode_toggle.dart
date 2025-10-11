import 'package:flutter/material.dart';
import 'package:app/theme/theme_controller.dart';

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
          title: const Text('Appearance'),
          subtitle: Text(
            switch (mode) {
              ThemeMode.light => 'Light',
              ThemeMode.system => 'System default',
              ThemeMode.dark => 'Dark',
            },
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          trailing: SegmentedButton<ThemeMode>(
            segments: const [
              ButtonSegment(value: ThemeMode.light, label: Text('Light')),
              ButtonSegment(value: ThemeMode.system, label: Text('System')),
              ButtonSegment(value: ThemeMode.dark, label: Text('Dark')),
            ],
            selected: {mode},
            onSelectionChanged: (s) => c.setMode(s.first),
          ),
        );
      },
    );
  }
}
