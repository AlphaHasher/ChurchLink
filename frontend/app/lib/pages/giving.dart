import 'package:flutter/material.dart';
import 'package:app/services/paypal_service.dart';
import 'package:app_links/app_links.dart';
import 'dart:async';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:firebase_auth/firebase_auth.dart';


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
    _linkSubscription = _appLinks!.uriLinkStream.listen((Uri uri) async {
      if (!mounted) return;
      if (uri.scheme == 'churchlink' && uri.host == 'paypal-success') {
        if (!mounted) return;
        Navigator.of(context).pushNamed(
          '/paypal-success',
          arguments: {'token': uri.queryParameters['token']},
        );
      }
      if (uri.scheme == 'churchlink' && uri.host == 'paypal-cancel') {
        if (!mounted) return;
        Navigator.of(context).pushNamed('/cancel');
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
    final successUrl = 'https://yourchurch.org/donation/success';
    final cancelUrl = 'https://yourchurch.org/donation/cancel';
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
      title: 'Church Giving',
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        appBar: AppBar(
          backgroundColor: const Color.fromARGB(159, 144, 79, 230),
          iconTheme: const IconThemeData(color: Colors.white),
          title: const Padding(
            padding: EdgeInsets.only(left: 80),
            child: Text(
              'Church Giving',
              style: TextStyle(color: Colors.white),
            ),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        backgroundColor: const Color.fromARGB(246, 244, 236, 255),
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
                      style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Card(
                    elevation: 4,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    color: Colors.white,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
                      child: Column(
                        children: [
                          Text(
                            'Enter Amount',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Colors.deepPurple,
                            ),
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _amountController,
                            keyboardType: TextInputType.numberWithOptions(decimal: true),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.2,
                              color: Colors.black,
                            ),
                            decoration: InputDecoration(
                              prefixIcon: Padding(
                                padding: const EdgeInsets.only(left: 16, right: 8),
                                child: Text('\$',
                                  style: TextStyle(fontSize: 32, color: Colors.green)),
                              ),
                              prefixIconConstraints: BoxConstraints(minWidth: 0, minHeight: 0),
                              hintText: '0.00',
                              hintStyle: TextStyle(fontSize: 32, color: Colors.grey),
                              border: InputBorder.none,
                              filled: true,
                              fillColor: Colors.grey[100],
                              contentPadding: EdgeInsets.symmetric(vertical: 16),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: _purpose,
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
                              value: _intervalUnit,
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
                                  } else if (_intervalUnit == 'WEEK') maxVal = 52;
                                  else if (_intervalUnit == 'MONTH') maxVal = 12;
                                  else if (_intervalUnit == 'YEAR') maxVal = 1;
                                  
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
                              style: TextStyle(
                                fontSize: 16,
                                color: _startDate != null ? Colors.black : Colors.grey[600],
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
                      child: Text(_message!, style: const TextStyle(fontSize: 16, color: Colors.green)),
                    ),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.volunteer_activism),
                    label: const Text('Give with PayPal'),
                    onPressed: _loading ? null : _give,
                    style: ElevatedButton.styleFrom(
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
}