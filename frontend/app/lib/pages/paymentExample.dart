import 'package:flutter/material.dart';
import 'package:flutter_paypal_payment/flutter_paypal_payment.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'dart:developer';

class PaymentExample extends StatelessWidget {
  const PaymentExample({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PaypalPaymentDemp',
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        appBar: AppBar(
          backgroundColor: const Color.fromARGB(159, 144, 79, 230),
          iconTheme: const IconThemeData(color: Colors.white),
          title: const Padding(
            padding: EdgeInsets.only(left: 80),
            child: Text(
              'PaymentExample',
              style: TextStyle(color: Colors.white),
            ),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        backgroundColor: const Color.fromARGB(246, 244, 236, 255),
        body: SafeArea(
          minimum: const EdgeInsets.symmetric(horizontal: 10),
          child: Center(
            child: TextButton(
              onPressed: () {
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (BuildContext context) => PaypalCheckoutView(
                    sandboxMode: true,
                    clientId: dotenv.env['PAYPAL_CLIENT_ID'],
                    secretKey: dotenv.env['PAYPAL_CLIENT_SECRET'],
                    transactions: const [
                      {
                        "amount": {
                          "total": '100',
                          "currency": "USD",
                          "details": {
                            "subtotal": '100',
                            "shipping": '0',
                            "shipping_discount": 0
                          }
                        },
                        "description": "The payment transaction description.",
                        // "payment_options": {
                        //   "allowed_payment_method":
                        //       "INSTANT_FUNDING_SOURCE"
                        // },
                        "item_list": {
                          "items": [
                            {
                              "name": "Apple",
                              "quantity": 4,
                              "price": '10',
                              "currency": "USD"
                            },
                            {
                              "name": "Pineapple",
                              "quantity": 5,
                              "price": '12',
                              "currency": "USD"
                            }
                          ],

                          // Optional
                          //   "shipping_address": {
                          //     "recipient_name": "Tharwat samy",
                          //     "line1": "tharwat",
                          //     "line2": "",
                          //     "city": "tharwat",
                          //     "country_code": "EG",
                          //     "postal_code": "25025",
                          //     "phone": "+00000000",
                          //     "state": "ALex"
                          //  },
                        }
                      }
                    ],
                    note: "Contact us for any questions on your order.",
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
                ));
              },
              style: TextButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
              child: const Text('Pay with PayPal', style: TextStyle(fontSize: 16)),
            ),
          ),
        ),
      ),
    );
  }
}
