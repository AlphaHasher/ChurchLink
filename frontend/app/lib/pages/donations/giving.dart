import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/donation_helper.dart';
import 'package:app/models/donations.dart';
import 'package:app/pages/donations/donation_paypal_page.dart';
import 'package:app/pages/donations/donation_success_page.dart';
import 'package:app/widgets/events/event_map_card.dart';
import 'package:app/services/paypal_service.dart';

class Giving extends StatefulWidget {
  const Giving({super.key});

  @override
  State<Giving> createState() => _GivingState();
}

class _GivingState extends State<Giving> {
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _messageController = TextEditingController();

  bool _submitting = false;
  String? _error;

  bool _isRecurring = false;
  DonationInterval _interval = DonationInterval.month;
  final DonationCurrency _currency = DonationCurrency.usd;

  String _churchName = 'Your Church Name';
  Map<String, String> _churchAddress = {
    'address': '123 Main Street',
    'city': 'Your City',
    'state': 'ST',
    'postalCode': '12345',
  };

  @override
  void initState() {
    super.initState();
    _loadChurchName();
    _loadChurchAddress();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _loadChurchName() async {
    try {
      final churchName = await PaypalService.getChurchName();
      if (!mounted) return;
      setState(() {
        _churchName = churchName;
      });
    } catch (_) {
      // PaypalService handles its own defaults; keep the local default on failure.
    }
  }

  Future<void> _loadChurchAddress() async {
    try {
      final addr = await PaypalService.getChurchAddress();
      if (!mounted) return;
      setState(() {
        _churchAddress = Map<String, String>.from(addr);
      });
    } catch (_) {
      // Same here: keep default placeholder address.
    }
  }

  double? _parseAmount() {
    final raw = _amountController.text.trim();
    if (raw.isEmpty) return null;

    final normalized = raw.replaceAll(',', '');
    final v = double.tryParse(normalized);
    if (v == null || v <= 0) return null;
    return v;
  }

  void _setQuickAmount(double amount) {
    setState(() {
      _amountController.text = amount.toStringAsFixed(0);
      _error = null;
    });
  }

  String _intervalLabel(DonationInterval i) {
    final localize = LocalizationHelper.localize;
    switch (i) {
      case DonationInterval.week:
        return localize('Weekly');
      case DonationInterval.month:
        return localize('Monthly');
      case DonationInterval.year:
        return localize('Yearly');
    }
  }

  Future<void> _handleDonate() async {
    final localize = LocalizationHelper.localize;

    final amount = _parseAmount();
    if (amount == null) {
      setState(() {
        _error = localize('Please enter a valid amount greater than zero.');
      });
      return;
    }

    final message =
        _messageController.text.trim().isEmpty
            ? null
            : _messageController.text.trim();

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      if (_isRecurring) {
        // Recurring donation – create subscription then open PayPal.
        final req = CreateDonationSubscriptionRequest(
          amount: amount,
          currency: _currency,
          interval: _interval,
          message: message,
        );

        final res = await DonationHelper.createDonationSubscription(req);
        if (!res.success) {
          setState(() {
            _error =
                res.msg ?? localize('Could not create PayPal subscription.');
          });
          return;
        }

        if (res.approveUrl == null || res.approveUrl!.isEmpty) {
          setState(() {
            _error = localize(
              'Subscription created but no approval link returned by PayPal.',
            );
          });
          return;
        }

        if (!mounted) return;
        final paypalResult = await Navigator.of(
          context,
        ).push<DonationPaypalResult>(
          MaterialPageRoute(
            builder:
                (_) => DonationPaypalWebViewPage(
                  approveUrl: res.approveUrl!,
                  flow: DonationPaypalFlow.recurring,
                ),
          ),
        );

        if (!mounted) return;

        if (paypalResult == null ||
            paypalResult.state == DonationPaypalFlowState.cancelled) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                localize('Subscription was cancelled before completion.'),
              ),
            ),
          );
          return;
        }

        await Navigator.of(context).push(
          MaterialPageRoute(
            builder:
                (_) => DonationSuccessPage(
                  churchName: _churchName,
                  amount: amount,
                  currency: _currency,
                  isRecurring: true,
                  interval: _interval,
                ),
          ),
        );

        return;
      } else {
        // One-time donation – create order, open PayPal, then capture.
        final req = CreateOneTimeDonationRequest(
          amount: amount,
          currency: _currency,
          message: message,
        );

        final res = await DonationHelper.createOneTimeDonation(req);
        if (!res.success) {
          setState(() {
            _error =
                res.msg ??
                localize('Could not create PayPal order for donation.');
          });
          return;
        }

        if (res.orderId == null || res.orderId!.isEmpty) {
          setState(() {
            _error = localize(
              'Invalid response from server (missing order id).',
            );
          });
          return;
        }

        if (res.approveUrl == null || res.approveUrl!.isEmpty) {
          setState(() {
            _error = localize(
              'Order created but no approval link returned by PayPal.',
            );
          });
          return;
        }

        final orderId = res.orderId!;

        if (!mounted) return;
        final paypalResult = await Navigator.of(
          context,
        ).push<DonationPaypalResult>(
          MaterialPageRoute(
            builder:
                (_) => DonationPaypalWebViewPage(
                  approveUrl: res.approveUrl!,
                  flow: DonationPaypalFlow.oneTime,
                ),
          ),
        );

        if (!mounted) return;

        if (paypalResult == null ||
            paypalResult.state == DonationPaypalFlowState.cancelled) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                localize('Donation was cancelled before completion.'),
              ),
            ),
          );
          return;
        }

        final captureRes = await DonationHelper.captureOneTimeDonation(
          CaptureOneTimeDonationRequest(orderId: orderId),
        );

        if (!captureRes.success) {
          setState(() {
            _error =
                captureRes.msg ??
                localize(
                  'We could not confirm your PayPal donation. Please contact support if you were charged.',
                );
          });
          return;
        }

        if (!mounted) return;

        await Navigator.of(context).push(
          MaterialPageRoute(
            builder:
                (_) => DonationSuccessPage(
                  churchName: _churchName,
                  amount: captureRes.capturedAmount ?? amount,
                  currency: captureRes.currency ?? _currency,
                  isRecurring: false,
                ),
          ),
        );

        return;
      }
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Widget _buildHero(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Icon(Icons.church, size: 64, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              localize('Supporting $_churchName'),
              textAlign: TextAlign.center,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              localize(
                'Your generosity helps support the ongoing ministry, outreach, and care of our church family.',
              ),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDonationCard(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    return Card(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              localize('Give Online', capitalize: true),
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              localize(
                'Give securely through PayPal. You can make a one-time gift or set up an automatic recurring donation.',
              ),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 20),

            // Mode selector
            Text(
              localize('How often would you like to give?'),
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: Text(localize('One-Time')),
                    selected: !_isRecurring,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() {
                          _isRecurring = false;
                          _error = null;
                        });
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: Text(localize('Recurring')),
                    selected: _isRecurring,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() {
                          _isRecurring = true;
                          _error = null;
                        });
                      }
                    },
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Amount input
            Text(
              localize('Donation Amount'),
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                prefixText: '\$',
                hintText: localize('Enter amount'),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (final preset in <double>[25, 50, 100])
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: OutlinedButton(
                        onPressed: () => _setQuickAmount(preset),
                        child: Text('\$${preset.toStringAsFixed(0)}'),
                      ),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 16),

            if (_isRecurring) ...[
              Text(
                localize('How often?', capitalize: true),
                style: theme.textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<DonationInterval>(
                initialValue: _interval,
                items:
                    DonationInterval.values
                        .map(
                          (i) => DropdownMenuItem<DonationInterval>(
                            value: i,
                            child: Text(_intervalLabel(i)),
                          ),
                        )
                        .toList(),
                onChanged: (val) {
                  if (val == null) return;
                  setState(() {
                    _interval = val;
                  });
                },
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Optional message
            Text(
              localize('Add a note (optional)'),
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _messageController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: localize(
                  'You can include a short message with your gift.',
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),

            const SizedBox(height: 20),

            if (_error != null) ...[
              Text(
                _error!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
              const SizedBox(height: 12),
            ],

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _submitting ? null : _handleDonate,
                icon:
                    _submitting
                        ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                        : const Icon(Icons.payments),
                label: Text(
                  _isRecurring
                      ? localize('Give with PayPal (Recurring)')
                      : localize('Give with PayPal (One-Time)'),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.black,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapSection(BuildContext context) {
    final addressParts =
        [
          _churchAddress['address'],
          _churchAddress['city'],
          _churchAddress['state'],
          _churchAddress['postalCode'],
        ].where((p) => p != null && p.trim().isNotEmpty).toList();

    final fullAddress = addressParts.join(', ');

    return EventMapCard(
      locationInfo: _churchName,
      locationAddress: fullAddress,
    );
  }

  Widget _buildMailInCard(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.local_post_office_outlined,
                  size: 28,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 12),
                Text(
                  localize('Mail-in Donations'),
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              localize(
                'Prefer to send a check? Mail your donation to our church address. Please make checks payable to $_churchName.',
              ),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        size: 20,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        localize('Mailing Address'),
                        style: theme.textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.only(left: 26),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if ((_churchAddress['address'] ?? '').isNotEmpty)
                          Text(
                            _churchAddress['address']!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface,
                            ),
                          ),
                        if ((_churchAddress['city'] ?? '').isNotEmpty ||
                            (_churchAddress['state'] ?? '').isNotEmpty ||
                            (_churchAddress['postalCode'] ?? '').isNotEmpty)
                          Text(
                            [
                                  _churchAddress['city'],
                                  _churchAddress['state'],
                                  _churchAddress['postalCode'],
                                ]
                                .where(
                                  (part) =>
                                      part != null && part.trim().isNotEmpty,
                                )
                                .join(', '),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInPersonCard(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.handshake_outlined,
                  size: 28,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 12),
                Text(
                  localize('Donate In Person'),
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              localize(
                'Visit us during any service or event to give in person. We gladly receive donations as cash or checks—any amount is gratefully accepted!',
              ),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;

    return Scaffold(
      appBar: AppBar(
        title: Text('$_churchName ${localize("Giving")}'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth > 700;

            final content = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHero(context),
                const SizedBox(height: 16),
                _buildDonationCard(context),
                const SizedBox(height: 16),
                _buildMailInCard(context),
                const SizedBox(height: 16),
                _buildInPersonCard(context),
                const SizedBox(height: 24),
                _buildMapSection(context),
                const SizedBox(height: 24),
              ],
            );

            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 900),
                  child:
                      isWide
                          ? Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                flex: 3,
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    _buildHero(context),
                                    const SizedBox(height: 16),
                                    _buildDonationCard(context),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                flex: 2,
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    _buildMapSection(context),
                                    const SizedBox(height: 16),
                                    _buildMailInCard(context),
                                    const SizedBox(height: 16),
                                    _buildInPersonCard(context),
                                  ],
                                ),
                              ),
                            ],
                          )
                          : content,
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
