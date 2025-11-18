import 'package:flutter/material.dart';
import 'package:app/helpers/localization_helper.dart';

class WeeklyBulletin extends StatefulWidget {
  const WeeklyBulletin({super.key});

  @override
  State<WeeklyBulletin> createState() => _WeeklyBulletinState();
}

class _WeeklyBulletinState extends State<WeeklyBulletin> {
  @override
  Widget build(BuildContext context) {
          return Scaffold(
            key: const ValueKey('screen-bulletin'),
            appBar: AppBar(
              title: Padding(
                 padding: const EdgeInsets.only(left: 60),
                 child: Text(
                   LocalizationHelper.localize('Weekly Bulletin', capitalize: true),
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