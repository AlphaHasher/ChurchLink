import 'package:flutter/material.dart';
import 'package:app/models/bible_plan.dart';
import 'package:app/services/bible_plan_service.dart';
import 'package:app/helpers/bible_plan_auth_utils.dart';
import 'package:app/pages/bible_plan_detail_page.dart';

/// Page showing all published Bible plans available for subscription
class BiblePlansListPage extends StatefulWidget {
  const BiblePlansListPage({super.key});

  @override
  State<BiblePlansListPage> createState() => _BiblePlansListPageState();
}

class _BiblePlansListPageState extends State<BiblePlansListPage> {
  final BiblePlanService _service = BiblePlanService();
  List<BiblePlan> _publishedPlans = [];
  Map<String, UserBiblePlanSubscription> _userSubscriptions = {};
  bool _isLoading = false;
  bool _isUserLoggedIn = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkAuthAndLoadPlans();
  }

  Future<void> _checkAuthAndLoadPlans() async {
    _isUserLoggedIn = BiblePlanAuthUtils.isUserLoggedIn();
    await _loadPlans();
  }

  Future<void> _loadPlans({bool showLoader = true}) async {
    if (!mounted) return;

    setState(() {
      if (showLoader) {
        _isLoading = true;
      }
      _errorMessage = null;
    });

    try {
      // Always load published plans
      final published = await _service.getPublishedPlans();

      // Only load user subscriptions if logged in
      List<UserBiblePlanSubscription> subscriptions = [];
      if (_isUserLoggedIn) {
        try {
          subscriptions = await _service.getMyBiblePlans();
        } catch (e) {
          // user may have lost connection or auth expired - not critical here
        }
      }

      if (!mounted) return;

      setState(() {
        _publishedPlans = published;
        _userSubscriptions = {for (final sub in subscriptions) sub.planId: sub};
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to load plans. Please try again.';
        _isLoading = false;
      });
    }
  }

  Future<void> _refreshPlans() async {
    await _loadPlans(showLoader: false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: const Text('Bible Reading Plans'),
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _refreshPlans,
            child: _buildContent(context),
          ),
          if (_isLoading)
            const Positioned.fill(
              child: IgnorePointer(
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (_errorMessage != null && _publishedPlans.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 120),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 48,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(height: 16),
                Text(
                  _errorMessage!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 16,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: () => _loadPlans(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ],
      );
    }

    if (_publishedPlans.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 120),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.book_outlined,
                  size: 64,
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withAlpha(50),
                ),
                const SizedBox(height: 16),
                Text(
                  'No Bible Plans Available',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Check back later for new reading plans',
                  style: TextStyle(
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withAlpha(70),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _publishedPlans.length,
      itemBuilder: (context, index) {
        final plan = _publishedPlans[index];
        final subscription = _userSubscriptions[plan.id];
        return _BiblePlanCard(
          plan: plan,
          isEnrolled: subscription != null,
          onTap: () => _navigateToPlanDetail(plan, subscription),
        );
      },
    );
  }

  Future<void> _navigateToPlanDetail(
    BiblePlan plan,
    UserBiblePlanSubscription? existingSubscription,
  ) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (context) => BiblePlanDetailPage(
              plan: plan,
              existingSubscription: existingSubscription,
            ),
      ),
    );

    // If user subscribed successfully, return true to parent and close this page
    if (result == true && mounted) {
      Navigator.pop(context, true);
    } else if (result == false) {
      // If detail page indicates changes without navigation pop (e.g., unsubscribe), refresh
      await _refreshPlans();
    }
  }
}

/// Card widget for displaying a Bible plan in the list
class _BiblePlanCard extends StatelessWidget {
  final BiblePlan plan;
  final bool isEnrolled;
  final VoidCallback onTap;

  const _BiblePlanCard({
    required this.plan,
    required this.onTap,
    this.isEnrolled = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with icon and duration badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.auto_stories,
                            color: Theme.of(context).colorScheme.onPrimary,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                plan.name,
                                style: Theme.of(
                                  context,
                                ).textTheme.titleMedium?.copyWith(
                                  color:
                                      Theme.of(context).colorScheme.onSurface,
                                  fontWeight: FontWeight.bold,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (isEnrolled) ...[
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color:
                                        Theme.of(context).colorScheme.primary,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    'Currently Enrolled',
                                    style: TextStyle(
                                      color:
                                          Theme.of(
                                            context,
                                          ).colorScheme.onPrimary,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF445A64),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFF263238),
                        width: 1,
                      ),
                    ),
                    child: Text(
                      '${plan.duration} Days',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Action button
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      gradient:
                          isEnrolled
                              ? LinearGradient(
                                colors: [
                                  Color.fromRGBO(90, 90, 90, 1),
                                  Color.fromRGBO(120, 120, 120, 1),
                                ],
                              )
                              : LinearGradient(
                                colors: [
                                  Color.fromRGBO(100, 80, 200, 1),
                                  Color.fromRGBO(150, 130, 255, 1),
                                ],
                              ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          isEnrolled ? 'Review Plan' : 'View Plan',
                          style: Theme.of(
                            context,
                          ).textTheme.labelLarge?.copyWith(
                            color: Theme.of(context).colorScheme.onPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          Icons.arrow_forward_ios,
                          color: Theme.of(context).colorScheme.onPrimary,
                          size: 14,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
