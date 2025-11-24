import 'package:flutter/foundation.dart';

import 'package:app/models/bulletin.dart';
import 'package:app/models/service_bulletin.dart';
import 'package:app/models/server_week.dart';
import 'package:app/services/bulletins_service.dart';
import 'package:app/widgets/service_filter_sheet.dart';

class BulletinsProvider extends ChangeNotifier {
  BulletinsProvider({BulletinsService? bulletinsService})
    : _bulletinsService = bulletinsService ?? BulletinsService() {
    // Initialize announcement filter with empty week boundaries - will be fetched from server
    _activeAnnouncementFilter = BulletinFilter(
      limit: 50,
      published: true,
      upcomingOnly: true, // Show bulletins where publish_date <= now
    );
    // Service filter starts empty (no filters applied)
    _activeServiceFilter = const ServiceFilterOptions();
  }

  final BulletinsService _bulletinsService;

  List<Bulletin> _items = <Bulletin>[];
  List<ServiceBulletin> _services = <ServiceBulletin>[];
  List<ServiceBulletin> _filteredServices = <ServiceBulletin>[];
  ServerWeekInfo? _serverWeek;
  bool _loading = false;
  String? _error;
  late BulletinFilter _activeAnnouncementFilter;
  ServiceFilterOptions _activeServiceFilter = const ServiceFilterOptions();
  Bulletin? _selected;

  List<Bulletin> get items => List.unmodifiable(_items);
  List<ServiceBulletin> get services => List.unmodifiable(_filteredServices);
  ServerWeekInfo? get serverWeek => _serverWeek;
  bool get isLoading => _loading;
  String? get error => _error;
  BulletinFilter get activeAnnouncementFilter => _activeAnnouncementFilter;
  ServiceFilterOptions get activeServiceFilter => _activeServiceFilter;
  Bulletin? get selected => _selected;

  /// Get upcoming bulletins (publish date in the future)
  List<Bulletin> get upcomingBulletins =>
      _items.where((bulletin) => bulletin.isUpcoming).toList();

  /// Get upcoming services (service_time >= now)
  List<ServiceBulletin> get upcomingServices =>
      _services.where((service) => service.isUpcoming).toList();

  Future<void> loadInitial() async {
    await _loadWithFilter(_activeAnnouncementFilter, resetPagination: true);
  }

  Future<void> applyAnnouncementFilter(BulletinFilter filter) async {
    _activeAnnouncementFilter = filter;
    await _loadWithFilter(filter, resetPagination: true);
  }

  Future<void> applyServiceFilter(ServiceFilterOptions filter) async {
    _activeServiceFilter = filter;
    _applyClientSideServiceFilter();
    notifyListeners();
  }

  Future<void> refresh() async {
    await _loadWithFilter(_activeAnnouncementFilter, resetPagination: true);
  }

  void selectBulletin(Bulletin? bulletin) {
    _selected = bulletin;
    notifyListeners();
  }

  Future<void> loadMore() async {
    if (_loading) return;

    final nextFilter = _activeAnnouncementFilter.copyWith(
      skip: _activeAnnouncementFilter.skip + _activeAnnouncementFilter.limit,
    );

    await _loadWithFilter(nextFilter, resetPagination: false);
  }

  void _applyClientSideServiceFilter() {
    // Start with all services
    var filtered = _services.toList();

    // Filter by day of week
    if (_activeServiceFilter.dayOfWeek != null) {
      filtered =
          filtered.where((service) {
            return service.dayOfWeek == _activeServiceFilter.dayOfWeek;
          }).toList();
    }

    // Filter by time range
    if (_activeServiceFilter.timeRange != null) {
      filtered =
          filtered.where((service) {
            final parts = service.timeOfDay.split(':');
            final hour = int.tryParse(parts[0]) ?? 0;

            switch (_activeServiceFilter.timeRange) {
              case 'morning':
                return hour >= 6 && hour < 12;
              case 'afternoon':
                return hour >= 12 && hour < 18;
              case 'evening':
                return hour >= 18 || hour < 6;
              default:
                return true;
            }
          }).toList();
    }

    // Filter by title search
    if (_activeServiceFilter.titleQuery != null &&
        _activeServiceFilter.titleQuery!.isNotEmpty) {
      final query = _activeServiceFilter.titleQuery!.toLowerCase();
      filtered =
          filtered.where((service) {
            return service.title.toLowerCase().contains(query);
          }).toList();
    }

    _filteredServices = filtered;
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
      // Fetch server week info if not already loaded
      if (_serverWeek == null || resetPagination) {
        _serverWeek = await _bulletinsService.fetchCurrentWeek();
        debugPrint(
          '[Bulletins Provider] Server week: ${_serverWeek!.weekLabel} '
          '(${_serverWeek!.timezone})',
        );

        // Update filter with server week boundaries
        filter = filter.copyWith(
          weekStart: _serverWeek!.weekStart,
          weekEnd: _serverWeek!.weekEnd,
        );
      }

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
        _activeAnnouncementFilter = filter;
      }

      // Apply client-side service filtering
      _applyClientSideServiceFilter();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Search bulletins by headline (does not include services in results)
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
