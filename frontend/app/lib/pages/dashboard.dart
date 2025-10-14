import 'package:app/pages/bulletins.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/pages/giving.dart';
import 'package:app/pages/eventspage.dart';
import 'package:app/pages/ministries.dart';
import 'package:app/pages/contact.dart';
import 'package:app/pages/forms.dart';
import 'package:app/services/dashboard_tiles_service.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cached_network_image/cached_network_image.dart';


// URL for Strapi, currently hardcoded to the Android emulator default value.
// Potentially migrate this into the .env later
const String strapiUrl = "http://10.0.2.2:1339";

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});
  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late final Future<Map<String, String>> _tilesFuture;
  late final Future<Map<String, String>> _readyFuture;

  @override
  void initState() {
    super.initState();
    _tilesFuture = DashboardTilesService(strapiUrl).fetchImageUrls()
      .then((map) async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('dashboard_urls', json.encode(map));
        return map;
      }).catchError((_) async {
        final prefs = await SharedPreferences.getInstance();
        final s = prefs.getString('dashboard_urls');
        if (s != null) {
          final Map<String, dynamic> raw = json.decode(s);
          return raw.map((k, v) => MapEntry(k, v as String));
        }
        return <String, String>{};
      });

    _readyFuture = _tilesFuture.then((map) async {
      // Precache *before* first paint
      final futures = <Future<void>>[];
      for (final url in map.values) {
        futures.add(precacheImage(NetworkImage(url), context));
      }
      await Future.wait(futures);
      return map;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('screen-home'),
      body: SafeArea(
        child: SingleChildScrollView(
          child: FutureBuilder<Map<String, String>>(
            future: _readyFuture,
            builder: (context, snapshot) {
              // Use Strapi results when ready; empty map while loading/error
              final images = snapshot.data ?? const <String, String>{};

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Helper to create a full-width card
                  Builder(
                    builder: (ctx) {
                      Widget buildCard(
                        String title,
                        VoidCallback onTap,
                        Color background, {
                        String? imageUrl,
                      }) {
                        // If using an image, force white text; otherwise compute from background
                        final Color textColor = (imageUrl != null)
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
                            decoration: imageUrl != null
                                ? BoxDecoration(
                                    image: DecorationImage(
                                      image: CachedNetworkImageProvider(imageUrl),
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
                                  if (imageUrl != null)
                                    const DecoratedBox(
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.bottomCenter,
                                          end: Alignment.topCenter,
                                          colors: [Color(0xB3000000), Colors.transparent],
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
                                            shadows: imageUrl != null
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
                              imageUrl: images['join-live'],
                          ),
                          buildCard('Weekly Bulletin', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(
                                builder: (_) => const BulletinsPage(),
                              ),
                            );
                          },
                              Colors.teal.shade600,
                              imageUrl: images['weekly-bulletin'],
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
                              imageUrl: images['events'],
                          ),
                          buildCard('Giving', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(builder: (_) => const Giving()),
                            );
                          },
                              Colors.green.shade600,
                              imageUrl: images['giving'],
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
                              imageUrl: images['ministries'],
                          ),
                          buildCard('Contact Us', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(builder: (_) => const Contact()),
                            );
                          },
                              Colors.blueGrey.shade700,
                              imageUrl: images['contact'],
                          ),
                          buildCard('Forms', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(builder: (_) => const Forms()),
                            );
                          },
                              Colors.brown.shade600,
                              imageUrl: images['forms'],
                          ),
                        ],
                      );
                    },
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
