import { supabase } from '../config/supabase';
import { escapeHtml } from '../utils/escapeHtml';
import { cachedQuery } from '../utils/queryCache';
import { getSignedUrl } from './storage';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generate a secure quote response token and return the URL for email.
 * The customer can click this to accept/decline the quote from a web page.
 */
export async function createQuoteResponseToken(documentId: string): Promise<string> {
  // Generate a 64-char hex token
  // Hermes supports globalThis.crypto.getRandomValues; fallback to Math.random
  let token: string;
  try {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: concatenate random hex segments
    token = Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0')
    ).join('');
  }

  const { error } = await supabase
    .from('document_tokens')
    .insert({
      document_id: documentId,
      token,
    });

  if (error) {
    console.warn('Failed to create quote response token:', error.message);
    throw new Error('Could not create response link');
  }

  // Build the URL that points to the quote-response page hosted on our website
  return `https://gaspilotapp.com/quote-response.html?token=${token}`;
}

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
  /** Document ID for email delivery tracking */
  documentId?: string;
  /** Accept/Decline token URL for quotes */
  quoteResponseUrl?: string;
}

interface SendHtmlEmailArgs {
  to: string[];
  subject: string;
  html: string;
  attachmentName?: string;
  pdfBase64?: string;
  fromName?: string;
  bcc?: string[];
  /** Document ID for email delivery tracking */
  documentId?: string;
}

/** Fetch company info + settings for email context */
async function getCompanyEmailContext(companyId: string) {
  let companyData: any = null;
  try {
    companyData = await cachedQuery(
      `company:${companyId}`,
      async () => {
        const { data, error } = await supabase
          .from('companies')
          .select('name, email, phone, logo_url, settings')
          .eq('id', companyId)
          .single();
        if (error) throw error;
        return data;
      },
      5 * 60 * 1000, // 5 minute TTL for company branding data
    );
  } catch {
    return null;
  }

  if (!companyData) return null;

  let logoSignedUrl = '';
  if (companyData.logo_url) {
    try {
      logoSignedUrl = await getSignedUrl(companyData.logo_url);
    } catch {
      // ignore — no logo
    }
  }

  return {
    companyName: companyData.name || '',
    companyEmail: companyData.email || '',
    companyPhone: companyData.phone || '',
    logoUrl: logoSignedUrl,
    ccEngineerOnEmails: !!(companyData.settings as any)?.ccEngineerOnEmails,
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
  documentId,
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
      documentId: documentId || undefined,
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
  quoteResponseUrl?: string;
}): string {
  const {
    logoUrl, companyName, companyPhone, companyEmail,
    formLabel, certRef, propertyAddress, inspectionDate,
    nextDueDate, landlordName, tenantName, quoteResponseUrl,
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
        ${quoteResponseUrl ? `
        <tr><td style="padding:8px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding-bottom:8px;">
                <p style="margin:0 0 16px;font-size:15px;color:#0f172a;font-weight:600;">Please respond to this quote:</p>
              </td>
            </tr>
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:8px;">
                      <a href="${quoteResponseUrl}" style="display:inline-block;padding:14px 28px;background-color:#16a34a;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:10px;">✓ Accept Quote</a>
                    </td>
                    <td style="padding-left:8px;">
                      <a href="${quoteResponseUrl}" style="display:inline-block;padding:14px 28px;background-color:#f1f5f9;color:#64748b;font-weight:700;font-size:15px;text-decoration:none;border-radius:10px;border:1px solid #e2e8f0;">✗ Decline</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>` : ''}

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
  documentId,
  quoteResponseUrl,
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
    quoteResponseUrl,
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
    attachmentName: `${(formLabel || label).replace(/\s+/g, '-')}-${certRef || 'certificate'}.pdf`,
    pdfBase64,
    fromName: companyCtx?.companyName || undefined,
    documentId,
  });
}
