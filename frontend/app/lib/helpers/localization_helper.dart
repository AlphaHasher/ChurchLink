import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app/helpers/api_client.dart';

typedef LocalizationListener = void Function();

class LanguageOption {
  final String code;
  final String name;
  const LanguageOption({required this.code, required this.name});
}

class LocalizationHelper {
  LocalizationHelper._();

  static const Duration _batchDelay = Duration(milliseconds: 100);
  static const String _sourceLocale = 'en';
  static const String _prefsLocaleKey = 'preferred_language';
  static const String _prefsCacheKey = 'i18n_cache_v1';
  static const Duration _persistDebounce = Duration(milliseconds: 400);
  static const int _maxPersistedEntries = 2000; // safety cap

  static String _currentLocale = 'en';
  static String? _pendingRebuildLocale; 

  static final Map<String, Map<String, String>> _cache =
      <String, Map<String, String>>{};
  static final Map<String, Set<String>> _pending =
      <String, Set<String>>{};
  static final Map<String, Timer?> _timers =
      <String, Timer?>{};
  static final Map<String, Future<void>?> _inflight =
      <String, Future<void>?>{};
  static final Set<LocalizationListener> _listeners =
      <LocalizationListener>{};
  static List<LanguageOption> _availableLanguages = [];

  static Timer? _persistTimer;
  static bool _cacheDirty = false;
  static int _uiVersion = 0; // increments on every notify
  static int get uiVersion => _uiVersion;

  static void addListener(LocalizationListener listener) {
    _listeners.add(listener);
  }

  static void removeListener(LocalizationListener listener) {
    _listeners.remove(listener);
  }

  static String localize(
    String? input,
  ) {
    final base = (input ?? '').toString();
    if (base.trim().isEmpty) {
      return '';
    }

    final normalizedLocale = _currentLocale.trim();
    if (normalizedLocale.isEmpty || normalizedLocale == _sourceLocale) {
      return base;
    }

    final cached = _cache[base]?[normalizedLocale];
    if (cached != null) {
      return cached;
    }

    _queueTranslation(base, normalizedLocale);
    return base;
  }

  static Future<String> localizeAsync(
    String? input,
  ) async {
    final base = (input ?? '').toString().trim();
    if (base.isEmpty) {
      return '';
    }

    final normalizedLocale = _currentLocale.trim();
    if (normalizedLocale.isEmpty || normalizedLocale == _sourceLocale) {
      return base;
    }

    final localeMap = _cache.putIfAbsent(base, () => <String, String>{});
    final cached = localeMap[normalizedLocale];
    if (cached != null) {
      return cached;
    }

    // Queue and await flush
    _queueTranslation(base, normalizedLocale);

    // Await the inflight future for this locale
    final inflight = _inflight[normalizedLocale];
    if (inflight != null) {
      await inflight;
    } else {
      // If no inflight, trigger flush immediately for this single item
      await _flush(normalizedLocale);
    }

    // Now get the translated value
    final translated = localeMap[normalizedLocale];
    return translated ?? base;
  }

  static void _queueTranslation(String text, String locale) {
    final existing = _cache[text];
    if (existing != null && existing.containsKey(locale)) {
      return;
    }

    final set = _pending.putIfAbsent(locale, () => <String>{});
    set.add(text);

    final timer = _timers[locale];
    timer?.cancel();
    _timers[locale] = Timer(_batchDelay, () => _flush(locale));
  }

  static Future<void> _loadCacheFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsCacheKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        decoded.forEach((k, v) {
          if (k is String && v is Map) {
            final m = <String, String>{};
            v.forEach((lk, lv) {
              if (lk is String && lv is String) m[lk] = lv;
            });
            if (m.isNotEmpty) _cache[k] = m;
          }
        });
      }
    } catch (e) {
    }
  }

  static void _schedulePersist() {
    if (_persistTimer != null) return;
    _persistTimer = Timer(_persistDebounce, () async {
      _persistTimer = null;
      if (!_cacheDirty) return;
      _cacheDirty = false;
      try {
        // Cap entries for safety
        final entries = _cache.entries.take(_maxPersistedEntries);
        final toStore = <String, Map<String, String>>{};
        for (final e in entries) {
          toStore[e.key] = Map<String, String>.from(e.value);
        }
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_prefsCacheKey, jsonEncode(toStore));
      } catch (e) {
    }
    });
  }

  static Future<void> _flush(String locale) async {
    _timers[locale]?.cancel();
    _timers[locale] = null;

    final pending = _pending[locale];
    if (pending == null || pending.isEmpty) {
      return;
    }

    final items = List<String>.from(pending);
    pending.clear();

    Future<void> run() async {
      try {
        
        final response = await api.post(
          '/v1/translator/translate-multi',
          data: <String, dynamic>{
            'items': items,
            'dest_languages': <String>[locale],
            'src': _sourceLocale,
          },
        );

        Map<String, dynamic>? translations;
        final data = response.data;
        if (data is Map) {
          final raw = data['translations'];
          if (raw is Map) {
            translations = Map<String, dynamic>.from(raw);
          }
        }

        if (translations == null) {
          return;
        }

        var updated = false;
        var updatedCount = 0;
        for (final key in items) {
          final perLocale = translations[key];
          if (perLocale is Map) {
            final value = perLocale[locale];
            if (value is String && value.trim().isNotEmpty) {
              final trimmed = value.trim();
              final localeMap =
                  _cache.putIfAbsent(key, () => <String, String>{});
              if (localeMap[locale] != trimmed) {
                localeMap[locale] = trimmed;
                updated = true;
                updatedCount += 1;
              }
            }
          }
        }

        
        if (updated) {
          _cacheDirty = true;
          _schedulePersist();
        }
        if (_pendingRebuildLocale == locale) {
          _notifyListeners();
          _pendingRebuildLocale = null;
        } else if (updated) {
          // Subsequent batches (e.g., strings queued during first rebuild)
          _notifyListeners();
        }
      } catch (_) {
        // ignore errors; we'll fall back to original strings
      }
    }

    final previous = _inflight[locale];
    Future<void> future;
    if (previous != null) {
      future = previous
          .catchError((_) {})
          .then((_) => run());
    } else {
      future = run();
    }

    _inflight[locale] = future;
    future.whenComplete(() {
      if (identical(_inflight[locale], future)) {
        _inflight[locale] = null;
      }
    });
  }

  static void _notifyListeners() {
    _uiVersion += 1;
    final listeners = List<LocalizationListener>.from(_listeners);
    for (final listener in listeners) {
      try {
        listener();
      } catch (_) {
        // ignore listener errors
      }
    }
  }

 

  static Future<void> loadUserLocale() async {
    // Try server first
    try {
      final response = await api.get('/v1/users/language');
      final data = response.data;
      if (data is Map<String, dynamic>) {
        final lang = data['language'];
        if (lang is String && lang.trim().isNotEmpty) {
          final newLocale = lang.trim();
          if (newLocale != _currentLocale) {
            _currentLocale = newLocale;
            _notifyListeners();
          }
          // Persist for offline/unauthenticated usage
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString(_prefsLocaleKey, newLocale);
          } catch (e) {}
          return;
        }
      }
    } catch (e) {
      // Ignore; will try to read from local storage below
    }

    // Fallback: read preferred language from local storage
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_prefsLocaleKey);
      final next = (stored == null || stored.trim().isEmpty) ? 'en' : stored.trim();
      if (next != _currentLocale) {
        _currentLocale = next;
        _notifyListeners();
      } else {
        _currentLocale = next; // ensure set at least once
      }
    } catch (e) {
      _currentLocale = 'en';
    }
  }

  static Future<void> updateUserLocale(String newLocale) async {
    final trimmed = newLocale.trim();
    // Attempt to update on server
    try {
      await api.patch('/v1/users/update-language', data: {'language': trimmed});
    } catch (e) {
      // Ignore server errors; we'll still store locally
    }

    // Persist locally regardless (supports unauthenticated/offline use)
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsLocaleKey, trimmed);
    } catch (e) {}

    // Defer rebuild until translations are fetched for this locale.
    _pendingRebuildLocale = trimmed;
    _currentLocale = trimmed;

    // Phase 1: Immediate rebuild so visible widgets call localize() and queue strings
    _notifyListeners();
  }

  // Change locale and wait for translations to be fetched before returning.
  static Future<void> changeLocaleAndAwait(
    String newLocale, {
    List<String>? warmupKeys,
  }) async {
    await updateUserLocale(newLocale);

    final target = _currentLocale;
    if (warmupKeys != null && warmupKeys.isNotEmpty) {
      for (final k in warmupKeys) {
        localize(k);
      }
    }

    await _flush(target);
    final fut = _inflight[target];
    if (fut != null) {
      await fut; // completes after batch finishes and rebuild is triggered
    }
  }

  static String get currentLocale => _currentLocale;

  static Future<void> loadAvailableLanguages() async {
    try {
      final jsonString = await rootBundle.loadString('assets/languages.json');
      final List<dynamic> jsonList = json.decode(jsonString);
      final langs = <LanguageOption>[];
      for (final item in jsonList) {
        if (item is Map<String, dynamic>) {
          final code = item['code']?.toString() ?? '';
          final name = item['name']?.toString() ?? '';
          if (code.isNotEmpty && name.isNotEmpty) {
            langs.add(LanguageOption(code: code, name: name));
          }
        }
      }
      _availableLanguages = langs..sort((a, b) => a.name.compareTo(b.name));
    } catch (e) {
      _availableLanguages = [const LanguageOption(code: 'en', name: 'English')];
    }
  }

  static List<LanguageOption> get availableLanguages => List.unmodifiable(_availableLanguages);

  static Future<void> init() async {
    await _loadCacheFromPrefs();
    await loadUserLocale();
    await loadAvailableLanguages();
  }
}

