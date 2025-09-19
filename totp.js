// totp.js — synchronous HMAC-SHA1 TOTP implementation

(function() {
	function rotl(n, s) {
		return (n << s) | (n >>> (32 - s));
	}

	function sha1Bytes(msgBytes) {
		const ml = msgBytes.length * 8;
		const with1 = new Uint8Array(((msgBytes.length + 9 + 63) >> 6) << 6);
		with1.set(msgBytes);
		with1[msgBytes.length] = 0x80;
		const dv = new DataView(with1.buffer);
		dv.setUint32(with1.length - 4, ml);
		const w = new Uint32Array(80);
		let h0 = 0x67452301,
			h1 = 0xEFCDAB89,
			h2 = 0x98BADCFE,
			h3 = 0x10325476,
			h4 = 0xC3D2E1F0;
		for (let i = 0; i < with1.length; i += 64) {
			for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
			for (let j = 16; j < 80; j++) w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
			let a = h0,
				b = h1,
				c = h2,
				d = h3,
				e = h4;
			for (let t = 0; t < 80; t++) {
				let temp;
				if (t < 20) temp = ((b & c) | ((~b) & d)) + 0x5A827999 + rotl(a, 5) + e + w[t];
				else if (t < 40) temp = (b ^ c ^ d) + 0x6ED9EBA1 + rotl(a, 5) + e + w[t];
				else if (t < 60) temp = ((b & c) | (b & d) | (c & d)) + 0x8F1BBCDC + rotl(a, 5) + e + w[t];
				else temp = (b ^ c ^ d) + 0xCA62C1D6 + rotl(a, 5) + e + w[t];
				e = d;
				d = c;
				c = rotl(b, 30);
				b = a;
				a = (temp >>> 0);
			}
			h0 = (h0 + a) >>> 0;
			h1 = (h1 + b) >>> 0;
			h2 = (h2 + c) >>> 0;
			h3 = (h3 + d) >>> 0;
			h4 = (h4 + e) >>> 0;
		}
		const out = new Uint8Array(20);
		const dv2 = new DataView(out.buffer);
		dv2.setUint32(0, h0);
		dv2.setUint32(4, h1);
		dv2.setUint32(8, h2);
		dv2.setUint32(12, h3);
		dv2.setUint32(16, h4);
		return out;
	}

	function hmacSha1(keyBytes, msgBytes) {
		const block = 64;
		if (keyBytes.length > block) {
			keyBytes = sha1Bytes(keyBytes);
		}
		if (keyBytes.length < block) {
			const kb = new Uint8Array(block);
			kb.set(keyBytes);
			keyBytes = kb;
		}
		const okey = new Uint8Array(block),
			ikey = new Uint8Array(block);
		for (let i = 0; i < block; i++) {
			okey[i] = 0x5c ^ keyBytes[i];
			ikey[i] = 0x36 ^ keyBytes[i];
		}
		const inner = new Uint8Array(ikey.length + msgBytes.length);
		inner.set(ikey);
		inner.set(msgBytes, ikey.length);
		const innerHash = sha1Bytes(inner);
		const outer = new Uint8Array(okey.length + innerHash.length);
		outer.set(okey);
		outer.set(innerHash, okey.length);
		return sha1Bytes(outer);
	}

	function base32toBytes(b32) {
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
		let bits = 0,
			value = 0;
		const out = [];
		b32 = (b32 || '').replace(/=+$/, '').replace(/\\s+/g, '').toUpperCase();
		for (let i = 0; i < b32.length; i++) {
			const idx = alphabet.indexOf(b32[i]);
			if (idx === -1) continue;
			value = (value << 5) | idx;
			bits += 5;
			if (bits >= 8) {
				bits -= 8;
				out.push((value >> bits) & 0xFF);
			}
		}
		return new Uint8Array(out);
	}

	window.TOTP = {
		generateCodeForAccount: function(acc, now) {
			try {
				const digits = acc.digits || 6,
					period = acc.period || 30;
				let counter = Math.floor(((now || Date.now()) / 1000) / period);
				const counterBytes = new Uint8Array(8);
				for (let i = 7; i >= 0; i--) {
					counterBytes[i] = counter & 0xff;
					counter = Math.floor(counter / 256);
				}
				const key = base32toBytes(acc.secret);
				const h = hmacSha1(key, counterBytes);
				const offset = h[h.length - 1] & 0xf;
				const code = ((h[offset] & 0x7f) << 24) | ((h[offset + 1] & 0xff) << 16) | ((h[offset + 2] & 0xff) << 8) | (h[offset + 3] & 0xff);
				const otp = (code % (10 ** digits)).toString().padStart(digits, '0');
				const until = period - (Math.floor((now || Date.now()) / 1000) % period);
				return {
					code: otp,
					until
				};
			} catch (e) {
				return {
					code: 'error',
					until: 0
				};
			}
		}
	};
})();