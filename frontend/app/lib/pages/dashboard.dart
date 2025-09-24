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
              Builder(builder: (ctx) {
                Widget buildCard(String title, VoidCallback onTap, Color background) {
                  final textColor = background.computeLuminance() > 0.5 ? Colors.black : Colors.white;
                  return Card(
                    margin: EdgeInsets.zero,
                    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                    child: InkWell(
                      onTap: onTap,
                      child: Container(
                        color: background,
                        height: 150,
                        width: double.infinity,
                        child: Center(
                          child: Text(
                            title,
                            style: Theme.of(ctx).textTheme.titleLarge?.copyWith(color: textColor),
                          ),
                        ),
                      ),
                    ),
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    buildCard('Join Live', () {
                      Navigator.push(ctx, CupertinoPageRoute(builder: (_) => const JoinLive()));
                    }, Colors.indigo.shade600),
                    buildCard('Weekly Bulletin', () {
                      Navigator.push(ctx, CupertinoPageRoute(builder: (_) => const WeeklyBulletin()));
                    }, Colors.teal.shade600),
                    buildCard('Events', () {
                      Navigator.push(ctx, CupertinoPageRoute(builder: (_) => const EventsPage()));
                    }, Colors.orange.shade600),
                    buildCard('Giving', () {
                      Navigator.push(ctx, CupertinoPageRoute(builder: (_) => const Giving()));
                    }, Colors.green.shade600),
                    buildCard('Ministries', () {
                      Navigator.push(ctx, CupertinoPageRoute(builder: (_) => const Ministries()));
                    }, Colors.purple.shade600),
                    buildCard('Contact Us', () {
                      Navigator.push(ctx, CupertinoPageRoute(builder: (_) => const Contact()));
                    }, Colors.blueGrey.shade700),
                    buildCard('Forms', () {
                      Navigator.push(ctx, CupertinoPageRoute(builder: (_) => const Forms()));
                    }, Colors.brown.shade600),
                  ],
                );
              }),
            ],
          ),
        ),
      ),
    );
  }
}
