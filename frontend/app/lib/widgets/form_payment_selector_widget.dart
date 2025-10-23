import 'package:flutter/material.dart';
import 'package:app/services/form_payment_service.dart';
import 'package:app/widgets/form_payment_widget.dart';

class FormPaymentSelectorWidget extends StatefulWidget {
  final String formSlug;
  final String formTitle;
  final Map<String, dynamic> formResponse;
  final double totalAmount;
  final List<String> paymentMethods;
  final VoidCallback onPaymentSuccess;
  final Function(String) onPaymentError;
  final VoidCallback onPaymentCancel;

  const FormPaymentSelectorWidget({
    super.key,
    required this.formSlug,
    required this.formTitle,
    required this.formResponse,
    required this.totalAmount,
    required this.paymentMethods,
    required this.onPaymentSuccess,
    required this.onPaymentError,
    required this.onPaymentCancel,
  });

  @override
  State<FormPaymentSelectorWidget> createState() =>
      _FormPaymentSelectorWidgetState();
}

class _FormPaymentSelectorWidgetState extends State<FormPaymentSelectorWidget> {
  String? _selectedPaymentMethod;
  bool _processing = false;

  @override
  void initState() {
    super.initState();
    // Auto-select if only one payment method is available
    if (widget.paymentMethods.length == 1) {
      _selectedPaymentMethod = widget.paymentMethods.first;
    }
  }

  Future<void> _processPayment() async {
    if (_selectedPaymentMethod == null) return;

    if (_selectedPaymentMethod == 'door') {
      await _processDoorPayment();
    } else if (_selectedPaymentMethod == 'paypal') {
      // PayPal payment will be handled by FormPaymentWidget
      setState(() {
        // This will show the PayPal widget
      });
    }
  }

  Future<void> _processDoorPayment() async {
    setState(() {
      _processing = true;
    });

    try {
      final result = await FormPaymentService.completeDoorPayment(
        formSlug: widget.formSlug,
        formResponse: widget.formResponse,
        paymentAmount: widget.totalAmount,
      );

      if (result != null && result['success'] == true) {
        widget.onPaymentSuccess();
      } else {
        widget.onPaymentError('Failed to submit form with door payment option');
      }
    } catch (e) {
      widget.onPaymentError('Error processing door payment: $e');
    } finally {
      setState(() {
        _processing = false;
      });
    }
  }

  Widget _buildPaymentMethodTile(String method) {
    String title;
    String subtitle;
    IconData icon;

    switch (method) {
      case 'paypal':
        title = 'Pay with PayPal';
        subtitle = 'Secure online payment';
        icon = Icons.payment;
        break;
      case 'door':
        title = 'Pay at Door';
        subtitle = 'Pay when you arrive';
        icon = Icons.store;
        break;
      default:
        title = method.toUpperCase();
        subtitle = 'Payment method';
        icon = Icons.payment;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: RadioListTile<String>(
        value: method,
        groupValue: _selectedPaymentMethod,
        onChanged: _processing ? null : (value) {
          setState(() {
            _selectedPaymentMethod = value;
          });
        },
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(subtitle),
        secondary: Icon(icon),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: _selectedPaymentMethod == method
                ? Theme.of(context).primaryColor
                : Colors.grey.shade300,
          ),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // If PayPal is selected and it's the final step, show the PayPal widget
    if (_selectedPaymentMethod == 'paypal' && widget.paymentMethods.contains('paypal')) {
      return FormPaymentWidget(
        formSlug: widget.formSlug,
        formTitle: widget.formTitle,
        formResponse: widget.formResponse,
        totalAmount: widget.totalAmount,
        onPaymentSuccess: widget.onPaymentSuccess,
        onPaymentError: widget.onPaymentError,
        onPaymentCancel: () {
          setState(() {
            _selectedPaymentMethod = null;
          });
          widget.onPaymentCancel();
        },
      );
    }

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Choose Payment Method',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            
            Text(
              'Total: \$${widget.totalAmount.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),

            // Payment method options
            ...widget.paymentMethods.map(_buildPaymentMethodTile),

            const SizedBox(height: 16),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _processing ? null : widget.onPaymentCancel,
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _processing || _selectedPaymentMethod == null
                        ? null
                        : _processPayment,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.black,
                    ),
                    child: _processing
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            _selectedPaymentMethod == 'door'
                                ? 'Submit Form'
                                : 'Continue',
                          ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}