import 'package:flutter/material.dart';

/// Common PayPal payment dialog utilities
class PayPalDialogs {
  /// Show success dialog
  static void showSuccessDialog({
    required BuildContext context,
    required double amount,
    String? message,
    VoidCallback? onOk,
  }) {
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
          message ?? 'Your payment of \$${amount.toStringAsFixed(2)} has been processed successfully.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              onOk?.call();
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  /// Show error dialog
  static void showErrorDialog({
    required BuildContext context,
    required String error,
    VoidCallback? onOk,
  }) {
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
              onOk?.call();
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  /// Show cancel dialog
  static void showCancelDialog({
    required BuildContext context,
    String? message,
    VoidCallback? onOk,
  }) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(
          Icons.cancel,
          color: Colors.orange,
          size: 48,
        ),
        title: const Text('Payment Cancelled'),
        content: Text(
          message ?? 'Your payment was cancelled. You can try again later.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              onOk?.call();
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}

/// Common PayPal button styles and configurations
class PayPalButtonStyles {
  static const Color paypalBlue = Color(0xFF0070BA);
  static const Color paypalLightBlue = Color(0xFF009CDE);
  
  static ButtonStyle getPrimaryStyle({Color? backgroundColor}) {
    return ElevatedButton.styleFrom(
      backgroundColor: backgroundColor ?? paypalBlue,
      foregroundColor: Colors.white,
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
      ),
    );
  }

  static ButtonStyle getFormPaymentStyle() {
    return ElevatedButton.styleFrom(
      backgroundColor: paypalBlue,
      foregroundColor: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(6),
      ),
    );
  }
}