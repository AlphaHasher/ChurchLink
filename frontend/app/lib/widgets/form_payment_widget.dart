import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:app/services/form_payment_service.dart';
import 'dart:developer';

class FormPaymentWidget extends StatefulWidget {
  final String formSlug;
  final String formTitle;
  final Map<String, dynamic> formResponse;
  final double totalAmount;
  final VoidCallback? onPaymentSuccess;
  final Function(String)? onPaymentError;
  final VoidCallback? onPaymentCancel;

  const FormPaymentWidget({
    super.key,
    required this.formSlug,
    required this.formTitle,
    required this.formResponse,
    required this.totalAmount,
    this.onPaymentSuccess,
    this.onPaymentError,
    this.onPaymentCancel,
  });

  @override
  State<FormPaymentWidget> createState() => _FormPaymentWidgetState();
}

class _FormPaymentWidgetState extends State<FormPaymentWidget> {
  bool _isLoading = false;
  String? _error;

  Future<void> _initiatePayment() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      log('[FormPaymentWidget] Initiating payment for form: ${widget.formSlug}');
      log('[FormPaymentWidget] Total amount: ${widget.totalAmount}');

      // Validate amount
      if (widget.totalAmount <= 0) {
        throw Exception('Payment amount must be greater than zero');
      }

      // Create payment order
      final result = await FormPaymentService.createFormPaymentOrder(
        formSlug: widget.formSlug,
        paymentData: {
          'amount': widget.totalAmount,
          'form_response': widget.formResponse,
          'metadata': {
            'form_title': widget.formTitle,
            'payment_type': 'form_submission',
          },
        },
      );

      if (result != null && result['success'] == true) {
        final approvalUrl = result['approval_url'] as String?;
        final paymentId = result['order_id'] as String?;

        if (approvalUrl != null && paymentId != null) {
          log('[FormPaymentWidget] Opening PayPal WebView with URL: $approvalUrl');
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
      log('[FormPaymentWidget] Payment initiation error: $e');
      if (mounted) {
        setState(() {
          _error = e.toString();
        });
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
    // Create WebView controller
    late final WebViewController controller;
    
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            log('[FormPaymentWidget] WebView page started: $url');
            
            // Check for success URL pattern
            if (url.contains('payment/success') || url.contains('PayerID=')) {
              Navigator.of(context).pop();
              _handlePaymentSuccess(url, paymentId);
            }
            // Check for cancel URL pattern
            else if (url.contains('payment/cancel') || url.contains('cancel')) {
              Navigator.of(context).pop();
              _handlePaymentCancel();
            }
          },
          onPageFinished: (String url) {
            log('[FormPaymentWidget] WebView page finished: $url');
          },
        ),
      )
      ..loadRequest(Uri.parse(approvalUrl));

    // Show fullscreen PayPal WebView
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (context) => Scaffold(
          appBar: AppBar(
            title: const Text('Complete Payment'),
            leading: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () {
                Navigator.of(context).pop();
                widget.onPaymentCancel?.call();
              },
            ),
            backgroundColor: const Color(0xFF0070BA),
            foregroundColor: Colors.white,
          ),
          body: SafeArea(
            child: WebViewWidget(controller: controller),
          ),
        ),
      ),
    );
  }

  void _handlePaymentSuccess(String url, String paymentId) async {
    try {
      log('[FormPaymentWidget] Handling payment success for URL: $url');
      
      // Extract PayerID from URL
      final uri = Uri.parse(url);
      final payerId = uri.queryParameters['PayerID'] ?? '';
      
      if (payerId.isEmpty) {
        throw Exception('PayerID not found in success URL');
      }

      log('[FormPaymentWidget] Completing PayPal payment with PaymentID: $paymentId, PayerID: $payerId');

      // Complete the PayPal payment
      final result = await FormPaymentService.completePayPalPayment(
        formSlug: widget.formSlug,
        orderId: paymentId,
        payerId: payerId,
        formResponse: widget.formResponse,
      );

      if (result != null && result['success'] == true) {
        log('[FormPaymentWidget] Payment completed successfully');
        widget.onPaymentSuccess?.call();
        if (mounted) {
          _showSuccessDialog();
        }
      } else {
        final error = result?['error'] ?? 'Failed to complete payment';
        throw Exception(error);
      }
    } catch (e) {
      log('[FormPaymentWidget] Payment completion error: $e');
      if (mounted) {
        widget.onPaymentError?.call(e.toString());
        _showErrorDialog('Payment completion failed: ${e.toString()}');
      }
    }
  }

  void _handlePaymentCancel() {
    log('[FormPaymentWidget] Payment was cancelled by user');
    widget.onPaymentCancel?.call();
    if (mounted) {
      _showCancelDialog();
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        icon: const Icon(
          Icons.check_circle,
          color: Colors.green,
          size: 48,
        ),
        title: const Text('Payment Successful'),
        content: Text(
          'Your payment of \$${widget.totalAmount.toStringAsFixed(2)} has been processed successfully. Your form submission is now complete.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showErrorDialog(String error) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        icon: const Icon(
          Icons.error,
          color: Colors.red,
          size: 48,
        ),
        title: const Text('Payment Failed'),
        content: Text(
          'Payment processing failed: $error\n\nPlease try again or contact support if the problem persists.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showCancelDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(
          Icons.cancel,
          color: Colors.orange,
          size: 48,
        ),
        title: const Text('Payment Cancelled'),
        content: const Text(
          'Your payment was cancelled. You can try again or submit the form later.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
        color: Colors.grey.shade50,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.payment,
                color: Color(0xFF0070BA),
                size: 24,
              ),
              const SizedBox(width: 8),
              const Text(
                'Payment Required',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0070BA),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          
          // Payment summary
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Form: ${widget.formTitle}',
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Total Amount: \$${widget.totalAmount.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error, color: Colors.red, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                ],
              ),
            ),
          ],
          
          const SizedBox(height: 16),
          
          // Payment button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _initiatePayment,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0070BA),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              child: _isLoading
                  ? const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        ),
                        SizedBox(width: 8),
                        Text('Processing...'),
                      ],
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.payment, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Pay with PayPal',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
          
          const SizedBox(height: 8),
          
          // Security note
          const Text(
            'Secure payment powered by PayPal. Your payment information is encrypted and secure.',
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}