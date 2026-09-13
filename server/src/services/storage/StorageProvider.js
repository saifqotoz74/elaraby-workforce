// Enterprise Storage Provider Base Interface
// Defines the contract for multi-instance file and attachment persistence.

class StorageProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Saves a file buffer to storage.
   * @param {Object} params
   * @param {Buffer} params.buffer
   * @param {string} params.originalName
   * @param {string} params.mimeType
   * @param {boolean} [params.isPrivate=false]
   * @returns {Promise<{ url: string, key: string, filename: string, size: number, provider: string }>}
   */
  async saveFile(params) {
    throw new Error('saveFile must be implemented by subclass');
  }

  /**
   * Retrieves a file from storage.
   * @param {string} key
   * @returns {Promise<{ buffer: Buffer, contentType: string, contentLength: number }>}
   */
  async getFile(key) {
    throw new Error('getFile must be implemented by subclass');
  }

  /**
   * Deletes a file from storage.
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async deleteFile(key) {
    throw new Error('deleteFile must be implemented by subclass');
  }

  /**
   * Health check probe for storage connectivity.
   * @returns {Promise<{ status: string, ok: boolean, error?: string }>}
   */
  async checkHealth() {
    throw new Error('checkHealth must be implemented by subclass');
  }

  /**
   * Indicates whether this provider has valid configuration credentials.
   * @returns {boolean}
   */
  isConfigured() {
    return false;
  }
}

module.exports = StorageProvider;
