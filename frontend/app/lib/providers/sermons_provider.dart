import 'package:flutter/foundation.dart';

import 'package:app/models/sermon.dart';
import 'package:app/models/sermon_favorite.dart';
import 'package:app/models/sermon_filter.dart';
import 'package:app/services/my_sermons_service.dart';
import 'package:app/services/sermons_service.dart';

class SermonsProvider extends ChangeNotifier {
  SermonsProvider({
    SermonsService? sermonsService,
    MySermonsService? mySermonsService,
  }) : _sermonsService = sermonsService ?? SermonsService(),
       _mySermonsService = mySermonsService ?? MySermonsService();

  final SermonsService _sermonsService;
  final MySermonsService _mySermonsService;

  List<Sermon> _items = <Sermon>[];
  bool _loading = false;
  bool _favoritesLoading = false;
  String? _error;
  SermonFilter _activeFilter = const SermonFilter(limit: 50);
  Sermon? _selected;
  List<SermonFavorite> _favorites = <SermonFavorite>[];

  List<Sermon> get items => List.unmodifiable(_items);
  bool get isLoading => _loading;
  bool get isFavoritesLoading => _favoritesLoading;
  String? get error => _error;
  SermonFilter get activeFilter => _activeFilter;
  Sermon? get selected => _selected;
  List<SermonFavorite> get favorites => List.unmodifiable(_favorites);

  Future<void> loadInitial() async {
    await _loadWithFilter(_activeFilter, resetPagination: true);
  }

  Future<void> applyFilter(SermonFilter filter) async {
    _activeFilter = filter;
    await _loadWithFilter(filter, resetPagination: true);
  }

  Future<void> refreshFavorites({bool expand = true}) async {
    _favoritesLoading = true;
    notifyListeners();

    try {
      List<Sermon> source = _items;

      if (source.isEmpty || expand) {
        try {
          source = await _sermonsService.fetchSermons(
            const SermonFilter(limit: 200, skip: 0),
          );
        } catch (_) {
          // Fall back to items already loaded even if refresh fails.
        }
      }

      _favorites =
          source
              .where((sermon) => sermon.isFavorited)
              .map(
                (sermon) => SermonFavorite(
                  id: sermon.id,
                  sermonId: sermon.id,
                  addedOn: DateTime.now(),
                  sermon: sermon.copyWith(isFavorited: true),
                ),
              )
              .toList();
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _favoritesLoading = false;
      notifyListeners();
    }
  }

  Future<void> removeFavorite(String sermonId) async {
    _favoritesLoading = true;
    notifyListeners();

    try {
      final success = await _mySermonsService.removeFavorite(sermonId);
      if (!success) {
        throw Exception('Favorite removal unsuccessful');
      }

      _favorites =
          _favorites
              .where((favorite) => favorite.sermonId != sermonId)
              .toList();

      final index = _items.indexWhere((sermon) => sermon.id == sermonId);
      if (index >= 0) {
        final current = _items[index];
        _items = List<Sermon>.from(_items)
          ..[index] = current.copyWith(isFavorited: false);
      }

      if (_selected?.id == sermonId) {
        _selected = _selected?.copyWith(isFavorited: false);
      }

      _error = null;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _favoritesLoading = false;
      notifyListeners();
    }
  }

  Future<void> toggleFavorite(Sermon sermon) async {
    final index = _items.indexWhere((item) => item.id == sermon.id);
    final bool targetFavorited = !sermon.isFavorited;

    Sermon? previous;
    if (index >= 0) {
      previous = _items[index];
      _items = List<Sermon>.from(_items)
        ..[index] = previous.copyWith(isFavorited: targetFavorited);
    }

    if (_selected?.id == sermon.id) {
      _selected = _selected?.copyWith(isFavorited: targetFavorited);
    }

    notifyListeners();

    try {
      if (targetFavorited) {
        await _sermonsService.favorite(sermon.id);
      } else {
        await _sermonsService.unfavorite(sermon.id);
      }
      _error = null;
      // Keep favorites cache in sync when already loaded
      if (targetFavorited) {
        final existingIndex = _favorites.indexWhere(
          (favorite) => favorite.sermonId == sermon.id,
        );
        final updatedFavorite = SermonFavorite(
          id:
              existingIndex >= 0
                  ? _favorites[existingIndex].id
                  : 'local-${sermon.id}',
          sermonId: sermon.id,
          addedOn: DateTime.now(),
          sermon: sermon.copyWith(isFavorited: true),
        );

        final favoritesCopy = List<SermonFavorite>.from(_favorites);
        if (existingIndex >= 0) {
          favoritesCopy[existingIndex] = updatedFavorite;
        } else {
          favoritesCopy.add(updatedFavorite);
        }
        _favorites = favoritesCopy;
      } else {
        _favorites =
            _favorites
                .where((favorite) => favorite.sermonId != sermon.id)
                .toList();
      }
    } catch (e) {
      if (index >= 0 && previous != null) {
        _items = List<Sermon>.from(_items)..[index] = previous;
      }
      if (_selected?.id == sermon.id) {
        _selected = sermon;
      }
      if (e is Exception && e.toString() == 'Exception: AUTH_REQUIRED') {
        _error = 'Please sign in to favorite sermons.';
      } else {
        _error = e.toString();
      }
      notifyListeners();
      rethrow;
    } finally {
      notifyListeners();
    }
  }

  void selectSermon(Sermon? sermon) {
    _selected = sermon;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> _loadWithFilter(
    SermonFilter filter, {
    required bool resetPagination,
  }) async {
    _loading = true;
    if (resetPagination) {
      _items = <Sermon>[];
    }
    notifyListeners();

    try {
      final sermons = await _sermonsService.fetchSermons(filter);
      _items = sermons;
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}

