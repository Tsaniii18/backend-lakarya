interface NotificationEmailOptions {
  eyebrow: string;
  title: string;
  recipientName: string;
  message: string;
  details?: Array<{ label: string; value: string }>;
  closing?: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function createNotificationEmail(options: NotificationEmailOptions) {
  const details = options.details?.length
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;background:#f4f7fb;border:1px solid #d8dee8;border-radius:10px;">
        ${options.details
          .map(
            ({ label, value }) => `
          <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f2747;text-align:right;">${escapeHtml(value)}</td>
          </tr>`,
          )
          .join('')}
      </table>`
    : '';

  return `
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#334155;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ee;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d8dee8;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#0f2747;padding:24px 28px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">LaKarya</td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <p style="margin:0 0 12px;font-size:15px;color:#64748b;">${escapeHtml(options.eyebrow)}</p>
                <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#0f2747;">${escapeHtml(options.title)}</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Halo ${escapeHtml(options.recipientName)},</p>
                <p style="margin:0;font-size:15px;line-height:1.7;">${escapeHtml(options.message)}</p>
                ${details}
                <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${escapeHtml(options.closing ?? 'Email ini dikirim otomatis oleh sistem LaKarya.')}</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #d8dee8;padding:18px 28px;font-size:12px;color:#64748b;">LaKarya · Portal layanan internal karyawan</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
