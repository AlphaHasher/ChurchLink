import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/event.dart';
import '../pages/payment_cancel_page.dart';
import '../pages/payment_success_page.dart';

import '../services/event_registration_service.dart';

// Custom input formatter for currency amounts
class CurrencyInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    // Allow empty value
    if (newValue.text.isEmpty) {
      return newValue;
    }

    // Remove any non-digit and non-decimal point characters
    String filtered = newValue.text.replaceAll(RegExp(r'[^0-9.]'), '');
    
    // Ensure only one decimal point
    List<String> parts = filtered.split('.');
    if (parts.length > 2) {
      filtered = '${parts[0]}.${parts.sublist(1).join('')}';
    }
    
    // Limit to 2 decimal places
    if (parts.length == 2 && parts[1].length > 2) {
      filtered = '${parts[0]}.${parts[1].substring(0, 2)}';
    }
    
    // Prevent amounts over 10000 (reasonable limit for donations)
    final double? amount = double.tryParse(filtered);
    if (amount != null && amount > 10000) {
      return oldValue;
    }

    return TextEditingValue(
      text: filtered,
      selection: TextSelection.collapsed(offset: filtered.length),
    );
  }
}

class BulkEventRegistrationWidget extends StatefulWidget {
  final Event event;
  final List<Map<String, dynamic>> registrations;
  final Function(String paymentType)? onSuccess; // Modified to include payment type
  final VoidCallback? onCancel;
  final Function(String paymentId, String payerId)? onPaymentSuccess; // New callback for payment success
  final bool navigateOnPayAtDoor; // New parameter to enable direct navigation

  const BulkEventRegistrationWidget({
    Key? key,
    required this.event,
    required this.registrations,
    this.onSuccess,
    this.onCancel,
    this.onPaymentSuccess, // Add this parameter
    this.navigateOnPayAtDoor = false, // Default to false for backward compatibility
  }) : super(key: key);

  @override
  State<BulkEventRegistrationWidget> createState() => _BulkEventRegistrationWidgetState();
}

class _BulkEventRegistrationWidgetState extends State<BulkEventRegistrationWidget> {
  bool _isLoading = false;
  double _donationAmount = 0.0;
  String _selectedPaymentOption = 'free'; // 'free', 'paypal', 'door'
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    
    // Set default payment option based on event requirements
    if (widget.event.requiresPayment) {
      // For paid events, default to the first available payment method
      if (widget.event.hasPayPalOption) {
        _selectedPaymentOption = 'paypal';
      } else if (widget.event.hasDoorPaymentOption) {
        _selectedPaymentOption = 'door';
      }
    } else {
      // For free events, default to free registration
      _selectedPaymentOption = 'free';
    }
  }

  double get _totalAmount {
    if (widget.event.requiresPayment) {
      return widget.event.price * widget.registrations.length;
    }
    return _donationAmount;
  }

  String get _buttonText {
    if (_selectedPaymentOption == 'door') {
      return 'Register & Pay \$${(widget.event.price * widget.registrations.length).toStringAsFixed(2)} at Door';
    } else if (_selectedPaymentOption == 'paypal' && widget.event.requiresPayment) {
      return 'Pay \$${_totalAmount.toStringAsFixed(2)} with PayPal';
    } else if (_selectedPaymentOption == 'paypal' && !widget.event.requiresPayment && _donationAmount > 0) {
      return 'Donate \$${_donationAmount.toStringAsFixed(2)} with PayPal';
    } else if (_selectedPaymentOption == 'paypal' && !widget.event.requiresPayment && _donationAmount <= 0) {
      return 'Register ${widget.registrations.length} people';
    } else if (_donationAmount > 0) {
      return 'Donate \$${_donationAmount.toStringAsFixed(2)}';
    }
    return 'Register ${widget.registrations.length} people';
  }

  Color get _buttonColor {
    if (_selectedPaymentOption == 'door') {
      return Colors.orange; // Orange for pay at door
    } else if (_selectedPaymentOption == 'paypal' || _donationAmount > 0) {
      return const Color(0xFF0070BA); // PayPal blue
    }
    return Theme.of(context).primaryColor;
  }

  Widget _buildDonationAmountSelector() {
    // Only show for free events when PayPal donation option is selected
    if (!widget.event.isFree || _selectedPaymentOption != 'paypal') {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        border: Border.all(color: Colors.green.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Donation Amount',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.green.shade800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Enter the amount you\'d like to donate:',
            style: TextStyle(fontSize: 14, color: Colors.green.shade700),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Text('\$', style: TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    CurrencyInputFormatter(),
                  ],
                  decoration: const InputDecoration(
                    hintText: '0.00',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    errorStyle: TextStyle(fontSize: 12),
                  ),
                  validator: (value) {
                    // For free events, donation is optional
                    if (value == null || value.isEmpty) {
                      return null; // Allow empty for optional donations
                    }
                    final amount = double.tryParse(value);
                    if (amount == null) {
                      return 'Please enter a valid number';
                    }
                    if (amount < 0) {
                      return 'Amount cannot be negative';
                    }
                    if (amount > 10000) {
                      return 'Amount cannot exceed \$10,000';
                    }
                    return null;
                  },
                  onChanged: (value) {
                    setState(() {
                      _donationAmount = double.tryParse(value) ?? 0.0;
                    });
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentOptionsSelector() {
    // For paid events: show payment options if there are multiple payment methods available
    if (widget.event.requiresPayment) {
      // Count available payment options
      int availableOptions = 0;
      if (widget.event.hasPayPalOption) availableOptions++;
      if (widget.event.hasDoorPaymentOption) availableOptions++;
      
      // Only show selector if there are multiple payment options
      if (availableOptions <= 1) {
        return const SizedBox.shrink();
      }
      
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Payment Method',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This event costs \$${widget.event.price.toStringAsFixed(2)} per person. Choose your payment method:',
              style: const TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 12),
            Column(
              children: [
                // Show PayPal option if available
                if (widget.event.hasPayPalOption)
                  RadioListTile<String>(
                    title: Row(
                      children: [
                        const Text('Pay with PayPal'),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0070BA),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'PayPal',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    subtitle: Text('Pay \$${(widget.event.price * widget.registrations.length).toStringAsFixed(2)} now'),
                    value: 'paypal',
                    groupValue: _selectedPaymentOption,
                    onChanged: (value) {
                      setState(() {
                        _selectedPaymentOption = value!;
                      });
                    },
                    contentPadding: EdgeInsets.zero,
                  ),
                // Show door payment option if available
                if (widget.event.hasDoorPaymentOption)
                  RadioListTile<String>(
                    title: const Text('Pay at Door'),
                    subtitle: Text('Pay \$${(widget.event.price * widget.registrations.length).toStringAsFixed(2)} when you arrive'),
                    value: 'door',
                    groupValue: _selectedPaymentOption,
                    onChanged: (value) {
                      setState(() {
                        _selectedPaymentOption = value!;
                      });
                    },
                    contentPadding: EdgeInsets.zero,
                  ),
              ],
            ),
          ],
        ),
      );
    }
    
    // For free events: show optional donation selector if PayPal is available
    if (widget.event.isFree && widget.event.hasPayPalOption) {
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          border: Border.all(color: Colors.blue.shade200),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Optional Donation',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.blue.shade800,
              ),
            ),
            const SizedBox(height: 8),
            
            const SizedBox(height: 12),
            RadioListTile<String>(
              title: const Text('Register'),
              subtitle: const Text('No donation'),
              value: 'free',
              groupValue: _selectedPaymentOption,
              onChanged: (value) {
                setState(() {
                  _selectedPaymentOption = value!;
                  _donationAmount = 0.0;
                });
              },
              contentPadding: EdgeInsets.zero,
            ),
            RadioListTile<String>(
              title: const Text('Register + Donate'),
              subtitle: const Text('Support this Event via PayPal'),
              value: 'paypal',
              groupValue: _selectedPaymentOption,
              onChanged: (value) {
                setState(() {
                  _selectedPaymentOption = value!;
                  if (_donationAmount <= 0) {
                    _donationAmount = 0.0; // Default donation amount
                  }
                });
              },
              contentPadding: EdgeInsets.zero,
            ),
          ],
        ),
      );
    }
    
    // No payment options needed for free events without PayPal
    return const SizedBox.shrink();
  }

  Widget _buildRegistrationSummary() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Registration Summary',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.blue.shade800,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Event: ${widget.event.name}',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 4),
          Text(
            'Number of people: ${widget.registrations.length}',
            style: const TextStyle(fontSize: 14),
          ),
          if (widget.event.requiresPayment) ...[
            const SizedBox(height: 4),
            Text(
              'Price per person: \$${widget.event.price.toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text(
              'Total amount: \$${_totalAmount.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.green,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _handleRegistration() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      // Debug logging
      log('[BulkRegistration] Registration debug info:');
      log('[BulkRegistration] Selected payment option: $_selectedPaymentOption');
      log('[BulkRegistration] Total amount: $_totalAmount');
      log('[BulkRegistration] Donation amount: $_donationAmount');
      log('[BulkRegistration] Event requires payment: ${widget.event.requiresPayment}');
      log('[BulkRegistration] Event price: ${widget.event.price}');
      log('[BulkRegistration] Registration count: ${widget.registrations.length}');

      // Determine registration flow based on selected payment option
      if (_selectedPaymentOption == 'door') {
        // Register but mark as "pay at door"
        await _handlePayAtDoorRegistration();
      } else if (_selectedPaymentOption == 'paypal' && _totalAmount > 0) {
        // Use PayPal flow only when there's actually money to process
        log('[BulkRegistration] Using PayPal flow - total: $_totalAmount, donation: $_donationAmount');
        await _handlePayPalPayment();
      } else {
        // Use direct registration for completely free events
        log('[BulkRegistration] Using free registration flow');
        await _handleFreeRegistration();
      }
    } catch (e) {
      log('[BulkRegistration] Error: $e');
      setState(() {
        _errorMessage = 'Registration failed: ${e.toString()}';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _handlePayAtDoorRegistration() async {
    log('[BulkRegistration] Processing pay-at-door registration');
    
    try {
      // Use the simplified unified registration API with door payment option
      final success = await EventRegistrationService.registerMultiplePeople(
        eventId: widget.event.id,
        registrations: widget.registrations,
        paymentOption: 'door',  // Mark as pay at door
        donationAmount: _donationAmount,
      );

      if (success) {
        log('[BulkRegistration] Pay-at-door registrations completed');
        
        // Handle navigation directly if requested
        if (widget.navigateOnPayAtDoor) {
          log('[BulkRegistration] Navigating directly to success page for pay-at-door');
          try {
            // Navigate immediately while context is still valid
            Navigator.of(context, rootNavigator: true).pushReplacement(
              MaterialPageRoute(
                builder: (context) => PaymentSuccessPage(
                  paymentId: null, // No payment ID for pay-at-door
                  payerId: null,   // No payer ID for pay-at-door
                  eventId: widget.event.id,
                  eventName: widget.event.name,
                ),
              ),
            );
            log('[BulkRegistration] Direct navigation completed successfully');
            return; // Don't call the callback since we're handling navigation directly
          } catch (e) {
            log('[BulkRegistration] Direct navigation failed: $e');
            // Fall back to callback approach
          }
        }
        
        // Call success callback in a separate try-catch to avoid UI exceptions affecting registration
        try {
          widget.onSuccess?.call('door'); // Pass payment type
        } catch (callbackError) {
          log('[BulkRegistration] Error in success callback: $callbackError');
          // Don't rethrow callback errors, the registration was successful
        }
      } else {
        throw Exception('Door payment registration failed');
      }
    } catch (e) {
      log('[BulkRegistration] Error during pay-at-door registration: $e');
      throw e;
    }
  }

  Future<void> _handlePayPalPayment() async {
    log('[BulkRegistration] Creating PayPal payment order');
    
    // Add payment amount to registrations for backend processing
    final registrationsWithPayment = widget.registrations.map((reg) => {
      ...reg,
      'payment_method': 'paypal',
      'payment_amount_per_person': _selectedPaymentOption == 'paypal' ? widget.event.price : 0,
      'donation_amount': _donationAmount,
    }).toList();
    
    // Store pending bulk registration data for deep link completion
    await _storePendingBulkRegistration(registrationsWithPayment);
    
    final result = await EventRegistrationService.createPaymentOrderForMultiple(
      eventId: widget.event.id,
      registrations: registrationsWithPayment,  // Use registrations with payment data
      totalAmount: _totalAmount,
      donationAmount: _donationAmount,
    );

    if (!result['success']) {
      throw Exception(result['message'] ?? 'Failed to create payment order');
    }

    final approvalUrl = result['approval_url'];
    final paymentId = result['payment_id'] ?? '';

    log('[BulkRegistration] Opening PayPal WebView: $approvalUrl');

    // Use WebView instead of external browser
    await _showPayPalWebView(approvalUrl, paymentId);

    // No longer show manual completion dialog - WebView will handle it automatically
  }

  Future<void> _storePendingBulkRegistration(List<Map<String, dynamic>> registrations) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pendingData = {
        'eventId': widget.event.id,
        'registrations': registrations,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      };
      await prefs.setString('pending_bulk_registration', jsonEncode(pendingData));
      log('[BulkRegistration] Stored pending bulk registration data for eventId: ${widget.event.id}');
      log('[BulkRegistration] Stored ${registrations.length} registrations');
    } catch (e) {
      log('[BulkRegistration] Failed to store pending registration: $e');
    }
  }

  // Simplified: No need for complex pending registration storage
  // The unified API handles registration directly

  Future<void> _handleFreeRegistration() async {
    log('[BulkRegistration] Processing free registrations');
    
    // For free events, register each person individually using the bulk registration endpoint
    // This matches the React frontend pattern
    
    try {
      // Use the simplified unified registration API
      final success = await EventRegistrationService.registerMultiplePeople(
        eventId: widget.event.id,
        registrations: widget.registrations,
        paymentOption: null,  // null for free events
        donationAmount: _donationAmount,
      );

      if (success) {
        log('[BulkRegistration] Free registrations completed');
        
        // Call success callback in a separate try-catch to avoid UI exceptions affecting registration
        try {
          widget.onSuccess?.call('free'); // Pass payment type
        } catch (callbackError) {
          log('[BulkRegistration] Error in success callback: $callbackError');
          // Don't rethrow callback errors, the registration was successful
        }
      } else {
        throw Exception('Registration failed');
      }
    } catch (e) {
      log('[BulkRegistration] Error during free registration: $e');
      rethrow;
    }
  }

  Future<void> _showPayPalWebView(String approvalUrl, String paymentId) async {
    // Enhanced success/cancel detection using PayPal parameters
    // Instead of relying on specific URLs, look for PayPal success/cancel indicators
    
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (context) => Scaffold(
        appBar: AppBar(
          title: const Text('Complete Payment'),
          backgroundColor: Theme.of(context).primaryColor,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _errorMessage = 'Payment cancelled by user';
              });
            },
          ),
        ),
        body: Column(
          children: [
            // WebView
            Expanded(
              child: WebViewWidget(
          controller: WebViewController()
            ..setJavaScriptMode(JavaScriptMode.unrestricted)
            ..setNavigationDelegate(
              NavigationDelegate(
                onPageStarted: (String url) {
                  log('[BulkRegistration] Page started loading: $url');
                },
                onPageFinished: (String url) {
                  log('[BulkRegistration] Page finished loading: $url');
                  
                  // Also check for success indicators when page finishes loading
                  if (url.contains('PayerID=') || url.contains('payer_id=')) {
                    log('[BulkRegistration] SUCCESS DETECTED in onPageFinished: $url');
                    
                    final uri = Uri.parse(url);
                    final payerId = uri.queryParameters['PayerID'] ?? uri.queryParameters['payer_id'];
                    
                    if (payerId != null) {
                      log('[BulkRegistration] Triggering success flow from onPageFinished');
                      _handlePaymentSuccess(paymentId, payerId);
                    }
                  }
                },
                onNavigationRequest: (NavigationRequest request) async {
                  log('[BulkRegistration] WebView navigation request: ${request.url}');
                  
                  final uri = Uri.parse(request.url);
                  final payerId = uri.queryParameters['PayerID'] ?? uri.queryParameters['payer_id'];
                  final token = uri.queryParameters['token'];
                  
                  log('[BulkRegistration] URL parameters - PayerID: $payerId, token: $token');
                  
                  // Check for PayPal success indicators
                  bool isPayPalSuccess = (payerId != null && token != null) || 
                                        request.url.contains('payment/success') ||
                                        request.url.contains('/success');
                  
                  // Check for PayPal cancel indicators  
                  bool isPayPalCancel = request.url.contains('payment/cancel') ||
                                       request.url.contains('/cancel') ||
                                       request.url.contains('cancelled');
                  
                  log('[BulkRegistration] Detection - isPayPalSuccess: $isPayPalSuccess, isPayPalCancel: $isPayPalCancel');
                  
                  // Handle success
                  if (isPayPalSuccess) {
                    log('[BulkRegistration] Payment success detected - PayerID: $payerId, token: $token');
                    log('[BulkRegistration] Success URL: ${request.url}');
                    
                    // Use async function for reliable navigation
                    if (payerId != null) {
                      _handlePaymentSuccess(paymentId, payerId);
                    }
                    
                
                    
                    return NavigationDecision.prevent;
                  }
                  
                  // Handle cancel
                  if (isPayPalCancel) {
                    log('[BulkRegistration] Payment cancel detected');
                    log('[BulkRegistration] Cancel URL: ${request.url}');
                    
                    // Use async function for reliable navigation
                    _handlePaymentCancel(paymentId);
                    
                    return NavigationDecision.prevent;
                  }
                  
                  return NavigationDecision.navigate;
                },
              ),
            )
            ..loadRequest(Uri.parse(approvalUrl)),
              ),
            ),
          ],
        ),
      ),
    ));
  }

  // Handle payment success with proper async navigation
  Future<void> _handlePaymentSuccess(String paymentId, String payerId) async {
    try {
      log('[BulkRegistration] Calling payment success callback');
      
      // Complete registration in background first
      if (payerId.isNotEmpty) {
        await _completeBulkRegistrationAfterPayment(paymentId, payerId);
      }
      
      // Navigate properly with context checks
      if (!mounted) return;
      
      // Pop the WebView dialog first
      if (Navigator.canPop(context)) {
        Navigator.pop(context);
      }
      
      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;
      
      // Pop the member registration list dialog
      if (Navigator.canPop(context)) {
        Navigator.pop(context);
      }
      
      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;
      
      // Use callback to let parent handle success page navigation
      widget.onPaymentSuccess?.call(paymentId, payerId);
    } catch (error) {
      log('[BulkRegistration] Error in payment success handler: $error');
      // Even if registration completion fails, we should still navigate
      // since PayPal payment was successful
      if (mounted) {
        widget.onPaymentSuccess?.call(paymentId, payerId);
      }
    }
  }

  // Handle payment cancel with proper async navigation
  Future<void> _handlePaymentCancel(String paymentId) async {
    try {
      log('[BulkRegistration] Payment cancel detected');

      if (!mounted) return;

      // Pop the WebView dialog first
      if (Navigator.canPop(context)) {
        Navigator.pop(context);
      }

      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;

      // Pop the member registration list dialog
      if (Navigator.canPop(context)) {
        Navigator.pop(context);
      }

      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;

      // Navigate to cancel page
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => PaymentCancelPage(
            paymentId: paymentId,
            eventId: widget.event.id,
            eventName: widget.event.name,
            reason: 'Payment was cancelled by the user',
          ),
        ),
      );
    } catch (error) {
      log('[BulkRegistration] Error in payment cancel handler: $error');
    }
  }

  // Complete bulk registration after successful PayPal payment
  Future<void> _completeBulkRegistrationAfterPayment(String paymentId, String payerId) async {
    try {
      log('[BulkRegistration] Completing registration after payment - PaymentID: $paymentId, PayerID: $payerId');
      
      // For WebView payments, we need to call the backend completion endpoint directly
      // This simulates what the deep link handler would do
      await _callPaymentCompletionEndpoint(paymentId, payerId);
      
      log('[BulkRegistration] Bulk registration completed successfully after payment');
    } catch (e) {
      log('[BulkRegistration] Error completing registration after payment: $e');
      
      // Don't navigate to cancel page here since we've already shown success page
      // PayPal payment succeeded, but registration completion failed
      // User should contact support with their payment ID
      
      // Note: This is a background operation, so UI has already shown success
      rethrow;
    }
  }

  // Call the backend payment completion endpoint
  Future<void> _callPaymentCompletionEndpoint(String paymentId, String payerId) async {
    try {
      final response = await EventRegistrationService.completePayPalPayment(
        eventId: widget.event.id,
        paymentId: paymentId,
        payerId: payerId,
      );
      
      if (!response) {
        throw Exception('Payment completion failed');
      }
    } catch (e) {
      log('[BulkRegistration] Error calling payment completion endpoint: $e');
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildRegistrationSummary(),
        _buildPaymentOptionsSelector(),
        _buildDonationAmountSelector(),
        
        if (_errorMessage.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              border: Border.all(color: Colors.red.shade300),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              _errorMessage,
              style: TextStyle(color: Colors.red.shade700),
            ),
          ),

        ElevatedButton(
          onPressed: _isLoading ? null : _handleRegistration,
          style: ElevatedButton.styleFrom(
            backgroundColor: _buttonColor,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: _isLoading
              ? const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                    SizedBox(width: 12),
                    Text('Processing...'),
                  ],
                )
              : Text(
                  _buttonText,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
        ),
      ],
    );
  }
}