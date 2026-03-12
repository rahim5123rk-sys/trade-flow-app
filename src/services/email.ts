import { supabase } from '../config/supabase';
import { escapeHtml } from '../utils/escapeHtml';

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
}

interface SendHtmlEmailArgs {
  to: string[];
  subject: string;
  html: string;
  attachmentName?: string;
  pdfBase64?: string;
}

export async function sendHtmlEmail({
  to,
  subject,
  html,
  attachmentName,
  pdfBase64,
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
}: SendCp12CertificateArgs): Promise<void> {
  const recipients = sanitizeRecipients(to);
  if (recipients.length === 0) {
    throw new Error('No valid recipient emails found.');
  }

  const subject = (subjectOverride || '').trim() || `Gas Safety Certificate ${certRef}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Your Gas Safety Certificate</h2>
      <p style="margin:0 0 12px;">Please find your Gas Safety Record attached as a PDF.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Reference</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(certRef)}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Property</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(propertyAddress || 'Not provided')}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Inspection Date</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(inspectionDate)}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Next Due Date</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(nextDueDate)}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Landlord</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(landlordName || 'Not provided')}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Tenant</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(tenantName || 'Not provided')}</td>
        </tr>
      </table>
      <p style="margin:0;color:#475569;font-size:14px;">Thank you for using GasPilot.</p>
    </div>
  `;

  await sendHtmlEmail({
    to: recipients,
    subject,
    html,
    attachmentName: `${certRef || 'gas-safety-certificate'}.pdf`,
    pdfBase64,
  });
}
