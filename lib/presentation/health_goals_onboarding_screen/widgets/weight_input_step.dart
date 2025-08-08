import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sizer/sizer.dart';


class WeightInputStep extends StatefulWidget {
  final double? currentWeight;
  final Function(double?) onWeightChanged;

  const WeightInputStep({
    super.key,
    required this.currentWeight,
    required this.onWeightChanged,
  });

  @override
  State<WeightInputStep> createState() => _WeightInputStepState();
}

class _WeightInputStepState extends State<WeightInputStep> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.currentWeight?.toStringAsFixed(1) ?? '');
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
          SizedBox(height: 40.h),
          
          // Weight icon
          Container(
            padding: EdgeInsets.all(20.h),
            decoration: BoxDecoration(
              color: Theme.of(context).primaryColor.withAlpha(26),
              shape: BoxShape.circle),
            child: Icon(
              Icons.monitor_weight_outlined,
              size: 48.h,
              color: Theme.of(context).primaryColor)),
          
          SizedBox(height: 32.h),
          
          Text(
            'ما هو وزنك الحالي؟',
            style: TextStyle(
              fontSize: 24.sp,
              fontWeight: FontWeight.bold,
              color: Colors.black87),
            textAlign: TextAlign.center),
          
          SizedBox(height: 12.h),
          
          Text(
            'هذا يساعدنا في حساب احتياجاتك الغذائية',
            style: TextStyle(
              fontSize: 16.sp,
              color: Colors.grey[600]),
            textAlign: TextAlign.center),
          
          SizedBox(height: 40.h),
          
          // Weight input
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
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,1}')),
                        LengthLimitingTextInputFormatter(5),
                      ],
                      style: TextStyle(
                        fontSize: 32.sp,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).primaryColor),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        hintText: '70.0',
                        contentPadding: EdgeInsets.zero),
                      onChanged: (value) {
                        final weight = double.tryParse(value);
                        widget.onWeightChanged(weight);
                      }))),
                SizedBox(width: 8.h),
                Text(
                  'كغم',
                  style: TextStyle(
                    fontSize: 18.sp,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[600])),
              ])),
          
          SizedBox(height: 24.h),
          
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
                'النطاق المعتاد: 40-200 كغم',
                style: TextStyle(
                  fontSize: 14.sp,
                  color: Colors.grey[500])),
            ]),
          
          const Spacer(),
        ]));
  }
}