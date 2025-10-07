const OTPUtils = {
  targetIssuer: {
    "Dapodik": "kode2fa",
    "SDM": "totp_code",
    "SIASN": "otp",
    "InfoGTK": "otpForm"
  },

  // Parse otpauth URI
  parseOtpauth(uri) {
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
  },

  // Build otpauth URI dari account object
  buildOtpauthURI(acc) {
    const issuer = encodeURIComponent(acc.issuer || '');
    const label = encodeURIComponent(acc.label || '');
    const secret = acc.secret;
    return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=${acc.algorithm}&digits=${acc.digits}&period=${acc.period}`;
  },

  // Sort accounts: Label → Issuer
  sortAccounts(accounts) {
    return accounts.sort((a, b) => {
      const labelCompare = (a.label || '').localeCompare(b.label || '');
      if (labelCompare !== 0) return labelCompare;
      return (a.issuer || '').localeCompare(b.issuer || '');
    });
  },

  // Filter accounts berdasarkan search term
  filterAccounts(accountsList, searchTerm) {
    if (!searchTerm) return accountsList;

    return accountsList.filter(account => {
      const label = (account.label || '').toLowerCase();
      const issuer = (account.issuer || '').toLowerCase();
      const code = TOTP.generateCodeForAccount(account, Date.now()).code;

      return label.includes(searchTerm) ||
        issuer.includes(searchTerm) ||
        code.includes(searchTerm);
    });
  },

  // Group accounts by issuer
  groupAccountsByIssuer(accounts) {
    const grouped = {};
    accounts.forEach(a => {
      const group = a.issuer || 'Other';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(a);
    });
    return grouped;
  },

  // Process QR code image
  processQRImage(imageData, width, height) {
    const code = jsQR(imageData, width, height);
    if (code && code.data) {
      return this.parseOtpauth(code.data) || this.parseOtpauth(code.data.trim());
    }
    return null;
  },

  // Download QR code sebagai PNG
  downloadQRCode(account) {
    return new Promise((resolve) => {
      const uri = this.buildOtpauthURI(account);
      
      const canvas = document.createElement("canvas");
      const size = 400;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, size, size);
      
      const qr = QRCode(0, 'L');
      qr.addData(uri);
      qr.make();
      
      const moduleCount = qr.getModuleCount();
      const cellSize = (size - 20) / moduleCount;
      const offset = (size - (moduleCount * cellSize)) / 2;
      
      context.fillStyle = "#000000";
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            context.fillRect(
              offset + col * cellSize,
              offset + row * cellSize,
              cellSize,
              cellSize
            );
          }
        }
      }
      
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = size + 40;
      finalCanvas.height = size + 40;
      const finalContext = finalCanvas.getContext("2d");
      
      finalContext.fillStyle = "#FFFFFF";
      finalContext.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
      finalContext.drawImage(canvas, 20, 20);
      
      setTimeout(() => {
        const link = document.createElement("a");
        link.download = `${account.label || 'otp'}` + `_${account.issuer}_qrcode.png`;
        link.href = finalCanvas.toDataURL("image/png", 1.0);
        link.click();
        resolve(true);
      }, 100);
    });
  },
  downloadQRCodeAlternative(account) {
    const uri = this.buildOtpauthURI(account);
    
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-1000px";
    container.style.top = "-1000px";
    document.body.appendChild(container);
    
    new QRCode(container, {
      text: uri,
      width: 512,
      height: 512,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L
    });
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const canvas = container.querySelector("canvas");
        if (canvas) {
          const finalCanvas = document.createElement("canvas");
          finalCanvas.width = 532;
          finalCanvas.height = 532;
          const ctx = finalCanvas.getContext("2d");
          
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
          
          ctx.drawImage(canvas, 10, 10);
          
          const link = document.createElement("a");
          link.download = `${account.label || 'otp'}` + `_${account.issuer}_qrcode.png`;
          link.href = finalCanvas.toDataURL("image/png", 1.0);
          link.click();
          
          document.body.removeChild(container);
          resolve(true);
        }
      }, 300);
    });
  }
};