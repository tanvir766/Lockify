# Flutter Admin Panel Integration

Since this environment is for the React web app, here is the Flutter code you need to add to your mobile app to integrate the Admin Access system.

## 1. Login Page Update (Subtle Admin Button)

Add this `Positioned` widget inside your `Stack` on the Login Page:

```dart
Positioned(
  bottom: 20,
  right: 20,
  child: GestureDetector(
    onTap: () => Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const AdminLoginPage()),
    ),
    child: const Text(
      'Admin Access',
      style: TextStyle(
        color: Colors.grey,
        fontSize: 10,
        decoration: TextDecoration.underline,
      ),
    ),
  ),
),
```

## 2. Admin Login Screen (`admin_login_page.dart`)

```dart
import 'package:flutter/material.dart';

class AdminLoginPage extends StatefulWidget {
  const AdminLoginPage({super.key});

  @override
  State<AdminLoginPage> createState() => _AdminLoginPageState();
}

class _AdminLoginPageState extends State<AdminLoginPage> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  void _handleLogin() {
    setState(() => _isLoading = true);
    
    // Predefined admin credentials (In a real app, use Firebase Auth or a secure backend)
    if (_usernameController.text == 'admin' && _passwordController.text == 'admin@2026') {
      // Navigate to Admin Panel (Web URL or separate Flutter screen)
      // For now, we'll just show a success message
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Admin Access Granted')),
      );
      // You can navigate to a WebView pointing to your React Admin Panel
      // or a separate Flutter Admin Dashboard.
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid Admin Credentials')),
      );
    }
    
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.shield, size: 80, color: Colors.indigoAccent),
            const SizedBox(height: 24),
            const Text(
              'Admin Console',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 40),
            TextField(
              controller: _usernameController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Username',
                hintStyle: const TextStyle(color: Colors.grey),
                prefixIcon: const Icon(Icons.person, color: Colors.grey),
                filled: true,
                fillColor: Colors.white.withOpacity(0.05),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              obscureText: true,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Password',
                hintStyle: const TextStyle(color: Colors.grey),
                prefixIcon: const Icon(Icons.lock, color: Colors.grey),
                filled: true,
                fillColor: Colors.white.withOpacity(0.05),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _isLoading ? null : _handleLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigoAccent,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleAt(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: _isLoading 
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text('Access Portal', style: TextStyle(fontSize: 18)),
            ),
          ],
        ),
      ),
    );
  }
}
```

## 3. Security Considerations

*   **Credentials:** Avoid hardcoding credentials in production. Use Firebase Auth with a specific admin email or custom claims.
*   **Navigation:** If you use a WebView for the Admin Panel, ensure it's served over HTTPS and has proper session management.
