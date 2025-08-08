import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../../core/app_export.dart';
import '../../../widgets/custom_image_widget.dart';

class NutrioLogoWidget extends StatelessWidget {
  const NutrioLogoWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(children: [
      // Official NUTRIO Logo
      Container(
          width: 20.w,
          height: 20.w,
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4.w),
              boxShadow: [
                BoxShadow(
                    color: colorScheme.primary.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4)),
              ]),
          child: ClipRRect(
              borderRadius: BorderRadius.circular(4.w),
              child: CustomImageWidget(
                  imageUrl: 'assets/images/nutrio_logo.png',
                  width: 20.w, height: 20.w, fit: BoxFit.contain))),
      SizedBox(height: 3.h),

      // App Name
      Text('NUTRIO',
          style: theme.textTheme.headlineMedium?.copyWith(
              color: colorScheme.primary,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.0,
              fontSize: 24.sp)),
      SizedBox(height: 1.h),

      // Tagline
      Text('Your Health, Our Priority',
          style: theme.textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurface.withValues(alpha: 0.7),
              fontWeight: FontWeight.w400,
              fontSize: 12.sp)),
    ]);
  }
}