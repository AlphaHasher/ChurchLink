import 'package:flutter/material.dart';
import 'package:app/services/bible_plan_service.dart';
import 'package:app/services/notification_preferences_service.dart';
import 'package:app/helpers/logger.dart';

/// Widget for managing Bible plan notification settings
class BiblePlanNotificationSettings extends StatefulWidget {
  final String planId;
  final String planName;
  final String? currentNotificationTime;
  final bool currentNotificationEnabled;
  final VoidCallback? onSettingsChanged;

  const BiblePlanNotificationSettings({
    super.key,
    required this.planId,
    required this.planName,
    this.currentNotificationTime,
    required this.currentNotificationEnabled,
    this.onSettingsChanged,
  });

  @override
  State<BiblePlanNotificationSettings> createState() => _BiblePlanNotificationSettingsState();
}

class _BiblePlanNotificationSettingsState extends State<BiblePlanNotificationSettings> {
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
      final timeString = '${_notificationTime.hour.toString().padLeft(2, '0')}:'
          '${_notificationTime.minute.toString().padLeft(2, '0')}:00';

      // Get user's timezone
      final userTimezone = DateTime.now().timeZoneName;

      final success = await _biblePlanService.updateBiblePlanNotificationPreference(
        planId: widget.planId,
        notificationTime: _notificationEnabled ? timeString : null,
        notificationEnabled: _notificationEnabled,
        userTimezone: userTimezone,
      );

      if (success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Notification settings updated successfully'),
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
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: false),
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
      margin: const EdgeInsets.all(16.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.notifications, color: Colors.blue),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Notification Settings',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Device-level notification toggle
            if (!_deviceNotificationsEnabled) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.withAlpha(10),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.withAlpha(30)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.warning, color: Colors.orange, size: 20),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'Bible plan notifications are disabled on this device',
                            style: TextStyle(fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _toggleDeviceNotifications,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.orange,
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Enable on this device'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Plan-level notification settings
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Daily reminders for ${widget.planName}',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
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
            ),
            
            if (_notificationEnabled && _deviceNotificationsEnabled) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  const Icon(Icons.access_time, size: 20),
                  const SizedBox(width: 8),
                  const Text('Notification time:'),
                  const Spacer(),
                  InkWell(
                    onTap: _isLoading ? null : _selectTime,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Theme.of(context).primaryColor.withAlpha(10),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Theme.of(context).primaryColor.withAlpha(30),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _formatTime(_notificationTime),
                            style: TextStyle(
                              color: Theme.of(context).primaryColor,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            Icons.edit,
                            size: 16,
                            color: Theme.of(context).primaryColor,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'You\'ll receive a daily reminder at ${_formatTime(_notificationTime)} to read your Bible plan.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey[600],
                ),
              ),
            ],
            
            if (_isLoading) ...[
              const SizedBox(height: 16),
              const Center(
                child: CircularProgressIndicator(),
              ),
            ],

            // Device settings link
            const SizedBox(height: 16),
            InkWell(
              onTap: _toggleDeviceNotifications,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Row(
                  children: [
                    Icon(
                      Icons.settings,
                      size: 20,
                      color: Theme.of(context).primaryColor,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Device notification settings',
                      style: TextStyle(
                        color: Theme.of(context).primaryColor,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      _deviceNotificationsEnabled ? Icons.notifications_active : Icons.notifications_off,
                      size: 20,
                      color: _deviceNotificationsEnabled ? Colors.green : Colors.grey,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}