// This file is where the colors are defined for the app's light and dark themes

import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData light = ThemeData(
    useMaterial3: true,
    colorScheme: const ColorScheme(
      brightness: Brightness.light,
      primary: Color.fromARGB(255, 142, 163, 168), // Accent (logo blue-green)
      onPrimary: Colors.white,
      secondary: Color(0xFF5C6BC0), // Secondary accent (nav icon)
      onSecondary: Colors.white,
      tertiary: Color(0xFF2E7D6D),
      onTertiary: Colors.white,
      tertiaryContainer: Color(0xFFCDEAE3),
      onTertiaryContainer: Color(0xFF0D3B34), // Main text
      surface: Color(0xFFFFFFFF), // Card/input background
      onSurface: Color(0xFF222222),
      error: Color(0xFFB00020),
      onError: Colors.white,
    ),
    scaffoldBackgroundColor: const Color(0xFFF5F5F7),
    inputDecorationTheme: const InputDecorationTheme(
      fillColor: Color(0xFFF0F0F0), // Input background
      filled: true,
      border: OutlineInputBorder(),
    ),
    appBarTheme: const AppBarTheme(
      centerTitle: true,
      backgroundColor: Color.fromARGB(255, 142, 163, 168), // was 0xFFF5F5F7
      foregroundColor: Colors.white, // was 0xFF222222
      elevation: 0,
    ),
  );

  static ThemeData dark = ThemeData(
    useMaterial3: true,
    colorScheme: const ColorScheme(
      brightness: Brightness.dark,
      primary: Color.fromARGB(255, 142, 163, 168), // Accent (logo blue-green)
      onPrimary: Colors.white,
      secondary: Color(0xFF3F51B5), // Secondary accent (nav icon)
      onSecondary: Colors.white,
      tertiary: Color(0xFF82D1C0),
      onTertiary: Color(0xFF00382F),
      tertiaryContainer: Color(0xFF0F4A40),
      onTertiaryContainer: Color(0xFFBEEADF), // Main text
      surface: Color(0xFF2C2C2C), // Card/input background
      onSurface: Color(0xFFF5F5F7),
      error: Color(0xFFCF6679),
      onError: Colors.black,
    ),
    scaffoldBackgroundColor: const Color(0xFF232323),
    inputDecorationTheme: const InputDecorationTheme(
      fillColor: Color(0xFF2C2C2C), // Input background
      filled: true,
      border: OutlineInputBorder(),
    ),
    appBarTheme: const AppBarTheme(
      centerTitle: true,
      backgroundColor: Color(
        0xFF1B1B1B,
      ), // was 0xFF232323 (now darker than page)
      foregroundColor: Color(0xFFF5F5F7),
      elevation: 0,
    ),
  );
}
