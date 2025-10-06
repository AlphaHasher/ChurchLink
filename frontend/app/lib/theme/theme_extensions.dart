import 'package:flutter/material.dart';

/// Extension on [BuildContext] to provide convenient access to theme properties.
/// This helps maintain consistency and reduces boilerplate when accessing theme colors.
extension ThemeExtensions on BuildContext {
  /// Access the current [ThemeData].
  ThemeData get theme => Theme.of(this);

  /// Access the current [ColorScheme].
  ColorScheme get colorScheme => theme.colorScheme;

  /// Access the current [TextTheme].
  TextTheme get textTheme => theme.textTheme;

  /// Primary color (accent color) - used for prominent UI elements.
  Color get primaryColor => colorScheme.primary;

  /// Color for text/icons on primary color.
  Color get onPrimaryColor => colorScheme.onPrimary;

  /// Secondary accent color.
  Color get secondaryColor => colorScheme.secondary;

  /// Color for text/icons on secondary color.
  Color get onSecondaryColor => colorScheme.onSecondary;

  /// Background color for the app.
  Color get backgroundColor => colorScheme.background;

  /// Color for text/icons on background.
  Color get onBackgroundColor => colorScheme.onBackground;

  /// Surface color for cards, sheets, and elevated components.
  Color get surfaceColor => colorScheme.surface;

  /// Color for text/icons on surface.
  Color get onSurfaceColor => colorScheme.onSurface;

  /// Error color for alerts and validation messages.
  Color get errorColor => colorScheme.error;

  /// Color for text/icons on error color.
  Color get onErrorColor => colorScheme.onError;

  /// Scaffold background color.
  Color get scaffoldBackgroundColor => theme.scaffoldBackgroundColor;

  /// Whether the current theme is dark mode.
  bool get isDarkMode => theme.brightness == Brightness.dark;
}
