import 'package:flutter/material.dart';
import '../models/event.dart';
import '../models/event_registration_summary.dart';
import '../helpers/strapi_helper.dart';

class EnhancedEventCard extends StatelessWidget {
  final Event event;
  final VoidCallback onViewPressed;
  final EventRegistrationSummary? registrationSummary;

  const EnhancedEventCard({
    super.key,
    required this.event,
    required this.onViewPressed,
    this.registrationSummary,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image Banner Section
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: _buildEventImage(),
          ),

          // Event Details Section
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Event Name and Cost Label Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        event.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    _buildCostLabel(),
                  ],
                ),

                const SizedBox(height: 8),

                // Date and Time
                Row(
                  children: [
                    const Icon(Icons.schedule, size: 16, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      event.formattedDateTime,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.grey,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 4),

                // Location
                Row(
                  children: [
                    const Icon(Icons.location_on, size: 16, color: Colors.grey),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        event.location,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // Description removed per design parity with My Events
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEventImage() {
    return SizedBox(
      height: 150,
      width: double.infinity,
      child: Stack(
        children: [
          // Load image from uploads API endpoint
          // For now, always show placeholder until backend image serving is implemented
          // _buildPlaceholderImage(),
          _buildEventThumb(),

          // View Details button positioned in bottom right
          Positioned(
            bottom: 12,
            right: 12,
            child: ElevatedButton(
              onPressed: onViewPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromARGB(255, 142, 163, 168),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
                elevation: 4,
              ),
              child: const Text(
                'View Details',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlaceholderImage() {
    return Container(
      width: double.infinity,
      height: double.infinity,
      color: Colors.grey[300],
      child: const Center(
        child: Icon(Icons.event, size: 50, color: Colors.grey),
      ),
    );
  }

  Widget _buildEventThumb() {
    if (event.imageUrl == null || event.imageUrl!.trim().isEmpty) {
      return _buildPlaceholderImage();
    } else {
      final url = StrapiHelper.getTrueImageURL(event.imageUrl!);

      // CHECK IF EVENT_URL RESOLVES TO REAL IMAGE
      // IF IT DOES, USE THAT IMAGE
      // IF IT DOESNT DEFAULT TO PLACEHOLDER IMAGE
      return SizedBox.expand(
        child: Image.network(
          url,
          fit: BoxFit.cover,
          // While loading, show the placeholder (keeps the card pretty)
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            return _buildPlaceholderImage();
          },
          // On error (404, invalid URL, etc.), show the placeholder
          errorBuilder: (context, error, stackTrace) {
            return _buildPlaceholderImage();
          },
        ),
      );
    }
  }

  Widget _buildCostLabel() {
    // Check if event is full first (but not if unlimited spots)
    if (registrationSummary != null &&
        registrationSummary!.availableSpots <= 0 &&
        registrationSummary!.availableSpots != -1) {  // Don't show full for unlimited spots
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.red,
          borderRadius: BorderRadius.circular(15),
        ),
        child: const Text(
          'FULL',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      );
    }
    // Then check if it's free
    else if (event.isFree) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: event.hasPayPalOption 
              ? const Color.fromARGB(255, 46, 125, 50) // Green for donations enabled
              : const Color.fromARGB(255, 142, 163, 168), // Gray for completely free
          borderRadius: BorderRadius.circular(15),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'FREE',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
            if (event.hasPayPalOption) ...[
              const SizedBox(width: 4),
              const Icon(
                Icons.volunteer_activism,
                color: Colors.white,
                size: 12,
              ),
            ],
          ],
        ),
      );
    } else {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: event.hasPayPalOption
              ? const Color(0xFF0070BA) // PayPal blue for online payment
              : const Color.fromARGB(255, 142, 163, 168), // Gray for pay at door
          borderRadius: BorderRadius.circular(15),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '\$${event.price.toStringAsFixed(2)}',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
            if (event.hasPayPalOption) ...[
              const SizedBox(width: 4),
              const Icon(
                Icons.payment,
                color: Colors.white,
                size: 12,
              ),
            ],
          ],
        ),
      );
    }
  }
}
