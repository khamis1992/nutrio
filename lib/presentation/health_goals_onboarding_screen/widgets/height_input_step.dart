import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sizer/sizer.dart';


class HeightInputStep extends StatefulWidget {
  final int? height;
  final Function(int?) onHeightChanged;

  const HeightInputStep({
    super.key,
    required this.height,
    required this.onHeightChanged,
  });

  @override
  State<HeightInputStep> createState() => _HeightInputStepState();
}

class _HeightInputStepState extends State<HeightInputStep> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.height?.toString() ?? '');
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
          
          // Height icon
          Container(
            padding: EdgeInsets.all(16.h),
            decoration: BoxDecoration(
              color: Theme.of(context).primaryColor.withAlpha(26),
              shape: BoxShape.circle),
            child: Icon(
              Icons.height,
              size: 32.sp,
              color: Theme.of(context).primaryColor)),
          
          SizedBox(height: 24.h),
          
          Text(
            'ما هو طولك؟',
            style: TextStyle(
              fontSize: 24.sp,
              fontWeight: FontWeight.bold,
              color: Colors.black87),
            textAlign: TextAlign.center),
          
          SizedBox(height: 8.h),
          
          Text(
            'نحتاج هذه المعلومة لحساب مؤشر كتلة الجسم',
            style: TextStyle(
              fontSize: 16.sp,
              color: Colors.grey[600]),
            textAlign: TextAlign.center),
          
          SizedBox(height: 32.h),
          
          // Height input
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
                        LengthLimitingTextInputFormatter(3),
                      ],
                      style: TextStyle(
                        fontSize: 20.sp,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).primaryColor),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        hintText: '170',
                        contentPadding: EdgeInsets.zero),
                      onChanged: (value) {
                        final height = int.tryParse(value);
                        widget.onHeightChanged(height);
                      }))),
                SizedBox(width: 8.h),
                Text(
                  'سم',
                  style: TextStyle(
                    fontSize: 16.sp,
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
                size: 16.sp,
                color: Colors.grey[500]),
              SizedBox(width: 8.h),
              Text(
                'النطاق المعتاد: 100-250 سم',
                style: TextStyle(
                  fontSize: 14.sp,
                  color: Colors.grey[500])),
            ]),
          
          const Spacer(),
        ]));
  }
}