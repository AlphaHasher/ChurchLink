import 'package:flutter/material.dart';
import 'package:app/services/bible_plan_service.dart';
import 'package:app/services/notification_preferences_service.dart';
import 'package:app/helpers/logger.dart';

/// Compact notification preferences card for Bible plans
class BiblePlanNotificationCard extends StatefulWidget {
  final String planId;
  final String planName;
  final String? currentNotificationTime;
  final bool currentNotificationEnabled;
  final VoidCallback? onSettingsChanged;

  const BiblePlanNotificationCard({
    super.key,
    required this.planId,
    required this.planName,
    this.currentNotificationTime,
    required this.currentNotificationEnabled,
    this.onSettingsChanged,
  });

  @override
  State<BiblePlanNotificationCard> createState() => _BiblePlanNotificationCardState();
}

class _BiblePlanNotificationCardState extends State<BiblePlanNotificationCard> {
  final BiblePlanService _biblePlanService = BiblePlanService();
  final NotificationPreferencesService _notificationService = NotificationPreferencesService();
  
  late bool _notificationEnabled;
  late TimeOfDay _notificationTime;
  bool _isLoading = false;
  bool _deviceNotificationsEnabled = true;

  @override
  void initState() {
    super.initState();
    _notificationEnabled = widget.currentNotificationEnabled;
    
    // Parse current notification time or default to 9:00 AM
    if (widget.currentNotificationTime != null) {
      final timeParts = widget.currentNotificationTime!.split(':');
      _notificationTime = TimeOfDay(
        hour: int.parse(timeParts[0]),
        minute: int.parse(timeParts[1]),
      );
    } else {
      _notificationTime = const TimeOfDay(hour: 9, minute: 0);
    }
    
    _checkDeviceNotificationStatus();
  }

  Future<void> _checkDeviceNotificationStatus() async {
    try {
      final enabled = await _notificationService.areBiblePlanNotificationsEnabled();
      if (mounted) {
        setState(() {
          _deviceNotificationsEnabled = enabled;
        });
      }
    } catch (e) {
      logger.e('Error checking device notification status: $e');
    }
  }

  Future<void> _updateNotificationSettings() async {
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final timeString = _notificationEnabled 
          ? '${_notificationTime.hour.toString().padLeft(2, '0')}:'
            '${_notificationTime.minute.toString().padLeft(2, '0')}'
          : null;

      final success = await _biblePlanService.updateNotificationSettings(
        planId: widget.planId,
        notificationTime: timeString,
        notificationEnabled: _notificationEnabled,
      );

      if (success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Notification settings updated'),
              backgroundColor: Colors.green,
            ),
          );
          widget.onSettingsChanged?.call();
        }
      } else {
        throw Exception('Failed to update notification settings');
      }
    } catch (e) {
      logger.e('Error updating notification settings: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update settings: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _notificationTime,
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

    if (picked != null && picked != _notificationTime) {
      setState(() {
        _notificationTime = picked;
      });
      await _updateNotificationSettings();
    }
  }

  Future<void> _toggleDeviceNotifications() async {
    try {
      final success = await _notificationService.setBiblePlanNotifications(!_deviceNotificationsEnabled);
      if (success) {
        setState(() {
          _deviceNotificationsEnabled = !_deviceNotificationsEnabled;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                _deviceNotificationsEnabled
                    ? 'Bible plan notifications enabled on this device'
                    : 'Bible plan notifications disabled on this device',
              ),
              backgroundColor: _deviceNotificationsEnabled ? Colors.green : Colors.orange,
            ),
          );
        }
      }
    } catch (e) {
      logger.e('Error toggling device notifications: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update device settings: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  String _formatTime(TimeOfDay time) {
    final hour = time.hourOfPeriod == 0 ? 12 : time.hourOfPeriod;
    final minute = time.minute.toString().padLeft(2, '0');
    final period = time.period == DayPeriod.am ? 'AM' : 'PM';
    return '$hour:$minute $period';
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      color: const Color.fromRGBO(65, 65, 65, 1),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.notifications,
                  color: _deviceNotificationsEnabled && _notificationEnabled 
                      ? const Color.fromRGBO(150, 130, 255, 1)
                      : Colors.grey,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Daily Reminders',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (_isLoading) ...[
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ] else ...[
                  Switch.adaptive(
                    value: _notificationEnabled && _deviceNotificationsEnabled,
                    onChanged: _deviceNotificationsEnabled ? (value) async {
                      setState(() {
                        _notificationEnabled = value;
                      });
                      await _updateNotificationSettings();
                    } : null,
                    activeThumbColor: const Color.fromRGBO(150, 130, 255, 1),
                  ),
                ],
              ],
            ),
            
            if (!_deviceNotificationsEnabled) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.withAlpha(10),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.withAlpha(30)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning, color: Colors.orange, size: 20),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Bible plan notifications are disabled on this device',
                        style: TextStyle(color: Colors.orange, fontSize: 12),
                      ),
                    ),
                    TextButton(
                      onPressed: _toggleDeviceNotifications,
                      child: const Text(
                        'Enable',
                        style: TextStyle(color: Colors.orange, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            
            if (_notificationEnabled && _deviceNotificationsEnabled) ...[
              const SizedBox(height: 12),
              InkWell(
                onTap: _isLoading ? null : _selectTime,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color.fromRGBO(150, 130, 255, 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: const Color.fromRGBO(150, 130, 255, 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.access_time,
                        size: 16,
                        color: Color.fromRGBO(150, 130, 255, 1),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Reminder time: ${_formatTime(_notificationTime)}',
                        style: const TextStyle(
                          color: Color.fromRGBO(150, 130, 255, 1),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Spacer(),
                      const Icon(
                        Icons.edit,
                        size: 16,
                        color: Color.fromRGBO(150, 130, 255, 1),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}