import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
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
    name: 'TradeFlow User', 
    address: 'Business Address', 
    email: 'contact@tradeflow.com', 
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

  // 4. Construct HTML
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          
          body { 
            font-family: 'Inter', Helvetica, sans-serif; 
            padding: 40px; 
            color: #1e293b; 
            -webkit-font-smoothing: antialiased;
            background: #fff;
          }

          /* Header */
          .header-row { display: flex; justify-content: space-between; margin-bottom: 40px; align-items: flex-start; }
          .logo-box { width: 100px; height: 100px; background: #f8fafc; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #e2e8f0; }
          .logo-img { width: 100%; height: 100%; object-fit: contain; }
          .invoice-title { text-align: right; }
          .invoice-label { font-size: 32px; font-weight: 800; color: #0f172a; letter-spacing: -1px; margin: 0; }
          .invoice-sub { color: #64748B; font-size: 14px; margin-top: 5px; }
          .status-badge { 
            display: inline-block; 
            margin-top: 10px; 
            padding: 6px 12px; 
            background: ${statusColor}15; 
            color: ${statusColor}; 
            border-radius: 6px; 
            font-size: 12px; 
            font-weight: 700; 
            letter-spacing: 0.5px;
          }

          /* Info Grid */
          .info-grid { display: flex; gap: 40px; margin-bottom: 50px; }
          .col { flex: 1; }
          .col-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
          .info-text { font-size: 14px; line-height: 1.6; color: #334155; }
          .info-name { font-weight: 700; color: #0f172a; font-size: 15px; margin-bottom: 4px; }

          /* Job Table */
          .job-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          .job-table th { text-align: left; padding: 12px 16px; background: #f8fafc; color: #64748B; font-size: 11px; text-transform: uppercase; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
          .job-table td { padding: 16px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          .desc-cell { width: 60%; }
          .notes-box { margin-top: 8px; font-size: 13px; color: #64748B; font-style: italic; background: #fff; }
          .price-cell { text-align: right; font-weight: 600; font-size: 15px; color: #0f172a; }

          /* Totals */
          .totals-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
          .totals-box { width: 250px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #64748B; }
          .grand-total { border-top: 2px solid #0f172a; margin-top: 10px; padding-top: 10px; font-size: 18px; font-weight: 800; color: #0f172a; }

          /* Photos */
          .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 15px; }
          .photo-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 40px; }
          .photo-frame { width: 140px; height: 140px; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; padding: 4px; background: #fff; }
          .photo-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }

          /* Footer / Signatures */
          .footer-row { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 30px; border-top: 1px dashed #cbd5e1; }
          .sig-box { width: 45%; }
          .sig-line { margin-top: 40px; border-bottom: 1px solid #cbd5e1; }
          .sig-img { height: 50px; object-fit: contain; margin-bottom: -10px; }
          .footer-text { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>

        <div class="header-row">
          <div class="logo-box">
             ${logoUrl 
               ? `<img src="${logoUrl}" class="logo-img" />` 
               : `<span style="font-size: 30px; font-weight: bold; color: #cbd5e1;">TF</span>`
             }
          </div>
          <div class="invoice-title">
            <h1 class="invoice-label">JOB SHEET</h1>
            <div class="invoice-sub">Ref: #${job.reference}</div>
            <div class="status-badge">${statusText}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="col">
            <div class="col-label">Service Provider</div>
            <div class="info-name">${companyData.name}</div>
            <div class="info-text">
              ${companyData.address}<br>
              ${companyData.email}<br>
              ${companyData.phone || ''}
            </div>
          </div>
          <div class="col">
            <div class="col-label">Client</div>
            <div class="info-name">${job.customer_snapshot?.name || 'Unknown Client'}</div>
            <div class="info-text">
              ${job.customer_snapshot?.address || 'No Address'}<br>
              ${job.customer_snapshot?.email || ''}<br>
              ${job.customer_snapshot?.phone || ''}
            </div>
          </div>
          <div class="col">
            <div class="col-label">Job Details</div>
            <div class="info-text">
              <strong>Date:</strong> ${dateStr}<br>
              <strong>Time:</strong> ${timeStr}<br>
              <strong>Type:</strong> Standard Service
            </div>
          </div>
        </div>

        <table class="job-table">
          <thead>
            <tr>
              <th class="desc-cell">Description</th>
              <th>Status</th>
              <th class="price-cell">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style="font-weight: 600; font-size: 14px; color: #0f172a;">${job.title}</div>
                ${job.notes ? `<div class="notes-box">Note: ${job.notes}</div>` : ''}
              </td>
              <td style="font-size: 13px; color: #64748B; padding-top: 18px;">${statusText}</td>
              <td class="price-cell" style="padding-top: 18px;">£${(job.price || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row">
              <span>Subtotal</span>
              <span>£${(job.price || 0).toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Tax (0%)</span>
              <span>£0.00</span>
            </div>
            <div class="total-row grand-total">
              <span>Total Due</span>
              <span>£${(job.price || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${photoUrls.length > 0 ? `
          <div style="margin-top: 20px;">
            <div class="section-title">Site Photos</div>
            <div class="photo-grid">
              ${photoUrls.map(url => `
                <div class="photo-frame">
                  <img src="${url}" class="photo-img" />
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="footer-row">
          <div class="sig-box">
            <div class="col-label">Client Signature</div>
            ${job.signature 
              ? `<img src="${job.signature}" class="sig-img" />` 
              : '<div style="height: 40px;"></div>'
            }
            <div class="sig-line"></div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 5px;">Signed by ${job.customer_snapshot?.name || 'Client'}</div>
          </div>

          <div class="sig-box">
             <div class="col-label">Authorised By</div>
             <div style="height: 40px;"></div>
             <div class="sig-line"></div>
             <div style="font-size: 10px; color: #94a3b8; margin-top: 5px;">${companyData.name}</div>
          </div>
        </div>

        <div class="footer-text">
          Thank you for your business. Payment is due within 14 days.<br>
          Generated by TradeFlow
        </div>

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