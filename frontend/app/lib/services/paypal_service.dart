import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:flutter_paypal_payment/flutter_paypal_payment.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

// WIP!!!!

// A centralized service for launching PayPal checkout flows.
//
// Extracts the payment logic so that any page can import and reuse it
// without duplicating code.
class PaypalService {
  // Initiates the PayPal checkout.
  //
  // [context]: The BuildContext from which to push the checkout view.
  // [sandboxMode]: Whether to use PayPal sandbox (true) or live environment (false).
  // [transactions]: A list of transaction maps following PayPal's expected format.
  // [note]: Optional customer-facing note on the order.
  static void checkout({
    required BuildContext context,
    required bool sandboxMode,
    required List<Map<String, dynamic>> transactions,
    String note = "Contact us for any questions on your order.",
  }) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (BuildContext context) => PaypalCheckoutView(
          sandboxMode: sandboxMode,
          clientId: dotenv.env['PAYPAL_CLIENT_ID'],
          secretKey: dotenv.env['PAYPAL_CLIENT_SECRET'],
          transactions: transactions,
          note: note,
          onSuccess: (Map params) async {
            log("onSuccess: \$params");
            Navigator.pop(context);
          },
          onError: (error) {
            log("onError: \$error");
            Navigator.pop(context);
          },
          onCancel: () {
            print('cancelled:');
            Navigator.pop(context);
          },
        ),
      ),
    );
  }
}
