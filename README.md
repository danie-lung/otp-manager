# OTP Manager Ope. Browser Extension
<div align="center">
  
![OTP Manager Ope](https://img.shields.io/badge/OTP-Manager-blue?style=for-the-badge&logo=google-authenticator)
![Version](https://img.shields.io/badge/Version-2.1-red?style=for-the-badge)

</div>

## 📖 Gambaran Umum

OTP Manager Ope. adalah ekstensi browser untuk mengelola semua kode Two-Factor Authentication (2FA) Anda dalam satu tempat. Dengan enkripsi dan antarmuka yang intuitif, ini adalah solusi untuk meningkatkan kenyamanan.

### Pengguna khusus

Ekstensi ini bisa dipakai untuk menghasilkan berbagai kode OTP, namun ada fitur khusus yakni kode OTP akan otomatis terisi ke form input diantaranya issuer Dapodik, SDM, dll.

Jika akan menggunakan fitur pengguna khusus tersebut, kita harus setting nama issuer terlebih dahulu. Jika bukan default, Gunakan tombol edit untuk mengubahnya.

#### Penulisan Issuer yang tersedia
* Dapodik
* SDM
* SIASN
* InfoGTK

Pastikan besar kecilnya sama, selain dari itu menggunakan [ctrl] + [v]

## ✨ Fitur

### 🔐 Manajemen Akun
- **📱 Generate OTP Real-time** - Kode diperbarui otomatis dengan countdown visual
- **🏷️ Pengelompokan Pintar** - Akun dikelompokkan otomatis berdasarkan penyedia layanan
- **🔍 Pencarian Instan** - Cari akun dengan cepat berdasarkan nama atau issuer
- **📊 Penyortiran** - Urutkan akun berdasarkan Label → Issuer untuk manajemen yang lebih baik
- **📱 Download QR**

### Kompatibilitas Browser
- ✅ Google Chrome 88+
- ✅ Microsoft Edge 88+
- ✅ Opera 74+
- ✅ Browser berbasis Chromium lainnya

### ➕ Multiple Metode Import
| Metode | Deskripsi |
|--------|-------------|
| **📷 Upload QR Code** | Unggah gambar QR code dari perangkat |
| **🌐 Scan Tab Aktif** | Capture dan scan QR code dari halaman web |
| **⌨️ Input Manual** | Tambah akun manual dengan secret key |

### 🛡️ Keamanan
- **Enkripsi Military-grade** - Algoritma AES-256-GCM
- **Perlindungan Password** - Master password diperlukan untuk data terenkripsi
- **Penyimpanan Lokal** - Semua data tetap di perangkat Anda

###  💾 Backup & Pemulihan
- **Export Terenkripsi** - Backup aman dengan password Anda
- **Export Tanpa Enkripsi** - Plain text untuk migrasi data
- **Import** - Deteksi otomatis backup terenkripsi
- **Validasi Password** - Import aman dengan verifikasi password

###  🎯 Integrasi
- **Auto-fill Satu Klik** - Input langsung ke field OTP
- **Fallback Clipboard** - Salin otomatis ke clipboard
- **Kompatibel Cross-browser** - Berfungsi di browser berbasis Chromium

### ⚠️ Peringatan Keamanan Penting
Jika Anda mengaktifkan enkripsi dan lupa password, secret OTP Anda TIDAK DAPAT DIPULIHKAN.
Selalu simpan master password Anda di password manager yang aman atau tulis di tempat yang aman.

## Disclaimer
* Semua data OTP hanya disimpan di penyimpanan lokal browser (chrome.storage.local).
* Jika ekstensi dihapus atau data browser ter-reset, data OTP akan hilang kecuali sudah diekspor manual.
* Penulis ekstensi tidak bertanggung jawab atas kerugian, kebocoran data, atau penyalahgunaan yang timbul dari penggunaan ekstensi ini.
* Dengan menggunakan ekstensi ini, pengguna menyatakan menanggung segala risiko sendiri.






