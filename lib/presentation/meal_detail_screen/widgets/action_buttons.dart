import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sizer/sizer.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../../../models/meal_model.dart';
import '../../../services/nutrition_service.dart';

class ActionButtons extends StatefulWidget {
  final MealModel? meal;
  final VoidCallback? onAddToPlan;
  final VoidCallback? onLogAsEaten;
  final bool isLoading;

  const ActionButtons({
    Key? key,
    this.meal,
    this.onAddToPlan,
    this.onLogAsEaten,
    this.isLoading = false,
  }) : super(key: key);

  @override
  State<ActionButtons> createState() => _ActionButtonsState();
}

class _ActionButtonsState extends State<ActionButtons> {
  bool _isLogging = false;

  Future<void> _logAsEaten() async {
    if (widget.meal == null) {
      widget.onLogAsEaten?.call();
      return;
    }

    try {
      setState(() => _isLogging = true);

      await NutritionService.instance.logMealAsEaten(widget.meal!);

      if (mounted) {
        Fluttertoast.showToast(
          msg: "Meal logged successfully!",
          backgroundColor: Colors.green,
          textColor: Colors.white,
        );
      }
    } catch (e) {
      if (mounted) {
        Fluttertoast.showToast(
          msg: e.toString().replaceAll('Exception: ', ''),
          backgroundColor: Colors.red,
          textColor: Colors.white,
        );
      }
    } finally {
      if (mounted) setState(() => _isLogging = false);
    }
  }

  void _addToPlan() {
    if (widget.onAddToPlan != null) {
      widget.onAddToPlan!();
    } else {
      Fluttertoast.showToast(
        msg: "Add to Plan feature coming soon!",
        backgroundColor: Colors.blue,
        textColor: Colors.white,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(26),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Add to Plan Button
          Expanded(
            child: OutlinedButton(
              onPressed: _addToPlan,
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFF2E7D32)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: EdgeInsets.symmetric(vertical: 2.h),
              ),
              child: Text(
                'Add to Plan',
                style: GoogleFonts.inter(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF2E7D32),
                ),
              ),
            ),
          ),
          SizedBox(width: 3.w),

          // Log as Eaten Button
          Expanded(
            child: ElevatedButton(
              onPressed: (_isLogging || widget.isLoading) ? null : _logAsEaten,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2E7D32),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: EdgeInsets.symmetric(vertical: 2.h),
              ),
              child: (_isLogging || widget.isLoading)
                  ? SizedBox(
                      height: 4.w,
                      width: 4.w,
                      child: const CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        strokeWidth: 2,
                      ),
                    )
                  : Text(
                      'Log as Eaten',
                      style: GoogleFonts.inter(
                        fontSize: 14.sp,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
