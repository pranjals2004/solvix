import 'package:flutter/material.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/data/models/auth_session.dart';
import 'package:gate_resolver/features/home/screens/student_home_screen.dart';
import 'package:gate_resolver/features/profile/screens/profile_screen.dart';
import 'package:gate_resolver/features/study/screens/study_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({required this.session, super.key});

  final AuthSession session;

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screens = [
      StudentHomeScreen(
        session: widget.session,
        onStudy: () => setState(() => _currentIndex = 1),
      ),
      const StudyScreen(),
      ProfileScreen(session: widget.session),
    ];

    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        indicatorColor: (isDark ? AppColors.accentCyan : AppColors.primaryLight)
            .withOpacity(0.14),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book),
            label: 'Study',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
