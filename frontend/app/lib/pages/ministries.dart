import 'package:flutter/material.dart';

class Ministries extends StatefulWidget {
  const Ministries({super.key});

  @override
  State<Ministries> createState() => _MinistriesState();
}

class _MinistriesState extends State<Ministries> {
  @override
  Widget build(BuildContext context) {
          return Scaffold(
            appBar: AppBar(
            //backgroundColor: const Color.fromARGB(159, 144, 79, 230),
             iconTheme: const IconThemeData(
                    color: Colors.white), // back arrow color
              title: Padding(
                 padding: const EdgeInsets.only(left: 100),
                 child: Text(
                   "Ministries",
                  style:
                  const TextStyle(color: Colors.white), // title color
                ),
              ),
              leading: IconButton(
              icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  Navigator.pop(context);
                 },
              ),
            ),
            //backgroundColor: const Color.fromARGB(246, 244, 236, 255), //old: const Color.fromARGB(156, 102, 133, 161),
             body: SafeArea(
              minimum: const EdgeInsets.symmetric(horizontal: 10),
              child: SingleChildScrollView(
                child: Column(
                 children: [
                      Text( "Hello")
                  ],
                 ),
               ),
            ),
          );
         }
      }