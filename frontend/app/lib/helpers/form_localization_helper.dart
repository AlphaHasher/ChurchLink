class FormLocaleState {
  const FormLocaleState({required this.locales, required this.activeLocale});

  final List<String> locales;
  final String activeLocale;
}

class FormLocalizationHelper {
  static const String fallbackLocale = 'en';

  static String defaultLocale(Map<String, dynamic> form) {
    final dynamic value = form['defaultLocale'] ?? form['default_locale'];
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isNotEmpty) {
        return trimmed;
      }
    }
    return fallbackLocale;
  }

  static List<String> collectLocales(Map<String, dynamic> form) {
    final ordered = <String>[];

    void addLocale(String? locale) {
      if (locale == null) return;
      final trimmed = locale.trim();
      if (trimmed.isEmpty) return;
      if (!ordered.contains(trimmed)) {
        ordered.add(trimmed);
      }
    }

    addLocale(defaultLocale(form));

    final supportedLocales = form['supported_locales'];
    if (supportedLocales is List) {
      for (final locale in supportedLocales) {
        if (locale is String) {
          addLocale(locale);
        } else if (locale != null) {
          addLocale(locale.toString());
        }
      }
    }

    if (ordered.isEmpty) {
      ordered.add(fallbackLocale);
    }

    return List.unmodifiable(ordered);
  }

  static String chooseActiveLocale({
    required List<String> locales,
    required String defaultLocale,
    String? preferredLocale,
    String fallback = fallbackLocale,
  }) {
    final preferred = preferredLocale?.trim();
    if (preferred != null &&
        preferred.isNotEmpty &&
        locales.contains(preferred)) {
      return preferred;
    }
    if (locales.contains(defaultLocale)) {
      return defaultLocale;
    }
    if (locales.isNotEmpty) {
      return locales.first;
    }
    return fallback;
  }

  static FormLocaleState initializeLocales(
    Map<String, dynamic> form, {
    String? preferredLocale,
  }) {
    final locales = collectLocales(form);
    final defaultLoc = defaultLocale(form);
    final active = chooseActiveLocale(
      locales: locales,
      defaultLocale: defaultLoc,
      preferredLocale: preferredLocale,
    );
    return FormLocaleState(locales: locales, activeLocale: active);
  }

  static String? _lookupLocalizedValue(
    Map<String, dynamic> source,
    String locale,
    String key,
  ) {
    final translations = source['translations'];
    if (translations is Map) {
      final localeData = translations[locale];
      if (localeData is Map) {
        final value = localeData[key];
        if (value is String) {
          final trimmed = value.trim();
          if (trimmed.isNotEmpty) {
            return trimmed;
          }
        }
      }
    }
    return null;
  }

  static String? getLocalizedString(
    Map<String, dynamic> source,
    String key, {
    required String activeLocale,
    required String defaultLocale,
    String fallback = fallbackLocale,
  }) {
    final candidates = <String>{activeLocale, defaultLocale, fallback};
    for (final locale in candidates) {
      final trimmed = locale.trim();
      if (trimmed.isEmpty) continue;
      final result = _lookupLocalizedValue(source, trimmed, key);
      if (result != null) {
        return result;
      }
    }

    final raw = source[key];
    if (raw is String) {
      final trimmed = raw.trim();
      if (trimmed.isNotEmpty) {
        return trimmed;
      }
    }
    return null;
  }

  static Map<String, dynamic> localizedField(
    Map<String, dynamic> field, {
    required String activeLocale,
    required String defaultLocale,
  }) {
    final localized = Map<String, dynamic>.from(field);

    void writeIfPresent(String key, {List<String>? mirrors}) {
      final value = getLocalizedString(
        field,
        key,
        activeLocale: activeLocale,
        defaultLocale: defaultLocale,
      );
      if (value != null) {
        localized[key] = value;
        if (mirrors != null) {
          for (final mirror in mirrors) {
            localized[mirror] = value;
          }
        }
      }
    }

    writeIfPresent('label');
    writeIfPresent('placeholder', mirrors: const ['hint']);
    writeIfPresent('helpText', mirrors: const ['helperText', 'description']);
    writeIfPresent('helperText', mirrors: const ['helpText', 'description']);
    writeIfPresent('description', mirrors: const ['helpText', 'helperText']);

    final options = field['options'];
    if (options is List) {
      localized['options'] =
          options.map((opt) {
            if (opt is Map) {
              final optionMap = Map<String, dynamic>.from(opt);
              final translations = optionMap['translations'];
              if (translations is Map) {
                final localeData = translations[activeLocale] ?? translations[defaultLocale];
                if (localeData is Map) {
                  final label = localeData['label'];
                  if (label is String && label.trim().isNotEmpty) {
                    optionMap['label'] = label.trim();
                    return optionMap;
                  }
                }
              }
              return optionMap;
            }
            return opt;
          }).toList();
    }

    return localized;
  }
}
