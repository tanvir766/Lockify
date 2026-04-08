const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const encryptionService = {
  /**
   * Encrypts a file's content using a generated key.
   * The key itself is then encrypted with the user's PIN/Password.
   */
  encryptFile: async (file: File, userPin: string): Promise<{ encryptedBlob: Blob; encryptedKey: string }> => {
    console.log('[Encryption] Starting for:', file.name, 'Size:', file.size);
    
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API is not available. Please ensure you are using a secure connection (HTTPS).');
    }

    try {
      // 1. Generate a random AES-GCM key for the file
      console.log('[Encryption] Generating file key...');
      const fileKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // 2. Export the file key to wrap it later
      const exportedKey = await crypto.subtle.exportKey('raw', fileKey);
      const fileKeyBuffer = new Uint8Array(exportedKey);
      
      // 3. Read file content using FileReader for better compatibility
      console.log('[Encryption] Reading file content...');
      const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('Failed to read file content.'));
        reader.readAsArrayBuffer(file);
      });
      
      // 4. Encrypt file content
      console.log('[Encryption] Encrypting content...');
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM
      const encryptedContent = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        fileKey,
        fileBuffer
      );

      // 5. Combine IV and encrypted content into a single blob
      console.log('[Encryption] Creating encrypted blob...');
      const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedContent), iv.length);
      
      const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });

      // 6. "Wrap" the file key using the user's PIN
      console.log('[Encryption] Deriving wrapping key from PIN...');
      const pinBuffer = new TextEncoder().encode(userPin);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const baseKey = await crypto.subtle.importKey(
        'raw',
        pinBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      const wrappingKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const wrapIv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedFileKey = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: wrapIv },
        wrappingKey,
        fileKeyBuffer
      );

      // 7. Store salt, wrapIv, and encryptedFileKey as a base64 string for metadata
      const keyMetadata = {
        salt: arrayBufferToBase64(salt.buffer),
        iv: arrayBufferToBase64(wrapIv.buffer),
        encryptedKey: arrayBufferToBase64(encryptedFileKey)
      };
      
      const encryptedKeyString = JSON.stringify(keyMetadata);
      
      console.log('[Encryption] Success');
      return { encryptedBlob, encryptedKey: encryptedKeyString };
    } catch (e: any) {
      console.error('[Encryption] Error:', e);
      throw new Error(`Encryption failed: ${e.message || 'Unknown error'}`);
    }
  },

  /**
   * Decrypts a file's content.
   */
  decryptFile: async (encryptedArrayBuffer: ArrayBuffer, encryptedKeyString: string, userPin: string, mimeType: string): Promise<string> => {
    console.log('[Decryption] Starting...');
    try {
      if (!encryptedKeyString || encryptedKeyString.trim() === 'undefined') {
        throw new Error('Invalid or missing encryption key metadata.');
      }
      
      let keyMetadata;
      try {
        keyMetadata = JSON.parse(encryptedKeyString);
      } catch (parseError) {
        console.error('[Decryption] JSON Parse Error on metadata:', encryptedKeyString);
        throw new Error('Corrupted encryption key metadata.');
      }
      
      const salt = new Uint8Array(base64ToArrayBuffer(keyMetadata.salt));
      const wrapIv = new Uint8Array(base64ToArrayBuffer(keyMetadata.iv));
      const encryptedFileKey = new Uint8Array(base64ToArrayBuffer(keyMetadata.encryptedKey));

      // 1. Derive the wrapping key from PIN
      const pinBuffer = new TextEncoder().encode(userPin);
      const baseKey = await crypto.subtle.importKey(
        'raw',
        pinBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      const wrappingKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // 2. Decrypt the file key
      console.log('[Decryption] Unwrapping file key...');
      const fileKeyBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: wrapIv },
        wrappingKey,
        encryptedFileKey
      );

      const fileKey = await crypto.subtle.importKey(
        'raw',
        fileKeyBuffer,
        'AES-GCM',
        false,
        ['decrypt']
      );

      // 3. Decrypt the file content
      console.log('[Decryption] Decrypting content...');
      const combined = new Uint8Array(encryptedArrayBuffer);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        fileKey,
        ciphertext
      );

      console.log('[Decryption] Success');
      const blob = new Blob([decryptedBuffer], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('[Decryption] Error:', e);
      throw new Error('Decryption failed. Invalid PIN or corrupted file.');
    }
  }
};
