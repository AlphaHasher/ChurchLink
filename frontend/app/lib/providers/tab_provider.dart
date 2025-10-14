import 'package:flutter/material.dart';
import '../helpers/backend_helper.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class TabProvider extends ChangeNotifier {
  static TabProvider? instance;

  // Default fallback mappings (will be replaced by API data)
  Map<String, int> tabNameToIndex = {
    'home': 0,
    'bible': 1,
    'sermons': 2,
    'events': 3,
    'profile': 4,
  };

  Map<int, String> indexToTabName = {
    0: 'home',
    1: 'bible',
    2: 'sermons',
    3: 'events',
    4: 'profile',
  };

  List<Map<String, dynamic>> _tabs = [];
  bool _isLoaded = false;
  int _currentIndex = 0;

  int get currentIndex => _currentIndex;
  String get currentTabName => indexToTabName[_currentIndex] ?? 'unknown';
  List<Map<String, dynamic>> get tabs => _tabs;
  bool get isLoaded => _isLoaded;

  /// Initialize and load tab configuration from API
  Future<void> loadTabConfiguration() async {
    try {
      debugPrint('Loading tab configuration from API...');
      final url = '${BackendHelper.apiBase}/api/v1/app/tabs';
      
      final response = await http.get(Uri.parse(url));
      
      if (response.statusCode == 200) {
        final List<dynamic> tabData = json.decode(response.body);
        _tabs = tabData.cast<Map<String, dynamic>>();
        
        // Debug: Print the raw tab data
        debugPrint('Raw tab data from API: $tabData');
        
        // Ensure all tabs have required fields
        for (var tab in _tabs) {
          if (tab['displayName'] == null || (tab['displayName'] as String).isEmpty) {
            debugPrint('Warning: Tab ${tab['name']} missing displayName, using name as fallback');
            tab['displayName'] = tab['name'];
          }
          debugPrint('Tab: ${tab['name']}, DisplayName: ${tab['displayName']}, Icon: ${tab['icon']}');
        }
        
        // Rebuild the mappings from API data
        _buildMappingsFromTabs();
        _isLoaded = true;
        
        debugPrint('Tab configuration loaded successfully: ${_tabs.length} tabs');
        debugPrint('New tab mappings: $tabNameToIndex');
        
        notifyListeners();
      } else {
        debugPrint('Failed to load tab configuration: ${response.statusCode}');
        _useFallbackConfiguration();
      }
    } catch (e) {
      debugPrint('Error loading tab configuration: $e');
      _useFallbackConfiguration();
    }
  }

  /// Build the mappings from the loaded tab data
  void _buildMappingsFromTabs() {
    tabNameToIndex.clear();
    indexToTabName.clear();
    
    for (final tab in _tabs) {
      final index = tab['index'] as int;
      final name = tab['name'] as String;
      
      tabNameToIndex[name.toLowerCase()] = index;
      indexToTabName[index] = name.toLowerCase();
    }
  }

  /// Use fallback configuration if API fails
  void _useFallbackConfiguration() {
    debugPrint('Using fallback tab configuration');
    _tabs = [
      {"index": 0, "name": "home", "displayName": "Home", "icon": "home", "enabled": true},
      {"index": 1, "name": "bible", "displayName": "Bible", "icon": "bible", "enabled": true},
      {"index": 2, "name": "sermons", "displayName": "Sermons", "icon": "sermons", "enabled": true},
      {"index": 3, "name": "events", "displayName": "Events", "icon": "event", "enabled": true},
      {"index": 4, "name": "profile", "displayName": "Profile", "icon": "person", "enabled": true},
    ];
    _buildMappingsFromTabs();
    _isLoaded = true;
    notifyListeners();
  }

  void setTab(int index) {
    if (index >= 0 && index < _tabs.length && index != _currentIndex) {
      final oldTab = currentTabName;
      _currentIndex = index;
      debugPrint('Tab changed from $oldTab to $currentTabName (index: $index)');
      notifyListeners();
    }
  }

  void setTabByName(String name) {
    final normalizedName = name.toLowerCase();
    if (tabNameToIndex.containsKey(normalizedName)) {
      setTab(tabNameToIndex[normalizedName]!);
    } else if (name.startsWith('/')) {
      final key = name.substring(1).toLowerCase();
      if (tabNameToIndex.containsKey(key)) {
        setTab(tabNameToIndex[key]!);
      }
    } else {
      debugPrint('Unknown tab name: $name');
    }
  }

  /// Refresh tab configuration from API
  Future<void> refreshTabConfiguration() async {
    debugPrint('Refreshing tab configuration...');
    await loadTabConfiguration();
  }

  /// Get tab index by name (useful for dynamic navigation)
  int? getTabIndexByName(String name) {
    final normalizedName = name.toLowerCase();
    final tab = _tabs.firstWhere(
      (tab) => (tab['name'] as String).toLowerCase() == normalizedName,
      orElse: () => {},
    );
    return tab.isEmpty ? null : tab['index'] as int?;
  }

  /// Check if a tab exists by name
  bool hasTab(String name) {
    return getTabIndexByName(name) != null;
  }

  void setTabsForTest(List<Map<String, dynamic>> t) {
    _tabs = t;
    _isLoaded = true;
    _currentIndex = 0;
    notifyListeners();
  }
}
