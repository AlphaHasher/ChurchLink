import 'package:flutter/material.dart';
import '../components/auth_popup.dart';

/// Widget shown when user needs to login to access Bible plans
class LoginReminderCard extends StatelessWidget {
  final String title;
  final String description;
  final String buttonText;
  final VoidCallback? onLoginSuccess;

  const LoginReminderCard({
    Key? key,
    this.title = 'Sign In Required',
    this.description = 'Please sign in to access your Bible reading plans and track your progress.',
    this.buttonText = 'Sign In',
    this.onLoginSuccess,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Card(
          color: const Color.fromRGBO(65, 65, 65, 1),
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Icon
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color.fromRGBO(150, 130, 255, 0.1),
                    borderRadius: BorderRadius.circular(50),
                  ),
                  child: const Icon(
                    Icons.lock_outline,
                    size: 48,
                    color: Color.fromRGBO(150, 130, 255, 1),
                  ),
                ),
                const SizedBox(height: 24),
                
                // Title
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                
                // Description
                Text(
                  description,
                  style: TextStyle(
                    color: Colors.grey[300],
                    fontSize: 16,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                
                // Sign In Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => _showLoginDialog(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color.fromRGBO(150, 130, 255, 1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.login),
                        const SizedBox(width: 8),
                        Text(
                          buttonText,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Benefits list
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color.fromRGBO(80, 80, 80, 1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'With your account you can:',
                        style: TextStyle(
                          color: Colors.grey[300],
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _buildBenefitItem('📖', 'Subscribe to Bible reading plans'),
                      _buildBenefitItem('📊', 'Track your reading progress'),
                      _buildBenefitItem('🔔', 'Get daily reminder notifications'),
                      _buildBenefitItem('☁️', 'Sync across all your devices'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBenefitItem(String emoji, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: Colors.grey[300],
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showLoginDialog(BuildContext context) async {
    await AuthPopup.show(context);
    
    // After login popup closes, check if user logged in successfully
    // and call the callback if provided
    await Future.delayed(const Duration(milliseconds: 500));
    onLoginSuccess?.call();
  }
}

/// Compact login reminder for smaller spaces
class CompactLoginReminder extends StatelessWidget {
  final VoidCallback? onLoginSuccess;

  const CompactLoginReminder({
    Key? key,
    this.onLoginSuccess,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color.fromRGBO(65, 65, 65, 1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color.fromRGBO(150, 130, 255, 0.3),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Icon(
                Icons.info_outline,
                color: Color.fromRGBO(150, 130, 255, 1),
                size: 24,
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Sign in to access your Bible plans',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => _showLoginDialog(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromRGBO(150, 130, 255, 1),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text('Sign In'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showLoginDialog(BuildContext context) async {
    await AuthPopup.show(context);
    
    // After login popup closes, check if user logged in successfully
    // and call the callback if provided
    await Future.delayed(const Duration(milliseconds: 500));
    onLoginSuccess?.call();
  }
}