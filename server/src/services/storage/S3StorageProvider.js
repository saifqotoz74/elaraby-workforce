// Enterprise S3 / MinIO Compatible Object Storage Provider
// Supports AWS S3, MinIO, Cloudflare R2, Ceph, and standard S3 API endpoints
// Implemented via pure Node.js AWS Signature Version 4 (SigV4) without external dependencies.

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const path = require('path');
const StorageProvider = require('./StorageProvider');

class S3StorageProvider extends StorageProvider {
  constructor(options = {}) {
    super('s3');
    this.endpoint = options.endpoint || process.env.S3_ENDPOINT || 'https://s3.amazonaws.com';
    this.region = options.region || process.env.S3_REGION || 'us-east-1';
    this.bucket = options.bucket || process.env.S3_BUCKET || 'elaraby-workforce';
    this.accessKeyId = options.accessKeyId || process.env.S3_ACCESS_KEY_ID || '';
    this.secretAccessKey = options.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || '';
    this.forcePathStyle = typeof options.forcePathStyle !== 'undefined'
      ? options.forcePathStyle
      : (process.env.S3_FORCE_PATH_STYLE === 'true' || this.endpoint.includes('localhost') || this.endpoint.includes('minio'));
  }

  isConfigured() {
    return !!(this.accessKeyId && this.secretAccessKey && (this.bucket || this.endpoint));
  }

  _sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  _hmac(key, data) {
    return crypto.createHmac('sha256', key).update(data).digest();
  }

  _getSigningKey(dateStamp) {
    const kDate = this._hmac('AWS4' + this.secretAccessKey, dateStamp);
    const kRegion = this._hmac(kDate, this.region);
    const kService = this._hmac(kRegion, 's3');
    return this._hmac(kService, 'aws4_request');
  }

  _buildRequestDetails(method, objectKey = '', queryParams = {}, payload = Buffer.alloc(0), extraHeaders = {}) {
    const urlObj = new URL(this.endpoint);
    let host = urlObj.host;
    let requestPath = '';

    if (this.forcePathStyle) {
      requestPath = `/${this.bucket}${objectKey ? (objectKey.startsWith('/') ? objectKey : '/' + objectKey) : ''}`;
    } else {
      if (!urlObj.hostname.startsWith(`${this.bucket}.`)) {
        host = `${this.bucket}.${urlObj.host}`;
      }
      requestPath = objectKey.startsWith('/') ? objectKey : `/${objectKey}`;
    }

    if (!requestPath) requestPath = '/';

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = this._sha256(payload);

    const headers = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...extraHeaders,
    };

    // Canonical query string
    const canonicalQuery = Object.keys(queryParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    // Canonical headers
    const sortedHeaderKeys = Object.keys(headers).map((k) => k.toLowerCase()).sort();
    const canonicalHeaders = sortedHeaderKeys
      .map((k) => `${k}:${String(headers[k]).trim()}\n`)
      .join('');
    const signedHeaders = sortedHeaderKeys.join(';');

    // Canonical request
    const canonicalRequest = [
      method,
      requestPath,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // String to sign
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this._sha256(canonicalRequest),
    ].join('\n');

    // Signature
    const signingKey = this._getSigningKey(dateStamp);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const protocol = urlObj.protocol === 'https:' ? https : http;
    const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);

    return {
      protocol,
      options: {
        method,
        host: urlObj.hostname,
        port,
        path: requestPath + (canonicalQuery ? `?${canonicalQuery}` : ''),
        headers,
      },
      payload,
    };
  }

  _sendHttpRequest({ protocol, options, payload }) {
    return new Promise((resolve, reject) => {
      const req = protocol.request(options, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      });
      req.on('error', reject);
      if (payload && payload.length > 0) {
        req.write(payload);
      }
      req.end();
    });
  }

  async saveFile({ buffer, originalName, mimeType, isPrivate = false }) {
    if (!buffer || buffer.length === 0) {
      const err = new Error('empty_file');
      err.statusCode = 400;
      throw err;
    }

    if (!this.isConfigured()) {
      const err = new Error('S3 credentials not configured. Provide S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.');
      err.statusCode = 503;
      throw err;
    }

    const rawExt = String(originalName || '').split('.').pop().toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const uniqueId = crypto.randomUUID();
    const key = `uploads/${yyyy}/${mm}/${uniqueId}.${ext}`;
    const contentType = mimeType || (ext === 'pdf' ? 'application/pdf' : `image/${ext}`);

    const reqDetails = this._buildRequestDetails('PUT', key, {}, buffer, {
      'content-type': contentType,
      'content-length': String(buffer.length),
    });

    const res = await this._sendHttpRequest(reqDetails);

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const errMsg = `S3 PutObject failed [${res.statusCode}]: ${res.body.toString('utf8').slice(0, 300)}`;
      console.error('[s3:upload_error]', errMsg);
      const err = new Error('storage_upload_failed');
      err.statusCode = 502;
      throw err;
    }

    // Return controlled internal proxy URL for authorized downloads
    return {
      url: `/api/uploads/${key}`,
      key,
      filename: `${uniqueId}.${ext}`,
      size: buffer.length,
      mimeType: contentType,
      provider: 's3',
      isPrivate,
    };
  }

  async getFile(key) {
    if (!this.isConfigured()) {
      const err = new Error('S3 credentials not configured.');
      err.statusCode = 503;
      throw err;
    }

    const reqDetails = this._buildRequestDetails('GET', key);
    const res = await this._sendHttpRequest(reqDetails);

    if (res.statusCode === 404) {
      const err = new Error('file_not_found');
      err.statusCode = 404;
      throw err;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const err = new Error(`S3 GetObject failed [${res.statusCode}]`);
      err.statusCode = 502;
      throw err;
    }

    return {
      buffer: res.body,
      contentType: res.headers['content-type'] || 'application/octet-stream',
      contentLength: parseInt(res.headers['content-length'] || String(res.body.length), 10),
    };
  }

  async deleteFile(key) {
    if (!this.isConfigured()) return false;
    try {
      const reqDetails = this._buildRequestDetails('DELETE', key);
      const res = await this._sendHttpRequest(reqDetails);
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  async checkHealth() {
    if (!this.isConfigured()) {
      return { status: 'not_configured', ok: false, error: 'S3 credentials missing' };
    }
    try {
      const reqDetails = this._buildRequestDetails('HEAD', '');
      const res = await this._sendHttpRequest(reqDetails);
      if (res.statusCode >= 200 && res.statusCode < 400) {
        return { status: 'connected', ok: true, bucket: this.bucket, endpoint: this.endpoint };
      }
      return { status: 'error', ok: false, statusCode: res.statusCode };
    } catch (err) {
      return { status: 'error', ok: false, error: err.message };
    }
  }
}

module.exports = S3StorageProvider;
