import 'package:flutter/material.dart';
import '../../../../core/theme/app_typography.dart';

class ApplyPermitSheet extends StatefulWidget {
  const ApplyPermitSheet({super.key});

  @override
  State<ApplyPermitSheet> createState() => _ApplyPermitSheetState();
}

class _ApplyPermitSheetState extends State<ApplyPermitSheet> {
  String? _selectedType;
  final List<String> _types = ['عمل حار', 'ارتفاعات', 'أماكن مغلقة', 'عزل طاقة'];
  
  bool _fireExtinguisher = false;
  bool _grounding = false;
  bool _safetyBelt = false;

  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 16,
          right: 16,
          top: 24,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('طلب تصريح عمل جديد', style: AppTypography.sectionHeading),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'نوع التصريح',
                  border: OutlineInputBorder(),
                ),
                value: _selectedType,
                items: _types.map((type) {
                  return DropdownMenuItem(value: type, child: Text(type));
                }).toList(),
                onChanged: (val) {
                  setState(() {
                    _selectedType = val;
                  });
                },
                validator: (value) => value == null ? 'يرجى اختيار نوع التصريح' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'الخط / الموقع',
                  border: OutlineInputBorder(),
                ),
                validator: (value) => value == null || value.isEmpty ? 'مطلوب' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'وصف العمل',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
                validator: (value) => value == null || value.isEmpty ? 'مطلوب' : null,
              ),
              const SizedBox(height: 16),
              Text('احتياطات السلامة', style: AppTypography.labelBold),
              CheckboxListTile(
                title: const Text('طفاية حريق'),
                value: _fireExtinguisher,
                onChanged: (val) => setState(() => _fireExtinguisher = val ?? false),
                controlAffinity: ListTileControlAffinity.leading,
              ),
              CheckboxListTile(
                title: const Text('تأريض'),
                value: _grounding,
                onChanged: (val) => setState(() => _grounding = val ?? false),
                controlAffinity: ListTileControlAffinity.leading,
              ),
              CheckboxListTile(
                title: const Text('أحزمة أمان'),
                value: _safetyBelt,
                onChanged: (val) => setState(() => _safetyBelt = val ?? false),
                controlAffinity: ListTileControlAffinity.leading,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  if (_formKey.currentState!.validate()) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('تم إرسال الطلب بنجاح')),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('إرسال الطلب'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
      ),
    );
  }
}
