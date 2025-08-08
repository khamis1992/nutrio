import 'package:flutter/material.dart';

import '../presentation/gym_access_screen/gym_access_screen.dart';
import '../presentation/health_goals_onboarding_screen/health_goals_onboarding_screen.dart';
import '../presentation/home_screen/home_screen.dart';
import '../presentation/login_screen/login_screen.dart';
import '../presentation/meal_detail_screen/meal_detail_screen.dart';
import '../presentation/meals_screen/meals_screen.dart';
import '../presentation/my_plan_screen/my_plan_screen.dart';
import '../presentation/profile_screen/profile_screen.dart';
import '../presentation/progress_screen/progress_screen.dart';
import '../presentation/restaurant_profile_screen/restaurant_profile_screen.dart';
import '../presentation/restaurants_screen/restaurants_screen.dart';
import '../presentation/signup_screen/signup_screen.dart';
import '../presentation/splash_screen/splash_screen.dart';
import '../presentation/subscription_screen/subscription_screen.dart';

class AppRoutes {
  static const String initial = '/';
  static const String login = '/login';
  static const String signup = '/signup';
  static const String home = '/home';
  static const String meals = '/meals';
  static const String restaurants = '/restaurants';
  static const String myPlan = '/myPlan';
  static const String progress = '/progress';
  static const String profile = '/profile';
  static const String splash = '/splash';
  static const String mealDetail = '/mealDetail';
  static const String restaurantProfile = '/restaurantProfile';
  static const String subscription = '/subscription';
  static const String gymAccess = '/gymAccess';
  static const String healthGoalsOnboarding = '/healthGoalsOnboarding';

  static final Map<String, Widget Function(BuildContext)> routes = {
    initial: (context) => const SplashScreen(),
    login: (context) => const LoginScreen(),
    signup: (context) => const SignupScreen(),
    home: (context) => const HomeScreen(),
    meals: (context) => const MealsScreen(),
    restaurants: (context) => const RestaurantsScreen(),
    myPlan: (context) => const MyPlanScreen(),
    progress: (context) => const ProgressScreen(),
    profile: (context) => const ProfileScreen(),
    splash: (context) => const SplashScreen(),
    mealDetail: (context) => const MealDetailScreen(),
    restaurantProfile: (context) => const RestaurantProfileScreen(),
    subscription: (context) => const SubscriptionScreen(),
    gymAccess: (context) => const GymAccessScreen(),
    healthGoalsOnboarding: (context) => const HealthGoalsOnboardingScreen(),
  };
}