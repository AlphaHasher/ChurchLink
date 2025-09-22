// sync/reader_sync.dart
// Centralizes connectivity + auth + sync side-effects for the Bible reader.

import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../data/notes_api.dart' as api;

typedef BooksIndexProvider = Map<String, int> Function();

class ReaderSync {
  ReaderSync({
    required this.provideBooksIndex,
    required this.hydrateCurrent,
    this.onOfflineChanged,
  });

  final BooksIndexProvider provideBooksIndex;
  final Future<void> Function() hydrateCurrent;
  final void Function(bool offline)? onOfflineChanged;

  StreamSubscription<dynamic>? _connSub;
  StreamSubscription<void>? _syncedSub;
  StreamSubscription<User?>? _authSub;

  bool _offline = false;

  // Start listeners and publish initial state so the UI can show the banner.
  Future<void> start() async {
    // 1) Initial connectivity -> publish to UI
    final initial = await Connectivity().checkConnectivity();
    _setOffline(isOfflineFrom(initial));

    // 2) Connectivity changes
    _connSub = Connectivity().onConnectivityChanged.listen((event) async {
      final off = isOfflineFrom(event);
      _setOffline(off);
      if (!off) {
        await _drainPrimeHydrate();
      }
    });

    // 3) Outbox / remote ops finished -> refresh if online
    _syncedSub = api.NotesApi.onSynced.listen((_) async {
      if (!_offline) await hydrateCurrent();
    });

    // 4) User signed in while the page is open -> warm cache + hydrate
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (user != null) {
        await _drainPrimeHydrate();
      }
    });
  }

  // Optional: after Books metadata is ready, pre-prime the cache once.
  Future<void> onBooksReady() async {
    final books = provideBooksIndex();
    if (books.isNotEmpty) {
      await api.NotesApi.primeAllCache(books: books);
    }
  }

  // Pull-to-refresh path (same as reconnect)
  Future<void> onPullToRefresh() async {
    await _drainPrimeHydrate();
  }

  Future<void> _drainPrimeHydrate() async {
    await api.NotesApi.drainOutbox();
    final books = provideBooksIndex();
    if (books.isNotEmpty) {
      await api.NotesApi.primeAllCache(books: books);
    }
    await hydrateCurrent();
  }

  void dispose() {
    _connSub?.cancel();
    _syncedSub?.cancel();
    _authSub?.cancel();
    _connSub = null;
    _syncedSub = null;
    _authSub = null;
  }

  void _setOffline(bool value) {
    if (_offline == value) return;
    _offline = value;
    onOfflineChanged?.call(value);
  }

  // Public helper so the widget can perform an extra initial check if desired.
  static bool isOfflineFrom(dynamic value) {
    final list = value is List<ConnectivityResult>
        ? value
        : value is ConnectivityResult
            ? <ConnectivityResult>[value]
            : const <ConnectivityResult>[];
    if (list.isEmpty) return true;
    return list.every((r) => r == ConnectivityResult.none);
  }
}
