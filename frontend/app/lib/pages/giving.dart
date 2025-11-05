import 'package:flutter/material.dart';
import 'package:app/services/paypal_service.dart';
import 'package:app_links/app_links.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:developer';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';


class Giving extends StatefulWidget {
  const Giving({super.key});

  @override
  State<Giving> createState() => _GivingState();
}

class _GivingState extends State<Giving> {
  bool _loading = false;
  String? _message;
  
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _messageController = TextEditingController();
  String? _accountEmail; 
  String _purpose = 'General';
  List<String> _fundPurposes = ['General']; // Default value while loading
  bool _isSubscription = false;
  String _intervalUnit = 'MONTH';
  int _intervalCount = 1;
  int _cycles = 12; 
  AppLinks? _appLinks;
  StreamSubscription<Uri>? _linkSubscription;
  DateTime? _startDate; 

  @override
  void initState() {
    super.initState();
    _appLinks = AppLinks();
    _linkSubscription = _appLinks!.uriLinkStream.listen((uri) async {
      log('[DeepLink] Received deep link: $uri');
      if (!mounted) return;
      
      if (uri.scheme == 'churchlink' && uri.host == 'paypal-success') {
        log('[DeepLink] PayPal success deep link detected');
        if (!mounted) return;
        
        // Extract PayPal parameters from the URI
        final paymentId = uri.queryParameters['paymentId'] ?? uri.queryParameters['payment_id'];
        final payerId = uri.queryParameters['PayerID'] ?? uri.queryParameters['payer_id'];
        final token = uri.queryParameters['token'];
        
        log('[DeepLink] Extracted parameters - paymentId: $paymentId, payerId: $payerId, token: $token');
        
        // Check if this is an event payment by looking for eventId in path or query parameters
        String? eventId = uri.queryParameters['eventId'] ?? uri.queryParameters['event_id'];
        
        // If not in query parameters, check if it's in the path (new format: churchlink://paypal-success/eventId)
        if (eventId == null && uri.pathSegments.isNotEmpty) {
          eventId = uri.pathSegments.first;
        }
        
        log('[DeepLink] Extracted eventId: $eventId');
        
        if (eventId != null && paymentId != null && payerId != null) {
          // This is an event payment completion
          try {
            log('[DeepLink] Event payment detected - eventId: $eventId, paymentId: $paymentId, payerId: $payerId');
            
            // Check if this is a bulk registration by looking for pending bulk registration data
            final pendingBulkData = await _getPendingBulkRegistration();
            log('[DeepLink] Pending bulk data: $pendingBulkData');
            log('[DeepLink] Bulk data exists: ${pendingBulkData != null}');
            if (pendingBulkData != null) {
              log('[DeepLink] Bulk data eventId: ${pendingBulkData['eventId']}, current eventId: $eventId');
              log('[DeepLink] EventId match: ${pendingBulkData['eventId'] == eventId}');
            }
            
            if (pendingBulkData != null && pendingBulkData['eventId'] == eventId) {
              // This is a bulk registration completion
              log('[DeepLink] Processing bulk registration completion');
              final registrations = pendingBulkData['registrations'] as List<dynamic>;
              final result = await PaypalService.completeBulkEventRegistration(
                eventId: eventId,
                registrations: registrations.cast<Map<String, dynamic>>(),
                paymentId: paymentId,
                payerId: payerId,
              );
              
              log('[DeepLink] Bulk registration API result: $result');
              
              // Clear pending data
              await _clearPendingBulkRegistration();
              
              if (result != null && result['success'] == true) {
                log('[DeepLink] Bulk registration completed successfully');
                // Close any open dialogs and clear navigation stack
                if (!mounted) return;
                Navigator.of(context).popUntil((route) => route.isFirst);

                // Navigate to events list, replacing the current route
                Navigator.of(context).pushNamedAndRemoveUntil(
                  '/events',
                  (route) => false, // Remove all previous routes
                );

                // Show success message after navigation
                final numberOfPeople = registrations.length;
                Future.delayed(Duration(milliseconds: 800), () {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        '✅ Successfully registered $numberOfPeople ${numberOfPeople == 1 ? 'person' : 'people'} for the event!',
                      ),
                      duration: Duration(seconds: 4),
                    ),
                  );
                });
              } else {
                log('[DeepLink] Bulk registration failed: ${result?['error']}');
                _showEventPaymentErrorDialog(result?['error'] ?? 'Bulk registration failed');
              }
            } else {
              // Single event payment
              log('[DeepLink] Processing single event payment completion');
              
              // Get current user email for registration
              final userEmail = FirebaseAuth.instance.currentUser?.email;
              log('[DeepLink] Current user email: $userEmail');
              
              final result = await PaypalService.completeEventPayment(
                eventId: eventId,
                paymentId: paymentId,
                payerId: payerId,
                userEmail: userEmail,
              );
              
              log('[DeepLink] Single event payment API result: $result');
              
                if (result != null && result['success'] == true) {
                log('[DeepLink] Single event payment completed successfully');
                // Close any open dialogs and clear navigation stack
                if (!mounted) return;
                Navigator.of(context).popUntil((route) => route.isFirst);

                // Navigate to events list, replacing the current route
                Navigator.of(context).pushNamedAndRemoveUntil(
                  '/events',
                  (route) => false, // Remove all previous routes
                );

                // Show success message after navigation
                Future.delayed(Duration(milliseconds: 800), () {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('✅ Event payment completed successfully!'),
                      duration: Duration(seconds: 4),
                    ),
                  );
                });
              } else {
                log('[DeepLink] Single event payment failed: ${result?['error']}');
                _showEventPaymentErrorDialog(result?['error'] ?? 'Payment completion failed');
              }
            }
          } catch (e) {
            log('[DeepLink] Error completing payment: $e');
            _showEventPaymentErrorDialog('Error completing payment: $e');
          }
        } else {
          // Regular donation payment - use existing route navigation
          Navigator.of(context).pushNamed(
            '/paypal-success',
            arguments: {'token': token},
          );
        }
      }
      
      if (uri.scheme == 'churchlink' && uri.host == 'paypal-cancel') {
        if (!mounted) return;
        
        // Check if this is an event payment cancellation by looking for eventId in path or query parameters
        String? eventId = uri.queryParameters['eventId'] ?? uri.queryParameters['event_id'];
        
        // If not in query parameters, check if it's in the path (new format: churchlink://paypal-cancel/eventId)
        if (eventId == null && uri.pathSegments.isNotEmpty) {
          eventId = uri.pathSegments.first;
        }
        
        if (eventId != null) {
          // Event payment was cancelled
          _showEventPaymentCancelDialog();
        } else {
          // Regular donation cancellation
          Navigator.of(context).pushNamed('/cancel');
        }
      }
    });
    _accountEmail = FirebaseAuth.instance.currentUser?.email;
    _loadFundPurposes();
  }

  Future<void> _loadFundPurposes() async {
    try {
      final purposes = await PaypalService.getFundPurposes();
      if (mounted) {
        setState(() {
          _fundPurposes = purposes;
          // Ensure current purpose is still valid
          if (!_fundPurposes.contains(_purpose)) {
            _purpose = _fundPurposes.isNotEmpty ? _fundPurposes.first : 'General';
          }
        });
      }
    } catch (e) {
      // Error is already handled in the service with default values
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    _amountController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Map<String, dynamic> _getIntervalData() {
    return {
      "interval_unit": _intervalUnit,
      "interval_count": _intervalCount
    };
  }

  String _getIntervalCountHelperText() {
    switch (_intervalUnit) {
      case 'DAY':
        return 'Min: 1, Max: 365';
      case 'WEEK':
        return 'Min: 1, Max: 52';
      case 'MONTH':
        return 'Min: 1, Max: 12';
      case 'YEAR':
        return 'Min: 1, Max: 1';
      default:
        return 'Min: 1';
    }
  }

  Future<void> _give() async {
    setState(() {
      _loading = true;
      _message = null;
    });
  final amountText = _amountController.text.trim();
  final firstName = _firstNameController.text.trim();
  final lastName = _lastNameController.text.trim();
  String? userId = FirebaseAuth.instance.currentUser?.uid;
  final message = _messageController.text.trim();
  double? amount = double.tryParse(amountText);
    if (amountText.isEmpty || amount == null || amount <= 0) {
      setState(() {
        _message = 'Please enter a valid giving amount (> 0).';
        _loading = false;
      });
      return;
    }
    if (_isSubscription && (firstName.isEmpty || lastName.isEmpty)) {
      setState(() {
        _message = 'Please enter your first and last name for subscriptions.';
        _loading = false;
      });
      return;
    }
    if (_purpose.isEmpty) {
      setState(() {
        _message = 'Please select a purpose for your donation.';
        _loading = false;
      });
      return;
    }
    final donation = {
      "fund_name": _purpose,
      if (_isSubscription) "first_name": firstName,
      if (_isSubscription) "last_name": lastName,
      "donor_email": _accountEmail?.trim() ?? "",
      "type": _isSubscription ? "subscription" : "one-time",
      if (userId != null) "user_id": userId,
      "amount": amount,
      if (_isSubscription) ..._getIntervalData(),
      if (_isSubscription) "cycles": _cycles,
  if (_isSubscription && _startDate != null) "start_date": _startDate!.toIso8601String(),
  if (message.isNotEmpty) "message": message,
    };
    // Use deep link URLs for mobile app callback detection
    final successUrl = 'churchlink://paypal-success';
    final cancelUrl = 'churchlink://paypal-cancel';
    if (_isSubscription) {
      final sub = await PaypalService.createSubscription(donation);
      if (sub != null && sub['approval_url'] != null) {
        final approvalUrl = sub['approval_url'] as String;
        setState(() {
          _loading = false;
        });
        final controller = WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setNavigationDelegate(
            NavigationDelegate(
              onNavigationRequest: (NavigationRequest request) async {
                if (request.url.startsWith(successUrl)) {
                  Navigator.pop(context);
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (context) => Scaffold(
                      appBar: AppBar(title: const Text('Confirmation')),
                      body: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.check_circle, color: Colors.green, size: 80),
                            const SizedBox(height: 20),
                            const Text('Thank you for your subscription!', style: TextStyle(fontSize: 22)),
                            const SizedBox(height: 10),
                            Text('Your recurring donation was set up successfully.', style: TextStyle(fontSize: 16)),
                            const SizedBox(height: 30),
                            ElevatedButton(
                              onPressed: () => Navigator.pop(context),
                              child: const Text('Back to Giving'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ));
                  return NavigationDecision.prevent;
                }
                if (request.url.startsWith(cancelUrl)) {
                  Navigator.pop(context);
                  setState(() {
                    _message = 'Subscription setup cancelled by user.';
                  });
                  return NavigationDecision.prevent;
                }
                return NavigationDecision.navigate;
              },
            ),
          )
          ..loadRequest(Uri.parse(approvalUrl));
        if (mounted) {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (context) => Scaffold(
              appBar: AppBar(title: Text('PayPal Subscription')),
              body: WebViewWidget(controller: controller),
            ),
          ));
        }
      } else {
        setState(() {
          _message = 'Subscription creation failed.';
          _loading = false;
        });
      }
    } else {
      // One-time donation
      final order = await PaypalService.createOrder(donation);
      if (order != null && order['payment_id'] != null && order['approval_url'] != null) {
        final approvalUrl = order['approval_url'] as String;
        final paymentId = order['payment_id'] as String;
        setState(() {
          _loading = false;
        });
        final controller = WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setNavigationDelegate(
            NavigationDelegate(
              onNavigationRequest: (NavigationRequest request) async {
                if (request.url.startsWith(successUrl)) {
                  final uri = Uri.parse(request.url);
                  final payerId = uri.queryParameters['PayerID'];
                  if (payerId != null) {
                    await PaypalService.captureOrder(paymentId, payerId);
                    if (mounted) {
                      Navigator.pop(context);
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (context) => Scaffold(
                          appBar: AppBar(title: const Text('Confirmation')),
                          body: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.check_circle, color: Colors.green, size: 80),
                                const SizedBox(height: 20),
                                const Text('Thank you for your donation!', style: TextStyle(fontSize: 22)),
                                const SizedBox(height: 10),
                                Text('Your payment was completed successfully.', style: TextStyle(fontSize: 16)),
                                const SizedBox(height: 30),
                                ElevatedButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('Back to Giving'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ));
                    }
                  }
                  return NavigationDecision.prevent;
                }
                if (request.url.startsWith(cancelUrl)) {
                  Navigator.pop(context);
                  setState(() {
                    _message = 'Payment cancelled by user.';
                  });
                  return NavigationDecision.prevent;
                }
                return NavigationDecision.navigate;
              },
            ),
          )
          ..loadRequest(Uri.parse(approvalUrl));
        if (mounted) {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (context) => Scaffold(
              appBar: AppBar(title: Text('PayPal Payment')),
              body: WebViewWidget(controller: controller),
            ),
          ));
        }
      } else {
        setState(() {
          _message = 'Order creation failed.';
          _loading = false;
        });
      }
    }
  }


  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: Theme.of(context),
      darkTheme: Theme.of(context),
      title: 'Church Giving',
      debugShowCheckedModeBanner: false,
      home: Scaffold(
      appBar: AppBar(
        title: const Text(
          'Church Giving',
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
        body: SafeArea(
          minimum: const EdgeInsets.symmetric(horizontal: 10),
          child: Center(
            child: SingleChildScrollView(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: 20),
                  Text('Support Our Church', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: Text(
                      'Enter your name and donation details below. Payment will be processed securely through PayPal.',
                      style: TextStyle(fontSize: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Card(
                    elevation: 4,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
                      child: Column(
                        children: [
                          Text(
                            'Enter Amount',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _amountController,
                            keyboardType: TextInputType.numberWithOptions(decimal: true),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.2,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                            decoration: InputDecoration(
                              prefixIcon: Padding(
                                padding: const EdgeInsets.only(left: 16, right: 8),
                                child: Text('\$',
                                  style: TextStyle(fontSize: 32, color: const Color.fromARGB(255, 50, 143, 53))),
                              ),
                              prefixIconConstraints: BoxConstraints(minWidth: 0, minHeight: 0),
                              hintText: '0.00',
                              hintStyle: TextStyle(fontSize: 32, color: Theme.of(context).hintColor),
                              border: const OutlineInputBorder(),
                              filled: true,
                              contentPadding: EdgeInsets.symmetric(vertical: 16),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _purpose,
                    decoration: const InputDecoration(
                      labelText: 'Purpose',
                      border: OutlineInputBorder(),
                    ),
                    items: _fundPurposes.map((purpose) => DropdownMenuItem(
                      value: purpose,
                      child: Text(purpose),
                    )).toList(),
                    onChanged: (val) {
                      setState(() {
                        _purpose = val ?? (_fundPurposes.isNotEmpty ? _fundPurposes.first : 'General');
                      });
                    },
                  ),
                  const SizedBox(height: 10),
                  TextField(
                      controller: _messageController,
                      decoration: const InputDecoration(
                        labelText: 'Message (optional)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Checkbox(
                        value: _isSubscription,
                        onChanged: (val) {
                          setState(() {
                            _isSubscription = val ?? false;
                          });
                        },
                      ),
                      const Text('Recurring giving'),
                    ],
                  ),
                  if (_isSubscription) ...[
                    // Name fields for subscriptions
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8.0),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _firstNameController,
                              decoration: const InputDecoration(
                                labelText: 'First Name',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: _lastNameController,
                              decoration: const InputDecoration(
                                labelText: 'Last Name',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Interval controls
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8.0),
                      child: Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: _intervalUnit,
                              decoration: const InputDecoration(
                                labelText: 'Interval Unit',
                                border: OutlineInputBorder(),
                              ),
                              items: const [
                                DropdownMenuItem(value: 'DAY', child: Text('Day')),
                                DropdownMenuItem(value: 'WEEK', child: Text('Week')),
                                DropdownMenuItem(value: 'MONTH', child: Text('Month')),
                                DropdownMenuItem(value: 'YEAR', child: Text('Year')),
                              ],
                              onChanged: (val) {
                                setState(() {
                                  _intervalUnit = val ?? 'MONTH';
                                });
                              },
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextFormField(
                              initialValue: _intervalCount.toString(),
                              decoration: InputDecoration(
                                labelText: 'Interval Count',
                                helperText: _getIntervalCountHelperText(),
                                border: const OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.number,
                              onChanged: (val) {
                                final parsed = int.tryParse(val);
                                if (parsed != null && parsed > 0) {
                                  int maxVal = 1;
                                  if (_intervalUnit == 'DAY') {
                                    maxVal = 365;
                                  } else if (_intervalUnit == 'WEEK') { maxVal = 52; }
                                  else if (_intervalUnit == 'MONTH') { maxVal = 12; }
                                  else if (_intervalUnit == 'YEAR') { maxVal = 1; }

                                  setState(() {
                                    _intervalCount = parsed > maxVal ? maxVal : parsed;
                                  });
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextFormField(
                              initialValue: _cycles.toString(),
                              decoration: const InputDecoration(
                                labelText: 'Cycles (max 60)',
                                border: OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.number,
                              onChanged: (val) {
                                final parsed = int.tryParse(val);
                                if (parsed != null && parsed > 0) {
                                  setState(() {
                                    _cycles = parsed > 60 ? 60 : parsed;
                                  });
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8.0),
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Start Date',
                          border: OutlineInputBorder(),
                        ),
                        child: InkWell(
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now(),
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                            );
                            if (picked != null) {
                              setState(() {
                                _startDate = picked;
                              });
                            }
                          },
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12.0),
                            child: Text(
                              _startDate != null
                                  ? '${_startDate!.month}/${_startDate!.day}/${_startDate!.year}'
                                  : 'Choose date',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontSize: 16,
                                color: _startDate != null ? Theme.of(context).colorScheme.onSurface : Theme.of(context).hintColor,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  if (_loading)
                    const CircularProgressIndicator(),
                  if (_message != null)
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(_message!, style: TextStyle(fontSize: 16, color: Theme.of(context).colorScheme.error)),
                    ),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.volunteer_activism),
                    label: const Text('Give with PayPal'),
                    onPressed: _loading ? null : _give,
                    style: ElevatedButton.styleFrom(
                      // Leave PayPal button hard coded blue, matches their branding
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    ),
                  ),

                  
                  const SizedBox(height: 30),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showEventPaymentErrorDialog(String error) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment Error'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error, color: Theme.of(context).colorScheme.error, size: 48),
            const SizedBox(height: 16),
            Text(
              'Event payment failed: $error',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            const Text(
              'Please try again or contact support if the problem persists.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // Close dialog
              Navigator.of(context).pushReplacementNamed('/events');
            },
            child: const Text('Back to Events'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showEventPaymentCancelDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment Cancelled'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cancel, color: Colors.orange, size: 48),
            const SizedBox(height: 16),
            const Text(
              'Event payment was cancelled. Your registration is not confirmed yet.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            const Text(
              'You can try again later or complete payment at the event if applicable.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // Close dialog
              Navigator.of(context).pushReplacementNamed('/events');
            },
            child: const Text('Back to Events'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<Map<String, dynamic>?> _getPendingBulkRegistration() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pendingDataString = prefs.getString('pending_bulk_registration');
      log('[DeepLink] Raw pending data string: $pendingDataString');
      
      if (pendingDataString != null) {
        final pendingData = jsonDecode(pendingDataString) as Map<String, dynamic>;
        log('[DeepLink] Parsed pending data: $pendingData');
        
        // Check if data is not too old (e.g., within last hour)
        final timestamp = pendingData['timestamp'] as int;
        final now = DateTime.now().millisecondsSinceEpoch;
        final ageMinutes = (now - timestamp) / 60000;
        log('[DeepLink] Pending data age: ${ageMinutes.toStringAsFixed(1)} minutes');
        
        if (now - timestamp < 3600000) { // 1 hour
          log('[DeepLink] Pending data is valid');
          return pendingData;
        } else {
          // Clear old data
          log('[DeepLink] Pending data is too old, clearing');
          await prefs.remove('pending_bulk_registration');
        }
      } else {
        log('[DeepLink] No pending data found');
      }
    } catch (e) {
      log('[DeepLink] Failed to get pending registration: $e');
    }
    return null;
  }

  Future<void> _clearPendingBulkRegistration() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('pending_bulk_registration');
      log('[DeepLink] Cleared pending bulk registration data');
    } catch (e) {
      log('[DeepLink] Failed to clear pending registration: $e');
    }
  }
}