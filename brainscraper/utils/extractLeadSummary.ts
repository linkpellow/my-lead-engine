/**
 * Lead Summary Extraction Utilities
 * Extracts and formats lead summaries for export
 */

export interface LeadSummary {
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  company?: string;
  title?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  age?: number | string;
  income?: string;
  dateScraped?: string;
  dncStatus?: string;
  dncLastChecked?: string;
  canContact?: boolean;
  dncReason?: string;
  lineType?: string;
  carrier?: string;
  dobOrAge?: string;
  [key: string]: any;
}

// Overload for single row
export function extractLeadSummary(
  row: Record<string, any>, 
  enriched?: Record<string, any>, 
  dncData?: { canContact?: boolean; reason?: string }
): LeadSummary;

// Overload for array of rows
export function extractLeadSummary(rows: Record<string, any>[]): LeadSummary[];

// Implementation
export function extractLeadSummary(
  rowOrRows: Record<string, any> | Record<string, any>[],
  enriched?: Record<string, any>,
  dncData?: { canContact?: boolean; reason?: string }
): LeadSummary | LeadSummary[] {
  // Handle array case
  if (Array.isArray(rowOrRows)) {
    return rowOrRows.map(row => extractSingleLeadSummary(row));
  }
  
  // Handle single row case
  return extractSingleLeadSummary(rowOrRows, enriched, dncData);
}

function extractSingleLeadSummary(
  row: Record<string, any>,
  enriched?: Record<string, any>,
  dncData?: { canContact?: boolean; reason?: string }
): LeadSummary {
  // Extract phone - check row first, then enriched
  const phone = row['Phone'] || row['phone'] || row['Phone Number'] || row['PhoneNumber'] || 
                row['phone_number'] || row['Mobile'] || row['mobile'] || 
                row['Primary Phone'] || row['PrimaryPhone'] || 
                enriched?.phone || '';
  
  // Extract email - check row first, then enriched
  const email = row['Email'] || row['email'] || row['Email Address'] || row['EmailAddress'] || 
                row['email_address'] || row['Primary Email'] || row['PrimaryEmail'] || 
                enriched?.email || '';
  
  // Extract name
  const name = row['Name'] || row['name'] || row['Full Name'] || row['FullName'] || 
               row['full_name'] || row['fullName'] || 
               `${row['First Name'] || row['firstName'] || row['first_name'] || ''} ${row['Last Name'] || row['lastName'] || row['last_name'] || ''}`.trim() || 
               'Unknown';
  
  // Extract location
  const city = row['City'] || row['city'] || enriched?.city || '';
  const state = row['State'] || row['state'] || enriched?.state || '';
  const zipcode = row['Zipcode'] || row['zipcode'] || row['Zip Code'] || row['ZipCode'] || 
                  row['zip_code'] || row['Postal Code'] || row['PostalCode'] || 
                  row['postal_code'] || enriched?.zipcode || '';
  const location = row['Location'] || row['location'] || 
                   (city && state ? `${city}, ${state}` : '') || '';
  
  // Extract company and title
  const company = row['Company'] || row['company'] || row['Company Name'] || row['CompanyName'] || 
                  row['company_name'] || enriched?.company || '';
  const title = row['Title'] || row['title'] || row['Job Title'] || row['JobTitle'] || 
                row['job_title'] || enriched?.title || '';
  
  // Build summary
  const summary: LeadSummary = {
    name,
    phone: phone ? String(phone).replace(/\D/g, '').length >= 10 ? String(phone) : '' : '',
    email: email && email.includes('@') ? String(email) : '',
    location: location || (city && state ? `${city}, ${state}` : ''),
    company,
    title,
    city,
    state,
    zipcode,
    ...row,
  };
  
  // Add enriched data if available
  if (enriched) {
    if (enriched.phone && !summary.phone) {
      const enrichedPhone = String(enriched.phone).replace(/\D/g, '');
      if (enrichedPhone.length >= 10) {
        summary.phone = enriched.phone;
      }
    }
    if (enriched.email && !summary.email) {
      summary.email = enriched.email;
    }
    if (enriched.age) summary.age = enriched.age;
    if (enriched.income) summary.income = enriched.income;
    if (enriched.dobOrAge) summary.dobOrAge = enriched.dobOrAge;
    if (enriched.lineType) summary.lineType = enriched.lineType;
    if (enriched.carrier) summary.carrier = enriched.carrier;
  }
  
  // Add DNC data if available
  if (dncData) {
    summary.canContact = dncData.canContact;
    summary.dncReason = dncData.reason;
  }
  
  return summary;
}

export function leadSummariesToCSV(summaries: LeadSummary[]): string {
  if (summaries.length === 0) return '';
  
  const headers = Object.keys(summaries[0]);
  const csvRows = [
    headers.join(','),
    ...summaries.map(summary => 
      headers.map(header => {
        const value = summary[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape commas and quotes
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    ),
  ];
  
  return csvRows.join('\n');
}

export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}