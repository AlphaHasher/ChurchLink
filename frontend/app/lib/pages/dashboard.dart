import 'package:app/pages/weeklybulletin.dart';
import 'package:flutter/material.dart';
import 'package:app/components/tiles.dart';
import 'package:flutter/cupertino.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/pages/giving.dart';
import 'package:app/pages/eventspage.dart';
// ...existing imports...
import 'package:app/pages/ministries.dart';
import 'package:app/pages/contact.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
          child: Wrap(
            alignment: WrapAlignment.center,
            spacing: 15,
            runSpacing: 15,
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
              Tiles(
                onTap: () {
                  Navigator.push(
                    context,
                    CupertinoPageRoute(builder: (_) => const WeeklyBulletin()),
                  );
                },
                mainText: "Weekly Bulletin",
                subText: '',
                height: 150,
                width: 150,
              ),
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

              Tiles(
                onTap: () {
                  Navigator.push(
                    context,
                    CupertinoPageRoute(builder: (_) => const Giving()),
                  );
                },
                mainText: "Giving",
                subText: '',
                height: 150,
                width: 150,
              ),
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
        ),
      ),
    );
  }
}
