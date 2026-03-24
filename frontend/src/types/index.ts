export type ResourceType = 'cabinet' | 'single';
export type ResourceStatus = 'available' | 'partial' | 'full';
export type BookingStatus = 'active' | 'returned' | 'cancelled';

export interface Resource {
  id: string;
  schoolId?: string;
  type: ResourceType;
  name: string;
  classRoom: string;
  totalQuantity: number;
  description: string;
  // Derived fields returned by API
  currentBooked: number;
  availableNow: number;
  status: ResourceStatus;
  overdueBookings: number;
}

export interface Booking {
  id: string;
  resourceId: string;
  borrower: string;
  borrowerClass: string;
  quantity: number;
  startTime: string;
  endTime: string;
  actualReturnTime: string | null;
  status: BookingStatus;
  notes: string;
  isOverdue?: boolean;
}

export interface ResourceStat {
  id: string;
  name: string;
  type: ResourceType;
  classRoom: string;
  totalQuantity: number;
  currentBooked: number;
  availableNow: number;
  utilisationPct: number;
}

export interface Stats {
  totalResources: number;
  totalBookings: number;
  activeBookings: number;
  returnedBookings: number;
  cancelledBookings: number;
  fullyBookedResources: number;
  overdueBookings: number;
  totalChromebooks: number;
  resourceStats: ResourceStat[];
}

export interface CreateBookingPayload {
  resourceId: string;
  borrower: string;
  borrowerClass: string;
  quantity: number;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface CreateResourcePayload {
  type: ResourceType;
  name: string;
  classRoom: string;
  totalQuantity: number;
  description?: string;
  schoolId?: string;
}

export interface WhitelistEntry {
  email: string;
  created_by?: string | null;
  created_at?: string | null;
}
