import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sizer/sizer.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/gym_model.dart';
import '../../services/gym_service.dart';
import '../../widgets/custom_bottom_bar.dart';

class GymAccessScreen extends StatefulWidget {
  const GymAccessScreen({Key? key}) : super(key: key);

  @override
  State<GymAccessScreen> createState() => _GymAccessScreenState();
}

class _GymAccessScreenState extends State<GymAccessScreen> {
  List<GymModel> _allGyms = [];
  Map<String, dynamic>? _currentAccess;
  bool _hasActiveAccess = false;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadGymData();
  }

  Future<void> _loadGymData() async {
    try {
      final futures = await Future.wait([
        GymService.instance.getAllGyms(),
        GymService.instance.getCurrentGymAccess(),
        GymService.instance.hasActiveGymAccess(),
      ]);

      if (mounted) {
        setState(() {
          _allGyms = futures[0] as List<GymModel>;
          _currentAccess = futures[1] as Map<String, dynamic>?;
          _hasActiveAccess = futures[2] as bool;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(
          'Gym Access',
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Access Status
                  if (_hasActiveAccess && _currentAccess != null)
                    _buildCurrentAccessCard()
                  else
                    _buildNoAccessCard(),

                  SizedBox(height: 3.h),

                  // Available Gyms
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4.w),
                    child: Text(
                      'Available Gyms in Qatar',
                      style: GoogleFonts.inter(
                        fontSize: 20.sp,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                  SizedBox(height: 2.h),

                  // Gyms List
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _allGyms.length,
                    itemBuilder: (context, index) {
                      return _buildGymCard(_allGyms[index]);
                    },
                  ),

                  SizedBox(height: 10.h), // Bottom padding
                ],
              ),
            ),
      bottomNavigationBar: const CustomBottomBar(currentIndex: 4),
    );
  }

  Widget _buildCurrentAccessCard() {
    final gym = _currentAccess!['gyms'];
    final fromDate = DateTime.parse(_currentAccess!['from_date']);
    final toDate = DateTime.parse(_currentAccess!['to_date']);
    final daysLeft = toDate.difference(DateTime.now()).inDays;

    return Container(
      margin: EdgeInsets.all(4.w),
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2E7D32), Color(0xFF4CAF50)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(26),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.verified,
                color: Colors.white,
                size: 6.w,
              ),
              SizedBox(width: 3.w),
              Text(
                'Active Gym Access',
                style: GoogleFonts.inter(
                  fontSize: 18.sp,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          SizedBox(height: 2.h),
          Row(
            children: [
              // Gym Image
              Container(
                width: 15.w,
                height: 15.w,
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(51),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: gym['image_url'] != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: CachedNetworkImage(
                          imageUrl: gym['image_url'],
                          fit: BoxFit.cover,
                          errorWidget: (context, url, error) => Icon(
                            Icons.fitness_center,
                            color: Colors.white,
                            size: 6.w,
                          ),
                        ),
                      )
                    : Icon(
                        Icons.fitness_center,
                        color: Colors.white,
                        size: 6.w,
                      ),
              ),
              SizedBox(width: 3.w),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      gym['name'] ?? 'Unknown Gym',
                      style: GoogleFonts.inter(
                        fontSize: 16.sp,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    if (gym['location'] != null)
                      Text(
                        gym['location'],
                        style: GoogleFonts.inter(
                          fontSize: 12.sp,
                          color: Colors.white.withAlpha(230),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 2.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Valid until',
                    style: GoogleFonts.inter(
                      fontSize: 12.sp,
                      color: Colors.white.withAlpha(204),
                    ),
                  ),
                  Text(
                    _formatDate(toDate),
                    style: GoogleFonts.inter(
                      fontSize: 14.sp,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(51),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$daysLeft days left',
                  style: GoogleFonts.inter(
                    fontSize: 12.sp,
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNoAccessCard() {
    return Container(
      margin: EdgeInsets.all(4.w),
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.lock_outline,
                color: Colors.grey[600],
                size: 6.w,
              ),
              SizedBox(width: 3.w),
              Text(
                'No Active Gym Access',
                style: GoogleFonts.inter(
                  fontSize: 18.sp,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                ),
              ),
            ],
          ),
          SizedBox(height: 2.h),
          Text(
            'Subscribe to a plan with gym access to use our partner gyms across Qatar.',
            style: GoogleFonts.inter(
              fontSize: 14.sp,
              color: Colors.grey[600],
            ),
          ),
          SizedBox(height: 2.h),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () =>
                  Navigator.pushNamed(context, '/subscription-screen'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2E7D32),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                'Upgrade Subscription',
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

  Widget _buildGymCard(GymModel gym) {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 2.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(13),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(4.w),
        child: Row(
          children: [
            // Gym Image
            Container(
              width: 20.w,
              height: 20.w,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(12),
              ),
              child: gym.imageUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: CachedNetworkImage(
                        imageUrl: gym.imageUrl!,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => const Center(
                          child: CircularProgressIndicator(),
                        ),
                        errorWidget: (context, url, error) => Icon(
                          Icons.fitness_center,
                          color: Colors.grey[400],
                          size: 8.w,
                        ),
                      ),
                    )
                  : Icon(
                      Icons.fitness_center,
                      color: Colors.grey[400],
                      size: 8.w,
                    ),
            ),
            SizedBox(width: 4.w),

            // Gym Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    gym.name,
                    style: GoogleFonts.inter(
                      fontSize: 16.sp,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  SizedBox(height: 1.h),
                  if (gym.location != null)
                    Row(
                      children: [
                        Icon(
                          Icons.location_on,
                          color: Colors.grey[500],
                          size: 4.w,
                        ),
                        SizedBox(width: 1.w),
                        Expanded(
                          child: Text(
                            gym.location!,
                            style: GoogleFonts.inter(
                              fontSize: 12.sp,
                              color: Colors.grey[600],
                            ),
                          ),
                        ),
                      ],
                    ),
                  if (gym.gymType != null) ...[
                    SizedBox(height: 1.h),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2E7D32).withAlpha(26),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        gym.gymType!,
                        style: GoogleFonts.inter(
                          fontSize: 10.sp,
                          color: const Color(0xFF2E7D32),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Access Status
            Icon(
              _hasActiveAccess ? Icons.check_circle : Icons.lock,
              color:
                  _hasActiveAccess ? const Color(0xFF2E7D32) : Colors.grey[400],
              size: 6.w,
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
