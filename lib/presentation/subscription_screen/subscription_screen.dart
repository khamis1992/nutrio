import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sizer/sizer.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../../models/subscription_model.dart';
import '../../services/subscription_service.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({Key? key}) : super(key: key);

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  SubscriptionModel? _currentSubscription;
  bool _isLoading = true;
  String _selectedPlan = 'Monthly';
  bool _includeGym = false;

  final Map<String, Map<String, dynamic>> _plans = {
    'Daily': {
      'price': 15,
      'duration': 1,
      'description': 'Perfect for trying out NUTRIO',
      'features': ['1 Day Access', '3 Meals', 'Nutrition Tracking'],
    },
    'Weekly': {
      'price': 89,
      'duration': 7,
      'description': 'Great for short-term goals',
      'features': [
        '7 Days Access',
        '21 Meals',
        'Nutrition Tracking',
        'Progress Reports'
      ],
    },
    'Monthly': {
      'price': 299,
      'duration': 30,
      'description': 'Most popular plan',
      'features': [
        '30 Days Access',
        '90 Meals',
        'Nutrition Tracking',
        'Progress Reports',
        'Priority Support'
      ],
    },
  };

  @override
  void initState() {
    super.initState();
    _loadCurrentSubscription();
  }

  Future<void> _loadCurrentSubscription() async {
    try {
      final subscription =
          await SubscriptionService.instance.getCurrentSubscription();
      if (mounted) {
        setState(() {
          _currentSubscription = subscription;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _subscribeToPlan() async {
    try {
      setState(() => _isLoading = true);

      final selectedPlanData = _plans[_selectedPlan]!;
      final startDate = DateTime.now();
      final endDate =
          startDate.add(Duration(days: selectedPlanData['duration']));
      final price = selectedPlanData['price'] + (_includeGym ? 50 : 0);

      await SubscriptionService.instance.createSubscription(
        planType: _selectedPlan,
        price: price.toDouble(),
        startDate: startDate,
        endDate: endDate,
        includesGym: _includeGym,
      );

      if (mounted) {
        Fluttertoast.showToast(
          msg: "Subscription created successfully!",
          backgroundColor: Colors.green,
          textColor: Colors.white,
        );
        await _loadCurrentSubscription();
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        Fluttertoast.showToast(
          msg: e.toString().replaceAll('Exception: ', ''),
          backgroundColor: Colors.red,
          textColor: Colors.white,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(
          'Subscription Plans',
          style: GoogleFonts.inter(
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Column(
                children: [
                  // Current Subscription Status
                  if (_currentSubscription != null)
                    Container(
                      margin: EdgeInsets.all(4.w),
                      padding: EdgeInsets.all(4.w),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                            color: const Color(0xFF2E7D32), width: 2),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.verified,
                                color: const Color(0xFF2E7D32),
                                size: 6.w,
                              ),
                              SizedBox(width: 3.w),
                              Text(
                                'Current Plan',
                                style: GoogleFonts.inter(
                                  fontSize: 18.sp,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF2E7D32),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 2.h),
                          Text(
                            '${_currentSubscription!.planType} Plan',
                            style: GoogleFonts.inter(
                              fontSize: 16.sp,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          SizedBox(height: 1.h),
                          if (_currentSubscription!.endDate != null)
                            Text(
                              'Valid until ${_formatDate(_currentSubscription!.endDate!)}',
                              style: GoogleFonts.inter(
                                fontSize: 14.sp,
                                color: Colors.grey[600],
                              ),
                            ),
                        ],
                      ),
                    ),

                  // Plan Selection
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4.w),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Choose Your Plan',
                          style: GoogleFonts.inter(
                            fontSize: 20.sp,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        SizedBox(height: 2.h),

                        // Plan Cards
                        ..._plans.entries.map((entry) => _buildPlanCard(
                              entry.key,
                              entry.value,
                            )),

                        SizedBox(height: 3.h),

                        // Gym Access Toggle
                        Container(
                          padding: EdgeInsets.all(4.w),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.fitness_center,
                                color: const Color(0xFF2E7D32),
                                size: 6.w,
                              ),
                              SizedBox(width: 3.w),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Add Gym Access',
                                      style: GoogleFonts.inter(
                                        fontSize: 16.sp,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    Text(
                                      '+QR 50 per plan',
                                      style: GoogleFonts.inter(
                                        fontSize: 14.sp,
                                        color: Colors.grey[600],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Switch(
                                value: _includeGym,
                                onChanged: (value) =>
                                    setState(() => _includeGym = value),
                                activeColor: const Color(0xFF2E7D32),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(height: 4.h),

                        // Subscribe Button
                        SizedBox(
                          width: double.infinity,
                          height: 6.h,
                          child: ElevatedButton(
                            onPressed: _currentSubscription?.active == true
                                ? null
                                : _subscribeToPlan,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2E7D32),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 2,
                            ),
                            child: Text(
                              _currentSubscription?.active == true
                                  ? 'Already Subscribed'
                                  : 'Subscribe Now - QR ${_plans[_selectedPlan]!['price'] + (_includeGym ? 50 : 0)}',
                              style: GoogleFonts.inter(
                                fontSize: 16.sp,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        SizedBox(height: 2.h),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildPlanCard(String planName, Map<String, dynamic> planData) {
    final isSelected = _selectedPlan == planName;
    final features = planData['features'] as List<String>;

    return GestureDetector(
      onTap: () => setState(() => _selectedPlan = planName),
      child: Container(
        margin: EdgeInsets.only(bottom: 3.w),
        padding: EdgeInsets.all(4.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFF2E7D32) : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Radio<String>(
                  value: planName,
                  groupValue: _selectedPlan,
                  onChanged: (value) => setState(() => _selectedPlan = value!),
                  activeColor: const Color(0xFF2E7D32),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            planName,
                            style: GoogleFonts.inter(
                              fontSize: 18.sp,
                              fontWeight: FontWeight.bold,
                              color: isSelected
                                  ? const Color(0xFF2E7D32)
                                  : Colors.black87,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            'QR ${planData['price']}',
                            style: GoogleFonts.inter(
                              fontSize: 20.sp,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF2E7D32),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        planData['description'],
                        style: GoogleFonts.inter(
                          fontSize: 12.sp,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: 2.h),

            // Features
            Wrap(
              spacing: 2.w,
              runSpacing: 1.h,
              children: features
                  .map((feature) => Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2E7D32).withAlpha(26),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          feature,
                          style: GoogleFonts.inter(
                            fontSize: 11.sp,
                            color: const Color(0xFF2E7D32),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];

    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }
}
