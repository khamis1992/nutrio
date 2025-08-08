import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sizer/sizer.dart';

import '../../models/health_goal_model.dart';
import '../../services/auth_service.dart';
import '../../services/health_goals_service.dart';
import '../../services/localization_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_bottom_bar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoading = false;
  HealthGoalModel? _userGoal;
  bool _goalsLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUserGoals();
  }

  Future<void> _loadUserGoals() async {
    final user = AuthService.instance.currentUser;
    if (user == null) return;

    try {
      // Check if user has profile first
      final userId = user.id;
      final goal = await HealthGoalsService.instance.getUserHealthGoal(userId);

      setState(() {
        _userGoal = goal;
        _goalsLoading = false;
      });
    } catch (e) {
      setState(() {
        _goalsLoading = false;
      });
    }
  }

  Future<void> _handleSignOut() async {
    try {
      setState(() => _isLoading = true);

      await AuthService.instance.signOut();

      if (mounted) {
        Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        Fluttertoast.showToast(
            msg: e.toString().replaceAll('Exception: ', ''),
            backgroundColor: Colors.red,
            textColor: Colors.white);
      }
    }
  }

  void _showSignOutDialog() {
    final localizations = AppLocalizations.of(context)!;

    showDialog(
        context: context,
        builder: (context) => AlertDialog(
                backgroundColor: Theme.of(context).cardColor,
                title: Text(localizations.signOut,
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimaryLight)),
                content: Text(localizations.signOutConfirmation,
                    style: GoogleFonts.inter(color: AppTheme.textPrimaryLight)),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text(localizations.cancel,
                          style: GoogleFonts.inter(
                              color: AppTheme.textSecondaryLight))),
                  TextButton(
                      onPressed: () {
                        Navigator.pop(context);
                        _handleSignOut();
                      },
                      child: Text(localizations.signOut,
                          style: GoogleFonts.inter(
                              color: Colors.red, fontWeight: FontWeight.w600))),
                ]));
  }

  void _showLanguageDialog() {
    final localizations = AppLocalizations.of(context)!;
    final currentLanguage = LocalizationService.instance.currentLanguageCode;

    showDialog(
        context: context,
        builder: (context) => AlertDialog(
                backgroundColor: Theme.of(context).cardColor,
                title: Text(localizations.selectLanguage,
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimaryLight)),
                content: Column(mainAxisSize: MainAxisSize.min, children: [
                  ListTile(
                      leading: const Icon(Icons.language),
                      title: Text(localizations.english,
                          style: GoogleFonts.inter(
                              color: AppTheme.textPrimaryLight)),
                      trailing: currentLanguage == 'en'
                          ? Icon(Icons.check, color: AppTheme.primaryLight)
                          : null,
                      onTap: () async {
                        await LocalizationService.instance.changeLanguage('en');
                        Navigator.pop(context);
                        setState(() {}); // Refresh the UI
                      }),
                  ListTile(
                      leading: const Icon(Icons.language),
                      title: Text(localizations.arabic,
                          style: GoogleFonts.inter(
                              color: AppTheme.textPrimaryLight)),
                      trailing: currentLanguage == 'ar'
                          ? Icon(Icons.check, color: AppTheme.primaryLight)
                          : null,
                      onTap: () async {
                        await LocalizationService.instance.changeLanguage('ar');
                        Navigator.pop(context);
                        setState(() {}); // Refresh the UI
                      }),
                ]),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text(localizations.cancel,
                          style: GoogleFonts.inter(
                              color: AppTheme.textSecondaryLight))),
                ]));
  }

  void _handleGoalsNavigation() async {
    await Navigator.pushNamed(context, '/health-goals');
    _loadUserGoals(); // Refresh goals data when returning
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.instance.currentUser;
    final userName = user?.userMetadata?['full_name'] ?? 'User';
    final userEmail = user?.email ?? '';
    final localizations = AppLocalizations.of(context)!;
    final isArabic = LocalizationService.instance.isArabic;

    return Scaffold(
        backgroundColor: AppTheme.backgroundLight,
        appBar: AppBar(
            title: Text(localizations.profile,
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimaryLight)),
            backgroundColor: AppTheme.surfaceLight,
            elevation: 0,
            iconTheme: IconThemeData(color: AppTheme.primaryLight)),
        body: SingleChildScrollView(
            child: Column(children: [
          SizedBox(height: 2.h),

          // Profile Header
          Container(
              margin: EdgeInsets.symmetric(horizontal: 4.w),
              padding: EdgeInsets.all(4.w),
              decoration: BoxDecoration(
                  color: AppTheme.cardLight,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                        color: AppTheme.shadowLight,
                        blurRadius: 10,
                        offset: const Offset(0, 2)),
                  ]),
              child: Row(
                  textDirection:
                      isArabic ? TextDirection.rtl : TextDirection.ltr,
                  children: [
                    // Avatar
                    Container(
                        width: 20.w,
                        height: 20.w,
                        decoration: BoxDecoration(
                            color: AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(10.w)),
                        child: Center(
                            child: Text(
                                userName.isNotEmpty
                                    ? userName[0].toUpperCase()
                                    : 'U',
                                style: GoogleFonts.inter(
                                    fontSize: 24.sp,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white)))),
                    SizedBox(width: 4.w),

                    // User Info
                    Expanded(
                        child: Column(
                            crossAxisAlignment: isArabic
                                ? CrossAxisAlignment.end
                                : CrossAxisAlignment.start,
                            children: [
                          Text(userName,
                              style: GoogleFonts.inter(
                                  fontSize: 18.sp,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textPrimaryLight),
                              textDirection: isArabic
                                  ? TextDirection.rtl
                                  : TextDirection.ltr),
                          SizedBox(height: 1.h),
                          Text(userEmail,
                              style: GoogleFonts.inter(
                                  fontSize: 14.sp,
                                  color: AppTheme.textSecondaryLight),
                              textDirection: isArabic
                                  ? TextDirection.rtl
                                  : TextDirection.ltr),
                        ])),
                  ])),
          SizedBox(height: 3.h),

          // My Goals Section
          _buildMenuSection(localizations, [
            _goalsLoading
                ? _buildLoadingGoalsItem(localizations)
                : _userGoal != null
                    ? _buildGoalsMenuItem(localizations, _userGoal!)
                    : _buildSetupGoalsMenuItem(localizations),
          ]),
          SizedBox(height: 2.h),

          // Menu Options
          _buildMenuSection(localizations, [
            _buildMenuItem(
                icon: Icons.restaurant_menu,
                title: localizations.myPlan,
                subtitle: localizations.viewAndManageYourMealPlan,
                onTap: () => Navigator.pushNamed(context, '/my-plan')),
            _buildMenuItem(
                icon: Icons.trending_up,
                title: localizations.progress ?? 'Progress',
                subtitle: localizations.trackYourNutritionAndProgress,
                onTap: () => Navigator.pushNamed(context, '/progress')),
            _buildMenuItem(
                icon: Icons.payment,
                title: localizations.subscription ?? 'Subscription',
                subtitle: localizations.manageYourSubscriptionPlan,
                onTap: () => Navigator.pushNamed(context, '/subscription')),
            _buildMenuItem(
                icon: Icons.fitness_center,
                title: localizations.gymAccess ?? 'Gym Access',
                subtitle: localizations.viewGymAccessAndLocations,
                onTap: () => Navigator.pushNamed(context, '/gym-access')),
          ]),
          SizedBox(height: 2.h),

          // Settings Section
          _buildMenuSection(localizations, [
            _buildMenuItem(
                icon: Icons.language,
                title: localizations.language,
                subtitle: LocalizationService.instance.getLanguageName(
                    LocalizationService.instance.currentLanguageCode),
                onTap: _showLanguageDialog),
            _buildMenuItem(
                icon: Icons.notifications_outlined,
                title: localizations.notifications,
                subtitle: localizations.manageNotificationPreferences,
                onTap: () {
                  // TODO: Implement notifications settings
                  Fluttertoast.showToast(
                      msg: "Notifications settings coming soon!",
                      backgroundColor: AppTheme.primaryLight,
                      textColor: Colors.white);
                }),
            _buildMenuItem(
                icon: Icons.help_outline,
                title: localizations.helpSupport,
                subtitle: localizations.getHelpOrContactSupport,
                onTap: () {
                  // TODO: Implement help & support
                  Fluttertoast.showToast(
                      msg: "Help & Support coming soon!",
                      backgroundColor: AppTheme.primaryLight,
                      textColor: Colors.white);
                }),
            _buildMenuItem(
                icon: Icons.privacy_tip_outlined,
                title: localizations.privacyPolicy,
                subtitle: localizations.readOurPrivacyPolicy,
                onTap: () {
                  // TODO: Implement privacy policy
                  Fluttertoast.showToast(
                      msg: "Privacy Policy coming soon!",
                      backgroundColor: AppTheme.primaryLight,
                      textColor: Colors.white);
                }),
          ]),
          SizedBox(height: 2.h),

          // Sign Out
          _buildMenuSection(localizations, [
            _buildMenuItem(
                icon: Icons.logout,
                title: localizations.signOut,
                subtitle: localizations.signOutOfYourAccount,
                onTap: _showSignOutDialog,
                isDestructive: true),
          ]),

          SizedBox(height: 10.h), // Bottom padding
        ])),
        bottomNavigationBar: const CustomBottomBar(currentIndex: 4));
  }

  Widget _buildMenuSection(AppLocalizations localizations, List<Widget> items) {
    return Container(
        margin: EdgeInsets.symmetric(horizontal: 4.w),
        decoration: BoxDecoration(
            color: AppTheme.cardLight,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                  color: AppTheme.shadowLight,
                  blurRadius: 10,
                  offset: const Offset(0, 2)),
            ]),
        child: Column(children: items));
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    final color = isDestructive ? Colors.red : AppTheme.textPrimaryLight;
    final iconColor = isDestructive ? Colors.red : AppTheme.primaryLight;
    final isArabic = LocalizationService.instance.isArabic;

    return ListTile(
        leading: Icon(icon, color: iconColor, size: 6.w),
        title: Text(title,
            style: GoogleFonts.inter(
                fontSize: 16.sp, fontWeight: FontWeight.w600, color: color),
            textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr),
        subtitle: Text(subtitle,
            style: GoogleFonts.inter(
                fontSize: 12.sp, color: AppTheme.textSecondaryLight),
            textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr),
        trailing: Icon(
            isArabic ? Icons.arrow_back_ios : Icons.arrow_forward_ios,
            color: AppTheme.textSecondaryLight.withAlpha(153),
            size: 4.w),
        onTap: _isLoading ? null : onTap,
        contentPadding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h));
  }

  Widget _buildLoadingGoalsItem(AppLocalizations localizations) {
    final isArabic = LocalizationService.instance.isArabic;

    return ListTile(
        leading:
            Icon(Icons.track_changes, color: AppTheme.primaryLight, size: 6.w),
        title: Text(localizations.myGoals,
            style: GoogleFonts.inter(
                fontSize: 16.sp,
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimaryLight),
            textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr),
        subtitle: SizedBox(
            height: 16,
            width: 120,
            child: Container(
                decoration: BoxDecoration(
                    color: AppTheme.textSecondaryLight.withAlpha(77),
                    borderRadius: BorderRadius.circular(4)))),
        trailing: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor:
                    AlwaysStoppedAnimation<Color>(AppTheme.primaryLight))),
        contentPadding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h));
  }

  Widget _buildSetupGoalsMenuItem(AppLocalizations localizations) {
    final isArabic = LocalizationService.instance.isArabic;

    return ListTile(
        leading:
            Icon(Icons.track_changes, color: AppTheme.primaryLight, size: 6.w),
        title: Text(localizations.setupYourGoals,
            style: GoogleFonts.inter(
                fontSize: 16.sp,
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimaryLight),
            textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr),
        subtitle: Text(localizations.setUpHealthGoalsDescription,
            style: GoogleFonts.inter(
                fontSize: 12.sp, color: AppTheme.textSecondaryLight),
            textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr),
        trailing: Icon(
            isArabic ? Icons.arrow_back_ios : Icons.arrow_forward_ios,
            color: AppTheme.textSecondaryLight.withAlpha(153),
            size: 4.w),
        onTap: _isLoading ? null : _handleGoalsNavigation,
        contentPadding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h));
  }

  Widget _buildGoalsMenuItem(
      AppLocalizations localizations, HealthGoalModel goal) {
    final isArabic = LocalizationService.instance.isArabic;
    final languageCode = LocalizationService.instance.currentLanguageCode;

    // Build subtitle with goal details
    List<String> details = [];
    details.add(
        '${localizations.currentGoal}: ${goal.getLocalizedGoalName(languageCode)}');

    if (goal.currentWeight != null) {
      details.add(
          '${localizations.currentWeight}: ${goal.currentWeight!.toStringAsFixed(1)} ${localizations.kg}');
    }

    if (goal.height != null) {
      details
          .add('${localizations.height}: ${goal.height} ${localizations.cm}');
    }

    if (goal.gender != null) {
      final genderName = goal.getLocalizedGenderName(languageCode);
      if (genderName != null) {
        details.add(genderName);
      }
    }

    if (goal.age != null) {
      details.add('${goal.age} ${localizations.years}');
    }

    final subtitle = details.join(' • ');

    return ListTile(
        leading:
            Icon(Icons.track_changes, color: AppTheme.primaryLight, size: 6.w),
        title: Text(localizations.myGoals,
            style: GoogleFonts.inter(
                fontSize: 16.sp,
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimaryLight),
            textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr),
        subtitle: Text(subtitle,
            style: GoogleFonts.inter(
                fontSize: 12.sp, color: AppTheme.textSecondaryLight),
            textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr,
            maxLines: 2,
            overflow: TextOverflow.ellipsis),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(localizations.editGoals,
              style: GoogleFonts.inter(
                  fontSize: 12.sp,
                  color: AppTheme.primaryLight,
                  fontWeight: FontWeight.w500)),
          SizedBox(width: 1.w),
          Icon(isArabic ? Icons.arrow_back_ios : Icons.arrow_forward_ios,
              color: AppTheme.primaryLight, size: 4.w),
        ]),
        onTap: _isLoading ? null : _handleGoalsNavigation,
        contentPadding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h));
  }
}