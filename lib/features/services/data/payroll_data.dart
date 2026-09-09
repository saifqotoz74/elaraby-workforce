import 'dart:io' show Platform;
import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../../core/storage/local_store.dart';

/// Payroll figures for the July 2026 statement until a backend supplies them.
class SalarySlipData {
  static const defaultPeriod = 'July 2026';

  final String period;
  final int basicSalary;
  final int allowances;
  final int deductions;
  final String paidOn;
  final String paymentMethod;

  const SalarySlipData({
    this.period = defaultPeriod,
    this.basicSalary = 7000,
    this.allowances = 950,
    this.deductions = 200,
    this.paidOn = 'Jul 28, 2026',
    this.paymentMethod = 'Bank Transfer (CIB)',
  });

  int get netPay => basicSalary + allowances - deductions;

  String get netPayLabel => 'EGP ${_format(netPay)}';

  static String _format(int amount) {
    final s = amount.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      final posFromEnd = s.length - i;
      buf.write(s[i]);
      if (posFromEnd > 1 && posFromEnd % 3 == 1) buf.write(',');
    }
    return buf.toString();
  }

  String get basicLabel => 'EGP ${_format(basicSalary)}';
  String get allowancesLabel => '+EGP ${_format(allowances)}';
  String get deductionsLabel => '-EGP ${_format(deductions)}';
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

/// Builds the real PDF statement and opens the system share sheet.
Future<void> shareSalarySlipPdf(SalarySlipData data) async {
  final profile = LocalStore.instance.profile;
  final cacheKey = '${profile.employeeCode}_${data.period}_${data.netPay}';

  if (_cachedPdfKey == cacheKey && _cachedPdfBytes != null) {
    await Printing.sharePdf(
      bytes: _cachedPdfBytes!,
      filename: 'Salary_Slip_${data.period.replaceAll(' ', '_')}.pdf',
    );
    return;
  }

  pw.Font? regularFont = _cachedCairoRegular;
  pw.Font? boldFont = _cachedCairoBold;
  if (regularFont == null && !Platform.environment.containsKey('FLUTTER_TEST')) {
    try {
      regularFont = await PdfGoogleFonts.cairoRegular().timeout(const Duration(seconds: 5));
      boldFont = await PdfGoogleFonts.cairoBold().timeout(const Duration(seconds: 5));
      _cachedCairoRegular = regularFont;
      _cachedCairoBold = boldFont;
    } catch (_) {
      // In headless test environments or offline mode, gracefully fall back to base font
    }
  }

  final bool hasUnicode = regularFont != null && boldFont != null;
  final theme = hasUnicode
      ? pw.ThemeData.withFont(base: regularFont, bold: boldFont)
      : pw.ThemeData.base();

  String safeText(String text, [String fallback = '']) {
    if (hasUnicode) return text;
    final sanitized = text.replaceAll(RegExp(r'[^\x20-\x7E]'), '').trim();
    if (sanitized.isNotEmpty) return sanitized;
    return fallback.isNotEmpty ? fallback : 'Elaraby Employee';
  }

  final pdf = pw.Document(theme: theme);

  pdf.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(40),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.all(16),
            decoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFF0B63B4),
              borderRadius: pw.BorderRadius.all(pw.Radius.circular(10)),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'ELARABY GROUP',
                  style: pw.TextStyle(
                    color: PdfColors.white,
                    fontSize: 20,
                    fontWeight: pw.FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  'Payroll Statement - ${data.period}',
                  style: const pw.TextStyle(
                    color: PdfColors.white,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 24),
          _pdfRow('Employee', safeText(profile.name, profile.employeeCode)),
          _pdfRow('Employee ID', profile.employeeCode),
          _pdfRow('Factory', safeText(profile.factory, 'Main Complex')),
          _pdfRow('Department', safeText(profile.department, 'Operations')),
          _pdfRow('Payment Method', data.paymentMethod),
          _pdfRow('Paid On', data.paidOn),
          pw.SizedBox(height: 16),
          pw.Divider(),
          _pdfRow('Basic Salary', data.basicLabel),
          _pdfRow('Allowances (Housing & Transport)', data.allowancesLabel),
          _pdfRow('Deductions (Tax & Insurance)', data.deductionsLabel),
          pw.Divider(),
          _pdfRow('TOTAL NET PAY', data.netPayLabel, bold: true),
          pw.Spacer(),
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.all(10),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColors.grey400),
              borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
            ),
            child: pw.Text(
              'This document is signed electronically by the HR Finance Division and is valid without a physical stamp.',
              style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
            ),
          ),
        ],
      ),
    ),
  );

  final Uint8List bytes = await pdf.save();
  _cachedPdfKey = cacheKey;
  _cachedPdfBytes = bytes;

  await Printing.sharePdf(
    bytes: bytes,
    filename: 'Salary_Slip_${data.period.replaceAll(' ', '_')}.pdf',
  );
}

pw.Widget _pdfRow(String label, String value, {bool bold = false}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 4),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(label, style: pw.TextStyle(fontSize: 11)),
        pw.Text(
          value,
          style: pw.TextStyle(
            fontSize: bold ? 14 : 11,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
      ],
    ),
  );
}
