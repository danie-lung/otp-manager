(() => {
  const listEl = document.getElementById('list');
  const tpl = document.getElementById('accountTpl');
  const loadingEl = document.getElementById('loading');
  const searchInput = document.getElementById('searchInput');

  let currentSearchTerm = '';
  let accounts = [];
  let encryptionKey = null;
  let encryptionEnabled = false;
  let isPasswordModalOpen = false;

  function showLoading() {
    loadingEl.style.display = 'block';
  }

  function hideLoading() {
    loadingEl.style.display = 'none';
  }

  // Modal password
  async function showPasswordModal(message = "Masukkan kata sandi:") {
    if (isPasswordModalOpen) return;
    isPasswordModalOpen = true;

    const passwordModal = document.getElementById("passwordModal");
    const passwordInput = document.getElementById("passwordInput");
    const passwordError = document.getElementById("passwordError");
    const submitPasswordBtn = document.getElementById("submitPassword");

    // Reset input dan error
    passwordInput.value = '';
    passwordError.style.display = 'none';
    passwordModal.querySelector('p').textContent = message;

    passwordModal.style.display = "block";
    passwordInput.focus();

    return new Promise((resolve) => {
      const handleSubmit = async () => {
        const password = passwordInput.value.trim();
        if (!password) {
          passwordError.textContent = "Kata sandi tidak boleh kosong.";
          passwordError.style.display = 'block';
          return;
        }

        try {
          const key = await OTPStorage.getKeyFromPassword(password);
          const storedAccounts = await new Promise(res => chrome.storage.local.get(['accounts'], res));
          const encryptedStoredAccounts = storedAccounts.accounts || [];

          if (encryptedStoredAccounts.some(acc => acc.encrypted)) {
            await OTPStorage.validateEncryptionKey(key, encryptedStoredAccounts);
          }

          passwordModal.style.display = "none";
          isPasswordModalOpen = false;
          resolve(key);
        } catch (e) {
          passwordError.textContent = "Kata sandi tidak valid. Silakan coba lagi.";
          passwordError.style.display = 'block';
          passwordInput.value = '';
          passwordInput.focus();
        }
      };

      submitPasswordBtn.onclick = handleSubmit;

      // Enter key support
      passwordInput.onkeypress = (e) => {
        if (e.key === 'Enter') handleSubmit();
      };
    });
  }

  // Modal Management
  function setupModals() {
    // Tools Modal
    const toolsModal = document.getElementById("toolsModal");
    const menuBtn = document.getElementById("menuBtn");
    const toolsCloseBtn = toolsModal.querySelector(".close");

    menuBtn.addEventListener("click", () => {
      toolsModal.style.display = "block"
    });
    toolsCloseBtn.addEventListener("click", () => toolsModal.style.display = "none");
    window.addEventListener("click", (e) => {
      if (e.target === toolsModal) toolsModal.style.display = "none";
    });

    // Settings Modal
    const settingsModal = document.getElementById("settingsModal");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsCloseBtn = settingsModal.querySelector(".close");
    const enableEncryptionCheckbox = document.getElementById("enableEncryption");
    const encryptionPasswordSection = document.getElementById("encryptionPasswordSection");
    const encryptionPasswordInput = document.getElementById("encryptionPassword");

    settingsBtn.addEventListener("click", async () => {
      const settings = await OTPStorage.loadSettings();
      enableEncryptionCheckbox.checked = settings.encryptionEnabled;
      encryptionPasswordSection.style.display = settings.encryptionEnabled ? 'none' : 'block';
      settingsModal.style.display = "block";
    });

    settingsCloseBtn.addEventListener("click", () => {
      settingsModal.style.display = "none";
      encryptionPasswordInput.value = '';
    });

    window.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.style.display = "none";
        encryptionPasswordInput.value = '';
      }
    });

    // Event checkbox
    enableEncryptionCheckbox.addEventListener('change', async () => {
      const settings = await OTPStorage.loadSettings();
      if (enableEncryptionCheckbox.checked && !settings.encryptionEnabled) {
        encryptionPasswordSection.style.display = 'block';
        encryptionPasswordInput.focus();
      } else if (settings.encryptionEnabled) {
        encryptionPasswordSection.style.display = 'none';
        encryptionPasswordInput.value = '';
      }
    });

    encryptionPasswordInput.addEventListener('input', () => {
      enableEncryptionCheckbox.checked = encryptionPasswordInput.value.length > 0;
    });

    setupModalHandlers();
  }

  function setupModalHandlers() {
    // Modal Upload QR
    document.getElementById('modalUploadQR').addEventListener('click', () => {
      document.getElementById('modalFileInput').click();
    });
    document.getElementById('modalFileInput').addEventListener('change', handleFileUpload);

    // Modal Scan Tab
    document.getElementById('modalScanTab').addEventListener('click', handleTabScan);

    // Modal Add Manual
    document.getElementById('modalAddManual').addEventListener('click', handleManualAdd);

    // Modal Export
    document.getElementById('modalExportBtn').addEventListener('click', async () => {
      if (encryptionEnabled && !encryptionKey) {
        encryptionKey = await showPasswordModal("Masukkan kata sandi untuk mengekspor akun terenkripsi:");
        if (!encryptionKey) {
          alert("Ekspor dibatalkan. Kata sandi diperlukan.");
          return;
        }
      }
      await OTPStorage.exportAccounts(accounts, encryptionEnabled, encryptionKey);
    });

    // Tombol Export (Unencrypted)
    const modalExportUnencryptedBtn = document.getElementById('modalExportUnencryptedBtn');
    modalExportUnencryptedBtn.addEventListener('click', async () => {
      if (encryptionEnabled && !encryptionKey) {
        encryptionKey = await showPasswordModal("Masukkan kata sandi untuk mengekspor akun tanpa enkripsi:");
        if (!encryptionKey) {
          alert("Ekspor dibatalkan. Kata sandi diperlukan.");
          return;
        }
      }
      await OTPStorage.exportAccounts(accounts, false, encryptionKey);
      closeModal('toolsModal');
    });

    // Modal Import
    document.getElementById('modalImportBtn').addEventListener('click', () => {
      document.getElementById('modalImportFile').click();
    });

    document.getElementById('modalImportFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const fileContent = await readFileAsText(file);
        const importedPreview = JSON.parse(fileContent);

        const hasEncryptedAccounts = Array.isArray(importedPreview) &&
          importedPreview.some(acc => acc.encrypted && acc.secret);

        let importEncryptionKey = null;
        if (hasEncryptedAccounts) {
          try {
            importEncryptionKey = await showImportPasswordModal();
          } catch (cancelError) {
            document.getElementById('modalImportFile').value = '';
            return;
          }

          try {
            await OTPStorage.validateImportedAccounts(importedPreview, importEncryptionKey);
          } catch (validationError) {
            alert("Password impor tidak valid atau file rusak. Impor dibatalkan.");
            document.getElementById('modalImportFile').value = '';
            return;
          }
        } else {
          if (encryptionEnabled && !encryptionKey) {
            encryptionKey = await showPasswordModal("Masukkan kata sandi enkripsi untuk mengimpor akun:");
            if (!encryptionKey) {
              alert("Impor dibatalkan. Kata sandi enkripsi diperlukan.");
              document.getElementById('modalImportFile').value = '';
              return;
            }
          }
          importEncryptionKey = encryptionKey;
        }

        const imported = await OTPStorage.importAccounts(file, importEncryptionKey);
        accounts = accounts.concat(imported);
        await OTPStorage.saveAccounts(accounts, encryptionKey);
        accounts = await OTPStorage.loadAccounts(encryptionKey);
        render();
        alert('Data berhasil diimpor!');
        closeModal('toolsModal');

      } catch (err) {
        if (err.message.includes('Password diperlukan') ||
          err.message.includes('Invalid encryption key')) {
          alert("File impor terenkripsi. Password diperlukan atau tidak valid.");
        } else if (err.message.includes('JSON')) {
          alert("File tidak valid. Pastikan file adalah backup OTP Manager Ope. yang benar.");
        } else if (err.message.includes('dibatalkan')) {
        } else {
          alert('Gagal mengimpor data: ' + err.message);
        }
      }

      document.getElementById('modalImportFile').value = '';
    });

    // Helper membaca file
    function readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsText(file);
      });
    }

    // Modal Clear All
    document.getElementById('modalClearBtn').addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin menghapus semua akun OTP?')) {
        accounts = [];
        currentSearchTerm = '';
        searchInput.value = '';
        await OTPStorage.saveAccounts(accounts, encryptionKey);
        await OTPStorage.saveSettings({ encryptionEnabled: false });
        render();
        alert('Semua akun berhasil dihapus.');
        closeModal('toolsModal');
      }
    });

    document.getElementById('btnSortAccounts').addEventListener('click', async () => {
      if (accounts.length === 0) {
        alert("Tidak ada akun untuk disortir.");
        return;
      }
      accounts = OTPUtils.sortAccounts(accounts);
      await OTPStorage.saveAccounts(accounts, encryptionKey);
      render();

      alert("Akun berhasil disortir berdasarkan Label → Issuer.");
      closeModal('settingsModal');
    });

    // Settings Save
    document.getElementById("saveSettings").addEventListener("click", async () => {
      const enableEncryptionCheckbox = document.getElementById("enableEncryption");
      const encryptionPasswordInput = document.getElementById("encryptionPassword");
      const settingsEnc = await OTPStorage.loadSettings();
      const muatAkun = await OTPStorage.loadAccounts();

      if (enableEncryptionCheckbox.checked && encryptionPasswordInput.value.trim() === '' && !settingsEnc.encryptionEnabled) {
        alert('Password enkripsi tidak boleh kosong!');
        encryptionPasswordInput.focus();
        return;
      }

      if (muatAkun.length === 0 && enableEncryptionCheckbox.checked) {
        alert("Akun kosong, tidak bisa dilanjutkan.");
        return;
      };

      if (enableEncryptionCheckbox.checked && settingsEnc.encryptionEnabled) {
        closeModal('settingsModal');
        return;
      }
      const newEncryptionEnabled = enableEncryptionCheckbox.checked;
      const passwordFromInput = encryptionPasswordInput.value.trim();
      const previousEncryptionEnabled = encryptionEnabled;


      if (newEncryptionEnabled && !previousEncryptionEnabled && !passwordFromInput) {
        const confirmWarn = confirm(
          "⚠️ WARNING: Jika Anda lupa kata sandi enkripsi, secret akun Anda tidak dapat dipulihkan.\n\n" +
          "Apakah Anda yakin ingin mengaktifkan enkripsi??"
        );
        if (!confirmWarn) {
          document.getElementById("enableEncryption").checked = false;
          return;
        }
      }

      let newEncryptionKey = null;
      if (newEncryptionEnabled && passwordFromInput) {
        newEncryptionKey = await OTPStorage.getKeyFromPassword(passwordFromInput);
      }

      if (newEncryptionEnabled !== previousEncryptionEnabled) {
        if (newEncryptionEnabled) {
          const encryptedAccounts = await Promise.all(accounts.map(async (account) => {
            if (!account.encrypted && account.secret) {
              const encryptedSecret = await OTPStorage.encryptSecret(account.secret, newEncryptionKey);
              return { ...account, secret: encryptedSecret, encrypted: true };
            }
            return account;
          }));
          accounts = encryptedAccounts;
          encryptionKey = newEncryptionKey;
          encryptionEnabled = true;
          alert("Enkripsi diaktifkan. Semua secret telah dienkripsi.");
        } else {
          if (!encryptionKey) {
            encryptionKey = await showPasswordModal("Masukkan kata sandi enkripsi untuk menonaktifkan enkripsi akun:");
            if (!encryptionKey) {
              alert("Penonaktifan enkripsi dibatalkan. Kata sandi diperlukan untuk mendekripsi.");
              enableEncryptionCheckbox.checked = true;
              return;
            }
          }

          const decryptedAccounts = await Promise.all(accounts.map(async (account) => {
            if (account.encrypted && account.secret) {
              try {
                const decryptedSecret = await OTPStorage.decryptSecret(account.secret, encryptionKey);
                return { ...account, secret: decryptedSecret, encrypted: false };
              } catch (e) {
                throw e;
              }
            }
            return account;
          }));
          accounts = decryptedAccounts;
          encryptionKey = null;
          encryptionEnabled = false;
          alert("Enkripsi dinonaktifkan. Semua secret telah didekripsi.");
        }
      }

      await OTPStorage.saveAccounts(accounts, encryptionKey);
      const settings = {
        encryptionEnabled: newEncryptionEnabled
      };
      await OTPStorage.saveSettings(settings);
      window.close();
    });
  }

  function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
  }

  // Modal password khusus impor
  async function showImportPasswordModal(message = "File yang akan diimpor berisi akun terenkripsi. Masukkan password untuk membukanya.") {
    const importPasswordModal = document.getElementById("importPasswordModal");
    const importPasswordInput = document.getElementById("importPasswordInput");
    const importPasswordError = document.getElementById("importPasswordError");
    const submitImportPasswordBtn = document.getElementById("submitImportPassword");
    const cancelImportPasswordBtn = document.getElementById("cancelImportPassword");

    // Reset input dan error
    importPasswordInput.value = '';
    importPasswordError.style.display = 'none';
    importPasswordModal.querySelector('p').textContent = message;

    importPasswordModal.style.display = "block";
    importPasswordInput.focus();

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        submitImportPasswordBtn.onclick = null;
        cancelImportPasswordBtn.onclick = null;
        importPasswordInput.onkeypress = null;
        importPasswordModal.style.display = "none";
      };

      const handleSubmit = async () => {
        const password = importPasswordInput.value.trim();
        if (!password) {
          importPasswordError.textContent = "Password tidak boleh kosong.";
          importPasswordError.style.display = 'block';
          return;
        }

        try {
          const key = await OTPStorage.getKeyFromPassword(password);
          cleanup();
          resolve(key);
        } catch (e) {
          importPasswordError.textContent = "Password tidak valid. Silakan coba lagi.";
          importPasswordError.style.display = 'block';
          importPasswordInput.value = '';
          importPasswordInput.focus();
        }
      };

      const handleCancel = () => {
        cleanup();
        reject(new Error("Import dibatalkan oleh user"));
      };

      submitImportPasswordBtn.onclick = handleSubmit;
      cancelImportPasswordBtn.onclick = handleCancel;

      // Enter key support
      importPasswordInput.onkeypress = (e) => {
        if (e.key === 'Enter') handleSubmit();
      };
    });
  }

  searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.toLowerCase().trim();
    render();
  });

  async function render() {
    showLoading();
    listEl.innerHTML = '';
    const tabsEl = document.getElementById('tabs');
    tabsEl.innerHTML = '';

    if (accounts.length === 0) {
      listEl.innerHTML = '<div class="no-results">Tidak ada akun yang ditemukan</div>';
      hideLoading();
      return;
    }

    const grouped = OTPUtils.groupAccountsByIssuer(accounts);
    const issuers = Object.keys(grouped);
    issuers.unshift("All");

    renderTabs(tabsEl, issuers, grouped);
    hideLoading();
  }

  function renderTabs(tabsEl, issuers, grouped) {
    let activeIssuer = issuers[0];

    issuers.forEach(issuer => {
      const tab = document.createElement('div');
      tab.className = 'tab' + (issuer === activeIssuer ? ' active' : '');
      tab.textContent = issuer;
      tab.addEventListener('click', () => {
        activeIssuer = issuer;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        showAccounts(issuer, grouped);
      });
      tabsEl.appendChild(tab);
    });

    showAccounts(activeIssuer, grouped);
  }

  function showAccounts(issuer, grouped) {
    listEl.innerHTML = '';

    let list = issuer === "All" ? accounts : grouped[issuer];
    list = OTPUtils.filterAccounts(list, currentSearchTerm);

    if (list.length === 0) {
      listEl.innerHTML = '<div class="no-results">Tidak ada akun yang ditemukan</div>';
      return;
    }

    list.forEach(account => {
      const accountElement = createAccountElement(account);
      listEl.appendChild(accountElement);
    });
  }

  function createAccountElement(account) {
    const node = tpl.content.cloneNode(true);
    node.querySelector('.label').textContent = account.label || 'Account';
    node.querySelector('.issuer').textContent = account.issuer || '';

    const codeEl = node.querySelector('.code');
    const timeEl = node.querySelector('.time');

    // Delete button
    node.querySelector('.del').addEventListener('click', () => deleteAccount(account));

    // Edit button
    node.querySelector('.edit').addEventListener('click', () => editAccount(account));

    // QR button
    node.querySelector('.qr').addEventListener('click', async () => {
      if (account.encrypted) {
        alert("Tidak dapat membuat kode QR untuk akun terenkripsi. Harap nonaktifkan enkripsi atau dekripsi akun terlebih dahulu.");
        return;
      }
      try {
        await OTPUtils.downloadQRCodeAlternative(account);
      } catch (error) {
        await OTPUtils.downloadQRCode(account);
      }
    });

    // OTP click handler
    codeEl.addEventListener('click', () => handleOTPClick(account, codeEl));

    // Update OTP timer
    function updateOTP() {
      if (account.encrypted) {
        codeEl.textContent = "******";
        timeEl.textContent = "";
        return;
      }
      const now = Date.now();
      const res = TOTP.generateCodeForAccount(account, now);
      codeEl.textContent = res.code;
      timeEl.textContent = `${res.until}s`;
    }

    updateOTP();
    setInterval(updateOTP, 1000);

    return node;
  }

  async function deleteAccount(account) {
    if (account.encrypted) {
      alert("Tidak dapat menghapus akun terenkripsi. Harap nonaktifkan enkripsi atau dekripsi akun terlebih dahulu.");
      return;
    }
    if (confirm(`Hapus akun "${account.label}" (${account.issuer})?`)) {
      const index = accounts.indexOf(account);
      if (index >= 0) {
        accounts.splice(index, 1);
        await OTPStorage.saveAccounts(accounts, encryptionKey);
        const muatAkun = await OTPStorage.loadAccounts();
        if (muatAkun.length === 0) {
          await OTPStorage.saveSettings({ encryptionEnabled: false });
        };
        render();
      }
    }
  }

  async function editAccount(account) {
    if (account.encrypted) {
      alert("Tidak dapat mengedit akun terenkripsi. Harap nonaktifkan enkripsi atau dekripsi akun terlebih dahulu.");
      return;
    }
    const newLabel = await showPrompt('Edit Label:', account.label);
    if (newLabel === null) return;
    const newIssuer = await showPrompt('Edit Issuer:', account.issuer || '');
    if (newIssuer === null) return;

    account.label = newLabel.trim();
    account.issuer = newIssuer.trim();
    await OTPStorage.saveAccounts(accounts, encryptionKey);
    render();
  }

  function handleOTPClick(account, codeEl) {
    const otp = codeEl.textContent;
    const inputId = OTPUtils.targetIssuer[account.issuer] || null;

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (issuer, otp, inputId) => {
          // kasus khusus InfoGTK → pisah OTP ke tiap input
          if (issuer === "InfoGTK") {
            const inputs = document.querySelectorAll("#otpForm .otp-input");
            if (inputs && inputs.length === otp.length) {
              otp.split("").forEach((digit, i) => {
                inputs[i].value = digit;
                inputs[i].dispatchEvent(new Event("input", {
                  bubbles: true
                }));
              });
              return true;
            }
            return false;
          }
          if (inputId) {
            const input = document.getElementById(inputId);
            if (input) {
              input.value = otp;
              input.dispatchEvent(new Event("input", {
                bubbles: true
              }));
              return true;
            }
          }
          return false;
        },
        args: [account.issuer, otp, inputId]
      }, results => {
        // Fallback ke clipboard
        if (!results || !results[0].result) {
          navigator.clipboard.writeText(otp).then(() => {
            codeEl.style.color = "#8a8a8a";
            codeEl.textContent = "Disalin!";
            setTimeout(() => {
              codeEl.textContent = otp;
              codeEl.style.color = "";
            }, 1000);
          });
        }
      });
    });
  }

  async function handleFileUpload(ev) {
    const file = ev.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const cvs = document.createElement('canvas');
        cvs.width = img.width;
        cvs.height = img.height;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgd = ctx.getImageData(0, 0, cvs.width, cvs.height);

        const parsed = OTPUtils.processQRImage(imgd.data, cvs.width, cvs.height);
        if (parsed && parsed.secret) {
          if (encryptionEnabled) {
            const encryptedSecret = await OTPStorage.encryptSecret(parsed.secret, encryptionKey);
            accounts.push({ ...parsed, secret: encryptedSecret, encrypted: true });
          } else {
            accounts.push(parsed);
          }
          await OTPStorage.saveAccounts(accounts, encryptionKey);
          closeModal('toolsModal');
          accounts = await OTPStorage.loadAccounts(encryptionKey);
          render();
          alert('Berhasil ditambahkan');
        } else {
          closeModal('toolsModal');
          alert('Kode QR tidak valid atau bukan otpauth URI.');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleTabScan() {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, dataUrl => {
      if (chrome.runtime.lastError) {
        closeModal('toolsModal');
        alert('Tangkapan gagal: ' + chrome.runtime.lastError.message);
        return;
      }

      const img = new Image();
      img.onload = async () => {
        const cvs = document.createElement('canvas');
        cvs.width = img.width;
        cvs.height = img.height;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgd = ctx.getImageData(0, 0, cvs.width, cvs.height);

        const parsed = OTPUtils.processQRImage(imgd.data, cvs.width, cvs.height);
        if (parsed && parsed.secret) {
          if (encryptionEnabled) {
            const encryptedSecret = await OTPStorage.encryptSecret(parsed.secret, encryptionKey);
            accounts.push({ ...parsed, secret: encryptedSecret, encrypted: true });
          } else {
            accounts.push(parsed);
          }
          await OTPStorage.saveAccounts(accounts, encryptionKey);
          closeModal('toolsModal');
          accounts = await OTPStorage.loadAccounts(encryptionKey);
          render();
          alert('Berhasil ditambahkan');
        } else {
          closeModal('toolsModal');
          alert('Kode QR tidak ditemukan dalam tab. Coba untuk zoom in.');
        }
      };
      img.src = dataUrl;
    });
  }

  async function handleManualAdd() {
    if (encryptionEnabled && !encryptionKey) {
      encryptionKey = await showPasswordModal("Masukkan kata sandi enkripsi untuk menambahkan akun:");
      if (!encryptionKey) {
        alert("Penambahan dibatalkan. Kata sandi diperlukan.");
        return;
      }
    }
    const label = await showPrompt('Label:', '');
    if (!label) return;
    const secret = await showPrompt('Secret:', '');
    if (!secret) return;
    const issuer = await showPrompt('Issuer:', '');
	if (!issuer) return;

    const newAccount = {
      label: label.trim(),
      secret: secret.trim(),
      issuer: issuer.trim(),
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    };

    if (encryptionEnabled) {
      const encryptedSecret = await OTPStorage.encryptSecret(newAccount.secret, encryptionKey);
      accounts.push({ ...newAccount, secret: encryptedSecret, encrypted: true });
    } else {
      accounts.push(newAccount);
    }

    await OTPStorage.saveAccounts(accounts, encryptionKey);
    closeModal('toolsModal');
    accounts = await OTPStorage.loadAccounts(encryptionKey);
    render();
    alert('Berhasil ditambahkan');
  }
  
  function showPrompt(message, defaultValue = "") {
	  return new Promise((resolve) => {
		const modal = document.createElement("div");
		modal.className = "modal-overlay";
		modal.innerHTML = `
		  <div class="modal-content">
			<p>${message}</p>
			<input type="text" id="promptInput" value="${defaultValue}" />
			<div class="button-row">
			  <button id="cancelBtn">Batal</button>
			  <button id="okBtn">OK</button>
			</div>
		  </div>`;
		document.body.appendChild(modal);
		const input = modal.querySelector("#promptInput");
		input.focus();

		modal.querySelector("#okBtn").onclick = () => {
		  const val = input.value;
		  modal.remove();
		  resolve(val);
		};
		modal.querySelector("#cancelBtn").onclick = () => {
		  modal.remove();
		  resolve(null);
		};
	  });
	}
	
	function showAlert(message) {
	  const modal = document.createElement("div");
	  modal.className = "modal-overlay";
	  modal.innerHTML = `
		<div class="modal-content">
		  <p>${message}</p>
		  <div style="text-align:right">
			<button id="okBtn">OK</button>
		  </div>
		</div>`;
	  document.body.appendChild(modal);
	  modal.querySelector("#okBtn").onclick = () => modal.remove();
	}


  // Initialize
  async function init() {
    showLoading();
    setupModals();
    const settings = await OTPStorage.loadSettings();
    encryptionEnabled = settings.encryptionEnabled;

    if (encryptionEnabled) {
      let key = null;
      while (!key) {
        key = await showPasswordModal("Akun Anda dienkripsi. Masukkan kata sandi Anda untuk mengaksesnya.");
        if (!key) {
          alert("Kata sandi tidak valid. Silakan coba lagi.");
        }
      }
      encryptionKey = key;
    }

    const modalExportUnencryptedBtn = document.getElementById('modalExportUnencryptedBtn');
    if (encryptionEnabled) {
      modalExportUnencryptedBtn.style.display = 'block';
    } else {
      modalExportUnencryptedBtn.style.display = 'none';
    }

    accounts = await OTPStorage.loadAccounts(encryptionKey);
    render();
    hideLoading();
  }

  init();
})();