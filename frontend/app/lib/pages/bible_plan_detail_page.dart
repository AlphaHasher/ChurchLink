import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/bible_plan.dart';
import '../services/bible_plan_service.dart';
import '../widgets/days_pagination_header.dart';
import '../widgets/day_preview_card.dart';
import '../widgets/days_window.dart';

/// Detail page for a Bible plan where users can view and subscribe
class BiblePlanDetailPage extends StatefulWidget {
  final BiblePlan plan;
  final UserBiblePlanSubscription? existingSubscription;

  const BiblePlanDetailPage({
    super.key,
    required this.plan,
    this.existingSubscription,
  });

  @override
  State<BiblePlanDetailPage> createState() => _BiblePlanDetailPageState();
}

class _BiblePlanDetailPageState extends State<BiblePlanDetailPage> {
  final BiblePlanService _service = BiblePlanService();
  final _formKey = GlobalKey<FormState>();
  
  DateTime _selectedStartDate = DateTime.now();
  TimeOfDay _selectedNotificationTime = const TimeOfDay(hour: 8, minute: 0);
  bool _notificationEnabled = true;
  bool _isSubscribing = false;

  // pagination is handled by DaysWindow widget

  bool get _isAlreadySubscribed => widget.existingSubscription != null;

  @override
  void initState() {
    super.initState();

    final existing = widget.existingSubscription;
    if (existing != null) {
      _selectedStartDate = existing.startDate;
      _notificationEnabled = existing.notificationEnabled;
      if (existing.notificationTime != null) {
        final parts = existing.notificationTime!.split(':');
        if (parts.length >= 2) {
          final hour = int.tryParse(parts[0]);
          final minute = int.tryParse(parts[1]);
          if (hour != null && minute != null) {
            _selectedNotificationTime = TimeOfDay(hour: hour, minute: minute);
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: Text(
          widget.plan.name,
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Header section
            _buildHeaderSection(),
            
            // Plan details
            _buildDetailsSection(),
            
            // Reading preview
            _buildReadingPreviewSection(),
            
            // Subscription form
            if (_isAlreadySubscribed)
              _buildAlreadySubscribedBanner()
            else
              _buildSubscriptionForm(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderSection() {
  return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Theme.of(context).colorScheme.primary,
            Theme.of(context).colorScheme.primary,
          ],
        ),
      ),
      child: Column(
        children: [
          Icon(
            Icons.auto_stories,
            size: 64,
            color: Theme.of(context).colorScheme.onPrimary,
          ),
          const SizedBox(height: 16),
          Text(
            widget.plan.name,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onPrimary,
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(20),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${widget.plan.duration} Day Reading Plan',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailsSection() {
    final totalReadings = _getTotalReadings();
    final averagePerDay = (totalReadings / widget.plan.duration).ceil();

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Plan Overview',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildDetailRow(Icons.calendar_today, 'Duration', '${widget.plan.duration} days'),
          const SizedBox(height: 12),
          _buildDetailRow(Icons.menu_book, 'Total Readings', '$totalReadings passages'),
          const SizedBox(height: 12),
          _buildDetailRow(Icons.analytics, 'Average per Day', '~$averagePerDay passages'),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.primary, size: 20),
        const SizedBox(width: 12),
        Text(
          '$label: ',
          style: const TextStyle(
            fontSize: 15,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            // color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: const Color.fromRGBO(120, 200, 150, 1), size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(
                  // color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildReadingPreviewSection() {
    final total = widget.plan.duration;
    // If the plan is short, show all days without pagination controls
    if (total <= 5) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 12),
              child: Text(
                'Reading Preview',
                style: TextStyle(
                  // color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            ...List.generate(total, (index) {
              final day = index + 1;
              final readings = widget.plan.getReadingsForDay(day);
              return _buildDayPreviewCard(day, readings);
            }),
          ],
        ),
      );
    }

    // Paged window with header controls for longer plans
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 12),
            child: Text(
              'Reading Preview',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          DaysWindow(
            storageKey: 'plan_detail_window_${widget.plan.id}',
            totalDays: total,
            pageSize: 5,
            initialDay: 1,
            builder: (context, start, end, onPrev, onNext) {
              return Column(
                children: [
                  DaysPaginationHeader(
                    start: start,
                    end: end,
                    total: total,
                    pageSize: 5,
                    onPrev: onPrev,
                    onNext: onNext,
                  ),
                  ...List.generate(end - start + 1, (index) {
                    final day = start + index;
                    final readings = widget.plan.getReadingsForDay(day);
                    return DayPreviewCard(day: day, readings: readings);
                  }),
                  if (end < total)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        '... and ${total - end} more days',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          fontSize: 14,
                          fontStyle: FontStyle.italic,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDayPreviewCard(int day, List<BiblePassage> readings) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        shape: const RoundedRectangleBorder(side: BorderSide(color: Colors.transparent)),
        title: Text(
          'Day $day',
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
        subtitle: Text(
          '${readings.length} passage${readings.length != 1 ? 's' : ''}',
          style: const TextStyle(
            color: Color.fromRGBO(180, 180, 180, 1),
            fontSize: 14,
          ),
        ),
        iconColor: Theme.of(context).colorScheme.primary,
        collapsedIconColor: Theme.of(context).colorScheme.primary,
        children: readings.map((passage) {
          return ListTile(
            dense: true,
            leading: Icon(
              Icons.bookmark_border,
              color: Theme.of(context).colorScheme.primary,
              size: 20,
            ),
            title: Text(
              passage.reference,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 14,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSubscriptionForm() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Start Your Journey',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Choose when to start and set your daily reminder',
              style: TextStyle(
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),
            
            // Start Date Picker
            _buildStartDatePicker(),
            const SizedBox(height: 20),
            
            // Notification Settings
            _buildNotificationSettings(),
            const SizedBox(height: 24),
            
            // Subscribe Button
            _buildSubscribeButton(),
          ],
        ),
      ),
    );
  }

  Widget _buildAlreadySubscribedBanner() {
    final subscription = widget.existingSubscription!;
    final formattedDate = DateFormat('EEEE, MMM d, yyyy').format(subscription.startDate);
    final notificationInfo = subscription.notificationEnabled
        ? (subscription.notificationTime != null
            ? 'Daily reminder at ${subscription.notificationTime}'
            : 'Daily reminder enabled')
        : 'Daily reminders disabled';

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color.fromRGBO(120, 200, 150, 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.check_circle,
                  color: Color.fromRGBO(120, 200, 150, 1),
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Already Enrolled',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'You are currently subscribed to this reading plan.',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoRow(Icons.event_available, 'Start Date', formattedDate),
          const SizedBox(height: 12),
          _buildInfoRow(Icons.notifications_active, 'Notifications', notificationInfo),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context, false);
            },
            icon: const Icon(Icons.arrow_back),
            label: const Text('Back to Plans'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color.fromRGBO(120, 200, 150, 1),
              foregroundColor: const Color.fromRGBO(40, 40, 40, 1),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStartDatePicker() {
    return InkWell(
      onTap: _selectStartDate,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              Icons.calendar_today,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Start Date',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('EEEE, MMM d, yyyy').format(_selectedStartDate),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationSettings() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Daily Reminder',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            Switch(
              value: _notificationEnabled,
              onChanged: (value) {
                setState(() {
                  _notificationEnabled = value;
                });
              },
            ),
          ],
        ),
        if (_notificationEnabled) ...[
          const SizedBox(height: 12),
          InkWell(
            onTap: _selectNotificationTime,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.alarm,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Reminder Time',
                          style: TextStyle(
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _selectedNotificationTime.format(context),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.arrow_forward_ios,
                    size: 16,
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSubscribeButton() {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: _isSubscribing ? null : _handleSubscribe,
        style: ElevatedButton.styleFrom(
          backgroundColor: Theme.of(context).colorScheme.primary,
          disabledBackgroundColor: const Color.fromRGBO(100, 100, 100, 1),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 0,
        ),
        child: _isSubscribing
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              )
            : Text(
                'Start Reading Plan',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.onPrimary,
                ),
              ),
      ),
    );
  }

  Future<void> _selectStartDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedStartDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        final theme = Theme.of(context);
        return Theme(data: theme, child: child!);
      },
    );

    if (picked != null && picked != _selectedStartDate) {
      setState(() {
        _selectedStartDate = picked;
      });
    }
  }

  Future<void> _selectNotificationTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _selectedNotificationTime,
      builder: (context, child) {
        final theme = Theme.of(context);
        return Theme(data: theme, child: child!);
      },
    );

    if (picked != null && picked != _selectedNotificationTime) {
      setState(() {
        _selectedNotificationTime = picked;
      });
    }
  }

  Future<void> _handleSubscribe() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubscribing = true;
    });

    try {
      final notificationTime = _notificationEnabled
          ? '${_selectedNotificationTime.hour.toString().padLeft(2, '0')}:${_selectedNotificationTime.minute.toString().padLeft(2, '0')}'
          : null;

      final success = await _service.subscribeToPlan(
        planId: widget.plan.id,
        startDate: _selectedStartDate,
        notificationTime: notificationTime,
        notificationEnabled: _notificationEnabled,
      );

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Successfully subscribed to reading plan!',
              ),
            backgroundColor: Theme.of(context).colorScheme.primary,
          ),
        );
        Navigator.pop(context, true); // Return true to indicate success
      } else {
        throw Exception('Failed to subscribe');
      }
    } catch (e) {
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubscribing = false;
        });
      }
    }
  }

  int _getTotalReadings() {
    int total = 0;
    for (var dayReadings in widget.plan.readings.values) {
      total += dayReadings.length;
    }
    return total;
  }
}
