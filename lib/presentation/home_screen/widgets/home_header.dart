import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../../core/app_export.dart';

class HomeHeader extends StatelessWidget {
  final String userName;
  final String currentDate;
  final VoidCallback onNotificationTap;

  const HomeHeader({
    super.key,
    required this.userName,
    required this.currentDate,
    required this.onNotificationTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(4.w, 2.h, 4.w, 2.h),
        decoration: BoxDecoration(color: colorScheme.surface, boxShadow: [
          BoxShadow(
              color: theme.shadowColor,
              offset: const Offset(0, 2),
              blurRadius: 4,
              spreadRadius: 0),
        ]),
        child: SafeArea(
            bottom: false,
            child: Row(children: [
              // Official NUTRIO Logo
              Container(
                  width: 10.w,
                  height: 10.w,
                  child: CustomImageWidget(
                      imageUrl: '',
                      width: 10.w, height: 10.w, fit: BoxFit.contain)),
              SizedBox(width: 3.w),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text('Hello, $userName!',
                        style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: colorScheme.onSurface),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    SizedBox(height: 0.5.h),
                    Text(currentDate,
                        style: theme.textTheme.bodyMedium?.copyWith(
                            color:
                                colorScheme.onSurface.withValues(alpha: 0.7))),
                  ])),
              GestureDetector(
                  onTap: onNotificationTap,
                  child: Container(
                      width: 12.w,
                      height: 12.w,
                      decoration: BoxDecoration(
                          color: colorScheme.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12)),
                      child: Stack(children: [
                        Center(
                            child: CustomIconWidget(
                                iconName: 'notifications_outlined',
                                color: colorScheme.primary,
                                size: 24)),
                        Positioned(
                            right: 2.w,
                            top: 2.w,
                            child: Container(
                                width: 2.w,
                                height: 2.w,
                                decoration: BoxDecoration(
                                    color: AppTheme.errorColor,
                                    shape: BoxShape.circle))),
                      ]))),
            ])));
  }
}