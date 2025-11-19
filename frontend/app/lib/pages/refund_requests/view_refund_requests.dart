import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/refund_request_helper.dart';
import 'package:app/models/refund_request.dart';
import 'package:app/widgets/refund_request_card.dart';
import 'package:app/pages/refund_requests/view_refund_request_response.dart';

class ViewRefundRequestsPage extends StatefulWidget {
  const ViewRefundRequestsPage({super.key});

  @override
  State<ViewRefundRequestsPage> createState() => _ViewRefundRequestsPageState();
}

class _ViewRefundRequestsPageState extends State<ViewRefundRequestsPage> {
  final List<RefundRequestWithTransaction> _rows = [];

  bool _isInitialLoading = true;
  bool _isRefreshing = false;
  bool _isLoadingMore = false;

  bool _hasMore = false;
  int _page = 0; // 0-based, same as RefundRequestHelper
  int _pageSize = 25;
  int _total = 0;

  RefundTxnKind? _kindFilter; // null => all kinds
  RefundRequestStatus _statusFilter = RefundRequestStatus.all;

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

  MyRefundRequestSearchParams _buildSearchParams({required bool forNextPage}) {
    // Determine which page to request (0-based).
    final int page = forNextPage ? (_page + 1) : 0;

    return MyRefundRequestSearchParams(
      page: page,
      pageSize: _pageSize,
      status: _statusFilter,
      txnKind: _kindFilter,
    );
  }

  Future<void> _fetchPage({required bool reset}) async {
    if (!mounted) return;

    if (!reset && (_isLoadingMore || !_hasMore)) {
      return;
    }

    setState(() {
      if (reset) {
        _isRefreshing = true;
      } else {
        _isLoadingMore = true;
      }
    });

    try {
      final params = _buildSearchParams(forNextPage: !reset);

      final results = await RefundRequestHelper.fetchMyRefundRequests(
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
        _total = results.total;

        final int totalPages =
            results.pageSize > 0
                ? ((results.total + results.pageSize - 1) ~/ results.pageSize)
                : 0;
        _hasMore = (results.page + 1) < totalPages;
      });
    } catch (e, st) {
      debugPrint('fetchMyRefundRequests failed: $e\n$st');
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
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    RefundTxnKind? tempKind = _kindFilter;
    RefundRequestStatus tempStatus = _statusFilter;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: StatefulBuilder(
            builder: (ctx, setModalState) {
              Widget buildKindDropdown() {
                return DropdownButtonFormField<RefundTxnKind?>(
                  decoration: InputDecoration(
                    labelText: localize('Transaction Type'),
                  ),
                  value: tempKind,
                  items: [
                    DropdownMenuItem<RefundTxnKind?>(
                      value: null,
                      child: Text(localize('All types')),
                    ),
                    DropdownMenuItem<RefundTxnKind?>(
                      value: RefundTxnKind.event,
                      child: Text(localize('Event payments')),
                    ),
                    DropdownMenuItem<RefundTxnKind?>(
                      value: RefundTxnKind.form,
                      child: Text(localize('Form payments')),
                    ),
                  ],
                  onChanged: (value) {
                    setModalState(() {
                      tempKind = value;
                    });
                  },
                );
              }

              Widget buildStatusDropdown() {
                return DropdownButtonFormField<RefundRequestStatus>(
                  decoration: InputDecoration(labelText: localize('Status')),
                  value: tempStatus,
                  items: [
                    DropdownMenuItem<RefundRequestStatus>(
                      value: RefundRequestStatus.all,
                      child: Text(localize('All statuses')),
                    ),
                    DropdownMenuItem<RefundRequestStatus>(
                      value: RefundRequestStatus.pending,
                      child: Text(localize('Pending')),
                    ),
                    DropdownMenuItem<RefundRequestStatus>(
                      value: RefundRequestStatus.resolved,
                      child: Text(localize('Resolved')),
                    ),
                    DropdownMenuItem<RefundRequestStatus>(
                      value: RefundRequestStatus.unresolved,
                      child: Text(localize('Unresolved')),
                    ),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setModalState(() {
                      tempStatus = value;
                    });
                  },
                );
              }

              return SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      localize('Filter refund requests'),
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    buildKindDropdown(),
                    const SizedBox(height: 12),
                    buildStatusDropdown(),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: () {
                            Navigator.of(ctx).pop();
                          },
                          child: Text(localize('Cancel')),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _kindFilter = tempKind;
                              _statusFilter = tempStatus;
                            });
                            Navigator.of(ctx).pop();
                            _fetchPage(reset: true);
                          },
                          child: Text(localize('Apply filters')),
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
  // UI BUILDERS
  // ---------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          localize('My refund requests', capitalize: true),
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          localize(
            'View the refund requests you have submitted for your payments.',
          ),
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurface.withOpacity(0.7),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: _showFilterSheet,
              icon: const Icon(Icons.filter_list),
              label: Text(localize('Filters')),
            ),
            const SizedBox(width: 8),
            TextButton.icon(
              onPressed: _isRefreshing || _isInitialLoading ? null : _onRefresh,
              icon:
                  _isRefreshing
                      ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                      : const Icon(Icons.refresh),
              label: Text(
                _isRefreshing ? localize('Refreshing...') : localize('Refresh'),
              ),
            ),
            const Spacer(),
            if (_total > 0)
              Text(
                '${localize("Total")}: $_total',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                ),
              ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;

    return Scaffold(
      appBar: AppBar(
        title: Text(localize('My refund requests', capitalize: true)),
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
                    children: [
                      const SizedBox(height: 32),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: _buildHeader(context),
                      ),
                      const SizedBox(height: 24),
                      Center(
                        child: Text(
                          localize(
                            'You have not submitted any refund requests yet.',
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  )
                  : ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
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
                          final req = _rows[index];
                          return RefundRequestCard(
                            request: req,
                            onTap: () => _navigateToDetails(req),
                          );
                        },
                      ),
                      if (_hasMore)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child:
                              _isLoadingMore
                                  ? const Center(
                                    child: CircularProgressIndicator(),
                                  )
                                  : OutlinedButton(
                                    onPressed: _onLoadMore,
                                    child: Text(localize('Load more')),
                                  ),
                        ),
                      if (_isRefreshing)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Center(
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                    ],
                  ),
        ),
      ),
    );
  }

  void _navigateToDetails(RefundRequestWithTransaction req) async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ViewRefundRequestResponsePage(request: req),
      ),
    );

    // If some action inside the detail page changed things, allow the
    // parent list to refresh.
    if (result == true) {
      _onRefresh();
    }
  }
}
