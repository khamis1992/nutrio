import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sizer/sizer.dart';
import '../../services/auth_service.dart';
import '../../widgets/custom_image_widget.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // Wait for 2 seconds to show splash
    await Future.delayed(const Duration(seconds: 2));

    if (mounted) {
      // Check if user is authenticated
      final isAuthenticated = AuthService.instance.isAuthenticated;

      if (isAuthenticated) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        Navigator.pushReplacementNamed(context, '/login');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        backgroundColor: const Color(0xFF2E7D32),
        body: Center(
            child:
                Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          // Official NUTRIO Logo
          Container(
              width: 40.w,
              height: 40.w,
              decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withAlpha(26),
                        blurRadius: 20,
                        offset: const Offset(0, 10)),
                  ]),
              child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: CustomImageWidget(
                      imageUrl: 'assets/images/nutrio_logo.png',
                      width: 40.w, height: 40.w, fit: BoxFit.contain))),
          SizedBox(height: 4.h),

          // App Name
          Text('NUTRIO',
              style: GoogleFonts.inter(
                  fontSize: 32.sp,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: 2)),
          SizedBox(height: 1.h),

          // Tagline
          Text('Healthy Meal Plans & Nutrition Tracking',
              style: GoogleFonts.inter(
                  fontSize: 14.sp,
                  color: Colors.white.withAlpha(204),
                  fontWeight: FontWeight.w400)),
          SizedBox(height: 8.h),

          // Loading Indicator
          const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              strokeWidth: 2),
        ])));
  }
}