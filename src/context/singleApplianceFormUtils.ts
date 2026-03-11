import { CustomerFormData, EMPTY_CUSTOMER_FORM } from '../../components/CustomerSelector';

export function splitPropertyAddress(address?: string) {
  const parts = (address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    line1: parts[0] || '',
    line2: parts.length > 3 ? parts.slice(1, -2).join(', ') : parts[1] || '',
    city: parts.length > 2 ? parts[parts.length - 2] || '' : '',
    postCode: parts.length > 1 ? parts[parts.length - 1] || '' : '',
  };
}

export function cloneSingleApplianceList<T extends {id: string}>(appliances?: T[]): T[] {
  if (!Array.isArray(appliances) || !appliances.length) return [];

  return appliances.slice(0, 1).map((appliance, index) => ({
    ...appliance,
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  }));
}

export function mergeCustomerForm(seed?: Partial<CustomerFormData>): CustomerFormData {
  return {
    ...EMPTY_CUSTOMER_FORM,
    ...seed,
  };
}
