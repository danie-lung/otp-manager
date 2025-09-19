(() => {
	const listEl = document.getElementById('list');
	const tpl = document.getElementById('accountTpl');
	const fileInput = document.getElementById('fileInput');
	const uploadBtn = document.getElementById('uploadQR');
	const scanBtn = document.getElementById('scanTab');
	const addManualBtn = document.getElementById('addManual');
	const nowEl = document.getElementById('now');

	let accounts = [];

	// mapping issuer ke input ID target di halaman
	const targetIssuer = {
		"Dapodik": "kode2fa",
		"SDM": "totp_code",
		"SIASN": "otp",
		"InfoGTK": "otpForm"
	};

	function save() {
		chrome.storage.local.set({
			accounts
		});
	}

	function load() {
		chrome.storage.local.get(['accounts'], res => {
			accounts = res.accounts || [];
			render();
		});
	}

	function parseOtpauth(uri) {
		try {
			if (!uri.startsWith('otpauth://')) return null;
			const u = new URL(uri);
			const label = decodeURIComponent(u.pathname.slice(1));
			const params = Object.fromEntries(u.searchParams.entries());
			const [issuerFromLabel, account] = label.includes(':') ? label.split(':') : [null, label];
			return {
				type: u.hostname,
				label: account || label,
				issuer: params.issuer || issuerFromLabel || '',
				secret: params.secret,
				algorithm: (params.algorithm || 'SHA1').toUpperCase(),
				digits: Number(params.digits || 6),
				period: Number(params.period || 30)
			};
		} catch (e) {
			return null;
		}
	}

	function render() {
		listEl.innerHTML = '';
		const tabsEl = document.getElementById('tabs');
		tabsEl.innerHTML = '';

		// group by issuer
		const grouped = {};
		accounts.forEach(a => {
			const group = a.issuer || 'Other';
			if (!grouped[group]) grouped[group] = [];
			grouped[group].push(a);
		});

		const issuers = Object.keys(grouped);
		if (issuers.length === 0) return;

		// tambah tab "All"
		issuers.unshift("All");

		let activeIssuer = issuers[0];

		function showAccounts(issuer) {
			listEl.innerHTML = '';

			const list = issuer === "All" ?
				accounts :
				grouped[issuer];

			list.forEach(a => {
				const node = tpl.content.cloneNode(true);
				node.querySelector('.label').textContent = a.label || 'Account';
				node.querySelector('.issuer').textContent = a.issuer || '';
				const codeEl = node.querySelector('.code');
				const timeEl = node.querySelector('.time');

				// delete
				node.querySelector('.del').addEventListener('click', () => {
					if (confirm(`Hapus akun "${a.label}" (${a.issuer})?`)) {
						const index = accounts.indexOf(a);
						if (index >= 0) {
							accounts.splice(index, 1);
							save();
							render();
						}
					}
				});

				// edit
				node.querySelector('.edit').addEventListener('click', () => {
					const newLabel = prompt('Edit Label:', a.label);
					if (newLabel === null) return;
					const newIssuer = prompt('Edit Issuer:', a.issuer || '');
					if (newIssuer === null) return;

					a.label = newLabel.trim();
					a.issuer = newIssuer.trim();
					save();
					render();
				});


				// copy atau fill OTP
				codeEl.addEventListener('click', () => {
					const otp = codeEl.textContent;
					const inputId = targetIssuer[a.issuer] || null; // jangan undefined

					chrome.tabs.query({
						active: true,
						currentWindow: true
					}, tabs => {
						chrome.scripting.executeScript({
								target: {
									tabId: tabs[0].id
								},
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

									// default: isi input berdasarkan id
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

									return false; // fallback copy
								},
								args: [a.issuer, otp, inputId]
							},
							results => {
								// fallback copy ke clipboard
								if (!results || !results[0].result) {
									navigator.clipboard.writeText(otp).then(() => {
										codeEl.style.color = "#c8f7c5";
										setTimeout(() => (codeEl.style.color = ""), 400);
									});
								}
							}
						);
					});
				});


				listEl.appendChild(node);

				// update OTP
				function tick() {
					const now = Date.now();
					const res = TOTP.generateCodeForAccount(a, now);
					codeEl.textContent = res.code;
					timeEl.textContent = `${res.until}s`;
				}
				tick();
				setInterval(tick, 1000);
			});
		}

		// buat tab issuer + All
		issuers.forEach(issuer => {
			const tab = document.createElement('div');
			tab.className = 'tab' + (issuer === activeIssuer ? ' active' : '');
			tab.textContent = issuer;
			tab.addEventListener('click', () => {
				activeIssuer = issuer;
				document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
				tab.classList.add('active');
				showAccounts(issuer);
			});
			tabsEl.appendChild(tab);
		});

		// tampilkan default tab
		showAccounts(activeIssuer);
	}

	// Upload QR
	uploadBtn.addEventListener('click', () => fileInput.click());
	fileInput.addEventListener('change', ev => {
		const f = ev.target.files[0];
		if (!f) return;
		const reader = new FileReader();
		reader.onload = e => {
			const img = new Image();
			img.onload = () => {
				const cvs = document.createElement('canvas');
				cvs.width = img.width;
				cvs.height = img.height;
				const ctx = cvs.getContext('2d');
				ctx.drawImage(img, 0, 0);
				const imgd = ctx.getImageData(0, 0, cvs.width, cvs.height);
				const code = jsQR(imgd.data, cvs.width, cvs.height);
				if (code && code.data) {
					const parsed = parseOtpauth(code.data) || parseOtpauth(code.data.trim());
					if (parsed && parsed.secret) {
						accounts.push(parsed);
						save();
						render();
						alert('Berhasil ditambahkan');
					} else {
						alert('Kode QR berhasil di decode tapi bukan otpauth URI: ' + code.data);
					}
				} else {
					alert('Kode QR tidak ditemukan.');
				}
			};
			img.src = e.target.result;
		};
		reader.readAsDataURL(f);
	});

	// Scan tab
	scanBtn.addEventListener('click', () => {
		chrome.tabs.captureVisibleTab(null, {
			format: 'png'
		}, dataUrl => {
			if (chrome.runtime.lastError) {
				alert('Tangkapan gagal: ' + chrome.runtime.lastError.message);
				return;
			}
			const img = new Image();
			img.onload = () => {
				const cvs = document.createElement('canvas');
				cvs.width = img.width;
				cvs.height = img.height;
				const ctx = cvs.getContext('2d');
				ctx.drawImage(img, 0, 0);
				const imgd = ctx.getImageData(0, 0, cvs.width, cvs.height);
				const code = jsQR(imgd.data, cvs.width, cvs.height);
				if (code && code.data) {
					const parsed = parseOtpauth(code.data) || parseOtpauth(code.data.trim());
					if (parsed && parsed.secret) {
						accounts.push(parsed);
						save();
						render();
						alert('Berhasil ditambahkan');
					} else {
						alert('Kode QR berhasil di decode tapi bukan otpauth URI: ' + code.data);
					}
				} else {
					alert('Kode QR tidak ditemukan dalam tab. Coba untuk zoom in.');
				}
			};
			img.src = dataUrl;
		});
	});

	// Add manual
	addManualBtn.addEventListener('click', () => {
		const label = prompt('Label)');
		if (!label) return;
		const secret = prompt('Secret');
		if (!secret) return;
		const issuer = prompt('Issuer (optional)') || '';
		accounts.push({
			label,
			secret,
			issuer,
			algorithm: 'SHA1',
			digits: 6,
			period: 30
		});
		save();
		render();
		alert('Berhasil ditambahkan');
	});

	// Export data
	document.getElementById('exportBtn').addEventListener('click', () => {
		const dataStr = JSON.stringify(accounts, null, 2);
		const blob = new Blob([dataStr], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = 'otp-backup.json';
		a.click();

		URL.revokeObjectURL(url);
	});

	// Import data
	const importFile = document.getElementById('importFile');
	document.getElementById('importBtn').addEventListener('click', () => {
		importFile.click();
	});

	importFile.addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const imported = JSON.parse(event.target.result);
				if (Array.isArray(imported)) {
					// gabungkan dengan akun lama
					accounts = accounts.concat(imported);
					save();
					render();
					alert('Data berhasil diimpor!');
				} else {
					alert('File tidak valid.');
				}
			} catch (err) {
				alert('Gagal membaca file: ' + err.message);
			}
		};
		reader.readAsText(file);
	});

	document.getElementById('clearBtn').addEventListener('click', () => {
		if (confirm('Apakah Anda yakin ingin menghapus semua akun OTP?')) {
			accounts = [];
			save();
			render();
			alert('Semua akun berhasil dihapus.');
		}
	});

	load();
})();