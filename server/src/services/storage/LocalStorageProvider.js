// Local Filesystem Storage Provider
// Standard provider for development, testing, and single-instance deployments.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StorageProvider = require('./StorageProvider');

class LocalStorageProvider extends StorageProvider {
  constructor(options = {}) {
    super('local');
    const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
    this.baseDir = options.baseDir || (isVercel
      ? path.join('/tmp', 'uploads')
      : path.join(__dirname, '..', '..', '..', 'uploads'));
  }

  isConfigured() {
    return true;
  }

  /**
   * Prevents path traversal vulnerabilities (e.g. ../../etc/passwd)
   */
  _resolveSafePath(key) {
    const cleanKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(this.baseDir, cleanKey);
    if (!fullPath.startsWith(path.resolve(this.baseDir))) {
      throw new Error('access_denied_path_traversal');
    }
    return fullPath;
  }

  async saveFile({ buffer, originalName, mimeType, isPrivate = false }) {
    if (!buffer || buffer.length === 0) {
      const err = new Error('empty_file');
      err.statusCode = 400;
      throw err;
    }

    await fs.promises.mkdir(this.baseDir, { recursive: true });

    const rawExt = String(originalName || '').split('.').pop().toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const filename = `img_${Date.now()}_${uniqueSuffix}.${ext}`;
    const targetPath = this._resolveSafePath(filename);

    await fs.promises.writeFile(targetPath, buffer);

    return {
      url: `/uploads/${filename}`,
      key: filename,
      filename,
      size: buffer.length,
      mimeType: mimeType || 'application/octet-stream',
      provider: 'local',
      isPrivate,
    };
  }

  async getFile(key) {
    const filePath = this._resolveSafePath(key);
    if (!fs.existsSync(filePath)) {
      const err = new Error('file_not_found');
      err.statusCode = 404;
      throw err;
    }

    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mimeMap = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      pdf: 'application/pdf',
    };

    return {
      buffer,
      contentType: mimeMap[ext] || 'application/octet-stream',
      contentLength: buffer.length,
    };
  }

  async deleteFile(key) {
    try {
      const filePath = this._resolveSafePath(key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  async checkHealth() {
    try {
      await fs.promises.mkdir(this.baseDir, { recursive: true });
      const testFile = path.join(this.baseDir, `.health_${Date.now()}`);
      await fs.promises.writeFile(testFile, 'ok');
      await fs.promises.unlink(testFile);
      return { status: 'healthy', ok: true, path: this.baseDir };
    } catch (err) {
      return { status: 'error', ok: false, error: err.message };
    }
  }
}

module.exports = LocalStorageProvider;
