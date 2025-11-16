import 'package:flutter/material.dart';
import 'package:app/theme/theme_controller.dart';
import 'package:app/helpers/localization_helper.dart';

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
          title: Text(LocalizationHelper.localize('Appearance')),
          subtitle: Text(
            switch (mode) {
              ThemeMode.light => LocalizationHelper.localize('Light'),
              ThemeMode.system => LocalizationHelper.localize('System default'),
              ThemeMode.dark => LocalizationHelper.localize('Dark'),
            },
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          trailing: SegmentedButton<ThemeMode>(
            segments: [
              ButtonSegment(value: ThemeMode.light, label: Text(LocalizationHelper.localize('Light'))),
              ButtonSegment(value: ThemeMode.system, label: Text(LocalizationHelper.localize('System'))),
              ButtonSegment(value: ThemeMode.dark, label: Text(LocalizationHelper.localize('Dark'))),
            ],
            selected: {mode},
            onSelectionChanged: (s) => c.setMode(s.first),
          ),
        );
      },
    );
  }
}
