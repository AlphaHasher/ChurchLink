import 'package:flutter/material.dart';
import '../models/event.dart';
import '../models/event_registration_summary.dart';

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
                          color: Colors.black87,
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

                // Description
                Text(
                  event.description,
                  style: const TextStyle(fontSize: 14, color: Colors.black87),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
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
          _buildPlaceholderImage(),

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

  Widget _buildCostLabel() {
    // Check if event is full first
    if (registrationSummary != null &&
        registrationSummary!.availableSpots <= 0) {
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
          color: const Color.fromARGB(255, 142, 163, 168),
          borderRadius: BorderRadius.circular(15),
        ),
        child: const Text(
          'FREE',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      );
    } else {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color.fromARGB(255, 142, 163, 168),
          borderRadius: BorderRadius.circular(15),
        ),
        child: Text(
          '\$${event.price.toStringAsFixed(2)}',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      );
    }
  }
}
