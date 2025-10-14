import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A helper widget that manages a paged window of days (e.g., 5-day pages)
/// with local persistence keyed by a plan id. It exposes start/end and
/// previous/next callbacks to a builder.
class DaysWindow extends StatefulWidget {
  final String storageKey; // unique key per plan
  final int totalDays;
  final int pageSize;
  final int initialDay;
  final Widget Function(BuildContext context, int start, int end, VoidCallback? onPrev, VoidCallback? onNext) builder;

  const DaysWindow({
    Key? key,
    required this.storageKey,
    required this.totalDays,
    required this.builder,
    this.pageSize = 5,
    this.initialDay = 1,
  }) : super(key: key);

  @override
  State<DaysWindow> createState() => _DaysWindowState();
}

class _DaysWindowState extends State<DaysWindow> {
  late int _windowStart;

  String get _prefsKey => widget.storageKey;

  @override
  void initState() {
    super.initState();
    _windowStart = _computeWindowStartForDay(widget.initialDay);
    _loadSavedWindowStart();
  }

  int _computeWindowStartForDay(int day) {
    if (day <= 0) return 1;
    final zeroBased = day - 1;
    final pageIndex = zeroBased ~/ widget.pageSize;
    return pageIndex * widget.pageSize + 1;
  }

  Future<void> _loadSavedWindowStart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getInt(_prefsKey);
      if (saved != null && mounted) {
        setState(() {
          _windowStart = saved.clamp(1, widget.totalDays).toInt();
        });
      }
    } catch (_) {}
  }

  Future<void> _persistWindowStart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_prefsKey, _windowStart);
    } catch (_) {}
  }

  void _seekWindowBy(int delta) {
    setState(() {
      _windowStart = (_windowStart + delta).clamp(1, widget.totalDays).toInt();
    });
    _persistWindowStart();
  }

  @override
  Widget build(BuildContext context) {
    final start = _windowStart.clamp(1, widget.totalDays).toInt();
    final end = (_windowStart + widget.pageSize - 1).clamp(1, widget.totalDays).toInt();

    final onPrev = start > 1 ? () => _seekWindowBy(-widget.pageSize) : null;
    final onNext = end < widget.totalDays ? () => _seekWindowBy(widget.pageSize) : null;

    return widget.builder(context, start, end, onPrev, onNext);
  }
}
