import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { escapeHtml } from '../utils/escapeHtml';
import { getSignedUrl, getSignedUrls } from './storage';

// Matches your Supabase snake_case structure
interface JobData {
  id: string;
  reference: string;
  company_id: string;
  scheduled_date: number;
  customer_snapshot: { 
    name: string; 
    address: string; 
    email?: string; 
    phone?: string 
  };
  title: string;
  notes?: string;
  status: string;
  payment_status?: string;
  price?: number;
  photos?: string[];
  signature?: string;
}

export const generateJobSheet = async (job: JobData) => {
  // 1. Fetch Company Details
  let companyData: any = { 
    name: 'GasPilot User', 
    address: 'Business Address', 
    email: 'contact@gaspilot.app', 
    phone: '',
    logo_url: null 
  };
  
  try {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', job.company_id)
      .single();

    if (data) companyData = data;
  } catch (e) {
    console.warn("Could not fetch company data for PDF", e);
  }

  // 2. Resolve private storage URLs
  const logoUrl = companyData.logo_url ? await getSignedUrl(companyData.logo_url) : null;
  const photoUrls = job.photos?.length ? await getSignedUrls(job.photos) : [];

  // 3. Format Data
  const jobDate = new Date(job.scheduled_date);
  const dateStr = jobDate.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const timeStr = jobDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  const isPaid = job.status === 'paid' || job.payment_status === 'paid';
  const statusColor = isPaid ? '#10B981' : '#64748B'; // Green if paid, Grey otherwise
  const statusText = isPaid ? 'PAID' : job.status.replace('_', ' ').toUpperCase();

  /** Escape user values for safe HTML interpolation */
  const esc = (v: unknown): string => escapeHtml(v);

  // 4. Construct HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #334155; font-size: 11px; line-height: 1.3; margin: 0;
    padding: 20mm; padding-bottom: 45mm; -webkit-print-color-adjust: exact;
  }
  .row { display: flex; flex-direction: row; justify-content: space-between; gap: 20px; }
  .col { flex: 1; }
  .text-right { text-align: right; }
  .bold { font-weight: 700; color: #0f172a; }

  /* HEADER */
  .header { margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
  .company-logo { height: 60px; width: auto; object-fit: contain; margin-bottom: 8px; display: block; }
  .company-title { font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 4px; }
  .company-text { font-size: 10px; color: #475569; display: block; margin-bottom: 1px; }

  .doc-title { font-size: 24px; font-weight: 800; color: #cbd5e1; text-align: right; margin-bottom: 10px; letter-spacing: 2px; }
  .meta-row { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 3px; }
  .meta-label { font-weight: 600; color: #64748b; font-size: 10px; }
  .meta-val { font-weight: 700; color: #0f172a; font-size: 10px; min-width: 70px; text-align: right; }

  /* ADDRESS GRID */
  .address-grid { display: flex; gap: 30px; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9; }
  .addr-box { flex: 1; }
  .addr-header { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .addr-name { font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .addr-text { font-size: 11px; color: #334155; display: block; margin-bottom: 1px; }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #f8fafc; color: #64748b; font-weight: 700; font-size: 9px; text-transform: uppercase; padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 10px; }
  .col-desc { width: 45%; }
  .col-num { text-align: right; white-space: nowrap; }

  /* NOTES */
  .notes-box { margin-top: 20px; padding: 10px; background: #fffbeb; border: 1px dashed #e2e8f0; border-radius: 4px; page-break-inside: avoid; }
  .notes-title { font-size: 9px; font-weight: 700; color: #b45309; text-transform: uppercase; margin-bottom: 2px; }
  .notes-content { font-size: 10px; color: #334155; }

  /* PHOTOS */
  .photo-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
  .photo-item { width: 100px; height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; }
  .photo-title { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }

  /* FOOTER */
  .footer { position: fixed; bottom: 15mm; left: 20mm; right: 20mm; height: 35mm; background: #fff; border-top: 1px solid #0f172a; padding-top: 10px; display: flex; justify-content: space-between; gap: 20px; }
  .left-box { flex: 1; font-size: 9px; line-height: 1.4; color: #475569; }
  .box-title { font-weight: 700; font-size: 9px; color: #0f172a; text-transform: uppercase; margin-bottom: 3px; }

  .sig-box { width: 140px; text-align: right; display: flex; flex-direction: column; justify-content: flex-end; }
  .sig-img { height: 35px; width: auto; object-fit: contain; align-self: flex-end; margin-bottom: 2px; }
  .sig-line { border-top: 1px solid #cbd5e1; font-size: 8px; color: #94a3b8; padding-top: 2px; text-transform: uppercase; text-align: center; }
  .terms { position: fixed; bottom: 8mm; left: 0; right: 0; text-align: center; font-size: 8px; color: #94a3b8; }
</style>
</head>
<body>

  <div class="header">
    <div class="col">
      ${logoUrl ? `<img src="${logoUrl}" class="company-logo" />` : ''}
      <div class="company-title">${esc(companyData.name)}</div>
      <div class="company-text">${esc((companyData.address || '').replace(/\n/g, ', '))}</div>
      <div class="company-text">${esc(companyData.phone)}</div>
      <div class="company-text">${esc(companyData.email)}</div>
    </div>
    <div class="col">
      <div class="doc-title">JOB SHEET</div>
      <div class="meta-row"><span class="meta-label">Reference:</span><span class="meta-val">#${esc(job.reference)}</span></div>
      <div class="meta-row"><span class="meta-label">Scheduled Date:</span><span class="meta-val">${dateStr}</span></div>
      <div class="meta-row"><span class="meta-label">Time:</span><span class="meta-val">${timeStr}</span></div>
      <div class="meta-row"><span class="meta-label">Status:</span><span class="meta-val" style="color: ${statusColor};">${statusText}</span></div>
    </div>
  </div>

  <div class="address-grid">
    <div class="addr-box">
      <div class="addr-header">Client</div>
      <div class="addr-name">${esc(job.customer_snapshot?.name || 'Unknown Client')}</div>
      ${job.customer_snapshot?.address ? `<div class="addr-text">${esc(job.customer_snapshot.address)}</div>` : ''}
      ${job.customer_snapshot?.phone ? `<div class="addr-text" style="margin-top:4px;">${esc(job.customer_snapshot.phone)}</div>` : ''}
      ${job.customer_snapshot?.email ? `<div class="addr-text">${esc(job.customer_snapshot.email)}</div>` : ''}
    </div>
    <div class="addr-box text-right">
      <div class="addr-header" style="border-color:transparent;">Site Address</div>
      <div class="addr-text">${esc(job.customer_snapshot?.address || 'No Address')}</div>
      <div class="addr-text" style="margin-top:4px; font-weight:600;">Job Date: ${dateStr}</div>
    </div>
  </div>

  <table>
    <thead><tr><th class="col-desc">Job Details</th><th class="col-num">Status</th><th class="col-num">Estimated Amount</th></tr></thead>
    <tbody>
      <tr>
        <td class="col-desc">
          <div class="bold">${esc(job.title)}</div>
        </td>
        <td class="col-num">${statusText}</td>
        <td class="col-num">£${(job.price || 0).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${job.notes ? `
    <div class="notes-box">
      <div class="notes-title">Job Notes</div>
      <div class="notes-content">${esc(job.notes).replace(/\n/g, '<br/>')}</div>
    </div>
  ` : ''}

  ${photoUrls.length > 0 ? `
    <div class="photo-title">Site Photos</div>
    <div class="photo-grid">
      ${photoUrls.map(url => `<img src="${url}" class="photo-item" />`).join('')}
    </div>
  ` : ''}

  <div class="footer">
    <div class="left-box">
      <div class="box-title">Client Acceptance</div>
      <div style="height:30px; border-bottom:1px dashed #cbd5e1; width:200px; margin-top:15px;"></div>
      <div style="font-size:8px; color:#94a3b8; margin-top:4px;">Signed by ${esc(job.customer_snapshot?.name || 'Client')}</div>
    </div>
    <div class="sig-box">
      ${job.signature ? `<img src="${job.signature}" class="sig-img" />` : '<div style="height:35px;"></div>'}
      <div class="sig-line">Technician Signature</div>
    </div>
  </div>
  <div class="terms">Generated by GasPilot</div>
</body>
</html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    const shareOptions = {
      UTI: '.pdf',
      mimeType: 'application/pdf',
    } as const;

    if (Platform.OS === 'ios') {
      void Sharing.shareAsync(uri, shareOptions).catch((err) => {
        console.warn('Job PDF share dismissed/failed on iOS:', err);
      });
      return;
    }

    await Sharing.shareAsync(uri, shareOptions);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};