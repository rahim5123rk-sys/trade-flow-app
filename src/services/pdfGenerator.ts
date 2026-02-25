import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';

// Helper interface to match what the function expects
interface JobData {
  reference: string;
  company_id: string; // Ensure your Job objects now use snake_case 'company_id'
  scheduled_date: number;
  customer_snapshot: { name: string; address: string };
  title: string;
  notes?: string;
  status: string;
  price?: number;
  photos?: string[];
  signature?: string;
}

export const generateJobSheet = async (job: JobData) => {
  // 1. Fetch Company Details (for Logo & Address) from Supabase
  let companyData: any = { name: 'TradeFlow User', address: '', email: '', phone: '' };
  
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', job.company_id)
      .single();

    if (data) {
      companyData = data;
    }
  } catch (e) {
    console.warn("Could not fetch company data for PDF", e);
  }

  const dateStr = new Date(job.scheduled_date).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Handle Logo (Supabase stores the full public URL in logo_url)
  const logoHtml = companyData.logo_url 
    ? `<img src="${companyData.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;" />` 
    : '';

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, sans-serif; padding: 40px; color: #333; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 30px; }
          .company-info { font-size: 14px; color: #555; text-align: right; }
          .brand { font-size: 24px; font-weight: bold; color: #2563EB; margin-bottom: 5px; }
          .meta { margin-top: 10px; font-size: 14px; color: #666; }
          .section { margin-bottom: 30px; }
          .label { font-size: 10px; text-transform: uppercase; color: #999; letter-spacing: 1px; margin-bottom: 5px; font-weight: bold; }
          .value { font-size: 16px; font-weight: 500; color: #000; }
          .photos { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
          .photo { width: 120px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
          .footer { margin-top: 60px; border-top: 1px solid #f0f0f0; padding-top: 20px; font-size: 12px; color: #aaa; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; gap: 15px; align-items: center;">
            ${logoHtml}
            <div>
              <div class="brand">JOB SHEET</div>
              <div style="font-weight: 600;">Ref: ${job.reference}</div>
            </div>
          </div>
          <div class="company-info">
            <div style="font-weight: bold; font-size: 16px; color: #000;">${companyData.name}</div>
            <div>${companyData.address}</div>
            <div>${companyData.email}</div>
            <div>${companyData.phone}</div>
          </div>
        </div>

        <div class="section">
          <div class="label">Customer</div>
          <div class="value" style="font-size: 18px;">${job.customer_snapshot?.name || 'Unknown'}</div>
          <div class="value" style="color: #555;">${job.customer_snapshot?.address || ''}</div>
          <div style="margin-top: 10px; color: #666; font-size: 14px;">Date: ${dateStr}</div>
        </div>

        <div class="section">
          <div class="label">Job Details</div>
          <div class="value" style="font-weight: bold; margin-bottom: 8px;">${job.title}</div>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; font-size: 14px; color: #444; border: 1px solid #e5e7eb;">
            ${job.notes || 'No notes.'}
          </div>
        </div>

        ${job.photos && job.photos.length > 0 ? `
        <div class="section">
           <div class="label">Proof of Work</div>
           <div class="photos">
             ${job.photos.map((url) => `<img src="${url}" class="photo" />`).join('')}
           </div>
        </div>
        ` : ''}

        <div class="section" style="display: flex; justify-content: space-between; align-items: flex-end;">
           <div>
             ${job.signature ? `
               <div class="label">Customer Signature</div>
               <img src="${job.signature}" style="width: 150px; height: 60px; object-fit: contain; border: 1px dashed #ccc; background: #fafafa;" />
             ` : ''}
           </div>
           
           ${job.price ? `
           <div style="text-align: right;">
             <div class="label">Total Price</div>
             <div class="value" style="font-size: 24px; color: #2563EB;">£${job.price.toFixed(2)}</div>
           </div>
           ` : ''}
        </div>
        
        <div class="footer">
          Generated by TradeFlow • ${new Date().toLocaleString()}
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};