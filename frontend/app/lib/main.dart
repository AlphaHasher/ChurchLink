import 'package:app/pages/weeklybulletin.dart';
import 'package:flutter/material.dart';
import 'package:app/components/tiles.dart';
import 'package:flutter/cupertino.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/pages/giving.dart';
import 'package:app/pages/eventspage.dart';
import 'package:app/pages/ministries.dart';
import 'package:app/pages/contact.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:app/firebase/firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        // This is the theme of your application.
        //
        // TRY THIS: Try running your application with "flutter run". You'll see
        // the application has a purple toolbar. Then, without quitting the app,
        // try changing the seedColor in the colorScheme below to Colors.green
        // and then invoke "hot reload" (save your changes or press the "hot
        // reload" button in a Flutter-supported IDE, or press "r" if you used
        // the command line to start the app).
        //
        // Notice that the counter didn't reset back to zero; the application
        // state is not lost during the reload. To reset the state, use hot
        // restart instead.
        //
        // This works for code too, not just values: Most code changes can be
        // tested with just a hot reload.
        colorScheme: ColorScheme.fromSeed(seedColor: const Color.fromARGB(255, 22, 77, 60)),
      ),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  // This widget is the home page of your application. It is stateful, meaning
  // that it has a State object (defined below) that contains fields that affect
  // how it looks.

  // This class is the configuration for the state. It holds the values (in this
  // case the title) provided by the parent (in this case the App widget) and
  // used by the build method of the State. Fields in a Widget subclass are
  // always marked "final".

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {

  @override
  Widget build(BuildContext context) {
    // This method is rerun every time setState is called, for instance as done
    // by the _incrementCounter method above.
    //
    // The Flutter framework has been optimized to make rerunning build methods
    // fast, so that you can just rebuild anything that needs updating rather
    // than having to individually change instances of widgets.
    return Scaffold(
      appBar: AppBar(
        // TRY THIS: Try changing the color here to a specific color (to
        // Colors.amber, perhaps?) and trigger a hot reload to see the AppBar
        // change color while the other colors stay the same.
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        // Here we take the value from the MyHomePage object that was created by
        // the App.build method, and use it to set our appbar title.
        title: Text(widget.title),
      ),
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
