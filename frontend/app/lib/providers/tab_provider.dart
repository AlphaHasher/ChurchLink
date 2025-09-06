import 'package:flutter/material.dart';

class TabProvider extends ChangeNotifier {
  static TabProvider? instance;

  final Map<String, int> tabNameToIndex = {
    'home': 0,
    '/home': 0,
    'bible': 1,
    '/bible': 1,
    'sermons': 2,
    '/sermons': 2,
    'profile': 3,
    '/profile': 3,
  };

  int _currentIndex = 0;

  int get currentIndex => _currentIndex;

  void setTab(int index) {
    _currentIndex = index;
    notifyListeners();
  }

  void setTabByName(String name) {
    if (tabNameToIndex.containsKey(name)) {
      setTab(tabNameToIndex[name]!);
    } else if (name.startsWith('/')) {
      final key = name.substring(1);
      if (tabNameToIndex.containsKey(key)) {
        setTab(tabNameToIndex[key]!);
      }
    }
  }
}
