import 'package:flutter/material.dart';
import '../models/event.dart';
import '../widgets/event_paypal_button.dart';

class EventPaymentScreen extends StatefulWidget {
  final Event event;
  final Map<String, dynamic>? registrationData;

  const EventPaymentScreen({
    Key? key,
    required this.event,
    this.registrationData,
  }) : super(key: key);

  @override
  State<EventPaymentScreen> createState() => _EventPaymentScreenState();
}

class _EventPaymentScreenState extends State<EventPaymentScreen> {
  double _donationAmount = 10.0;
  bool _paymentCompleted = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Complete Registration'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Event Information Card
            Card(
              elevation: 4,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.event.name,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.calendar_today, size: 16, color: Colors.grey),
                        const SizedBox(width: 4),
                        Text(
                          widget.event.formattedDateTime,
                          style: const TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on, size: 16, color: Colors.grey),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            widget.event.location,
                            style: const TextStyle(color: Colors.grey),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: widget.event.requiresPayment 
                            ? Colors.orange[100] 
                            : Colors.green[100],
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        widget.event.paymentStatus,
                        style: TextStyle(
                          color: widget.event.requiresPayment 
                              ? Colors.orange[800] 
                              : Colors.green[800],
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Registration Success Message
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.green[50],
                border: Border.all(color: Colors.green[200]!),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.green[600]),
                      const SizedBox(width: 8),
                      const Text(
                        'Registration Successful!',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'You have successfully registered for ${widget.event.name}.',
                    style: const TextStyle(color: Colors.black87),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Payment Section
            if (widget.event.hasPayPalOption && !_paymentCompleted) ...[
              Text(
                widget.event.requiresPayment 
                    ? 'Complete Your Payment'
                    : 'Support This Event (Optional)',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.event.requiresPayment
                    ? 'Payment is required to confirm your spot for this event. You can pay online now or pay at the door.'
                    : 'This is a free event, but you can make an optional donation to support it.',
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 16),
              
              // Donation amount selector for free events
              if (!widget.event.requiresPayment) ...[
                DonationAmountSelector(
                  initialAmount: _donationAmount,
                  onAmountChanged: (amount) {
                    setState(() {
                      _donationAmount = amount;
                    });
                  },
                ),
                const SizedBox(height: 16),
              ],
              
              // PayPal Button
              EventPayPalButton(
                event: widget.event,
                donationAmount: widget.event.requiresPayment ? null : _donationAmount,
                onPaymentSuccess: () {
                  setState(() {
                    _paymentCompleted = true;
                  });
                  _showPaymentSuccessDialog();
                },
                onPaymentError: (error) {
                  _showPaymentErrorDialog(error);
                },
              ),
              
              const SizedBox(height: 16),
              
              // Skip payment option for free events or pay at door
              Container(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    _completeRegistrationWithoutPayment();
                  },
                  icon: const Icon(Icons.skip_next),
                  label: Text(
                    widget.event.requiresPayment 
                        ? 'I\'ll Pay at the Door'
                        : 'Skip Donation',
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ] else if (_paymentCompleted) ...[
              // Payment completed state
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  border: Border.all(color: Colors.blue[200]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  children: [
                    Icon(Icons.payment, color: Colors.blue[600], size: 32),
                    const SizedBox(height: 8),
                    const Text(
                      'Payment Completed!',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Your registration is now confirmed.',
                      style: TextStyle(color: Colors.black87),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Done'),
                ),
              ),
            ] else ...[
              // No PayPal enabled
              Container(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Complete Registration'),
                ),
              ),
            ],
            
            const SizedBox(height: 24),
            
            // Refund Policy
            if (widget.event.refundPolicy != null && widget.event.refundPolicy!.isNotEmpty) ...[
              const Text(
                'Refund Policy',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  border: Border.all(color: Colors.grey[200]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.event.refundPolicy!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.black87,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _completeRegistrationWithoutPayment() {
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          widget.event.requiresPayment
              ? 'Registration confirmed! Please remember to pay at the door.'
              : 'Registration completed successfully!',
        ),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _showPaymentSuccessDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment Successful'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 48),
            const SizedBox(height: 16),
            Text(
              widget.event.requiresPayment
                  ? 'Your payment has been processed and your registration is confirmed!'
                  : 'Thank you for your generous donation!',
              textAlign: TextAlign.center,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // Close dialog
              Navigator.of(context).pop(); // Close payment screen
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  void _showPaymentErrorDialog(String error) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment Error'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error, color: Colors.red, size: 48),
            const SizedBox(height: 16),
            Text(
              'Payment failed: $error',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            const Text(
              'You can try again or complete your registration and pay at the door.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Try Again'),
          ),
          if (widget.event.requiresPayment)
            TextButton(
              onPressed: () {
                Navigator.of(context).pop(); // Close dialog
                _completeRegistrationWithoutPayment();
              },
              child: const Text('Pay at Door'),
            ),
        ],
      ),
    );
  }
}