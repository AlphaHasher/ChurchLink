import 'package:flutter/material.dart';

import 'dart:convert';
import 'package:http/http.dart' as http;

const String backendHost = '10.0.2.2:8000';


class EventsPage extends StatefulWidget {
  const EventsPage({super.key});

  @override
  State<EventsPage> createState() => _EventsPageState();
}

class Event {
  final String id;
  final String name;
  final String description;
  final String date;
  final String location;
  final double price;
  final List<String> ministry;
  final int minAge;
  final int maxAge;
  final String gender;

  Event({
    required this.id,
    required this.name,
    required this.description,
    required this.date,
    required this.location,
    required this.price,
    required this.ministry,
    required this.minAge,
    required this.maxAge,
    required this.gender,
  });

  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      date: json['date'],
      location: json['location'],
      price: (json['price'] as num).toDouble(),
      ministry: List<String>.from(json['ministry']),
      minAge: json['min_age'],
      maxAge: json['max_age'],
      gender: json['gender'],
    );
  }
}


class _EventsPageState extends State<EventsPage> {
  List<Event> _events = [];
  bool _isLoading = true;

  // Declare variables for dynamic filter values
  int? _minAge;
  int? _maxAge;
  String? _ministry;
  bool? _isFree;

  @override
  void initState() {
    super.initState();
    _loadEvents();
  }

  Future<void> _loadEvents() async {
    setState(() {
      _isLoading = true;
    });

    final uri = Uri.http(
      backendHost, // just host + port
      '/api/v1/events', // full path to your FastAPI endpoint
      {
        if (_minAge != null) 'min_age': _minAge.toString(),
        if (_maxAge != null) 'max_age': _maxAge.toString(),
        if (_ministry != null) 'ministry': _ministry!,
        if (_isFree != null) 'is_free': _isFree.toString(),
      },
    );

    try {
      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final List<dynamic> jsonData = jsonDecode(response.body);
        setState(() {
          _events = jsonData.map((json) => Event.fromJson(json)).toList();
          _isLoading = false;
        });
      } else {
        print("Failed to load events: ${response.statusCode}");
        setState(() => _isLoading = false);
      }
    } catch (e) {
      print("Error loading events: $e");
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color.fromARGB(159, 144, 79, 230),
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Padding(
          padding: EdgeInsets.only(left: 100),
          child: Text(
            "Events",
            style: TextStyle(color: Colors.white),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            Navigator.pop(context);
          },
        ),
      ),
      backgroundColor: const Color.fromARGB(246, 244, 236, 255),
      body: SafeArea(
        minimum: const EdgeInsets.symmetric(horizontal: 10),
        child: SingleChildScrollView(
          child: Column(
            children: [
              _isLoading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 50),
                      child: Center(
                        child: CircularProgressIndicator(),
                      ),
                    )
                  : _events.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.symmetric(vertical: 50),
                          child: Text("No events found."),
                        )
                      : ListView.builder(
                          physics: const NeverScrollableScrollPhysics(),
                          shrinkWrap: true,
                          itemCount: _events.length,
                          itemBuilder: (context, index) {
                            final event = _events[index];
                            return Card(
                              margin: const EdgeInsets.symmetric(vertical: 8),
                              child: ListTile(
                                title: Text(event.name),
                                subtitle: Text(event.description),
                                trailing: Text(
                                  event.price == 0
                                      ? "Free"
                                      : "\$${event.price.toStringAsFixed(2)}",
                                ),
                              ),
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
