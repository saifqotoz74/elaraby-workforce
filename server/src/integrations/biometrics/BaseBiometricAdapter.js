// Enterprise Biometric & Attendance Ingestion Base Adapter

class BaseBiometricAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Normalizes raw device punch into internal enterprise attendance record.
   * @param {Object} rawPunch
   * @returns {{ badgeNumber: string, nationalId?: string, punchTime: Date, punchType: 'CHECK_IN'|'CHECK_OUT', deviceId: string }}
   */
  normalizePunch(rawPunch) {
    const badge = String(rawPunch.badgeNumber || rawPunch.badge_number || rawPunch.badge_id || rawPunch.user_id || '').trim();
    const natId = rawPunch.nationalId || rawPunch.national_id || null;
    const device = String(rawPunch.deviceId || rawPunch.device_id || rawPunch.terminal_id || 'UNKNOWN_TERMINAL').trim();

    let punchTime = new Date();
    if (rawPunch.timestamp || rawPunch.time || rawPunch.punch_time) {
      const parsed = new Date(rawPunch.timestamp || rawPunch.time || rawPunch.punch_time);
      if (!isNaN(parsed.getTime())) punchTime = parsed;
    }

    const rawType = String(rawPunch.type || rawPunch.punch_type || rawPunch.status || '').toUpperCase();
    const isOut = rawType.includes('OUT') || rawType === '1' || rawType === 'CHECK_OUT';
    const punchType = isOut ? 'CHECK_OUT' : 'CHECK_IN';

    return {
      badgeNumber: badge,
      nationalId: natId,
      deviceId: device,
      punchTime,
      punchType,
      verifiedAt: Date.now(),
    };
  }

  /**
   * Parses standard biometric CSV / text exports (from SFTP or scheduled file drops).
   * @param {string} content
   * @returns {Array}
   */
  parseCsvFile(content) {
    if (!content || typeof content !== 'string') return [];
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return [];

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s-]/g, '_'));
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length === header.length) {
        const row = {};
        header.forEach((h, idx) => {
          row[h] = parts[idx];
        });
        records.push(this.normalizePunch(row));
      }
    }
    return records;
  }
}

module.exports = BaseBiometricAdapter;
