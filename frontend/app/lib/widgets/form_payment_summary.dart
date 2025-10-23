import 'package:flutter/material.dart';
import 'package:app/services/form_payment_service.dart';

class FormPaymentSummary extends StatelessWidget {
  final Map<String, dynamic> form;
  final Map<String, dynamic> values;

  const FormPaymentSummary({
    super.key,
    required this.form,
    required this.values,
  });

  List<PaymentItem> _getPaymentItems() {
    final items = <PaymentItem>[];
    final fields = form['data'];
    if (fields is! List) return items;

    for (final field in fields) {
      if (field is! Map<String, dynamic>) continue;
      
      final type = field['type']?.toString() ?? 'text';
      final name = field['name']?.toString() ?? '';
      final label = field['label']?.toString() ?? name;
      final value = values[name];

      switch (type) {
        case 'price':
          if (value is num && value > 0) {
            items.add(PaymentItem(
              label: label,
              amount: value.toDouble(),
              description: 'Price field entry',
            ));
          }
          break;
          
        case 'checkbox':
        case 'switch':
          if (value == true && field['price'] is num) {
            final price = (field['price'] as num).toDouble();
            items.add(PaymentItem(
              label: label,
              amount: price,
              description: 'Selected option',
            ));
          }
          break;
          
        case 'radio':
        case 'select':
          final options = field['options'] ?? field['choices'] ?? [];
          if (options is List && value != null) {
            for (final option in options) {
              if (option is Map<String, dynamic> && 
                  option['value'] == value && 
                  option['price'] is num) {
                final price = (option['price'] as num).toDouble();
                final optionLabel = option['label']?.toString() ?? value.toString();
                items.add(PaymentItem(
                  label: '$label: $optionLabel',
                  amount: price,
                  description: 'Selected option',
                ));
              }
            }
          }
          break;
          
        case 'date':
          final pricing = field['pricing'];
          if (pricing is Map<String, dynamic> && value is String) {
            try {
              final date = DateTime.parse(value);
              final weekday = _getWeekdayName(date.weekday);
              if (pricing[weekday] is num) {
                final price = (pricing[weekday] as num).toDouble();
                items.add(PaymentItem(
                  label: '$label: ${_formatDate(date)}',
                  amount: price,
                  description: 'Date-based pricing',
                ));
              }
            } catch (e) {
              // Ignore date parsing errors
            }
          }
          break;
      }
    }
    
    return items;
  }

  String _getWeekdayName(int weekday) {
    switch (weekday) {
      case 1: return 'monday';
      case 2: return 'tuesday';
      case 3: return 'wednesday';
      case 4: return 'thursday';
      case 5: return 'friday';
      case 6: return 'saturday';
      case 7: return 'sunday';
      default: return 'monday';
    }
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final items = _getPaymentItems();
    final total = FormPaymentService.calculateFormTotal(form, values);

    if (items.isEmpty || total <= 0) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
        color: Colors.white,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.receipt_long,
                color: Colors.blue,
                size: 24,
              ),
              const SizedBox(width: 8),
              const Text(
                'Payment Summary',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Payment items
          ...items.map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.label,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (item.description.isNotEmpty)
                        Text(
                          item.description,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                    ],
                  ),
                ),
                Text(
                  '\$${item.amount.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          )),
          
          const Divider(),
          
          // Total
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Total Amount:',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '\$${total.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.green,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class PaymentItem {
  final String label;
  final double amount;
  final String description;

  PaymentItem({
    required this.label,
    required this.amount,
    this.description = '',
  });
}