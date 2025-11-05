import 'dart:async';

/// Manages debounced batch updates for passage progress
/// Collects updates over a delay period and sends them in a single batch
class BatchUpdateDebouncer<T> {
  static const Duration _updateDelayDuration = Duration(seconds: 5);

  final Future<void> Function(List<T>) _onBatchReady;
  final Duration delayDuration;

  Timer? _debounceTimer;
  final List<T> _pendingUpdates = [];
  bool _isProcessing = false;

  BatchUpdateDebouncer({
    required Future<void> Function(List<T>) onBatchReady,
    Duration? delayDuration,
  })  : _onBatchReady = onBatchReady,
        delayDuration = delayDuration ?? _updateDelayDuration;

  /// Add an update to the batch queue and start/restart the debounce timer
  void add(T update) {
    _pendingUpdates.add(update);
    _resetTimer();
  }

  /// Reset the debounce timer
  void _resetTimer() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(delayDuration, _processBatch);
  }

  /// Process the batch of pending updates
  Future<void> _processBatch() async {
    if (_isProcessing || _pendingUpdates.isEmpty) {
      return;
    }

    _isProcessing = true;
    final updates = List<T>.from(_pendingUpdates);
    _pendingUpdates.clear();

    try {
      await _onBatchReady(updates);
    } finally {
      _isProcessing = false;
    }
  }

  /// Clean up resources
  void dispose() {
    _debounceTimer?.cancel();
  }

  /// Immediately process any pending updates, canceling any existing timer.
  /// Safe to call from lifecycle methods; the provided callback decides how
  /// to handle UI context availability.
  void flush() {
    if (_pendingUpdates.isEmpty) {
      _debounceTimer?.cancel();
      return;
    }
    _debounceTimer?.cancel();
    // Fire and forget; the callback is responsible for handling async and errors
    // and for avoiding UI work if the caller is unmounted.
    // ignore: discarded_futures
    _processBatch();
  }
}
