import 'package:app/pages/weeklybulletin.dart';
import 'package:flutter/material.dart';
import 'package:app/components/tiles.dart';
import 'package:flutter/cupertino.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/pages/payment_example.dart';
import 'package:app/pages/eventspage.dart';
import 'package:app/pages/ministries.dart';
import 'package:app/pages/contact.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Tiles(
                  onTap: () {
                    Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const JoinLive()),
                    );
                  },
                  mainText: "Join Live",
                  subText: '',
                  height: 150,
                  width: 150,
                ),
                const SizedBox(width: 15),
                Tiles(
                  onTap: () {
                    Navigator.push(
                      context,
                      CupertinoPageRoute(
                        builder: (_) => const WeeklyBulletin(),
                      ),
                    );
                  },
                  mainText: "Weekly Bulletin",
                  subText: '',
                  height: 150,
                  width: 150,
                ),
              ],
            ),
            const SizedBox(height: 15),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Tiles(
                  onTap: () {
                    Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const EventsPage()),
                    );
                  },
                  mainText: "Events",
                  subText: '',
                  height: 150,
                  width: 150,
                ),
                const SizedBox(width: 15),
                Tiles(
                  onTap: () {
                    Navigator.push(
                      context,
                      CupertinoPageRoute(
                        builder: (_) => const PaymentExample(),
                      ),
                    );
                  },
                  mainText: "Giving",
                  subText: '',
                  height: 150,
                  width: 150,
                ),
              ],
            ),
            const SizedBox(height: 15),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Tiles(
                  onTap: () {
                    Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const Ministries()),
                    );
                  },
                  mainText: "Ministries",
                  subText: '',
                  height: 150,
                  width: 150,
                ),
                const SizedBox(width: 15),
                Tiles(
                  onTap: () {
                    Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const Contact()),
                    );
                  },
                  mainText: "Contact Us",
                  subText: '',
                  height: 150,
                  width: 150,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
