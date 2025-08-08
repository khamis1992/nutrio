import 'package:flutter/material.dart';

import '../../routes/app_routes.dart';
import '../../services/auth_service.dart';
import './widgets/login_form_widget.dart';
import './widgets/nutrio_logo_widget.dart';
import './widgets/signup_link_widget.dart';
import './widgets/social_login_widget.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _checkAuthState();
  }

  void _checkAuthState() {
    // Listen to auth state changes
    AuthService.instance.authStateChanges.listen((authState) {
      if (authState.session != null && mounted) {
        Navigator.pushReplacementNamed(context, AppRoutes.home);
      }
    });
  }

  void _handleGoogleLogin() async {
    setState(() => _isLoading = true);
    // TODO: Implement Google login
    setState(() => _isLoading = false);
  }

  void _handleAppleLogin() async {
    setState(() => _isLoading = true);
    // TODO: Implement Apple login
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 40),

                // Logo Section
                const NutrioLogoWidget(),
                const SizedBox(height: 48),

                // Login Form
                const LoginFormWidget(),
                const SizedBox(height: 32),

                // Social Login
                SocialLoginWidget(
                  isLoading: _isLoading,
                  onGoogleLogin: _handleGoogleLogin,
                  onAppleLogin: _handleAppleLogin,
                ),
                const SizedBox(height: 24),

                // Signup Link
                const SignupLinkWidget(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}