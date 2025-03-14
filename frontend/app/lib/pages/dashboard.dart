import 'package:app/pages/weeklybulletin.dart';
import 'package:flutter/material.dart';
import 'package:app/components/tiles.dart';
import 'package:flutter/cupertino.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/pages/giving.dart';
import 'package:app/pages/eventspage.dart';
import 'package:app/pages/ministries.dart';
import 'package:app/pages/contact.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(

        colorScheme: ColorScheme.fromSeed(seedColor: const Color.fromARGB(255, 22, 77, 60)),

      ),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
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
                    CupertinoPageRoute(
                      builder: ((context) => const JoinLive()),
                    ),
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
                      builder: ((context) => const WeeklyBulletin()),
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
                      CupertinoPageRoute(
                        builder: ((context) => const EventsPage()),
                      ),
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
                        builder: ((context) => const Giving()),
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
                      CupertinoPageRoute(
                        builder: ((context) => const Ministries()),
                      ),
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
                      CupertinoPageRoute(
                        builder: ((context) => const Contact()),
                      ),
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
       // This trailing comma makes auto-formatting nicer for build methods.
    );
  }
}