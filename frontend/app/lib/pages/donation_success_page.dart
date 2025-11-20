import 'package:flutter/material.dart';
import 'package:app/helpers/localized_widgets.dart';

class DonationSuccessPage extends StatelessWidget {
  final String eventName;

  const DonationSuccessPage({super.key, required this.eventName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Thank You').localized(),
        backgroundColor: const Color.fromARGB(255, 142, 163, 168),
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Icon(Icons.volunteer_activism, size: 72, color: Color.fromARGB(255, 34, 197, 94)),
              const SizedBox(height: 24),
              Text(
                'Thank you for supporting',
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ).localized(),
              const SizedBox(height: 8),
              Text(
                eventName,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Text(
                'Your donation was successful. We appreciate your generosity.',  // Keep $amount dynamic
                style: TextStyle(fontSize: 16),
                textAlign: TextAlign.center,
              ).localized(),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () {
                  // Pop until the top (close success and event pages) or go back one
                  if (Navigator.of(context).canPop()) Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color.fromARGB(255, 142, 163, 168),
                ),
                child: Text(
                  'Close',
                ).localized(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
