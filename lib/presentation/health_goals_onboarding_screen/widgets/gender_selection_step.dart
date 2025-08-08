import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';


class GenderSelectionStep extends StatelessWidget {
  final String? selectedGender;
  final Function(String?) onGenderSelected;

  const GenderSelectionStep({
    super.key,
    required this.selectedGender,
    required this.onGenderSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 24.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(height: 24.h),
          
          // Gender icon
          Container(
            padding: EdgeInsets.all(24.h),
            decoration: BoxDecoration(
              color: Theme.of(context).primaryColor.withAlpha(26),
              shape: BoxShape.circle),
            child: Icon(
              Icons.person_outline,
              size: 48.h,
              color: Theme.of(context).primaryColor)),
          
          SizedBox(height: 32.h),
          
          Text(
            'الجنس (اختياري)',
            style: TextStyle(
              fontSize: 24.h,
              fontWeight: FontWeight.bold,
              color: Colors.black87),
            textAlign: TextAlign.center),
          
          SizedBox(height: 8.h),
          
          Text(
            'يساعدنا في تخصيص احتياجاتك بدقة أكبر',
            style: TextStyle(
              fontSize: 16.h,
              color: Colors.grey[600]),
            textAlign: TextAlign.center),
          
          SizedBox(height: 40.h),
          
          // Gender options
          Column(
            children: [
              _buildGenderOption(
                gender: 'male',
                title: 'ذكر',
                icon: Icons.male,
                color: Colors.blue),
              
              SizedBox(height: 16.h),
              
              _buildGenderOption(
                gender: 'female',
                title: 'أنثى',
                icon: Icons.female,
                color: Colors.pink),
              
              SizedBox(height: 16.h),
              
              _buildGenderOption(
                gender: 'prefer_not_to_say',
                title: 'أفضل عدم الإجابة',
                icon: Icons.remove,
                color: Colors.grey),
            ]),
          
          const Spacer(),
        ]));
  }

  Widget _buildGenderOption({
    required String gender,
    required String title,
    required IconData icon,
    required Color color,
  }) {
    final isSelected = selectedGender == gender;
    
    return GestureDetector(
      onTap: () => onGenderSelected(gender),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: EdgeInsets.all(20.h),
        decoration: BoxDecoration(
          color: isSelected ? color.withAlpha(26) : Colors.white,
          borderRadius: BorderRadius.circular(16.h),
          border: Border.all(
            color: isSelected ? color : Colors.grey.shade300,
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
                color: isSelected ? color.withAlpha(51) : color.withAlpha(26),
                borderRadius: BorderRadius.circular(12.h)),
              child: Icon(
                icon,
                size: 24.h,
                color: color)),
            
            SizedBox(width: 16.h),
            
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 18.h,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? color : Colors.black87))),
            
            if (isSelected)
              Container(
                padding: EdgeInsets.all(8.h),
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle),
                child: Icon(
                  Icons.check,
                  size: 16.h,
                  color: Colors.white)),
          ])));
  }
}