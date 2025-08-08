import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';


class OnboardingProgressBar extends StatelessWidget {
  final int currentStep;
  final int totalSteps;

  const OnboardingProgressBar({
    super.key,
    required this.currentStep,
    required this.totalSteps,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 16.h),
      child: Column(
        children: [
          Text(
            '${currentStep + 1}/$totalSteps',
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: Colors.grey[600])),
          SizedBox(height: 8.0),
          LinearProgressIndicator(
            value: (currentStep + 1) / totalSteps,
            backgroundColor: Colors.grey.withAlpha(51),
            valueColor: AlwaysStoppedAnimation<Color>(Theme.of(context).primaryColor)),
        ]));
  }
}