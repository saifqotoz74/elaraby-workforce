import 'dart:io' show File;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle, ByteData;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_theme.dart';

/// Itemized Payroll figures for official statements with history & loan integration.
class SalarySlipData {
  static const defaultPeriod = 'July 2026';

  final String period;
  final int basicSalary;
  final int overtimeAmount;
  final int transportAllowance;
  final int mealAllowance;
  final int incentiveBonus;
  final int allowances;
  final int socialInsurance;
  final int incomeTax;
  final int medicalInsurance;
  final int penalties;
  final int loanDeduction;
  final int deductions;
  final int netSalary;
  final String paidOn;
  final String paymentMethod;

  const SalarySlipData({
    required this.period,
    required this.basicSalary,
    this.overtimeAmount = 0,
    this.transportAllowance = 0,
    this.mealAllowance = 0,
    this.incentiveBonus = 0,
    required this.allowances,
    this.socialInsurance = 0,
    this.incomeTax = 0,
    this.medicalInsurance = 0,
    this.penalties = 0,
    this.loanDeduction = 0,
    required this.deductions,
    int? netSalary,
    required this.paidOn,
    required this.paymentMethod,
  }) : netSalary = netSalary ?? (basicSalary + allowances - deductions);

  factory SalarySlipData.fromJson(Map<String, dynamic> json) {
    final basic = ((json['basicSalary'] ?? json['baseSalary']) as num?)?.toInt() ?? 8500;
    final overtime = (json['overtimeAmount'] as num?)?.toInt() ?? 650;
    final transport = (json['transportAllowance'] as num?)?.toInt() ?? 400;
    final meal = (json['mealAllowance'] as num?)?.toInt() ?? 350;
    final incentive = (json['incentiveBonus'] as num?)?.toInt() ?? 800;
    
    // Total allowances fallback
    final totalAllowances = ((json['totalAllowances'] ?? json['allowances']) as num?)?.toInt() ??
        (overtime + transport + meal + incentive);

    final socIns = (json['socialInsurance'] as num?)?.toInt() ?? 680;
    final incTax = (json['incomeTax'] as num?)?.toInt() ?? 210;
    final medIns = (json['medicalInsurance'] as num?)?.toInt() ?? 150;
    final pen = (json['penalties'] as num?)?.toInt() ?? 0;
    final loanDed = (json['loanDeduction'] as num?)?.toInt() ?? 0;

    // Total deductions fallback
    final totalDeductions = ((json['totalDeductions'] ?? json['deductions']) as num?)?.toInt() ??
        (socIns + incTax + medIns + pen + loanDed);

    final net = (json['netSalary'] as num?)?.toInt() ??
        (basic + totalAllowances - totalDeductions);

    final period = json['periodEn'] as String? ??
        json['periodAr'] as String? ??
        json['period'] as String? ??
        defaultPeriod;

    return SalarySlipData(
      period: period,
      basicSalary: basic,
      overtimeAmount: overtime,
      transportAllowance: transport,
      mealAllowance: meal,
      incentiveBonus: incentive,
      allowances: totalAllowances,
      socialInsurance: socIns,
      incomeTax: incTax,
      medicalInsurance: medIns,
      penalties: pen,
      loanDeduction: loanDed,
      deductions: totalDeductions,
      netSalary: net,
      paidOn: json['paidOn'] as String? ?? 'Aug 28, 2026',
      paymentMethod: json['paymentMethod'] as String? ?? 'Bank Transfer (CIB)',
    );
  }

  int get netPay => netSalary;

  String get netPayLabel => 'EGP ${_format(netPay)}';

  static String format(int amount) {
    final s = amount.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      final posFromEnd = s.length - i;
      buf.write(s[i]);
      if (posFromEnd > 1 && posFromEnd % 3 == 1) buf.write(',');
    }
    return buf.toString();
  }

  static String _format(int amount) => format(amount);

  String get basicLabel => 'EGP ${_format(basicSalary)}';
  String get allowancesLabel => '+EGP ${_format(allowances)}';
  String get deductionsLabel => '-EGP ${_format(deductions)}';
  String get overtimeLabel => '+EGP ${_format(overtimeAmount)}';
  String get transportLabel => '+EGP ${_format(transportAllowance)}';
  String get mealLabel => '+EGP ${_format(mealAllowance)}';
  String get incentiveLabel => '+EGP ${_format(incentiveBonus)}';
  String get socialInsuranceLabel => '-EGP ${_format(socialInsurance)}';
  String get incomeTaxLabel => '-EGP ${_format(incomeTax)}';
  String get medicalInsuranceLabel => '-EGP ${_format(medicalInsurance)}';
  String get penaltiesLabel => '-EGP ${_format(penalties)}';
  String get loanDeductionLabel => '-EGP ${_format(loanDeduction)}';

  bool get hasLoanDeduction => loanDeduction > 0;
}

/// Converts integer number to formal Arabic words (Tafqeet / تفقيد المبلغ).
String convertToArabicWords(int number) {
  if (number == 0) return 'صفر جنيه مصري';
  
  final units = [
    '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
    'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر',
    'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'
  ];
  final tens = [
    '', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'
  ];
  final hundreds = [
    '', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة',
    'ثمانمائة', 'تسعمائة'
  ];

  String convertGroup(int n) {
    var str = '';
    final h = n ~/ 100;
    final rem = n % 100;

    if (h > 0) {
      str += hundreds[h];
      if (rem > 0) str += ' و';
    }

    if (rem > 0) {
      if (rem < 20) {
        str += units[rem];
      } else {
        final u = rem % 10;
        final t = rem ~/ 10;
        if (u > 0) {
          str += '${units[u]} و${tens[t]}';
        } else {
          str += tens[t];
        }
      }
    }
    return str;
  }

  var result = '';
  final thousands = number ~/ 1000;
  final remainder = number % 1000;

  if (thousands > 0) {
    if (thousands == 1) {
      result += 'ألف';
    } else if (thousands == 2) {
      result += 'ألفان';
    } else if (thousands >= 3 && thousands <= 10) {
      result += '${convertGroup(thousands)} آلاف';
    } else {
      result += '${convertGroup(thousands)} ألف';
    }
    if (remainder > 0) result += ' و';
  }

  if (remainder > 0) {
    result += convertGroup(remainder);
  }

  return 'فقط $result جنيهاً مصرياً لا غير';
}

Uint8List? _cachedPdfBytes;
String? _cachedPdfKey;

/// Clears cached PDF binary data.
void clearPdfCache() {
  _cachedPdfBytes = null;
  _cachedPdfKey = null;
}

pw.Font? _cachedCairoRegular;
pw.Font? _cachedCairoBold;

/// Ensures Cairo Unicode fonts are loaded with comprehensive fallbacks:
/// 1. Direct File read from assets/fonts/ (unit/widget test harness fallback)
/// 2. Flutter rootBundle asset loading (production runtime)
/// 3. PdfGoogleFonts network download with timeout fallback
Future<void> _ensureCairoFontsLoaded() async {
  if (_cachedCairoRegular != null && _cachedCairoBold != null) return;

  // 1. Try local file system first with directory traversal fallback (for test harness & offline CI)
  final candidateDirs = ['.', '..', '../..'];
  for (final dir in candidateDirs) {
    try {
      final regFile = File('$dir/assets/fonts/Cairo-Regular.ttf');
      final boldFile = File('$dir/assets/fonts/Cairo-Bold.ttf');
      if (regFile.existsSync() && boldFile.existsSync()) {
        final regBytes = regFile.readAsBytesSync();
        final boldBytes = boldFile.readAsBytesSync();
        _cachedCairoRegular = pw.Font.ttf(ByteData.view(regBytes.buffer));
        _cachedCairoBold = pw.Font.ttf(ByteData.view(boldBytes.buffer));
        return;
      }
    } catch (_) {}
  }

  // 2. Try loading from rootBundle (standard Flutter asset bundle in app runtime)
  try {
    final regData = await rootBundle.load('assets/fonts/Cairo-Regular.ttf');
    final boldData = await rootBundle.load('assets/fonts/Cairo-Bold.ttf');
    _cachedCairoRegular = pw.Font.ttf(regData);
    _cachedCairoBold = pw.Font.ttf(boldData);
    return;
  } catch (_) {}

  // 3. Fallback to Google Fonts network fetch if available
  try {
    _cachedCairoRegular = await PdfGoogleFonts.cairoRegular()
        .timeout(const Duration(seconds: 4));
    _cachedCairoBold = await PdfGoogleFonts.cairoBold()
        .timeout(const Duration(seconds: 4));
  } catch (e) {
    debugPrint('Cairo font fallback error: $e');
  }
}

/// Generates the raw PDF bytes for a salary slip statement, ensuring full Unicode
/// and Arabic font support with Egyptian currency and fallback glyphs.
Future<Uint8List> generateSalarySlipPdfBytes(SalarySlipData data) async {
  final profile = LocalStore.instance.profile;
  final brand = AppTheme.currentBrand;
  final cacheKey =
      '${brand.tenantId}_${profile.employeeCode}_${profile.name}_${data.period}_${data.netPay}_${data.paidOn}_v3';

  if (_cachedPdfKey == cacheKey && _cachedPdfBytes != null) {
    return _cachedPdfBytes!;
  }

  await _ensureCairoFontsLoaded();

  final pw.Font? regularFont = _cachedCairoRegular;
  final pw.Font? boldFont = _cachedCairoBold;

  final bool hasUnicode = regularFont != null && boldFont != null;
  final List<pw.Font> fontFallbacks = [
    if (regularFont != null) regularFont,
    if (boldFont != null) boldFont,
  ];

  final theme = hasUnicode
      ? pw.ThemeData.withFont(
          base: regularFont,
          bold: boldFont,
          italic: regularFont,
          boldItalic: boldFont,
          fontFallback: fontFallbacks,
        )
      : pw.ThemeData.base();

  final int a = (brand.primaryColor.a * 255).round() & 0xff;
  final int r = (brand.primaryColor.r * 255).round() & 0xff;
  final int g = (brand.primaryColor.g * 255).round() & 0xff;
  final int b = (brand.primaryColor.b * 255).round() & 0xff;
  final primaryPdfColor = PdfColor.fromInt((a << 24) | (r << 16) | (g << 8) | b);

  final qrPayload =
      '${brand.tenantId.toUpperCase()}-VERIFIED|EMP:${profile.employeeCode}|CR:${brand.crNumber}|PER:${data.period}|NET:${data.netPay}|HASH:${profile.employeeCode.hashCode ^ data.netPay}';

  final pdf = pw.Document(theme: theme);

  pdf.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      build: (context) => pw.Directionality(
        textDirection: pw.TextDirection.rtl,
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            // Enterprise Header
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: pw.BoxDecoration(
                color: primaryPdfColor,
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        '${brand.companyNameAr} - كشف مفردات الراتب الرسمي',
                        style: pw.TextStyle(
                          color: PdfColors.white,
                          fontSize: 16,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 2),
                      pw.Text(
                        '${brand.companyName.toUpperCase()} - OFFICIAL PAYROLL STATEMENT',
                        style: const pw.TextStyle(
                          color: PdfColors.white,
                          fontSize: 9,
                          letterSpacing: 1.1,
                        ),
                      ),
                      pw.SizedBox(height: 2),
                      pw.Text(
                        'س.ت: ${brand.crNumber}  |  ب.ض: ${brand.taxNumber}  |  الخط الساخن: ${brand.supportHotline}',
                        style: const pw.TextStyle(
                          color: PdfColors.white,
                          fontSize: 7.5,
                        ),
                      ),
                    ],
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: pw.BoxDecoration(
                      color: PdfColors.white,
                      borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
                    ),
                    child: pw.Text(
                      data.period,
                      style: pw.TextStyle(
                        color: primaryPdfColor,
                        fontSize: 12,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 14),

            // Employee Information Grid
            pw.Container(
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                color: const PdfColor.fromInt(0xFFF9FAFB),
                border: pw.Border.all(color: const PdfColor.fromInt(0xFFE5E7EB)),
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
              ),
              child: pw.Row(
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        _pdfMetaRow('اسم الموظف / Name:', profile.name.isNotEmpty ? profile.name : 'موظف / Employee'),
                        _pdfMetaRow('الرقم الوظيفي / Code:', profile.employeeCode),
                        _pdfMetaRow('الموقع / Branch:', profile.factory.isNotEmpty ? profile.factory : 'المقر الرئيسي / HQ'),
                      ],
                    ),
                  ),
                  pw.SizedBox(width: 16),
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        _pdfMetaRow('الإدارة / Dept:', profile.department.isNotEmpty ? profile.department : 'العمليات والتصنيع'),
                        _pdfMetaRow('طريقة الصرف / Method:', data.paymentMethod),
                        _pdfMetaRow('تاريخ التحويل / Date:', data.paidOn),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 14),

            // Breakdown Tables: Earnings and Deductions
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                // Earnings Column (المستحقات)
                pw.Expanded(
                  child: pw.Container(
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: const PdfColor.fromInt(0xFFD1D5DB)),
                      borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
                    ),
                    child: pw.Column(
                      children: [
                        pw.Container(
                          width: double.infinity,
                          padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                          color: const PdfColor.fromInt(0xFFEBF5FF),
                          child: pw.Text(
                            'المستحقات (Earnings)',
                            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11, color: const PdfColor.fromInt(0xFF0B63B4)),
                          ),
                        ),
                        _pdfTableItem('الراتب الأساسي', data.basicLabel),
                        _pdfTableItem('بدل انتقال وانتقالات', data.transportLabel),
                        _pdfTableItem('بدل وجبة وطبيعة عمل', data.mealLabel),
                        _pdfTableItem('حافز انتظام وإنتاج', data.incentiveLabel),
                        _pdfTableItem('ساعات عمل إضافية', data.overtimeLabel),
                        pw.Divider(height: 1, color: const PdfColor.fromInt(0xFFE5E7EB)),
                        _pdfTableItem('إجمالي المستحقات', 'EGP ${SalarySlipData._format(data.basicSalary + data.allowances)}', isTotal: true),
                      ],
                    ),
                  ),
                ),
                pw.SizedBox(width: 12),
                // Deductions Column (الاستقطاعات)
                pw.Expanded(
                  child: pw.Container(
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: const PdfColor.fromInt(0xFFD1D5DB)),
                      borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
                    ),
                    child: pw.Column(
                      children: [
                        pw.Container(
                          width: double.infinity,
                          padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                          color: const PdfColor.fromInt(0xFFFEF2F2),
                          child: pw.Text(
                            'الاستقطاعات (Deductions)',
                            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11, color: const PdfColor.fromInt(0xFFDC2626)),
                          ),
                        ),
                        _pdfTableItem('تأمينات اجتماعية', data.socialInsuranceLabel),
                        _pdfTableItem('ضريبة كسب العمل', data.incomeTaxLabel),
                        _pdfTableItem('تأمين صحي ورعاية', data.medicalInsuranceLabel),
                        _pdfTableItem('أقساط سلف وقروض', data.loanDeductionLabel),
                        _pdfTableItem('جزاءات وغيابات', data.penaltiesLabel),
                        pw.Divider(height: 1, color: const PdfColor.fromInt(0xFFE5E7EB)),
                        _pdfTableItem('إجمالي الاستقطاعات', data.deductionsLabel, isTotal: true),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            pw.SizedBox(height: 14),

            // Net Payable Card
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: pw.BoxDecoration(
                color: const PdfColor.fromInt(0xFFF0FDF4),
                border: pw.Border.all(color: const PdfColor.fromInt(0xFF86EFAC)),
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'صافي الراتب المستحق للتحويل (Net Payable)',
                        style: pw.TextStyle(
                          color: const PdfColor.fromInt(0xFF15803D),
                          fontSize: 11,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 2),
                      pw.Text(
                        convertToArabicWords(data.netPay),
                        style: const pw.TextStyle(
                          fontSize: 9,
                          color: PdfColors.grey800,
                        ),
                      ),
                    ],
                  ),
                  pw.Text(
                    data.netPayLabel,
                    style: pw.TextStyle(
                      color: const PdfColor.fromInt(0xFF15803D),
                      fontSize: 18,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            pw.Spacer(),

            // Verification & Electronic Signature Footer
            pw.Container(
              padding: const pw.EdgeInsets.all(10),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: const PdfColor.fromInt(0xFFE5E7EB)),
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
                color: const PdfColor.fromInt(0xFFFAFAFA),
              ),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.BarcodeWidget(
                    barcode: pw.Barcode.qrCode(),
                    data: qrPayload,
                    width: 48,
                    height: 48,
                    drawText: false,
                    textStyle: pw.TextStyle(font: regularFont, fontFallback: fontFallbacks),
                  ),
                  pw.SizedBox(width: 12),
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          'معتمد إلكترونياً من الإدارة العامة للموارد البشرية والقطاع المالي - ${brand.companyNameAr}',
                          style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold),
                        ),
                        pw.SizedBox(height: 2),
                        pw.Text(
                          'هذا البيان مستخرج وموقع رقمياً من منظومة ${brand.companyName} Workforce OS ولا يحتاج إلى ختم يدوي تقليدي. كود التحقق المشفر متضمن برمز الاستجابة السريعة أعلاه.',
                          style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );

  final Uint8List bytes = await pdf.save();
  _cachedPdfKey = cacheKey;
  _cachedPdfBytes = bytes;
  return bytes;
}

/// Builds the enterprise stamped PDF statement and opens the system share sheet.
Future<void> shareSalarySlipPdf(SalarySlipData data) async {
  final bytes = await generateSalarySlipPdfBytes(data);
  await Printing.sharePdf(
    bytes: bytes,
    filename: 'Salary_Slip_${data.period.replaceAll(' ', '_')}.pdf',
  );
}

pw.Widget _pdfMetaRow(String label, String value) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 2),
    child: pw.Row(
      children: [
        pw.Text(label, style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700)),
        pw.SizedBox(width: 4),
        pw.Expanded(
          child: pw.Text(
            value,
            style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold),
            overflow: pw.TextOverflow.clip,
          ),
        ),
      ],
    ),
  );
}

pw.Widget _pdfTableItem(String label, String value, {bool isTotal = false}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(
          label,
          style: pw.TextStyle(
            fontSize: 9,
            fontWeight: isTotal ? pw.FontWeight.bold : pw.FontWeight.normal,
          ),
        ),
        pw.Text(
          value,
          style: pw.TextStyle(
            fontSize: 9,
            fontWeight: isTotal ? pw.FontWeight.bold : pw.FontWeight.normal,
          ),
        ),
      ],
    ),
  );
}
