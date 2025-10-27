import 'dart:convert';

import 'package:app/pages/bulletins.dart';
import 'package:app/pages/eventspage.dart';
import 'package:app/pages/forms.dart';
import 'package:app/pages/giving.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/services/dashboard_tiles_service.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

final String _apiBaseUrl = dotenv.env['API_BASE_URL'] ?? 'http://10.0.2.2:8000';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});
  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late final Future<Map<String, String>> _tilesFuture;

  // Stops the app from causing errors when a precache for the dashboard images fails
  Future<void> _precacheSafe(ImageProvider provider) async {
    try {
      if (mounted) {
        await precacheImage(provider, context);
      }
    } catch (_) {
      debugPrint('[Dashboard] precache failed');
    }
  }

  @override
  void initState() {
    super.initState();
    _tilesFuture = DashboardTilesService(_apiBaseUrl)
        .fetchImageUrls()
        .then((map) async {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('dashboard_urls', json.encode(map));
          return map;
        })
        .catchError((_) async {
          final prefs = await SharedPreferences.getInstance();
          final s = prefs.getString('dashboard_urls');
          if (s != null) {
            final Map<String, dynamic> raw = json.decode(s);
            return raw.map((k, v) => MapEntry(k, v as String));
          }
          return <String, String>{};
        });

    // Precache images after tiles are fetched
    _tilesFuture.then((map) async {
      for (final url in map.values) {
        if (url.isEmpty) continue;
        await _precacheSafe(NetworkImage(url));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('screen-home'),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
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
                    final Color textColor =
                        (imageUrl != null)
                            ? Colors.white
                            : (background.computeLuminance() > 0.5
                                ? Colors.black
                                : Colors.white);

                    return Card(
                      margin: EdgeInsets.zero,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.zero,
                      ),
                      clipBehavior:
                          Clip.hardEdge, // keeps ripple & image clipped to card
                      child: Ink(
                        height: 150,
                        width: double.infinity,
                        // Image background when imageAsset is provided; else solid color
                        decoration:
                            imageUrl != null
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
                                      colors: [
                                        Color(0xB3000000),
                                        Colors.transparent,
                                      ],
                                    ),
                                  ),
                                ),
                              Center(
                                child: Text(
                                  title,
                                  textAlign: TextAlign.center,
                                  style: Theme.of(
                                    ctx,
                                  ).textTheme.titleLarge?.copyWith(
                                    color: textColor,
                                    // small shadow helps on busy photos
                                    shadows:
                                        imageUrl != null
                                            ? const [
                                              Shadow(
                                                blurRadius: 2,
                                                color: Colors.black45,
                                              ),
                                            ]
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

                  return FutureBuilder<Map<String, String>>(
                    future: _tilesFuture,
                    builder: (context, snap) {
                      final images = snap.data ?? const <String, String>{};

                      String? img(String slug) {
                        final u = images[slug];
                        return (u != null && u.isNotEmpty) ? u : null;
                      }

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          buildCard('Join Live', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(builder: (_) => const JoinLive()),
                            );
                          }, Colors.indigo.shade600, imageUrl: img('join-live')),
                          buildCard('Weekly Bulletin', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(
                                builder: (_) => const BulletinsPage(),
                              ),
                            );
                          }, Colors.teal.shade600, imageUrl: img('weekly-bulletin')),
                          buildCard('Events', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(
                                builder: (_) => const EventsPage(),
                              ),
                            );
                          }, Colors.orange.shade600, imageUrl: img('events')),
                          buildCard('Giving', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(builder: (_) => const Giving()),
                            );
                          }, Colors.green.shade600, imageUrl: img('giving')),
                          buildCard('Forms', () {
                            Navigator.push(
                              ctx,
                              CupertinoPageRoute(builder: (_) => const Forms()),
                            );
                          }, Colors.brown.shade600, imageUrl: img('forms')),
                        ],
                      );
                    }
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
