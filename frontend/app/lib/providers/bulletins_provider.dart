import 'package:flutter/foundation.dart';

import 'package:app/models/bulletin.dart';
import 'package:app/models/service_bulletin.dart';
import 'package:app/services/bulletins_service.dart';

/// Get the Monday of the current week at 00:00:00
/// Used ONLY for filtering services by week (services still use week-based display_week)
/// Bulletins now use exact date filtering via upcomingOnly parameter
DateTime _getCurrentWeekMonday() {
  final today = DateTime.now();
  final dayOfWeek = today.weekday; // 1 = Monday, 7 = Sunday
  final daysFromMonday = dayOfWeek - 1;
  final monday = today.subtract(Duration(days: daysFromMonday));
  return DateTime(monday.year, monday.month, monday.day);
}

/// Get the Sunday of the current week at 23:59:59
DateTime _getCurrentWeekSunday() {
  final monday = _getCurrentWeekMonday();
  final sunday = monday.add(const Duration(days: 6));
  return DateTime(sunday.year, sunday.month, sunday.day, 23, 59, 59);
}

class BulletinsProvider extends ChangeNotifier {
  BulletinsProvider({
    BulletinsService? bulletinsService,
  }) : _bulletinsService = bulletinsService ?? BulletinsService() {
    // Initialize filter with current week boundaries for services
    // and upcomingOnly=true for bulletins (date-based filtering)
    _activeFilter = BulletinFilter(
      limit: 50,
      published: true,
      upcomingOnly: true, // Show bulletins where publish_date <= now
      weekStart: _getCurrentWeekMonday(), // For services only
      weekEnd: _getCurrentWeekSunday(), // For services only
    );
  }

  final BulletinsService _bulletinsService;

  List<Bulletin> _items = <Bulletin>[];
  List<ServiceBulletin> _services = <ServiceBulletin>[];
  bool _loading = false;
  String? _error;
  late BulletinFilter _activeFilter;
  Bulletin? _selected;

  List<Bulletin> get items => List.unmodifiable(_items);
  List<ServiceBulletin> get services => List.unmodifiable(_services);
  bool get isLoading => _loading;
  String? get error => _error;
  BulletinFilter get activeFilter => _activeFilter;
  Bulletin? get selected => _selected;

  /// Get only pinned bulletins
  List<Bulletin> get pinnedBulletins =>
      _items.where((bulletin) => bulletin.pinned).toList();

  /// Get upcoming bulletins (publish date in the future)
  List<Bulletin> get upcomingBulletins =>
      _items.where((bulletin) => bulletin.isUpcoming).toList();

  /// Get upcoming services (service_time >= now)
  List<ServiceBulletin> get upcomingServices =>
      _services.where((service) => service.isUpcoming).toList();

  Future<void> loadInitial() async {
    await _loadWithFilter(_activeFilter, resetPagination: true);
  }

  Future<void> applyFilter(BulletinFilter filter) async {
    _activeFilter = filter;
    await _loadWithFilter(filter, resetPagination: true);
  }

  Future<void> refresh() async {
    await _loadWithFilter(_activeFilter, resetPagination: true);
  }

  void selectBulletin(Bulletin? bulletin) {
    _selected = bulletin;
    notifyListeners();
  }

  Future<void> loadMore() async {
    if (_loading) return;

    final nextFilter = _activeFilter.copyWith(
      skip: _activeFilter.skip + _activeFilter.limit,
    );

    await _loadWithFilter(nextFilter, resetPagination: false);
  }

  Future<void> _loadWithFilter(
    BulletinFilter filter, {
    required bool resetPagination,
  }) async {
    _loading = true;
    _error = null;
    if (resetPagination) {
      _items = <Bulletin>[];
      _services = <ServiceBulletin>[];
    }
    notifyListeners();

    try {
      // Log week filtering for services (not bulletins)
      if (filter.weekStart != null && filter.weekEnd != null) {
        debugPrint(
          '[Bulletins Provider] Filtering services for week: '
          '${filter.weekStart!.toIso8601String()} to ${filter.weekEnd!.toIso8601String()}',
        );
      }

      // Fetch combined feed with services and bulletins
      final feed = await _bulletinsService.fetchCombinedFeed(filter);

      debugPrint(
        '[Bulletins Provider] Loaded ${feed.services.length} services for current week, '
        '${feed.bulletins.length} bulletins (announcements) with date-based filtering',
      );

      if (resetPagination) {
        _items = feed.bulletins;
        _services = feed.services;
      } else {
        // When loading more, only append bulletins (services don't paginate)
        final existingIds = _items.map((item) => item.id).toSet();
        final newItems = feed.bulletins.where(
          (bulletin) => !existingIds.contains(bulletin.id),
        );
        _items = [..._items, ...newItems];
        // Always update services list with latest data
        _services = feed.services;
      }

      if (!resetPagination) {
        _activeFilter = filter;
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Search bulletins by headline (legacy - does not include services)
  Future<void> searchBulletins(String query) async {
    if (query.isEmpty) {
      await loadInitial();
      return;
    }

    _loading = true;
    _error = null;
    _items = <Bulletin>[];
    _services = <ServiceBulletin>[]; // Clear services during search
    notifyListeners();

    try {
      final bulletins = await _bulletinsService.search(query);
      _items = bulletins;
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Fetch a specific bulletin by ID
  Future<Bulletin?> fetchBulletinById(String id) async {
    try {
      final bulletin = await _bulletinsService.fetchBulletinById(id);
      return bulletin;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    }
  }

  @override
  void dispose() {
    _items = <Bulletin>[];
    _services = <ServiceBulletin>[];
    _selected = null;
    super.dispose();
  }
}
