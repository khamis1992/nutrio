import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';


class GoalSelectionStep extends StatelessWidget {
  final String? selectedGoal;
  final Function(String) onGoalSelected;

  const GoalSelectionStep({
    super.key,
    required this.selectedGoal,
    required this.onGoalSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 24.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(height: 20.h),
          
          // Welcome message
          Text(
            'دعنا نتعرف عليك أكثر 🌿',
            style: TextStyle(
              fontSize: 24.sp,
              fontWeight: FontWeight.bold,
              color: Theme.of(context).primaryColor,
              height: 1.2)),
          
          SizedBox(height: 12.h),
          
          Text(
            'هذا يساعدنا في بناء خطتك المثالية',
            style: TextStyle(
              fontSize: 16.sp,
              color: Colors.grey[600],
              height: 1.4)),
          
          SizedBox(height: 32.h),
          
          Text(
            'اختر هدفك:',
            style: TextStyle(
              fontSize: 18.sp,
              fontWeight: FontWeight.w600,
              color: Colors.black87)),
          
          SizedBox(height: 16.h),
          
          // Goal options
          Expanded(
            child: Column(
              children: [
                _buildGoalCard(
                  goal: 'weight_loss',
                  title: 'خسارة الوزن',
                  subtitle: 'فقدان الوزن بطريقة صحية ومستدامة',
                  icon: Icons.trending_down,
                  color: Colors.red.shade100,
                  iconColor: Colors.red.shade600),
                
                SizedBox(height: 12.h),
                
                _buildGoalCard(
                  goal: 'maintain_weight',
                  title: 'المحافظة على الوزن',
                  subtitle: 'الحفاظ على وزنك الحالي بنمط حياة صحي',
                  icon: Icons.balance,
                  color: Colors.green.shade100,
                  iconColor: Colors.green.shade600),
                
                SizedBox(height: 12.h),
                
                _buildGoalCard(
                  goal: 'build_muscle',
                  title: 'بناء العضلات',
                  subtitle: 'زيادة الكتلة العضلية وتحسين القوة',
                  icon: Icons.fitness_center,
                  color: Colors.blue.shade100,
                  iconColor: Colors.blue.shade600),
                
                SizedBox(height: 12.h),
                
                _buildGoalCard(
                  goal: 'medical_diet',
                  title: 'دايت طبي (سكري / ضغط / إلخ)',
                  subtitle: 'خطة غذائية مخصصة للحالات الطبية',
                  icon: Icons.medical_services,
                  color: Colors.orange.shade100,
                  iconColor: Colors.orange.shade600),
              ])),
        ]));
  }

  Widget _buildGoalCard({
    required String goal,
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required Color iconColor,
  }) {
    final isSelected = selectedGoal == goal;
    
    return GestureDetector(
      onTap: () => onGoalSelected(goal),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.all(20.h),
        decoration: BoxDecoration(
          color: isSelected ? color.withAlpha(204) : Colors.white,
          borderRadius: BorderRadius.circular(16.h),
          border: Border.all(
            color: isSelected ? iconColor : Colors.grey.shade300,
            width: isSelected ? 2 : 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(13),
              blurRadius: 8,
              offset: const Offset(0, 2)),
          ]),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(12.h),
              decoration: BoxDecoration(
                color: isSelected ? iconColor.withAlpha(51) : color,
                borderRadius: BorderRadius.circular(12.h)),
              child: Icon(
                icon,
                size: 24.sp,
                color: iconColor)),
            
            SizedBox(width: 16.h),
            
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16.sp,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? iconColor : Colors.black87)),
                  SizedBox(height: 4.h),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 14.sp,
                      color: Colors.grey[600],
                      height: 1.3)),
                ])),
            
            if (isSelected)
              Container(
                padding: EdgeInsets.all(6.h),
                decoration: BoxDecoration(
                  color: iconColor,
                  shape: BoxShape.circle),
                child: Icon(
                  Icons.check,
                  size: 16.sp,
                  color: Colors.white)),
          ])));
  }
}