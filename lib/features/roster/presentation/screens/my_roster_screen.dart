import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';

class MyRosterScreen extends StatefulWidget {
  const MyRosterScreen({super.key});

  @override
  State<MyRosterScreen> createState() => _MyRosterScreenState();
}

class _MyRosterScreenState extends State<MyRosterScreen> {
  int weekOffset = 0;
  Map<String, String> _serverRoster = {};

  @override
  void initState() {
    super.initState();
    _loadServerRoster();
  }

  Future<void> _loadServerRoster() async {
    try {
      final body = await ApiClient.instance.get('/employee/roster');
      if (body != null && mounted) {
        final list = body['roster'] ?? body['data'] ?? [];
        if (list is List && list.isNotEmpty) {
          final Map<String, String> map = {};
          for (final item in list) {
            final d = item['date'];
            final s = item['shift'];
            if (d != null && s != null) {
              map[d.toString().split('T')[0]] = s.toString();
            }
          }
          if (mounted && map.isNotEmpty) {
            setState(() {
              _serverRoster = map;
            });
          }
        }
      }
    } catch (_) {}
  }

  List<Map<String, String>> _generateMockRoster() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // Sunday of the current week (Egypt week starts Sunday)
    final diff = today.weekday == 7 ? 0 : today.weekday;
    final sunday = today.subtract(Duration(days: diff)).add(Duration(days: weekOffset * 7));

    final List<Map<String, String>> roster = [];
    final weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    final shifts = ['A', 'B', 'C', 'A', 'OFF', 'OFF', 'LEAVE'];

    for (int i = 0; i < 7; i++) {
      final date = sunday.add(Duration(days: i));
      final isFriday = date.weekday == DateTime.friday;
      final isSaturday = date.weekday == DateTime.saturday;
      
      final dateKey = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      String shift = _serverRoster[dateKey] ?? shifts[(i + weekOffset.abs()) % shifts.length];
      if (isFriday && !_serverRoster.containsKey(dateKey)) shift = 'OFF';
      if (isSaturday && shift != 'LEAVE' && !_serverRoster.containsKey(dateKey)) shift = 'OFF';

      roster.add({
        'dayName': weekDays[i],
        'date': '${date.day}/${date.month}',
        'fullDate': date.toIso8601String(),
        'shift': shift,
        'isToday': date.isAtSameMomentAs(today) ? 'true' : 'false',
        'isWeekend': (isFriday || isSaturday) ? 'true' : 'false',
      });
    }
    return roster;
  }

  void _changeWeek(int offset) {
    setState(() {
      weekOffset += offset;
    });
  }

  Color _getShiftColor(String shift) {
    switch (shift) {
      case 'A': return Colors.blue.shade100;
      case 'B': return Colors.green.shade100;
      case 'C': return Colors.purple.shade100;
      case 'OFF': return Colors.grey.shade200;
      case 'LEAVE': return Colors.yellow.shade100;
      default: return Colors.grey.shade100;
    }
  }

  Color _getShiftTextColor(String shift) {
    switch (shift) {
      case 'A': return Colors.blue.shade800;
      case 'B': return Colors.green.shade800;
      case 'C': return Colors.purple.shade800;
      case 'OFF': return Colors.grey.shade800;
      case 'LEAVE': return Colors.orange.shade800;
      default: return Colors.black;
    }
  }

  @override
  Widget build(BuildContext context) {
    final roster = _generateMockRoster();
    
    // Find next shift
    Map<String, String>? nextShift;
    for (var day in roster) {
      if (['A', 'B', 'C'].contains(day['shift']) && day['isToday'] == 'false' && day['isWeekend'] == 'false') {
        nextShift = day;
        break;
      }
    }
    nextShift ??= roster.firstWhere((day) => ['A', 'B', 'C'].contains(day['shift']), orElse: () => roster[0]);

    return Scaffold(
      appBar: AppBar(
        title: const Text('جدول الورديات الذكي'),
        centerTitle: true,
      ),
      body: Column(
        children: [
          // Week Navigation
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: () => _changeWeek(-1),
                ),
                Text(
                  weekOffset == 0 ? 'هذا الأسبوع' : (weekOffset > 0 ? 'بعد $weekOffset أسبوع' : 'قبل ${weekOffset.abs()} أسبوع'),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: () => _changeWeek(1),
                ),
              ],
            ),
          ),
          
          // Days List
          SizedBox(
            height: 140,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: roster.length,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              itemBuilder: (context, index) {
                final day = roster[index];
                final isToday = day['isToday'] == 'true';
                final isWeekend = day['isWeekend'] == 'true';
                final shift = day['shift']!;
                
                return Container(
                  width: 100,
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: isToday ? Colors.blue.shade50 : (isWeekend ? Colors.grey.shade50 : Colors.white),
                    border: Border.all(
                      color: isToday ? Colors.blue : Colors.grey.shade300,
                      width: isToday ? 2 : 1,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(day['dayName']!, style: TextStyle(fontWeight: FontWeight.bold, color: isWeekend ? Colors.grey : Colors.black)),
                      const SizedBox(height: 4),
                      Text(day['date']!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getShiftColor(shift),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          shift,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: _getShiftTextColor(shift),
                          ),
                        ),
                      )
                    ],
                  ),
                );
              },
            ),
          ),
          
          const SizedBox(height: 32),
          
          // Next Shift Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Card(
              elevation: 0,
              color: Colors.blue.shade50,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.blue.shade100),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.blue,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.access_time, color: Colors.white),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('الوردية القادمة', style: TextStyle(color: Colors.grey, fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(
                            '${nextShift['dayName']} - وردية ${nextShift['shift']}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
