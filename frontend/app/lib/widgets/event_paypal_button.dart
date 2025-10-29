import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:app/models/event.dart';
import 'package:app/services/paypal_service.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

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
      parts = filtered.split('.');
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

class EventPayPalButton extends StatefulWidget {
  final Event event;
  final VoidCallback? onPaymentSuccess;
  final Function(String)? onPaymentError;
  final double? donationAmount; // For free events

  const EventPayPalButton({
    super.key,
    required this.event,
    this.onPaymentSuccess,
    this.onPaymentError,
    this.donationAmount,
  });

  @override
  State<EventPayPalButton> createState() => _EventPayPalButtonState();
}

class _EventPayPalButtonState extends State<EventPayPalButton> {
  bool _isLoading = false;
  late double _donationAmount;

  /// Get the frontend base URL from environment variables with fallback
  String get _frontendBaseUrl {
    final envUrl = dotenv.env['FRONTEND_URL'];
    if (envUrl != null && envUrl.isNotEmpty) {
      return envUrl.replaceAll(RegExp(r'/+$'), ''); // Remove trailing slashes
    }
    
    // Fallback to localhost for development
    const fallbackUrl = 'http://localhost:3000';
    
    // Log warning in debug mode when using fallback
    if (kDebugMode) {
      log('Warning: FRONTEND_URL not configured, using fallback: $fallbackUrl');
    }
    
    return fallbackUrl;
  }

  @override
  void initState() {
    super.initState();
    // Initialize donation amount from widget prop (if provided) or sensible default
    _donationAmount = widget.donationAmount ?? (widget.event.requiresPayment ? widget.event.price : 10.0);
  }

  Future<void> _initiatePayment() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Determine the payment amounts
      double eventFee = 0.0;
      double donationAmount = 0.0;
      
      if (widget.event.requiresPayment) {
        // Paid event - event fee is required, donation is optional additional amount
        eventFee = widget.event.price;
        donationAmount = _donationAmount > widget.event.price ? (_donationAmount - widget.event.price) : 0.0;
      } else {
        // Free event - no event fee, all amount goes to donation
        eventFee = 0.0;
        donationAmount = _donationAmount;
        if (donationAmount <= 0) {
          throw Exception('Donation amount must be greater than zero');
        }
      }

      // Create payment order
      final result = await PaypalService.createEventPaymentOrder(
        eventId: widget.event.id,
        eventName: widget.event.name,
        eventFee: eventFee,
        donationAmount: donationAmount,
        message: widget.event.requiresPayment
            ? 'Payment for event: ${widget.event.name}'
            : 'Donation for event: ${widget.event.name}',
        returnUrl: '$_frontendBaseUrl/events/${widget.event.id}/payment/success',
        cancelUrl: '$_frontendBaseUrl/events/${widget.event.id}/payment/cancel',
      );

      if (result != null && result['success'] == true) {
        final approvalUrl = result['approval_url'] as String?;
        final paymentId = result['payment_id'] as String?;
        
        if (approvalUrl != null && paymentId != null) {
          // Use WebView to handle PayPal payment like donation flow
          if (mounted) {
            _showPayPalWebView(approvalUrl, paymentId);
          }
        } else {
          throw Exception('No approval URL or payment ID received');
        }
      } else {
        final error = result?['error'] ?? 'Failed to create payment order';
        throw Exception(error);
      }
    } catch (e) {
      if (mounted) {
        widget.onPaymentError?.call(e.toString());
        _showErrorDialog(e.toString());
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showPayPalWebView(String approvalUrl, String paymentId) {
    // Define success and cancel URLs that the WebView can intercept
    final successUrl = '$_frontendBaseUrl/events/${widget.event.id}/payment/success';
    final cancelUrl = '$_frontendBaseUrl/events/${widget.event.id}/payment/cancel';
    
    Navigator.of(context).push(MaterialPageRoute(
      builder: (context) => Scaffold(
        appBar: AppBar(
          title: const Text('Complete Payment'),
          backgroundColor: Theme.of(context).primaryColor,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () {
              Navigator.pop(context);
              if (widget.onPaymentError != null) {
                widget.onPaymentError!('Payment cancelled by user');
              }
            },
          ),
        ),
        body: WebViewWidget(
          controller: WebViewController()
            ..setJavaScriptMode(JavaScriptMode.unrestricted)
            ..setNavigationDelegate(
              NavigationDelegate(
                onNavigationRequest: (NavigationRequest request) async {
                  final sanitizedUrl = request.url.split('?')[0];
                  log('WebView navigation request: $sanitizedUrl', name: 'EventPayPalButton');
                  
                  // Handle success URL
                  if (request.url.startsWith(successUrl)) {
                    final uri = Uri.parse(request.url);
                    final payerId = uri.queryParameters['PayerID'] ?? uri.queryParameters['payer_id'];
                    final token = uri.queryParameters['token'];
                    
                    log('Payment success detected', name: 'EventPayPalButton');
                    
                    if (payerId != null && token != null) {
                      // Simulate deep link success handling
                      Navigator.pop(context);
                      
                      // Complete registration on backend before reporting success
                      final completed = await _triggerEventPaymentCompletion(
                        widget.event.id,
                        paymentId,
                        payerId,
                      );
                      if (completed) {
                        widget.onPaymentSuccess?.call();
                      } else {
                        widget.onPaymentError?.call('Failed to complete payment on server.');
                      } 
                    }
                    return NavigationDecision.prevent;
                  }
                  
                  // Handle cancel URL  
                  if (request.url.startsWith(cancelUrl)) {
                    log('Payment cancel detected', name: 'EventPayPalButton');
                    Navigator.pop(context);
                    if (widget.onPaymentError != null) {
                      widget.onPaymentError!('Payment cancelled by user');
                    }
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

  Future<bool> _triggerEventPaymentCompletion(
    String eventId,
    String paymentId,
    String payerId,
  ) async {
     // This simulates what the deep linking service does for event payment completion
     // We can call the same backend endpoint that handles payment completionv
    log('Triggering event payment completion', name: 'EventPayPalButton');
    try {
      final res = await PaypalService.completeEventPayment(
        eventId: eventId,
        paymentId: paymentId,
        payerId: payerId,
      );
      if (res != null && res['success'] == true) {
        return true;
      }
      _showErrorDialog(res?['error'] ?? 'Failed to complete registration.');
      return false;
    } catch (e) {
      log('Completion error: $e', name: 'EventPayPalButton');
      _showErrorDialog('Network error completing registration.');
      return false;
    }
  }

  void _showErrorDialog(String error) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment Error'),
        content: Text('Failed to start payment: $error'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
  // Determine button appearance based on event type
  final isPaidEvent = widget.event.requiresPayment;
  final amount = isPaidEvent ? widget.event.price : _donationAmount;
    
    String buttonText;
    Color buttonColor;
    IconData buttonIcon;
    
    if (isPaidEvent) {
      buttonText = 'Pay \$${amount.toStringAsFixed(2)} with PayPal';
      buttonColor = const Color(0xFF0070BA); // PayPal blue
      buttonIcon = Icons.payment;
    } else {
      buttonText = 'Donate \$${amount.toStringAsFixed(2)} with PayPal';
      buttonColor = const Color(0xFF009CDE); // Lighter blue for donations
      buttonIcon = Icons.volunteer_activism;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
  // If this is a free event and donations are allowed, show the amount selector
  if (!isPaidEvent && widget.event.allowsDonations) ...[
          DonationAmountSelector(
            initialAmount: _donationAmount,
            onAmountChanged: (amt) => setState(() => _donationAmount = amt),
          ),
          const SizedBox(height: 12),
        ],

        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton.icon(
        onPressed: (_isLoading || (!isPaidEvent && _donationAmount <= 0)) ? null : _initiatePayment,
        icon: _isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Icon(buttonIcon, color: Colors.white),
        label: Text(
          _isLoading ? 'Processing...' : buttonText,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: buttonColor,
          disabledBackgroundColor: buttonColor.withValues(alpha: 0.6),
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        ),
      ),
      ],
    );
  }
}

// Widget for donation amount selection on free events
class DonationAmountSelector extends StatefulWidget {
  final Function(double) onAmountChanged;
  final double initialAmount;

  const DonationAmountSelector({
    super.key,
    required this.onAmountChanged,
    this.initialAmount = 10.0,
  });

  @override
  State<DonationAmountSelector> createState() => _DonationAmountSelectorState();
}

class _DonationAmountSelectorState extends State<DonationAmountSelector> {
  late double _selectedAmount;
  final TextEditingController _customAmountController = TextEditingController();
  bool _isCustomAmount = false;

  final List<double> _presetAmounts = [5.0, 10.0, 25.0, 50.0, 100.0];

  @override
  void initState() {
    super.initState();
    _selectedAmount = widget.initialAmount;
    _customAmountController.text = _selectedAmount.toStringAsFixed(2);
  }

  void _selectAmount(double amount) {
    setState(() {
      _selectedAmount = amount;
      _isCustomAmount = false;
      _customAmountController.text = amount.toStringAsFixed(2);
    });
    widget.onAmountChanged(amount);
  }

  void _onCustomAmountChanged(String value) {
    final amount = double.tryParse(value);
    if (amount != null && amount >= 0) {
      setState(() {
        _selectedAmount = amount;
        _isCustomAmount = true;
      });
      widget.onAmountChanged(amount);
    } else if (value.isEmpty) {
      // Allow empty input
      setState(() {
        _selectedAmount = 0.0;
        _isCustomAmount = true;
      });
      widget.onAmountChanged(0.0);
    }
  }

  String? _validateCustomAmount(String value) {
    if (value.isEmpty) return null;
    
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
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select Donation Amount',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _presetAmounts.map((amount) {
            final isSelected = !_isCustomAmount && _selectedAmount == amount;
            return GestureDetector(
              onTap: () => _selectAmount(amount),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? Theme.of(context).primaryColor : Colors.grey[200],
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? Theme.of(context).primaryColor : Colors.grey[300]!,
                  ),
                ),
                child: Text(
                  '\$${amount.toStringAsFixed(0)}',
                  style: TextStyle(
                    color: isSelected ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            const Text('\$'),
            const SizedBox(width: 4),
            Expanded(
              child: TextField(
                controller: _customAmountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  CurrencyInputFormatter(),
                ],
                decoration: InputDecoration(
                  hintText: 'Custom amount',
                  border: const OutlineInputBorder(),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  errorText: _validateCustomAmount(_customAmountController.text),
                ),
                onChanged: (value) {
                  _onCustomAmountChanged(value);
                  setState(() {}); // Trigger rebuild to show/hide validation errors
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  @override
  void dispose() {
    _customAmountController.dispose();
    super.dispose();
  }
}