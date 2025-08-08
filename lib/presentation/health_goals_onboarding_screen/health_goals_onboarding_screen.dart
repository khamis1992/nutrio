import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../core/app_export.dart';
import '../../routes/app_routes.dart';
import '../../services/auth_service.dart';
import '../../services/health_goals_service.dart';
import './widgets/age_input_step.dart';
import './widgets/gender_selection_step.dart';
import './widgets/goal_selection_step.dart';
import './widgets/height_input_step.dart';
import './widgets/onboarding_progress_bar.dart';
import './widgets/setup_complete_step.dart';
import './widgets/weight_input_step.dart';

class HealthGoalsOnboardingScreen extends StatefulWidget {
  const HealthGoalsOnboardingScreen({super.key});

  @override
  State<HealthGoalsOnboardingScreen> createState() => _HealthGoalsOnboardingScreenState();
}

class _HealthGoalsOnboardingScreenState extends State<HealthGoalsOnboardingScreen> 
    with TickerProviderStateMixin {
  late PageController _pageController;
  late AnimationController _celebrationController;
  late Animation<double> _celebrationAnimation;

  int _currentStep = 0;
  final int _totalSteps = 5;
  bool _isLoading = false;

  // Form data
  String? _selectedGoal;
  double? _currentWeight;
  int? _height;
  String? _selectedGender;
  int? _age;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _celebrationController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this);
    _celebrationAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0).animate(CurvedAnimation(
      parent: _celebrationController,
      curve: Curves.elasticOut));
  }

  @override
  void dispose() {
    _pageController.dispose();
    _celebrationController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_currentStep < _totalSteps - 1) {
      setState(() {
        _currentStep++;
      });
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut);
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() {
        _currentStep--;
      });
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut);
    }
  }

  bool _canProceed() {
    switch (_currentStep) {
      case 0:
        return _selectedGoal != null;
      case 1:
        return _currentWeight != null && _currentWeight! > 0;
      case 2:
        return _height != null && _height! > 0;
      case 3:
        return true; // Gender is optional
      case 4:
        return true; // Age is optional
      default:
        return false;
    }
  }

  Future<void> _completeSetup() async {
    if (!_canProceed() || _selectedGoal == null) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final currentUser = AuthService.instance.currentUser;
      if (currentUser == null) {
        throw Exception('User not authenticated');
      }

      await HealthGoalsService.instance.saveHealthGoal(
        userId: currentUser.id,
        goal: _selectedGoal!,
        currentWeight: _currentWeight,
        height: _height,
        gender: _selectedGender,
        age: _age);

      // Start celebration animation
      await _celebrationController.forward();

      // Navigate based on goal
      await Future.delayed(const Duration(milliseconds: 800));
      
      if (mounted) {
        if (_selectedGoal == 'medical_diet') {
          Navigator.pushNamedAndRemoveUntil(
            context,
            AppRoutes.subscription,
            (route) => false);
        } else {
          Navigator.pushNamedAndRemoveUntil(
            context,
            AppRoutes.home,
            (route) => false);
        }
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('خطأ في حفظ البيانات: $error'),
            backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // Header with progress and skip
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 20.w),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (_currentStep > 0)
                    GestureDetector(
                      onTap: _previousStep,
                      child: Container(
                        padding: EdgeInsets.all(8.w),
                        decoration: BoxDecoration(
                          color: Colors.grey.withAlpha(26),
                          borderRadius: BorderRadius.circular(8.w)),
                        child: Icon(
                          Icons.arrow_back_ios,
                          size: 20.sp,
                          color: Colors.grey[600])))
                  else
                    SizedBox(width: 36.w),
                  
                  Expanded(
                    child: OnboardingProgressBar(
                      currentStep: _currentStep,
                      totalSteps: _totalSteps)),
                  
                  if (_currentStep < 3) // Show skip for first 3 optional steps
                    TextButton(
                      onPressed: () {
                        Navigator.pushNamedAndRemoveUntil(
                          context,
                          AppRoutes.home,
                          (route) => false);
                      },
                      child: Text(
                        'تخطي',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 14.sp,
                          fontWeight: FontWeight.w500)))
                  else
                    SizedBox(width: 60.w),
                ])),

            // Page content
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  GoalSelectionStep(
                    selectedGoal: _selectedGoal,
                    onGoalSelected: (goal) {
                      setState(() {
                        _selectedGoal = goal;
                      });
                    }),
                  WeightInputStep(
                    currentWeight: _currentWeight,
                    onWeightChanged: (weight) {
                      setState(() {
                        _currentWeight = weight;
                      });
                    }),
                  HeightInputStep(
                    height: _height,
                    onHeightChanged: (height) {
                      setState(() {
                        _height = height;
                      });
                    }),
                  GenderSelectionStep(
                    selectedGender: _selectedGender,
                    onGenderSelected: (gender) {
                      setState(() {
                        _selectedGender = gender;
                      });
                    }),
                  AgeInputStep(
                    age: _age,
                    onAgeChanged: (age) {
                      setState(() {
                        _age = age;
                      });
                    }),
                ])),

            // Bottom action button
            Container(
              padding: EdgeInsets.all(20.w),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : (_canProceed() ? 
                    (_currentStep == _totalSteps - 1 ? _completeSetup : _nextStep) 
                    : null),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).primaryColor,
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.symmetric(vertical: 16.h)),
                  child: _isLoading
                      ? SizedBox(
                          height: 20.h,
                          width: 20.w,
                          child: const CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2))
                      : AnimatedBuilder(
                          animation: _celebrationAnimation,
                          builder: (context, child) {
                            return Transform.scale(
                              scale: 1.0 + (_celebrationAnimation.value * 0.1),
                              child: Text(
                                _currentStep == _totalSteps - 1
                                    ? '🎉 إكمال الإعداد'
                                    : 'التالي',
                                style: TextStyle(
                                  fontSize: 16.sp,
                                  fontWeight: FontWeight.w600)));
                          })))),

            // Setup complete overlay
            if (_celebrationAnimation.value > 0)
              AnimatedBuilder(
                animation: _celebrationAnimation,
                builder: (context, child) {
                  return Container(
                    color: Colors.black.withOpacity(0.7 * _celebrationAnimation.value),
                    child: Center(
                      child: Transform.scale(
                        scale: _celebrationAnimation.value,
                        child: SetupCompleteStep(
                          selectedGoal: _selectedGoal ?? '',
                          animation: _celebrationAnimation))));
                }),
          ])),
    );
  }
}