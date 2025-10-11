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
            key: const ValueKey('screen-ministries'),
            appBar: AppBar(
              title: Padding(
                 padding: const EdgeInsets.only(left: 100),
                 child: Text(
                   "Ministries",
                ),
              ),
              leading: IconButton(
              icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  Navigator.pop(context);
                 },
              ),
            ),
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