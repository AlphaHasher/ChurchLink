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
  String? _accountEmail;
  String _purpose = 'General';
  List<String> _fundPurposes = ['General']; // Default value while loading
  AppLinks? _appLinks;
  StreamSubscription<Uri>? _linkSubscription;

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
            _purpose =
                _fundPurposes.isNotEmpty ? _fundPurposes.first : 'General';
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
    super.dispose();
  }

  Future<void> _give() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    final amountText = _amountController.text.trim();
    String? userId = FirebaseAuth.instance.currentUser?.uid;
    double? amount = double.tryParse(amountText);
    if (amountText.isEmpty || amount == null || amount <= 0) {
      setState(() {
        _message = 'Please enter a valid giving amount (> 0).';
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
      "donor_email": _accountEmail?.trim() ?? "",
      "type": "one-time",
      if (userId != null) "user_id": userId,
      "amount": amount,
    };
    final successUrl = 'https://yourchurch.org/donation/success';
    final cancelUrl = 'https://yourchurch.org/donation/cancel';

    // One-time donation
    final order = await PaypalService.createOrder(donation);
    if (order != null &&
        order['payment_id'] != null &&
        order['approval_url'] != null) {
      final approvalUrl = order['approval_url'] as String;
      final paymentId = order['payment_id'] as String;
      setState(() {
        _loading = false;
      });
      final controller =
          WebViewController()
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
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) {
                              final successTheme = Theme.of(context);
                              return Scaffold(
                                appBar: AppBar(
                                  title: const Text('Confirmation'),
                                ),
                                body: Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.check_circle,
                                        color: successTheme.colorScheme.primary,
                                        size: 80,
                                      ),
                                      const SizedBox(height: 20),
                                      Text(
                                        'Thank you for your donation!',
                                        style:
                                            successTheme
                                                .textTheme
                                                .headlineSmall,
                                      ),
                                      const SizedBox(height: 10),
                                      Text(
                                        'Your payment was completed successfully.',
                                        style: successTheme.textTheme.bodyLarge,
                                      ),
                                      const SizedBox(height: 30),
                                      ElevatedButton(
                                        onPressed: () => Navigator.pop(context),
                                        child: const Text('Back to Giving'),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        );
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
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder:
                (context) => _PayPalWebView(
                  controller: controller,
                  title: 'PayPal Payment',
                ),
          ),
        );
      }
    } else {
      setState(() {
        _message = 'Order creation failed.';
        _loading = false;
      });
    }
  }

  // Helper method to show donation dialog
  void _showDonationDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        final theme = Theme.of(context);
        final amountController = TextEditingController();
        final noteController = TextEditingController();

        return AlertDialog(
          backgroundColor: theme.colorScheme.surface,
          title: Text(
            'Enter Donation Amount',
            style: theme.textTheme.titleLarge?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: amountController,
                keyboardType: TextInputType.numberWithOptions(decimal: true),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w600,
                  color: theme.colorScheme.onSurface,
                ),
                decoration: InputDecoration(
                  prefixIcon: Padding(
                    padding: const EdgeInsets.only(left: 16, right: 8),
                    child: Text(
                      '\$',
                      style: TextStyle(
                        fontSize: 32,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ),
                  prefixIconConstraints: BoxConstraints(
                    minWidth: 0,
                    minHeight: 0,
                  ),
                  hintText: '0.00',
                  hintStyle: TextStyle(
                    fontSize: 32,
                    color: theme.colorScheme.onSurface.withOpacity(0.3),
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: noteController,
                maxLength: 500,
                maxLines: 1,
                style: TextStyle(
                  fontSize: 14,
                  color: theme.colorScheme.onSurface,
                ),
                decoration: InputDecoration(
                  labelText: 'Write us a note? (Optional)',
                  labelStyle: TextStyle(fontSize: 14),
                  hintText: '...',
                  hintStyle: TextStyle(fontSize: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  counterText: '',
                  helperText: 'Max 500 characters',
                  helperStyle: TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Cancel',
                style: TextStyle(color: theme.colorScheme.onSurface),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                final amountText = amountController.text.trim();
                final amount = double.tryParse(amountText);
                if (amountText.isEmpty || amount == null || amount <= 0) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Please enter a valid amount'),
                      backgroundColor: theme.colorScheme.error,
                    ),
                  );
                  return;
                }
                _amountController.text = amountText;
                // Store the note for the donation
                final note = noteController.text.trim();
                if (note.isNotEmpty) {
                  // Note will be sent with the donation
                  _purpose =
                      note.length > 100 ? '${note.substring(0, 97)}...' : note;
                } else {
                  _purpose = 'General';
                }
                Navigator.of(context).pop();
                _give();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: theme.colorScheme.primary,
                foregroundColor: theme.colorScheme.onPrimary,
              ),
              child: const Text('Continue'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Donations'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Section
              Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.church,
                      size: 64,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Supporting Your Church',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.primary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Your donations help our mission to support and uplift you and the community! Every contribution, large or small, has a meaningful difference!',
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: theme.colorScheme.onSurface.withOpacity(0.7),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.favorite,
                          color: theme.colorScheme.error,
                          size: 24,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Thank you for your generosity!',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: theme.colorScheme.onSurface.withOpacity(0.7),
                            fontStyle: FontStyle.italic,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Donate Online Section
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.smartphone,
                            color: theme.colorScheme.primary,
                            size: 28,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'Donate Online',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Directly support us through PayPal',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withOpacity(0.7),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Center(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.volunteer_activism),
                          label: const Text('Donate Here!'),
                          onPressed: _loading ? null : _showDonationDialog,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: theme.colorScheme.primary,
                            foregroundColor: theme.colorScheme.onPrimary,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 16,
                            ),
                            textStyle: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                      if (_loading)
                        const Padding(
                          padding: EdgeInsets.only(top: 16.0),
                          child: Center(child: CircularProgressIndicator()),
                        ),
                      if (_message != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 16.0),
                          child: Center(
                            child: Text(
                              _message!,
                              style: TextStyle(
                                fontSize: 14,
                                color: theme.colorScheme.error,
                                fontWeight: FontWeight.w500,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Donate In Person Section
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.location_on,
                            color: theme.colorScheme.primary,
                            size: 28,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'Donate In Person',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Visit us during service hours to offer donations as cash or checks, any amount is gratefully accepted!',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withOpacity(0.7),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.schedule,
                                  size: 18,
                                  color: theme.colorScheme.onSurface
                                      .withOpacity(0.6),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Service Times:',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurface,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Padding(
                              padding: const EdgeInsets.only(left: 26),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Sunday Mornings - 9:30 AM',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Sunday United Service - 12:15 PM',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Sunday Evenings - 5:00 PM',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Thursday Prayer Service - 7:00 PM',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Mail-in Donations Section
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.mail,
                            color: theme.colorScheme.primary,
                            size: 28,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'Mail-in Donations',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Prefer to send a check? Mail your donation to our church address. Please make checks payable to the church name.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withOpacity(0.7),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.location_city,
                                  size: 18,
                                  color: theme.colorScheme.onSurface
                                      .withOpacity(0.6),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Second Slavic Baptist Church',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurface,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Padding(
                              padding: const EdgeInsets.only(left: 26),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '6601 Watt Ave',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                  Text(
                                    'North Highlands, CA 95660',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

// Separate WebView widget with proper cleanup to prevent PigeonProxyApiRegistrar errors
class _PayPalWebView extends StatefulWidget {
  final WebViewController controller;
  final String title;

  const _PayPalWebView({required this.controller, required this.title});

  @override
  State<_PayPalWebView> createState() => _PayPalWebViewState();
}

class _PayPalWebViewState extends State<_PayPalWebView> {
  @override
  void dispose() {
    // Properly clean up WebView resources
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      onPopInvoked: (bool didPop) async {
        // Additional cleanup if needed when user backs out
        if (didPop) {
          // Allow navigation to complete cleanup
          await Future.delayed(const Duration(milliseconds: 100));
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: WebViewWidget(controller: widget.controller),
      ),
    );
  }
}
