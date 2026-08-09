function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function createPasswordResetEmail(name: string, resetUrl: string) {
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);

  return `
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset Password LaKarya</title>
  </head>
  <body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#334155;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ee;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d8dee8;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#0f2747;padding:24px 28px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                LaKarya
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <p style="margin:0 0 12px;font-size:15px;color:#64748b;">Pemulihan Akun</p>
                <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#0f2747;">Reset password Anda</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Halo ${safeName},</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
                  Kami menerima permintaan untuk mengganti password akun LaKarya Anda. Gunakan tombol berikut untuk membuat password baru.
                </p>
                <a href="${safeResetUrl}" style="display:inline-block;border-radius:8px;background:#0f2747;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                  Buat Password Baru
                </a>
                <p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#64748b;">
                  Link ini berlaku selama 15 menit. Jika Anda tidak meminta reset password, abaikan email ini.
                </p>
                <p style="margin:18px 0 6px;font-size:12px;color:#64748b;">Jika tombol tidak dapat dibuka, salin link berikut:</p>
                <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6;color:#3f6f9f;">${safeResetUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #d8dee8;padding:18px 28px;font-size:12px;color:#64748b;">
                LaKarya · Portal layanan internal karyawan
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
