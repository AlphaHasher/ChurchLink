import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/bible_plan.dart';
import '../services/bible_plan_service.dart';
import 'bible_plans_list_page.dart';

/// Main page showing user's subscribed Bible plans with progress tracking
class MyBiblePlansPage extends StatefulWidget {
  const MyBiblePlansPage({super.key});

  @override
  State<MyBiblePlansPage> createState() => _MyBiblePlansPageState();
}

class _MyBiblePlansPageState extends State<MyBiblePlansPage> with WidgetsBindingObserver {
  final BiblePlanService _service = BiblePlanService();
  List<UserBiblePlanWithDetails>? _plans;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshPlans();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh when app comes back to foreground
    if (state == AppLifecycleState.resumed) {
      _refreshPlans();
    }
  }

  Future<void> _refreshPlans({bool showLoader = true}) async {
    if (!mounted) return;

    setState(() {
      if (showLoader || _plans == null) {
        _isLoading = true;
      }
      _errorMessage = null;
    });

    try {
      final plans = await _service.getMyPlansWithDetails();
      if (!mounted) return;
      setState(() {
        _plans = plans;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to load plans. Please try again.';
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error loading plans: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPlansLoaded = _plans != null;

    if (_isLoading && !hasPlansLoaded) {
      return Scaffold(
        appBar: _buildAppBar(),
        backgroundColor: const Color.fromRGBO(50, 50, 50, 1),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: _buildAppBar(),
      backgroundColor: const Color.fromRGBO(50, 50, 50, 1),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: () => _refreshPlans(showLoader: false),
            child: _buildPlansContent(),
          ),
          if (_isLoading && hasPlansLoaded)
            const Positioned.fill(
              child: IgnorePointer(
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: const Color.fromRGBO(37, 37, 37, 1),
      iconTheme: const IconThemeData(color: Colors.white),
      title: const Text(
        'My Reading Plans',
        style: TextStyle(color: Colors.white),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.add),
          onPressed: _navigateToAddPlan,
          tooltip: 'Add New Plan',
        ),
      ],
    );
  }

  Widget _buildPlansContent() {
    if (_errorMessage != null && (_plans == null || _plans!.isEmpty)) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 120),
          _buildErrorState(),
        ],
      );
    }

    final plans = _plans ?? [];

    if (plans.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 40),
          _buildEmptyState(),
          const SizedBox(height: 40),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: plans.length,
      itemBuilder: (context, index) {
        final planWithDetails = plans[index];
        return _PlanProgressCard(
          key: ValueKey(planWithDetails.subscription.planId),
          planWithDetails: planWithDetails,
          onProgressUpdate: () => _refreshPlans(showLoader: false),
          onDelete: () => _handleDeletePlan(planWithDetails.subscription.planId),
        );
      },
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              'Error loading your plans',
              style: TextStyle(color: Colors.grey[300], fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => _refreshPlans(),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.book_outlined, size: 80, color: Colors.grey[600]),
            const SizedBox(height: 24),
            const Text(
              'No Active Reading Plans',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Start your Bible reading journey by\nadding a reading plan',
              style: TextStyle(
                color: Colors.grey[400],
                fontSize: 16,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _navigateToAddPlan,
              icon: const Icon(Icons.add),
              label: const Text('Browse Reading Plans'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromRGBO(150, 130, 255, 1),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToAddPlan() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const BiblePlansListPage(),
      ),
    );
    
    if (result == true) {
      await _refreshPlans(showLoader: false);
    }
  }

  Future<void> _handleDeletePlan(String planId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color.fromRGBO(65, 65, 65, 1),
        title: const Text(
          'Unsubscribe from Plan?',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'Your progress will be lost. This action cannot be undone.',
          style: TextStyle(color: Color.fromRGBO(200, 200, 200, 1)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Unsubscribe'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _service.unsubscribeFromPlan(planId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Unsubscribed from plan'),
              backgroundColor: Colors.green,
            ),
          );
          await _refreshPlans();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error: ${e.toString()}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }
}

/// Card widget showing a plan with accordion-style progress
class _PlanProgressCard extends StatefulWidget {
  final UserBiblePlanWithDetails planWithDetails;
  final VoidCallback onProgressUpdate;
  final VoidCallback onDelete;

  const _PlanProgressCard({
    super.key,
    required this.planWithDetails,
    required this.onProgressUpdate,
    required this.onDelete,
  });

  @override
  State<_PlanProgressCard> createState() => _PlanProgressCardState();
}

class _PlanProgressCardState extends State<_PlanProgressCard> {
  final BiblePlanService _service = BiblePlanService();
  bool _isExpanded = false;
  late UserBiblePlanWithDetails _localPlanDetails;
  bool _isUpdating = false;
  bool _isRestarting = false;
  double _previousProgressPercent = 0;
  double _currentProgressPercent = 0;
  // Pagination window start day (1-based). We show 5 days at a time.
  static const int _daysPageSize = 5;
  int _windowStartDay = 1;

  @override
  void initState() {
    super.initState();
    _localPlanDetails = widget.planWithDetails;
    _currentProgressPercent = _localPlanDetails.progressPercentage;
    _previousProgressPercent = _currentProgressPercent;
    // Initialize window so the current display day is visible
    final displayDay = _localPlanDetails.displayCurrentDay;
    _windowStartDay = _computeWindowStartForDay(displayDay);
  }

  @override
  void didUpdateWidget(_PlanProgressCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldProgress = oldWidget.planWithDetails.subscription.progress;
    final newProgress = widget.planWithDetails.subscription.progress;

    final progressChanged = !_areProgressListsEqual(oldProgress, newProgress);

    if (progressChanged ||
        (!_isUpdating &&
            !_areProgressListsEqual(
              _localPlanDetails.subscription.progress,
              newProgress,
            ))) {
      final newPercent = widget.planWithDetails.progressPercentage;
      setState(() {
        if (newPercent != _currentProgressPercent) {
          _previousProgressPercent = _currentProgressPercent;
          _currentProgressPercent = newPercent;
        }
        _localPlanDetails = widget.planWithDetails;
        // Ensure current display day stays visible in the paged view
        _windowStartDay = _computeWindowStartForDay(_localPlanDetails.displayCurrentDay);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = _localPlanDetails.plan;
    final subscription = _localPlanDetails.subscription;
    final progressPercent = _currentProgressPercent;
    final displayDay = _localPlanDetails.displayCurrentDay;
  final isComplete = _localPlanDetails.isComplete;

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      color: const Color.fromRGBO(65, 65, 65, 1),
      child: Column(
        children: [
          // Header
          InkWell(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color.fromRGBO(100, 80, 200, 0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.auto_stories,
                          color: Color.fromRGBO(150, 130, 255, 1),
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              plan.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Day $displayDay of ${plan.duration}',
                              style: const TextStyle(
                                color: Color.fromRGBO(180, 180, 180, 1),
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.more_vert),
                        color: Colors.white,
                        onPressed: () => _showOptionsMenu(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Progress bar
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Overall Progress',
                            style: TextStyle(
                              color: Color.fromRGBO(180, 180, 180, 1),
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            '${progressPercent.toStringAsFixed(0)}%',
                            style: const TextStyle(
                              color: Color.fromRGBO(150, 130, 255, 1),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TweenAnimationBuilder<double>(
                        tween: Tween<double>(
                          begin: _previousProgressPercent,
                          end: progressPercent,
                        ),
                        duration: const Duration(milliseconds: 400),
                        curve: Curves.easeInOut,
                        onEnd: () {
                          _previousProgressPercent = _currentProgressPercent;
                        },
                        builder: (context, value, child) {
                          return ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: LinearProgressIndicator(
                              value: value / 100,
                              backgroundColor: const Color.fromRGBO(80, 80, 80, 1),
                              valueColor: const AlwaysStoppedAnimation<Color>(
                                Color.fromRGBO(150, 130, 255, 1),
                              ),
                              minHeight: 8,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 350),
                    switchInCurve: Curves.easeOutCubic,
                    switchOutCurve: Curves.easeInCubic,
                    transitionBuilder: (child, animation) {
                      final curved = CurvedAnimation(parent: animation, curve: Curves.easeInOut);
                      return FadeTransition(
                        opacity: curved,
                        child: SizeTransition(
                          sizeFactor: curved,
                          axisAlignment: -1.0,
                          child: child,
                        ),
                      );
                    },
                    child: isComplete
                        ? Column(
                            key: const ValueKey('complete_banner'),
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const SizedBox(height: 12),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: _isRestarting ? null : _promptRestartPlan,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color.fromRGBO(150, 130, 255, 1),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                  ),
                                  icon: _isRestarting
                                      ? SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            valueColor: AlwaysStoppedAnimation<Color>(
                                              Colors.white,
                                            ),
                                          ),
                                        )
                                      : const Icon(Icons.refresh),
                                  label: Text(_isRestarting ? 'Restarting…' : 'Restart Plan'),
                                ),
                              ),
                              const SizedBox(height: 12),
                            ],
                          )
                        : const SizedBox.shrink(key: ValueKey('complete_banner_hidden')),
                  ),

                  // Expand/Collapse indicator
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _isExpanded ? Icons.expand_less : Icons.expand_more,
                        color: const Color.fromRGBO(150, 130, 255, 1),
                      ),
                      Text(
                        _isExpanded ? 'Hide Details' : 'View Details',
                        style: const TextStyle(
                          color: Color.fromRGBO(150, 130, 255, 1),
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Expandable accordion content
          if (_isExpanded)
            Container(
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: Color.fromRGBO(80, 80, 80, 1),
                    width: 1,
                  ),
                ),
              ),
              child: _buildDaysList(plan, subscription),
            ),
        ],
      ),
    );
  }

  Widget _buildDaysList(BiblePlan plan, UserBiblePlanSubscription subscription) {
    // Determine window bounds
    final total = plan.duration;
      final start = _windowStartDay.clamp(1, total).toInt();
      final end = (_windowStartDay + _daysPageSize - 1).clamp(1, total).toInt();

    // Header with paging controls
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left),
                color: Colors.white,
                  tooltip: 'Previous $_daysPageSize days',
                onPressed: start > 1
                    ? () => setState(() {
                          _windowStartDay = (_windowStartDay - _daysPageSize).clamp(1, total);
                        })
                    : null,
              ),
              Text(
                  'Days $start - $end',
                style: const TextStyle(color: Color.fromRGBO(200, 200, 200, 1)),
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right),
                color: Colors.white,
                  tooltip: 'Next $_daysPageSize days',
                onPressed: end < total
                    ? () => setState(() {
                          _windowStartDay = (_windowStartDay + _daysPageSize).clamp(1, total);
                        })
                    : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: end - start + 1,
          itemBuilder: (context, index) {
            final day = start + index;
            final readings = plan.getReadingsForDay(day);
            final dayProgress = subscription.getProgressForDay(day);
            final dayDate = _localPlanDetails.dateForDay(day);
            final dateLabel = DateFormat('MMM d').format(dayDate);
            final isRestDay = readings.isEmpty;

            return _DayExpansionTile(
              key: ValueKey('${widget.planWithDetails.subscription.planId}_day_$day'),
              day: day,
              readings: readings,
              progress: dayProgress,
              dateLabel: dateLabel,
              isRestDay: isRestDay,
              isUnlocked: _localPlanDetails.isDayUnlocked(day),
              onPassageToggle: _handlePassageToggle,
            );
          },
        ),
      ],
    );
  }

  int _computeWindowStartForDay(int day) {
    if (day <= 0) return 1;
    final zeroBased = day - 1;
    final pageIndex = zeroBased ~/ _daysPageSize;
    return pageIndex * _daysPageSize + 1;
  }

  Future<void> _handlePassageToggle(
    int day,
    String passageId,
    List<String> currentCompleted,
    int totalPassages,
  ) async {
    // Optimistic update - toggle locally first
    setState(() {
      _isUpdating = true;
      final updatedCompleted = List<String>.from(currentCompleted);
      if (updatedCompleted.contains(passageId)) {
        updatedCompleted.remove(passageId);
      } else {
        updatedCompleted.add(passageId);
      }
      
      final isCompleted = updatedCompleted.length == totalPassages;
      
      // Find and update the day progress in local state
      final progressList = List<DayProgress>.from(_localPlanDetails.subscription.progress);
      final dayIndex = progressList.indexWhere((p) => p.day == day);
      
      if (dayIndex >= 0) {
        progressList[dayIndex] = DayProgress(
          day: day,
          completedPassages: updatedCompleted,
          isCompleted: isCompleted,
        );
      } else {
        progressList.add(DayProgress(
          day: day,
          completedPassages: updatedCompleted,
          isCompleted: isCompleted,
        ));
      }
      
      // Update local subscription
      final updatedDetails = UserBiblePlanWithDetails(
        plan: _localPlanDetails.plan,
        subscription: _localPlanDetails.subscription.copyWith(
          progress: progressList,
        ),
      );

      final newPercent = updatedDetails.progressPercentage;
      if (newPercent != _currentProgressPercent) {
        _previousProgressPercent = _currentProgressPercent;
        _currentProgressPercent = newPercent;
      }

      _localPlanDetails = updatedDetails;
    });
    
    try {
      // Send update to backend
      await _service.togglePassageCompletion(
        planId: widget.planWithDetails.subscription.planId,
        day: day,
        passageId: passageId,
        currentCompletedPassages: currentCompleted,
        totalPassagesForDay: totalPassages,
      );
      
      // Refresh parent data in background without affecting our expanded state
      widget.onProgressUpdate();
    } catch (e) {
      // Revert on error
      setState(() {
        final revertPercent = widget.planWithDetails.progressPercentage;
        if (revertPercent != _currentProgressPercent) {
          _previousProgressPercent = _currentProgressPercent;
          _currentProgressPercent = revertPercent;
        }
        _localPlanDetails = widget.planWithDetails;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error updating progress: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUpdating = false;
        });
      }
    }
  }

  Future<void> _promptRestartPlan() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color.fromRGBO(65, 65, 65, 1),
        title: const Text(
          'Restart Plan?',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'Restarting will reset your progress and set your start date to today. Are you sure you want to restart? ',
          style: TextStyle(color: Color.fromRGBO(200, 200, 200, 1)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(
              foregroundColor: const Color.fromRGBO(150, 130, 255, 1),
            ),
            child: const Text('Restart'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _restartPlan();
    }
  }

  Future<void> _restartPlan() async {
    if (_isRestarting) return;

    setState(() {
      _isRestarting = true;
    });

    try {
      final requestedStart = DateTime.now();
      final effectiveStart = await _service.restartPlan(
        planId: widget.planWithDetails.subscription.planId,
        startDate: requestedStart,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        final updatedSubscription = _localPlanDetails.subscription.copyWith(
          startDate: effectiveStart,
          progress: [],
        );
        _localPlanDetails = UserBiblePlanWithDetails(
          plan: _localPlanDetails.plan,
          subscription: updatedSubscription,
        );
        _previousProgressPercent = _currentProgressPercent;
        _currentProgressPercent = 0;
        _isRestarting = false;
      });

      widget.onProgressUpdate();

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Plan restarted from day 1'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isRestarting = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error restarting plan: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showOptionsMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color.fromRGBO(65, 65, 65, 1),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.notifications, color: Colors.white),
                title: const Text(
                  'Notification Settings',
                  style: TextStyle(color: Colors.white),
                ),
                onTap: () {
                  Navigator.pop(context);
                  _showNotificationSettings();
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete, color: Colors.red),
                title: const Text(
                  'Unsubscribe from Plan',
                  style: TextStyle(color: Colors.red),
                ),
                onTap: () {
                  Navigator.pop(context);
                  widget.onDelete();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showNotificationSettings() {
    final subscription = widget.planWithDetails.subscription;
    
    showDialog(
      context: context,
      builder: (context) => _NotificationSettingsDialog(
        subscription: subscription,
        onSave: (time, enabled) async {
          try {
            await _service.updateNotificationSettings(
              planId: subscription.planId,
              notificationTime: time,
              notificationEnabled: enabled,
            );
            widget.onProgressUpdate();
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Notification settings updated'),
                  backgroundColor: Colors.green,
                ),
              );
            }
          } catch (e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Error: ${e.toString()}'),
                  backgroundColor: Colors.red,
                ),
              );
            }
          }
        },
      ),
    );
  }

  bool _areProgressListsEqual(List<DayProgress> a, List<DayProgress> b) {
    if (identical(a, b)) {
      return true;
    }

    if (a.length != b.length) {
      return false;
    }

    final sortedA = [...a]..sort((first, second) => first.day.compareTo(second.day));
    final sortedB = [...b]..sort((first, second) => first.day.compareTo(second.day));

    for (var i = 0; i < sortedA.length; i++) {
      final aProgress = sortedA[i];
      final bProgress = sortedB[i];

      if (aProgress.day != bProgress.day) {
        return false;
      }

      if (aProgress.isCompleted != bProgress.isCompleted) {
        return false;
      }

      if (!listEquals(aProgress.completedPassages, bProgress.completedPassages)) {
        return false;
      }
    }

    return true;
  }
}

/// Dialog for editing notification settings
class _NotificationSettingsDialog extends StatefulWidget {
  final UserBiblePlanSubscription subscription;
  final Function(String?, bool) onSave;

  const _NotificationSettingsDialog({
    required this.subscription,
    required this.onSave,
  });

  @override
  State<_NotificationSettingsDialog> createState() => _NotificationSettingsDialogState();
}

class _NotificationSettingsDialogState extends State<_NotificationSettingsDialog> {
  late bool _enabled;
  late TimeOfDay _time;

  @override
  void initState() {
    super.initState();
    _enabled = widget.subscription.notificationEnabled;
    
    // Parse notification time or default to 8:00 AM
    if (widget.subscription.notificationTime != null) {
      final parts = widget.subscription.notificationTime!.split(':');
      _time = TimeOfDay(
        hour: int.parse(parts[0]),
        minute: int.parse(parts[1]),
      );
    } else {
      _time = const TimeOfDay(hour: 8, minute: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color.fromRGBO(65, 65, 65, 1),
      title: const Text(
        'Notification Settings',
        style: TextStyle(color: Colors.white),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SwitchListTile(
            value: _enabled,
            onChanged: (value) => setState(() => _enabled = value),
            title: const Text(
              'Daily Reminder',
              style: TextStyle(color: Colors.white),
            ),
            activeColor: const Color.fromRGBO(150, 130, 255, 1),
          ),
          if (_enabled) ...[
            const SizedBox(height: 16),
            ListTile(
              title: const Text(
                'Reminder Time',
                style: TextStyle(color: Colors.white),
              ),
              subtitle: Text(
                _time.format(context),
                style: const TextStyle(color: Color.fromRGBO(180, 180, 180, 1)),
              ),
              trailing: const Icon(Icons.access_time, color: Color.fromRGBO(150, 130, 255, 1)),
              onTap: _selectTime,
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () {
            final timeString = _enabled 
                ? '${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}'
                : null;
            widget.onSave(timeString, _enabled);
            Navigator.pop(context);
          },
          child: const Text('Save'),
        ),
      ],
    );
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _time,
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color.fromRGBO(150, 130, 255, 1),
              onPrimary: Colors.white,
              surface: Color.fromRGBO(65, 65, 65, 1),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _time = picked;
      });
    }
  }
}

/// Individual day expansion tile with independent state management
class _DayExpansionTile extends StatefulWidget {
  final int day;
  final List<BiblePassage> readings;
  final DayProgress? progress;
  final String dateLabel;
  final bool isRestDay;
  final bool isUnlocked;
  final Future<void> Function(int day, String passageId, List<String> currentCompleted, int totalPassages) onPassageToggle;

  const _DayExpansionTile({
    super.key,
    required this.day,
    required this.readings,
    required this.progress,
    required this.dateLabel,
    required this.isRestDay,
    required this.isUnlocked,
    required this.onPassageToggle,
  });

  @override
  State<_DayExpansionTile> createState() => _DayExpansionTileState();
}

class _DayExpansionTileState extends State<_DayExpansionTile> {
  late DayProgress? _localProgress;
  bool _isUpdating = false;

  @override
  void initState() {
    super.initState();
    _localProgress = widget.progress;
  }

  @override
  void didUpdateWidget(_DayExpansionTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Update local progress when parent data changes, but only if we're not currently updating
    if (!_isUpdating) {
      setState(() {
        _localProgress = widget.progress;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCompleted = _localProgress?.isCompleted ?? false;
    final completedPassages = _localProgress?.completedPassages ?? [];
    final isLocked = !widget.isUnlocked;
    final isRestDay = widget.isRestDay;

    return ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      childrenPadding: const EdgeInsets.only(left: 20, right: 20, bottom: 12),
      title: Row(
        children: [
          Icon(
            isRestDay
                ? Icons.do_not_disturb_on
                : (isCompleted
                    ? Icons.check_circle
                    : Icons.radio_button_unchecked),
            color: isRestDay
                ? const Color.fromRGBO(255, 193, 7, 1)
                : (isCompleted
                    ? const Color.fromRGBO(120, 200, 150, 1)
                    : (isLocked
                        ? const Color.fromRGBO(90, 90, 90, 1)
                        : const Color.fromRGBO(120, 120, 120, 1))),
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Day ${widget.day}, ${widget.dateLabel}',
              style: TextStyle(
                color: isRestDay
                    ? Colors.white
                    : (isLocked
                        ? const Color.fromRGBO(150, 150, 150, 1)
                        : (isCompleted
                            ? Colors.white
                            : const Color.fromRGBO(200, 200, 200, 1))),
                fontWeight: isCompleted && !isLocked && !isRestDay
                    ? FontWeight.w600
                    : FontWeight.w500,
                fontSize: 15,
              ),
            ),
          ),
          Text(
            '${completedPassages.length}/${widget.readings.length}',
            style: TextStyle(
              color: isRestDay
                  ? const Color.fromRGBO(255, 213, 79, 1)
                  : (isCompleted
                      ? const Color.fromRGBO(120, 200, 150, 1)
                      : (isLocked
                          ? const Color.fromRGBO(110, 110, 110, 1)
                          : const Color.fromRGBO(150, 150, 150, 1))),
              fontSize: 13,
            ),
          ),
          if (isLocked)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color.fromRGBO(80, 80, 80, 1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Locked',
                  style: TextStyle(
                    color: Color.fromRGBO(200, 200, 200, 1),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          if (isRestDay)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color.fromRGBO(255, 215, 64, 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: const Color.fromRGBO(255, 213, 79, 1),
                    width: 1,
                  ),
                ),
                child: const Text(
                  'Rest Day',
                  style: TextStyle(
                    color: Color.fromRGBO(255, 213, 79, 1),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
      iconColor: const Color.fromRGBO(150, 130, 255, 1),
      collapsedIconColor: const Color.fromRGBO(150, 130, 255, 1),
      children: _buildChildren(isLocked, completedPassages, isRestDay),
    );
  }

  List<Widget> _buildChildren(bool isLocked, List<String> completedPassages, bool isRestDay) {
    final items = <Widget>[];

    if (isRestDay) {
      items.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Text(
            'Enjoy a moment of rest. This day has no assigned readings.',
            style: const TextStyle(
              color: Color.fromRGBO(200, 200, 200, 1),
              fontSize: 14,
            ),
          ),
        ),
      );
      return items;
    }

    if (isLocked) {
      items.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 4, right: 4, top: 4),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Complete previous days to unlock Day ${widget.day}.',
              style: const TextStyle(
                color: Color.fromRGBO(190, 190, 190, 1),
                fontSize: 13,
              ),
            ),
          ),
        ),
      );
    }

    items.addAll(widget.readings.map((passage) {
      final isPassageCompleted = completedPassages.contains(passage.id);
      return _buildPassageTile(
        passage,
        isPassageCompleted,
        completedPassages,
        isLocked,
      );
    }));

    return items;
  }

  Widget _buildPassageTile(
    BiblePassage passage,
    bool isCompleted,
    List<String> currentCompletedPassages,
    bool isLocked,
  ) {
    return CheckboxListTile(
      dense: true,
      value: isCompleted,
      onChanged: isLocked
          ? null
          : (value) => _handlePassageToggle(
                passage.id,
                currentCompletedPassages,
              ),
      title: Text(
        passage.reference,
        style: TextStyle(
          color: isLocked
              ? const Color.fromRGBO(140, 140, 140, 1)
              : (isCompleted
                  ? const Color.fromRGBO(180, 180, 180, 1)
                  : const Color.fromRGBO(220, 220, 220, 1)),
          decoration: isCompleted && !isLocked ? TextDecoration.lineThrough : null,
          fontSize: 14,
        ),
      ),
      controlAffinity: ListTileControlAffinity.leading,
      activeColor: const Color.fromRGBO(150, 130, 255, 1),
      checkColor: Colors.white,
    );
  }

  Future<void> _handlePassageToggle(
    String passageId,
    List<String> currentCompleted,
  ) async {
    if (!widget.isUnlocked) {
      return;
    }

    // Optimistic update - toggle locally first
    setState(() {
      _isUpdating = true;
      final updatedCompleted = List<String>.from(currentCompleted);
      if (updatedCompleted.contains(passageId)) {
        updatedCompleted.remove(passageId);
      } else {
        updatedCompleted.add(passageId);
      }
      
      final isCompleted = updatedCompleted.length == widget.readings.length;
      
      _localProgress = DayProgress(
        day: widget.day,
        completedPassages: updatedCompleted,
        isCompleted: isCompleted,
      );
    });
    
    try {
      // Send update to backend
      await widget.onPassageToggle(
        widget.day,
        passageId,
        currentCompleted,
        widget.readings.length,
      );
    } catch (e) {
      // Revert on error
      setState(() {
        _localProgress = widget.progress;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error updating progress: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUpdating = false;
        });
      }
    }
  }
}
