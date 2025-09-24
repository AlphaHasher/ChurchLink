import 'package:app/helpers/api_client.dart';
import 'package:app/components/auth_popup.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class Forms extends StatefulWidget {
	const Forms({super.key});

	@override
	State<Forms> createState() => _FormsState();
}

class _FormsState extends State<Forms> {
	bool _isLoading = true;
	String? _error;
	List<dynamic> _forms = [];

	@override
	void initState() {
		super.initState();
		_maybeLoad();
	}

	void _maybeLoad() async {
		final user = FirebaseAuth.instance.currentUser;
		if (user == null) {
			setState(() {
				_isLoading = false;
				_forms = [];
			});
			return;
		}

		await _loadForms();
	}

	Future<void> _loadForms() async {
		setState(() {
			_isLoading = true;
			_error = null;
		});

		try {
			final response = await api.get('/v1/forms/');
			if (response.statusCode == 200) {
				setState(() {
					_forms = response.data as List<dynamic>;
					_isLoading = false;
				});
			} else {
				setState(() {
					_error = 'Failed to load forms (${response.statusCode})';
					_isLoading = false;
				});
			}
		} catch (e) {
			setState(() {
				_error = 'Error loading forms: $e';
				_isLoading = false;
			});
		}
	}



	@override
	Widget build(BuildContext context) {
		final user = FirebaseAuth.instance.currentUser;

		return Scaffold(
			appBar: AppBar(
				title: const Text('Forms'),
				backgroundColor: Colors.black,
			),
			body: SafeArea(
				child: Padding(
					padding: const EdgeInsets.all(12.0),
					child: user == null
							? Center(
									child: Column(
										mainAxisSize: MainAxisSize.min,
										children: [
											const Icon(Icons.lock_outline, size: 64, color: Colors.grey),
											const SizedBox(height: 12),
											const Text(
												'Please sign in to view your forms.',
												style: TextStyle(fontSize: 16),
												textAlign: TextAlign.center,
											),
											const SizedBox(height: 12),
																ElevatedButton(
																	onPressed: () async {
																		await AuthPopup.show(context);
																		// After popup closes, try to load forms (user may have logged in)
																		_maybeLoad();
																	},
																	style: ElevatedButton.styleFrom(backgroundColor: Colors.black),
																	child: const Text('Log In'),
																),
										],
									),
								)
							: _isLoading
									? const Center(child: CircularProgressIndicator())
									: _error != null
											? Center(child: Text(_error!))
											: _forms.isEmpty
													? const Center(child: Text('No forms available.'))
													: ListView.separated(
															itemCount: _forms.length,
															separatorBuilder: (_, __) => const Divider(),
															itemBuilder: (context, index) {
																final f = _forms[index] as Map<String, dynamic>;
																final title = f['title'] ?? 'Untitled';
																final desc = f['description'] ?? '';
																final slug = f['slug'] ?? '';
																final createdAt = f['created_at'] ?? '';
																return ListTile(
																	title: Text(title),
																	subtitle: Text(desc.isNotEmpty ? desc : slug),
																	trailing: createdAt is String
																			? Text(createdAt.split('T').first)
																			: const SizedBox.shrink(),
																	onTap: () {
																		// TODO - open form details or submission page
																	},
																);
															},
														),
				),
			),
		);
	}
}

