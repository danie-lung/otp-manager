const OTPStorage = {
  async saveAccounts(accounts, encryptionKey = null) {
    const accountsToSave = await Promise.all(accounts.map(async (account) => {
      if (encryptionKey && account.secret && !account.encrypted) {
        const encryptedSecret = await this.encryptSecret(account.secret, encryptionKey);
        return { ...account, secret: encryptedSecret, encrypted: true };
      } else if (!encryptionKey && account.secret && account.encrypted) {
        try {
          const decryptedSecret = await this.decryptSecret(account.secret, encryptionKey);
          return { ...account, secret: decryptedSecret, encrypted: false };
        } catch (e) {
          return account;
        }
      }
      return account;
    }));
    return new Promise((resolve) => {
      chrome.storage.local.set({ accounts: accountsToSave }, resolve);
    });
  },

  async loadAccounts(encryptionKey = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['accounts'], async (res) => {
        const loadedAccounts = res.accounts || [];
        const decryptedAccounts = await Promise.all(loadedAccounts.map(async (account) => {
          if (account.encrypted && account.secret) {
            if (encryptionKey) {
              try {
                const decryptedSecret = await this.decryptSecret(account.secret, encryptionKey);
                return { ...account, secret: decryptedSecret, encrypted: false };
              } catch (e) {
                return { ...account, encrypted: true };
              }
            } else {
              return { ...account, encrypted: true };
            }
          }
          return account;
        }));
        resolve(decryptedAccounts);
      });
    });
  },

  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, resolve);
    });
  },

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['encryptionEnabled'], res => {
        resolve({
          encryptionEnabled: res.encryptionEnabled || false
        });
      });
    });
  },

  async validateEncryptionKey(encryptionKey, encryptedAccounts) {
    if (!encryptionKey) {
      throw new Error("Encryption key is required for validation.");
    }

    for (const account of encryptedAccounts) {
      if (account.encrypted && account.secret) {
        try {
          await this.decryptSecret(account.secret, encryptionKey);
        } catch (e) {
          throw new Error("Invalid encryption key.");
        }
      }
    }
    return true;
  },

  async getKeyFromPassword(password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
    const salt = new Uint8Array(16);
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  },

  async encryptSecret(secret, encryptionKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(secret);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      encryptionKey,
      encoded
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${ivHex}:${encryptedHex}`;
  },

  async decryptSecret(encryptedData, encryptionKey) {
    if (!encryptionKey) {
      throw new Error("Encryption key is required for decryption.");
    }
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted data format.");
    }
    const iv = new Uint8Array(parts[0].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(parts[1].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      encryptionKey,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  },

  async exportAccounts(accounts, encryptionEnabled, encryptionKey) {
    const exportData = await Promise.all(accounts.map(async acc => {
      if (encryptionEnabled) {
        if (!acc.encrypted && acc.secret && encryptionKey) {
          const encryptedSecret = await this.encryptSecret(acc.secret, encryptionKey);
          return { ...acc, secret: encryptedSecret, encrypted: true };
        }
        return acc;
      } else {
        if (acc.encrypted && acc.secret && encryptionKey) {
          try {
            const decryptedSecret = await this.decryptSecret(acc.secret, encryptionKey);
            return { ...acc, secret: decryptedSecret, encrypted: false };
          } catch (e) {
            return acc;
          }
        }
        return acc;
      }
    }));

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'otp-backup.json';
    a.click();

    URL.revokeObjectURL(url);
  },

async validateImportedAccounts(importedAccounts, encryptionKey = null) {
  for (const account of importedAccounts) {
    if (account.encrypted && account.secret) {
      if (!encryptionKey) {
        throw new Error("Kunci enkripsi diperlukan untuk impor terenkripsi.");
      }
      try {
        await this.decryptSecret(account.secret, encryptionKey);
      } catch (e) {
        throw new Error("Kunci enkripsi tidak valid untuk data yang diimpor.");
      }
    }
  }
  return true;
},

async importAccounts(file, encryptionKey = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          
          const hasEncryptedAccounts = imported.some(acc => acc.encrypted && acc.secret);
          
          if (hasEncryptedAccounts && !encryptionKey) {
            reject(new Error('File berisi akun terenkripsi. Password diperlukan.'));
            return;
          }
          
          if (hasEncryptedAccounts && encryptionKey) {
            try {
              await this.validateImportedAccounts(imported, encryptionKey);
            } catch (validationError) {
              reject(validationError);
              return;
            }
          }

          const processedImported = await Promise.all(imported.map(async (acc) => {
            if (encryptionKey) {
              if (!acc.encrypted && acc.secret) {
                const encryptedSecret = await this.encryptSecret(acc.secret, encryptionKey);
                return { ...acc, secret: encryptedSecret, encrypted: true };
              }
              else if (acc.encrypted && acc.secret) {
                try {
                  const decryptedSecret = await this.decryptSecret(acc.secret, encryptionKey);
                  return { ...acc, secret: decryptedSecret, encrypted: false };
                } catch (e) {
                  return acc;
                }
              }
            } else {
              if (acc.encrypted && acc.secret) {
                return acc;
              }
            }
            return acc;
          }));
          resolve(processedImported);
        } else {
          reject(new Error('File tidak valid. Data yang diimpor bukan array.'));
        }
      } catch (err) {
        reject(new Error('Gagal memproses file JSON: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file);
  });
}
};
