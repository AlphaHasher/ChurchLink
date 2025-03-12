import 'package:flutter/material.dart';

class Tiles extends StatefulWidget {
  final Function()? onTap;
  final String mainText, subText;
  final double height, width;
  const Tiles({
    super.key,
    required this.onTap,
    required this.mainText,
    required this.subText,
    required this.height,
    required this.width,
  });

  @override
  State<Tiles> createState() => _TilesState();
}

class _TilesState extends State<Tiles> {
  bool isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) {
        setState(() {
          isPressed = true; // Indicate that the button is pressed
        });
      },
      onTapUp: (_) {
        setState(() {
          isPressed = false; // Indicate that the button is released
        });
      },
      onTapCancel: () {
        setState(() {
          isPressed = false; // Indicate that the tap is canceled
        });
      },
      child: AnimatedOpacity(
        duration:
            const Duration(milliseconds: 150), // Adjust the duration as needed
        opacity: isPressed ? 0.8 : 1.0, // Lower opacity when pressed
        child: Container(
            width: widget.width,
            height: widget.height,
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.black54),
              borderRadius: BorderRadius.circular(10),
              color: Colors.black,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color.fromARGB(
                      255, 238, 237, 237), //old: Color.fromARGB(255, 6, 74, 83)
                  Color.fromARGB(
                      32, 67, 157, 216) //old: Color.fromARGB(255, 99, 25, 148)
                ],
              ),
            ),
            child: (widget.subText.isEmpty)
                ? Center(
                    child: Text(
                      textAlign: TextAlign.center,
                      widget.mainText,
                      style: const TextStyle(
                        color: Color.fromARGB(255, 78, 78, 78),
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  )
                : Center(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Column(
                        children: [
                          Text(
                            textAlign: TextAlign.center,
                            widget.mainText,
                            style: const TextStyle(
                              color: Color.fromARGB(255, 78, 78, 78),
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            textAlign: TextAlign.center,
                            widget.subText,
                            style: const TextStyle(
                              color: Color.fromARGB(255, 51, 160, 47),
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )),
      ),
    );
  }
}