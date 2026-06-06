export interface Contact {
  id: number;
  clinic: number;
  contact_number: string;
  contact_type: 'DOCTOR' | 'PRACTITIONER' | 'CLINIC' | 'LABORATORY' | 'PHARMACY' | 'SUPPLIER' | 'OTHER';
  contact_type_display: string;
  custom_contact_type?: string;
  
  // Personal/Organization Info
  first_name: string;
  last_name: string;
  middle_name?: string;
  full_name: string;
  organization_name?: string;
  
  // Professional Info
  specialty?: string;
  license_number?: string;
  
  // Contact Details
  email?: string;
  phone: string;
  alternative_phone?: string;
  
  // Address
  address: string;
  city: string;
  province: string;
  postal_code?: string;
  
  // Additional Info
  notes?: string;
  website?: string;
  
  // Status
  is_active: boolean;
  is_preferred: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateContactData {
  clinic: number;
  contact_type: 'DOCTOR' | 'PRACTITIONER' | 'CLINIC' | 'LABORATORY' | 'PHARMACY' | 'SUPPLIER' | 'OTHER';
  custom_contact_type?: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  organization_name?: string;
  specialty?: string;
  license_number?: string;
  email?: string;
  phone: string;
  alternative_phone?: string;
  address: string;
  city: string;
  province: string;
  postal_code?: string;
  notes?: string;
  website?: string;
  is_active?: boolean;
  is_preferred?: boolean;
}

export interface ContactStats {
  total: number;
  active: number;
  inactive: number;
  by_type: {
    [key: string]: {
      label: string;
      count: number;
    };
  };
}