import 'package:flutter/material.dart';

// Further normalized locations for style referencing
// Will likely replace or remove when all beatufication is complete

extension ThemeExtensions on BuildContext {
  ThemeData get theme => Theme.of(this);
  ColorScheme get colorScheme => theme.colorScheme;
  TextTheme get textTheme => theme.textTheme;

  Color get primaryColor => colorScheme.primary;
  Color get onPrimaryColor => colorScheme.onPrimary;
  Color get secondaryColor => colorScheme.secondary;
  Color get onSecondaryColor => colorScheme.onSecondary;
  Color get backgroundColor => colorScheme.background;
  Color get onBackgroundColor => colorScheme.onBackground;
  Color get surfaceColor => colorScheme.surface;
  Color get onSurfaceColor => colorScheme.onSurface;
  Color get errorColor => colorScheme.error;
  Color get onErrorColor => colorScheme.onError;
  Color get scaffoldBackgroundColor => theme.scaffoldBackgroundColor;

  bool get isDarkMode => theme.brightness == Brightness.dark;
}
