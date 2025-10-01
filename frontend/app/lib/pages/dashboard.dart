import 'package:app/pages/weeklybulletin.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/pages/giving.dart';
import 'package:app/pages/eventspage.dart';
import 'package:app/pages/ministries.dart';
import 'package:app/pages/contact.dart';
import 'package:app/pages/forms.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Helper to create a full-width card
              Builder(
                builder: (ctx) {
                  // Add optional named param: {String? imageAsset}
                  Widget buildCard(
                    String title,
                    VoidCallback onTap,
                    Color background, {
                    String? imageAsset,
                  }) {
                    // If using an image, force white text; otherwise compute from background
                    final Color textColor = (imageAsset != null)
                        ? Colors.white
                        : (background.computeLuminance() > 0.5 ? Colors.black : Colors.white);

                    return Card(
                      margin: EdgeInsets.zero,
                      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                      clipBehavior: Clip.hardEdge, // keeps ripple & image clipped to card
                      child: Ink(
                        height: 150,
                        width: double.infinity,
                        // Image background when imageAsset is provided; else solid color
                        decoration: imageAsset != null
                            ? BoxDecoration(
                                image: DecorationImage(
                                  image: AssetImage(imageAsset),
                                  fit: BoxFit.cover,
                                ),
                              )
                            : BoxDecoration(color: background),
                        child: InkWell(
                          onTap: onTap,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              // Dark gradient overlay only when an image is used
                              if (imageAsset != null)
                                const DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.bottomCenter,
                                      end: Alignment.topCenter,
                                      colors: [Colors.black54, Colors.transparent],
                                    ),
                                  ),
                                ),
                              Center(
                                child: Text(
                                  title,
                                  textAlign: TextAlign.center,
                                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                                        color: textColor,
                                        // small shadow helps on busy photos
                                        shadows: imageAsset != null
                                            ? const [Shadow(blurRadius: 2, color: Colors.black45)]
                                            : null,
                                      ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      buildCard('Join Live', () {
                        Navigator.push(
                          ctx,
                          CupertinoPageRoute(builder: (_) => const JoinLive()),
                        );
                      }, 
                        Colors.indigo.shade600,
                        imageAsset: 'assets/dashboard/joinlive.jpeg',
                      ),
                      buildCard('Weekly Bulletin', () {
                        Navigator.push(
                          ctx,
                          CupertinoPageRoute(
                            builder: (_) => const WeeklyBulletin(),
                          ),
                        );
                      }, 
                        Colors.teal.shade600,
                        imageAsset: 'assets/dashboard/bulletin.jpeg',
                      ),
                      buildCard('Events', () {
                        Navigator.push(
                          ctx,
                          CupertinoPageRoute(
                            builder: (_) => const EventsPage(),
                          ),
                        );
                      }, 
                        Colors.orange.shade600,
                        imageAsset: 'assets/dashboard/events.jpeg',
                      ),
                      buildCard('Giving', () {
                        Navigator.push(
                          ctx,
                          CupertinoPageRoute(builder: (_) => const Giving()),
                        );
                      }, 
                        Colors.green.shade600,
                        imageAsset: 'assets/dashboard/giving.jpeg',
),
                      buildCard('Ministries', () {
                        Navigator.push(
                          ctx,
                          CupertinoPageRoute(
                            builder: (_) => const Ministries(),
                          ),
                        );
                      }, 
                        Colors.purple.shade600,
                        imageAsset: 'assets/dashboard/ministries.jpeg',
                      ),
                      buildCard('Contact Us', () {
                        Navigator.push(
                          ctx,
                          CupertinoPageRoute(builder: (_) => const Contact()),
                        );
                      }, 
                        Colors.blueGrey.shade700,
                        imageAsset: 'assets/dashboard/contact.jpeg',  
                      ),
                      buildCard('Forms', () {
                        Navigator.push(
                          ctx,
                          CupertinoPageRoute(builder: (_) => const Forms()),
                        );
                      }, 
                        Colors.brown.shade600,
                        imageAsset: 'assets/dashboard/forms.jpeg',
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
