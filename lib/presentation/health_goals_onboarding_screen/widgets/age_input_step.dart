import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sizer/sizer.dart';


class AgeInputStep extends StatefulWidget {
  final int? age;
  final Function(int?) onAgeChanged;

  const AgeInputStep({
    super.key,
    required this.age,
    required this.onAgeChanged,
  });

  @override
  State<AgeInputStep> createState() => _AgeInputStepState();
}

class _AgeInputStepState extends State<AgeInputStep> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.age?.toString() ?? '');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 24.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(height: 32.h),
          
          // Age icon
          Container(
            padding: EdgeInsets.all(24.h),
            decoration: BoxDecoration(
              color: Theme.of(context).primaryColor.withAlpha(26),
              shape: BoxShape.circle),
            child: Icon(
              Icons.cake_outlined,
              size: 48.h,
              color: Theme.of(context).primaryColor)),
          
          SizedBox(height: 24.h),
          
          Text(
            'العمر (اختياري)',
            style: TextStyle(
              fontSize: 24.sp,
              fontWeight: FontWeight.bold,
              color: Colors.black87),
            textAlign: TextAlign.center),
          
          SizedBox(height: 8.h),
          
          Text(
            'يساعدنا في حساب معدل الأيض الأساسي',
            style: TextStyle(
              fontSize: 16.sp,
              color: Colors.grey[600]),
            textAlign: TextAlign.center),
          
          SizedBox(height: 32.h),
          
          // Age input
          Container(
            padding: EdgeInsets.symmetric(horizontal: 24.h, vertical: 16.h),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(16.h),
              border: Border.all(color: Colors.grey.shade300)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: IntrinsicWidth(
                    child: TextField(
                      controller: _controller,
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(2),
                      ],
                      style: TextStyle(
                        fontSize: 24.sp,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).primaryColor),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        hintText: '25',
                        contentPadding: EdgeInsets.zero),
                      onChanged: (value) {
                        final age = int.tryParse(value);
                        widget.onAgeChanged(age);
                      }))),
                SizedBox(width: 8.h),
                Text(
                  'سنة',
                  style: TextStyle(
                    fontSize: 18.sp,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[600])),
              ])),
          
          SizedBox(height: 16.h),
          
          // Range indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.info_outline,
                size: 16.h,
                color: Colors.grey[500]),
              SizedBox(width: 8.h),
              Text(
                'النطاق المعتاد: 13-99 سنة',
                style: TextStyle(
                  fontSize: 14.sp,
                  color: Colors.grey[500])),
            ]),
          
          SizedBox(height: 24.h),
          
          // Skip option
          TextButton(
            onPressed: () => widget.onAgeChanged(null),
            child: Text(
              'تخطي هذه الخطوة',
              style: TextStyle(
                fontSize: 16.sp,
                color: Colors.grey[600],
                decoration: TextDecoration.underline))),
          
          const Spacer(),
        ]));
  }
}