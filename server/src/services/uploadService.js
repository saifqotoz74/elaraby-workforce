const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');

const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const UPLOADS_DIR = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', '..', 'uploads');

const MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024; // 6MB
const ALLOWED_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Validates image magic bytes to prevent masquerading non-image or executable files.
 */
function isValidImage(buf, ext) {
  if (!buf || buf.length < 12) return false;
  if (ext === 'png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  }
  if (ext === 'webp') {
    return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

/**
 * Saves an image buffer to storage via active StorageProvider after strict validation.
 */
async function saveImageBuffer(buf, originalName, isPrivate = false) {
  if (!buf || buf.length === 0) {
    const err = new Error('empty_file');
    err.statusCode = 400;
    throw err;
  }
  if (buf.length > MAX_FILE_SIZE_BYTES) {
    const err = new Error('max_6mb');
    err.statusCode = 413;
    throw err;
  }

  const rawExt = String(originalName || '').split('.').pop().toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  if (!ALLOWED_EXT[ext] && !ALLOWED_EXT[rawExt]) {
    const err = new Error('only_png_jpg_webp_allowed');
    err.statusCode = 415;
    throw err;
  }

  if (!isValidImage(buf, ext)) {
    const err = new Error('invalid_image_data');
    err.statusCode = 400;
    throw err;
  }

  const result = await storage.saveFile({
    buffer: buf,
    originalName,
    mimeType: ALLOWED_EXT[ext] || 'application/octet-stream',
    isPrivate,
  });

  return {
    url: result.url,
    key: result.key,
    filename: result.filename,
    size: result.size,
    provider: result.provider,
  };
}

/**
 * Parses multipart/form-data body stream without external dependencies.
 */
function handleMultipartUpload(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      const err = new Error('invalid_multipart_boundary');
      err.statusCode = 400;
      return reject(err);
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const chunks = [];
    let totalLength = 0;

    req.on('data', (chunk) => {
      totalLength += chunk.length;
      if (totalLength > MAX_FILE_SIZE_BYTES + 1024 * 100) {
        const err = new Error('max_6mb');
        err.statusCode = 413;
        req.destroy(err);
        return reject(err);
      }
      chunks.push(chunk);
    });

    req.on('error', reject);

    req.on('end', async () => {
      const fullBuffer = Buffer.concat(chunks);
      const boundaryBuf = Buffer.from(`--${boundary}`);
      const crlf = Buffer.from('\r\n\r\n');

      let startIndex = fullBuffer.indexOf(boundaryBuf);
      if (startIndex === -1) {
        const err = new Error('no_boundary_found');
        err.statusCode = 400;
        return reject(err);
      }

      // Search for file part
      let fileBuffer = null;
      let filename = 'upload.png';

      while (startIndex !== -1) {
        const nextIndex = fullBuffer.indexOf(boundaryBuf, startIndex + boundaryBuf.length);
        if (nextIndex === -1) break;

        const partBuffer = fullBuffer.slice(startIndex + boundaryBuf.length, nextIndex);
        const headerEnd = partBuffer.indexOf(crlf);
        if (headerEnd !== -1) {
          const headerStr = partBuffer.slice(0, headerEnd).toString('utf8');
          const filenameMatch = headerStr.match(/filename="([^"]+)"/i);
          if (filenameMatch) {
            filename = filenameMatch[1];
            // File data is between headers and trailing \r\n
            let dataStart = headerEnd + crlf.length;
            let dataEnd = partBuffer.length;
            if (partBuffer[dataEnd - 2] === 0x0D && partBuffer[dataEnd - 1] === 0x0A) {
              dataEnd -= 2;
            }
            fileBuffer = partBuffer.slice(dataStart, dataEnd);
            break;
          }
        }
        startIndex = nextIndex;
      }

      if (!fileBuffer) {
        const err = new Error('no_file_found_in_multipart_payload');
        err.statusCode = 400;
        return reject(err);
      }

      try {
        const result = await saveImageBuffer(fileBuffer, filename);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Backward compatible Base64 JSON image upload.
 */
async function handleBase64Upload({ name, dataBase64 }) {
  if (!name || !dataBase64) {
    const err = new Error('name_and_data_required');
    err.statusCode = 400;
    throw err;
  }
  const dataUrlMatch = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataBase64);
  const rawBase64 = dataUrlMatch ? dataUrlMatch[2] : dataBase64;
  const buf = Buffer.from(rawBase64, 'base64');
  return await saveImageBuffer(buf, name);
}

module.exports = {
  UPLOADS_DIR,
  MAX_FILE_SIZE_BYTES,
  isValidImage,
  saveImageBuffer,
  handleMultipartUpload,
  handleBase64Upload,
  storage,
};
