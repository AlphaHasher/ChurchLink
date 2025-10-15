import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/event.dart';


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
  final VoidCallback? onSuccess;
  final VoidCallback? onCancel;

  const BulkEventRegistrationWidget({
    Key? key,
    required this.event,
    required this.registrations,
    this.onSuccess,
    this.onCancel,
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
    } else if (_selectedPaymentOption == 'paypal' && !widget.event.requiresPayment) {
      return 'Donate \$${_donationAmount.toStringAsFixed(2)} with PayPal';
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
                    if (value == null || value.isEmpty) {
                      return 'Please enter a donation amount';
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
            Text(
              'This is a free event. You can optionally make a donation to support our ministry.',
              style: TextStyle(fontSize: 14, color: Colors.blue.shade700),
            ),
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
              subtitle: const Text('Make an optional donation via PayPal'),
              value: 'paypal',
              groupValue: _selectedPaymentOption,
              onChanged: (value) {
                setState(() {
                  _selectedPaymentOption = value!;
                  if (_donationAmount <= 0) {
                    _donationAmount = 10.0; // Default donation amount
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
      // Determine registration flow based on selected payment option
      if (_selectedPaymentOption == 'door') {
        // Register but mark as "pay at door"
        await _handlePayAtDoorRegistration();
      } else if (_selectedPaymentOption == 'paypal' || _donationAmount > 0) {
        // Use PayPal flow for PayPal payments or donations
        await _handlePayPalPayment();
      } else {
        // Use direct registration for completely free events
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
      } else {
        throw Exception('Door payment registration failed');
      }
      widget.onSuccess?.call();
    } catch (e) {
      log('[BulkRegistration] Error during pay-at-door registration: $e');
      rethrow;
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
      registrations: widget.registrations,  // Use original registrations, not modified ones
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
        widget.onSuccess?.call();
      } else {
        throw Exception('Registration failed');
      }
    } catch (e) {
      log('[BulkRegistration] Error during free registration: $e');
      rethrow;
    }
  }

  Future<void> _showPayPalWebView(String approvalUrl, String paymentId) async {
    // Define success and cancel URLs that the WebView can intercept
    final successUrl = 'http://localhost:3000/events/${widget.event.id}/payment/success';
    final cancelUrl = 'http://localhost:3000/events/${widget.event.id}/payment/cancel';
    
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
        body: WebViewWidget(
          controller: WebViewController()
            ..setJavaScriptMode(JavaScriptMode.unrestricted)
            ..setNavigationDelegate(
              NavigationDelegate(
                onNavigationRequest: (NavigationRequest request) async {
                  log('[BulkRegistration] WebView navigation request: ${request.url}');
                  
                  // Handle success URL
                  if (request.url.startsWith(successUrl)) {
                    final uri = Uri.parse(request.url);
                    final payerId = uri.queryParameters['PayerID'] ?? uri.queryParameters['payer_id'];
                    final token = uri.queryParameters['token'];
                    
                    log('[BulkRegistration] Payment success detected - PayerID: $payerId, token: $token');
                    
                    if (payerId != null && token != null) {
                      // Close WebView and trigger success handling
                      Navigator.pop(context);
                      
                      // Complete the bulk registration
                      await _completeBulkRegistrationAfterPayment(paymentId, payerId);
                      
                      // Trigger success callback
                      widget.onSuccess?.call();
                    }
                    return NavigationDecision.prevent;
                  }
                  
                  // Handle cancel URL  
                  if (request.url.startsWith(cancelUrl)) {
                    log('[BulkRegistration] Payment cancel detected');
                    Navigator.pop(context);
                    setState(() {
                      _errorMessage = 'Payment cancelled by user';
                    });
                    return NavigationDecision.prevent;
                  }
                  
                  return NavigationDecision.navigate;
                },
              ),
            )
            ..loadRequest(Uri.parse(approvalUrl)),
        ),
      ),
    ));
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
      setState(() {
        _errorMessage = 'Payment successful but registration failed. Please contact support.';
      });
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