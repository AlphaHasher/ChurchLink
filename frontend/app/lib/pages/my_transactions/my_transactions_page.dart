import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/my_transactions_formatting.dart';
import 'package:app/helpers/transactions_helper.dart';
import 'package:app/models/transactions.dart';
import 'package:app/widgets/my_transactions_card.dart';
import 'package:app/pages/my_transactions/view_transaction_page.dart';

class MyTransactionsPage extends StatefulWidget {
  const MyTransactionsPage({super.key});

  @override
  State<MyTransactionsPage> createState() => _MyTransactionsPageState();
}

class _MyTransactionsPageState extends State<MyTransactionsPage> {
  final List<TransactionSummary> _rows = [];

  bool _isInitialLoading = true;
  bool _isRefreshing = false;
  bool _isLoadingMore = false;

  bool _hasMore = false;
  int _page = 1;
  int _pageSize = 25;
  int? _nextPage;

  TransactionKind? _kindFilter;
  TransactionSortMode _sortMode = TransactionSortMode.createdDesc;
  String _statusFilterId = 'all';

  @override
  void initState() {
    super.initState();
    _fetchInitial();
  }

  Future<void> _fetchInitial() async {
    setState(() {
      _isInitialLoading = true;
    });
    await _fetchPage(reset: true);
  }

  TransactionSearchParams _buildSearchParams({required bool forNextPage}) {
    // Determine which page to request.
    final int page = forNextPage ? (_nextPage ?? (_page + 1)) : 1;

    // Kind filter: null means "all".
    final List<TransactionKind>? kinds =
        _kindFilter != null ? <TransactionKind>[_kindFilter!] : null;

    // Status filter: get options for current kind, then map the selected id
    // to a list of raw status strings to send to the backend.
    final options = getStatusFilterOptionsForKind(_kindFilter);
    final selectedOpt = options.firstWhere(
      (opt) => opt.id == _statusFilterId,
      orElse: () => options.first,
    );
    final List<String>? statuses =
        selectedOpt.id == 'all' || selectedOpt.statuses.isEmpty
            ? null
            : selectedOpt.statuses;

    return TransactionSearchParams(
      kinds: kinds,
      statuses: statuses,
      page: page,
      pageSize: _pageSize,
      sort: _sortMode,
    );
  }

  Future<void> _fetchPage({required bool reset}) async {
    if (!mounted) return;
    if (!reset && (!_hasMore || _isLoadingMore)) return;

    if (reset) {
      _hasMore = true;
      _nextPage = null;
      _page = 1;
    }

    setState(() {
      if (reset && !_isRefreshing) {
        _isInitialLoading = true;
      } else if (!reset) {
        _isLoadingMore = true;
      }
    });

    try {
      final params = _buildSearchParams(forNextPage: !reset);
      final results = await TransactionsHelper.fetchMyTransactions(
        params: params,
      );

      if (!mounted) return;

      setState(() {
        if (reset) {
          _rows
            ..clear()
            ..addAll(results.items);
        } else {
          _rows.addAll(results.items);
        }

        _page = results.page;
        _pageSize = results.pageSize;
        _hasMore = results.hasMore;
        _nextPage = results.nextPage;
      });
    } catch (e, st) {
      debugPrint('fetchMyTransactions failed: $e\n$st');
    } finally {
      if (!mounted) return;
      setState(() {
        _isInitialLoading = false;
        _isRefreshing = false;
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _onRefresh() async {
    if (!mounted) return;
    setState(() {
      _isRefreshing = true;
    });
    await _fetchPage(reset: true);
  }

  void _onLoadMore() {
    _fetchPage(reset: false);
  }

  // ---------------------------------------------------------------------------
  // FILTER SHEET
  // ---------------------------------------------------------------------------

  void _showFilterSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        final theme = Theme.of(ctx);
        final textTheme = theme.textTheme;
        final colorScheme = theme.colorScheme;
        final localize = LocalizationHelper.localize;

        TransactionKind? tempKind = _kindFilter;
        TransactionSortMode tempSort = _sortMode;
        String tempStatusId = _statusFilterId;

        // Build status options snapshot based on the temporary kind.
        List<StatusFilterOption> tempStatusOptions =
            getStatusFilterOptionsForKind(tempKind);
        if (!tempStatusOptions.any((opt) => opt.id == tempStatusId)) {
          tempStatusId = tempStatusOptions.first.id;
        }

        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: StatefulBuilder(
            builder: (ctx, setModalState) {
              // Keep status options in sync when kind changes.
              void refreshStatusOptions() {
                tempStatusOptions = getStatusFilterOptionsForKind(tempKind);
                if (!tempStatusOptions.any((opt) => opt.id == tempStatusId)) {
                  tempStatusId = tempStatusOptions.first.id;
                }
              }

              Widget buildKindDropdown() {
                return DropdownButtonFormField<TransactionKind?>(
                  decoration: InputDecoration(labelText: localize('Type')),
                  value: tempKind,
                  items: [
                    DropdownMenuItem<TransactionKind?>(
                      value: null,
                      child: Text(localize('All types')),
                    ),
                    DropdownMenuItem<TransactionKind?>(
                      value: TransactionKind.donationOneTime,
                      child: Text(localize('One-time donations')),
                    ),
                    DropdownMenuItem<TransactionKind?>(
                      value: TransactionKind.donationSubscription,
                      child: Text(localize('Donation plans')),
                    ),
                    DropdownMenuItem<TransactionKind?>(
                      value: TransactionKind.donationSubscriptionPayment,
                      child: Text(localize('Plan payments')),
                    ),
                    DropdownMenuItem<TransactionKind?>(
                      value: TransactionKind.event,
                      child: Text(localize('Event payments')),
                    ),
                    DropdownMenuItem<TransactionKind?>(
                      value: TransactionKind.form,
                      child: Text(localize('Form payments')),
                    ),
                  ],
                  onChanged: (value) {
                    setModalState(() {
                      tempKind = value;
                      refreshStatusOptions();
                    });
                  },
                );
              }

              Widget buildSortDropdown() {
                return DropdownButtonFormField<TransactionSortMode>(
                  decoration: InputDecoration(labelText: localize('Sort by')),
                  value: tempSort,
                  items: [
                    DropdownMenuItem<TransactionSortMode>(
                      value: TransactionSortMode.createdDesc,
                      child: Text(localize('Newest first')),
                    ),
                    DropdownMenuItem<TransactionSortMode>(
                      value: TransactionSortMode.createdAsc,
                      child: Text(localize('Oldest first')),
                    ),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setModalState(() {
                      tempSort = value;
                    });
                  },
                );
              }

              Widget buildStatusDropdown() {
                return DropdownButtonFormField<String>(
                  decoration: InputDecoration(labelText: localize('Status')),
                  value: tempStatusId,
                  items:
                      tempStatusOptions
                          .map(
                            (opt) => DropdownMenuItem<String>(
                              value: opt.id,
                              child: Text(localize(opt.label)),
                            ),
                          )
                          .toList(),
                  onChanged: (value) {
                    if (value == null) return;
                    setModalState(() {
                      tempStatusId = value;
                    });
                  },
                );
              }

              return SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      localize('Filter Transactions'),
                      style: textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    buildKindDropdown(),
                    const SizedBox(height: 12),
                    buildSortDropdown(),
                    const SizedBox(height: 12),
                    buildStatusDropdown(),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              setModalState(() {
                                tempKind = null;
                                tempSort = TransactionSortMode.createdDesc;
                                tempStatusId = 'all';
                                refreshStatusOptions();
                              });
                            },
                            child: Text(localize('Clear')),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: colorScheme.primary,
                              foregroundColor: colorScheme.onPrimary,
                            ),
                            onPressed: () {
                              setState(() {
                                _kindFilter = tempKind;
                                _sortMode = tempSort;
                                _statusFilterId = tempStatusId;
                              });
                              Navigator.of(ctx).pop();
                              _onRefresh();
                            },
                            child: Text(localize('Apply')),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          localize('My Transactions', capitalize: true),
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          localize(
            'Only transactions paid through PayPal and recorded in this app are shown here. '
            'If something looks off, consider your bank information as the ultimate source of truth.',
          ),
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurface.withOpacity(0.7),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    return Scaffold(
      appBar: AppBar(
        title: Text(localize('My Transactions', capitalize: true)),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        minimum: const EdgeInsets.symmetric(horizontal: 10),
        child: RefreshIndicator(
          onRefresh: _onRefresh,
          child:
              _isInitialLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _rows.isEmpty
                  ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    children: [
                      _buildHeader(context),
                      const SizedBox(height: 40),
                      Center(
                        child: Text(
                          localize('You do not have any transactions yet.'),
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  )
                  : SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                          child: _buildHeader(context),
                        ),
                        ListView.builder(
                          physics: const NeverScrollableScrollPhysics(),
                          shrinkWrap: true,
                          itemCount: _rows.length,
                          itemBuilder: (context, index) {
                            final tx = _rows[index];
                            return MyTransactionsCard(
                              transaction: tx,
                              onTap: () => _navigateToDetails(tx),
                            );
                          },
                        ),
                        if (_hasMore)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child:
                                _isLoadingMore
                                    ? const CircularProgressIndicator()
                                    : OutlinedButton(
                                      onPressed: _onLoadMore,
                                      child: Text(localize('Load more')),
                                    ),
                          ),
                        if (_isRefreshing)
                          const Padding(
                            padding: EdgeInsets.only(bottom: 8),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showFilterSheet,
        child: const Icon(Icons.filter_list),
      ),
    );
  }

  void _navigateToDetails(TransactionSummary tx) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ViewTransactionPage(transaction: tx)),
    );

    if (!mounted) return;
    _onRefresh();
  }
}
