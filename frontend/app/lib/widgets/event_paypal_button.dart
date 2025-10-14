import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/event.dart';
import '../services/paypal_service.dart';

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

class EventPayPalButton extends StatefulWidget {
  final Event event;
  final VoidCallback? onPaymentSuccess;
  final Function(String)? onPaymentError;
  final double? donationAmount; // For free events

  const EventPayPalButton({
    Key? key,
    required this.event,
    this.onPaymentSuccess,
    this.onPaymentError,
    this.donationAmount,
  }) : super(key: key);

  @override
  State<EventPayPalButton> createState() => _EventPayPalButtonState();
}

class _EventPayPalButtonState extends State<EventPayPalButton> {
  bool _isLoading = false;

  Future<void> _initiatePayment() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Determine the payment amount
      double amount;
      
      if (widget.event.requiresPayment) {
        // Paid event - use event price
        amount = widget.event.price;
      } else {
        // Free event with donations - use provided amount or default
        amount = widget.donationAmount ?? 10.0;
      }

      // Create payment order
      final result = await PaypalService.createEventPaymentOrder(
        eventId: widget.event.id,
        eventName: widget.event.name,
        amount: amount,
        message: widget.event.requiresPayment
            ? 'Payment for event: ${widget.event.name}'
            : 'Donation for event: ${widget.event.name}',
        returnUrl: 'churchlink://paypal-success/${widget.event.id}',
        cancelUrl: 'churchlink://paypal-cancel/${widget.event.id}',
      );

      if (result != null && result['success'] == true) {
        final approvalUrl = result['approval_url'] as String?;
        
        if (approvalUrl != null) {
          // Launch PayPal payment in browser
          final uri = Uri.parse(approvalUrl);
          if (await canLaunchUrl(uri)) {
            await launchUrl(
              uri,
              mode: LaunchMode.externalApplication,
            );
            
            // Show dialog explaining next steps
            if (mounted) {
              _showPaymentInstructionsDialog();
            }
          } else {
            throw Exception('Could not launch PayPal payment');
          }
        } else {
          throw Exception('No approval URL received');
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

  void _showPaymentInstructionsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment Started'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('You have been redirected to PayPal to complete your payment.'),
            const SizedBox(height: 12),
            const Text('After completing the payment:'),
            const SizedBox(height: 8),
            const Text('• Return to this app'),
            const Text('• Your registration will be automatically confirmed'),
            const Text('• You will receive a confirmation email'),
            const SizedBox(height: 12),
            Text(
              widget.event.requiresPayment
                  ? 'Payment is required to complete your registration.'
                  : 'Thank you for your generous donation!',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
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
    final amount = isPaidEvent ? widget.event.price : (widget.donationAmount ?? 10.0);
    
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

    return Container(
      width: double.infinity,
      height: 50,
      child: ElevatedButton.icon(
        onPressed: _isLoading ? null : _initiatePayment,
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
          disabledBackgroundColor: buttonColor.withOpacity(0.6),
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
    );
  }
}

// Widget for donation amount selection on free events
class DonationAmountSelector extends StatefulWidget {
  final Function(double) onAmountChanged;
  final double initialAmount;

  const DonationAmountSelector({
    Key? key,
    required this.onAmountChanged,
    this.initialAmount = 10.0,
  }) : super(key: key);

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