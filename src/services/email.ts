import { supabase } from '../config/supabase';
import { escapeHtml } from '../utils/escapeHtml';
import { getSignedUrl } from './storage';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sanitizeRecipients = (emails: string[]): string[] => {
  const unique = new Set<string>();

  emails.forEach((email) => {
    const clean = (email || '').trim().toLowerCase();
    if (clean && EMAIL_REGEX.test(clean)) {
      unique.add(clean);
    }
  });

  return Array.from(unique);
};

interface SendCp12CertificateArgs {
  to: string[];
  certRef: string;
  propertyAddress: string;
  inspectionDate: string;
  nextDueDate: string;
  landlordName?: string;
  tenantName?: string;
  pdfBase64: string;
  subjectOverride?: string;
  /** Form type label shown in the email, e.g. "Gas Safety Certificate" */
  formLabel?: string;
}

interface SendHtmlEmailArgs {
  to: string[];
  subject: string;
  html: string;
  attachmentName?: string;
  pdfBase64?: string;
  fromName?: string;
  bcc?: string[];
}

/** Fetch company info + settings for email context */
async function getCompanyEmailContext(companyId: string) {
  const { data } = await supabase
    .from('companies')
    .select('name, email, phone, logo_url, settings')
    .eq('id', companyId)
    .single();

  if (!data) return null;

  let logoSignedUrl = '';
  if (data.logo_url) {
    try {
      logoSignedUrl = await getSignedUrl(data.logo_url);
    } catch {
      // ignore — no logo
    }
  }

  return {
    companyName: data.name || '',
    companyEmail: data.email || '',
    companyPhone: data.phone || '',
    logoUrl: logoSignedUrl,
    ccEngineerOnEmails: !!(data.settings as any)?.ccEngineerOnEmails,
  };
}

export async function sendHtmlEmail({
  to,
  subject,
  html,
  attachmentName,
  pdfBase64,
  fromName,
  bcc,
}: SendHtmlEmailArgs): Promise<void> {
  const recipients = sanitizeRecipients(to);
  if (recipients.length === 0) {
    throw new Error('No valid recipient emails found.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || 'Could not validate your session. Please sign in again.');
  }

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at; // Unix timestamp in seconds
  const isExpiredOrExpiringSoon = !expiresAt || expiresAt <= Math.floor(Date.now() / 1000) + 60;

  if (!accessToken || isExpiredOrExpiringSoon) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error(refreshError.message || 'Session expired. Please sign in again to send emails.');
    }
    accessToken = refreshed.session?.access_token;
  }

  if (!accessToken) {
    throw new Error('Session expired. Please sign in again to send emails.');
  }

  const { error } = await supabase.functions.invoke('send-email', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      to: recipients,
      subject,
      html,
      attachmentName,
      pdfBase64,
      fromName: fromName || undefined,
      bcc: bcc?.length ? bcc : undefined,
    },
  });

  if (error) {
    const functionsError = error as any;
    let backendMessage = '';

    if (functionsError?.context) {
      try {
        const response: Response = functionsError.context;
        const raw = await response.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            backendMessage = parsed?.error || parsed?.message || raw;
          } catch {
            backendMessage = raw;
          }
        }
      } catch {
        // ignore parsing issues
      }
    }

    const finalMessage = backendMessage || functionsError?.message || 'Failed to send email.';

    if (/invalid jwt|jwt/i.test(finalMessage)) {
      throw new Error('Authentication token is invalid or expired. Please sign out and sign back in, then try again.');
    }

    throw new Error(finalMessage);
  }
}

// ─── Branded HTML email template ───────────────────────────────

function buildBrandedEmail(opts: {
  logoUrl: string;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  formLabel: string;
  certRef: string;
  propertyAddress: string;
  inspectionDate: string;
  nextDueDate: string;
  landlordName: string;
  tenantName: string;
}): string {
  const {
    logoUrl, companyName, companyPhone, companyEmail,
    formLabel, certRef, propertyAddress, inspectionDate,
    nextDueDate, landlordName, tenantName,
  } = opts;

  const logoSection = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" style="max-height:60px;max-width:200px;display:block;" />`
    : `<span style="font-size:22px;font-weight:800;color:#0f172a;">${escapeHtml(companyName)}</span>`;

  const rows = [
    { label: 'Reference', value: certRef },
    { label: 'Property', value: propertyAddress || 'Not provided' },
    { label: 'Date', value: inspectionDate },
    ...(nextDueDate ? [{ label: 'Next Due', value: nextDueDate }] : []),
    ...(landlordName ? [{ label: 'Customer', value: landlordName }] : []),
    ...(tenantName ? [{ label: 'Tenant', value: tenantName }] : []),
  ];

  const tableRows = rows
    .map(
      (r, i) =>
        `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;width:120px;${i === 0 ? 'border-top:1px solid #f1f5f9;' : ''}">${escapeHtml(r.label)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:15px;${i === 0 ? 'border-top:1px solid #f1f5f9;' : ''}">${escapeHtml(r.value)}</td>
        </tr>`,
    )
    .join('');

  const companyContactParts = [companyPhone, companyEmail].filter(Boolean).map(escapeHtml).join(' &nbsp;·&nbsp; ');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #f1f5f9;">
          ${logoSection}
        </td></tr>

        <!-- Title -->
        <tr><td style="padding:28px 32px 8px;">
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;">Your ${escapeHtml(formLabel)}</h1>
          <p style="margin:8px 0 0;font-size:15px;color:#64748b;line-height:1.5;">Please find your document attached as a PDF.</p>
        </td></tr>

        <!-- Details Table -->
        <tr><td style="padding:16px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;">
            ${tableRows}
          </table>
        </td></tr>

        <!-- Company Contact -->
        ${companyContactParts ? `
        <tr><td style="padding:0 32px 24px;">
          <div style="background-color:#f8fafc;border-radius:10px;padding:14px 16px;text-align:center;">
            <span style="font-size:13px;color:#64748b;">${companyContactParts}</span>
          </div>
        </td></tr>` : ''}

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
          <span style="font-size:12px;color:#94a3b8;">Powered by </span>
          <span style="font-size:12px;font-weight:700;color:#94a3b8;">GasPilot</span>
          <span style="font-size:12px;color:#94a3b8;"> · Smart tools for gas engineers</span>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Public send function ──────────────────────────────────────

export async function sendCp12CertificateEmail({
  to,
  certRef,
  propertyAddress,
  inspectionDate,
  nextDueDate,
  landlordName,
  tenantName,
  pdfBase64,
  subjectOverride,
  formLabel,
}: SendCp12CertificateArgs): Promise<void> {
  const recipients = sanitizeRecipients(to);
  if (recipients.length === 0) {
    throw new Error('No valid recipient emails found.');
  }

  // Get company context for branding + CC toggle
  const { data: { user } } = await supabase.auth.getUser();
  let companyCtx: Awaited<ReturnType<typeof getCompanyEmailContext>> = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (profile?.company_id) {
      companyCtx = await getCompanyEmailContext(profile.company_id);
    }
  }

  const label = formLabel || 'Gas Safety Certificate';
  const subject = (subjectOverride || '').trim() || `${label} ${certRef}`;

  const html = buildBrandedEmail({
    logoUrl: companyCtx?.logoUrl || '',
    companyName: companyCtx?.companyName || '',
    companyPhone: companyCtx?.companyPhone || '',
    companyEmail: companyCtx?.companyEmail || '',
    formLabel: label,
    certRef,
    propertyAddress,
    inspectionDate,
    nextDueDate,
    landlordName: landlordName || '',
    tenantName: tenantName || '',
  });

  // BCC engineer if setting enabled (hidden from customer)
  const bccList: string[] = [];
  if (companyCtx?.ccEngineerOnEmails && user?.email) {
    const engineerEmail = user.email.trim().toLowerCase();
    if (!recipients.includes(engineerEmail)) {
      bccList.push(engineerEmail);
    }
  }

  await sendHtmlEmail({
    to: recipients,
    bcc: bccList.length ? bccList : undefined,
    subject,
    html,
    attachmentName: `${certRef || 'certificate'}.pdf`,
    pdfBase64,
    fromName: companyCtx?.companyName || undefined,
  });
}
