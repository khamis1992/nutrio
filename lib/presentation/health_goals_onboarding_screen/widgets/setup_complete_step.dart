import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';


class SetupCompleteStep extends StatelessWidget {
  final String selectedGoal;
  final Animation<double> animation;

  const SetupCompleteStep({
    super.key,
    required this.selectedGoal,
    required this.animation,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 40.h),
      padding: EdgeInsets.all(32.h),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.h),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(26),
            blurRadius: 20,
            offset: const Offset(0, 10)),
        ]),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Celebration icon
          AnimatedBuilder(
            animation: animation,
            builder: (context, child) {
              return Transform.scale(
                scale: 1.0 + (animation.value * 0.2),
                child: Container(
                  
                  decoration: BoxDecoration(
                    color: Colors.green.shade100,
                    shape: BoxShape.circle),
                  child: Icon(
                    Icons.check_circle_outline,
                    
                    color: Colors.green.shade600)));
            }),
          
          SizedBox(height: 20.h),
          
          Text(
            'تم الإعداد بنجاح! 🎉',
            style: TextStyle(
              
              fontWeight: FontWeight.bold,
              color: Theme.of(context).primaryColor),
            textAlign: TextAlign.center),
          
          SizedBox(height: 12.h),
          
          Text(
            _getSuccessMessage(selectedGoal),
            style: TextStyle(
              
              color: Colors.grey[600],
              height: 1.4),
            textAlign: TextAlign.center),
          
          SizedBox(height: 24.h),
          
          // Success indicators
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(3, (index) {
              return AnimatedBuilder(
                animation: animation,
                builder: (context, child) {
                  return AnimatedContainer(
                    duration: Duration(milliseconds: 200 + (index * 100)),
                    margin: EdgeInsets.symmetric(horizontal: 4.h),
                    width: 8.h,
                    height: 8.h,
                    decoration: BoxDecoration(
                      color: animation.value > 0.5
                          ? Theme.of(context).primaryColor
                          : Colors.grey.shade300,
                      shape: BoxShape.circle));
                });
            })),
        ]));
  }

  String _getSuccessMessage(String goal) {
    switch (goal) {
      case 'weight_loss':
        return 'سنقوم بإنشاء خطة غذائية مخصصة لخسارة الوزن بطريقة صحية';
      case 'maintain_weight':
        return 'سنساعدك في الحفاظ على وزنك الحالي بنمط حياة صحي';
      case 'build_muscle':
        return 'سنصمم لك خطة غذائية غنية بالبروتين لبناء العضلات';
      case 'medical_diet':
        return 'سنوجهك إلى خيارات الاشتراك المناسبة لحالتك الطبية';
      default:
        return 'سنقوم بإنشاء خطة غذائية مخصصة لك';
    }
  }
}