// Event model interfaces for Prisma/PostgreSQL

export interface Event {
  id: number;
  name: string;
  description?: string | null;
  date: Date;
  time?: string | null;
  venue: string;
  price: number;
  capacity: number;
  ticketsSold: number;
  image?: string | null;
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventWithAdmin extends Event {
  admin: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateEventInput {
  name: string;
  description?: string;
  date: Date;
  time?: string;
  venue: string;
  price: number;
  capacity: number;
  image?: string;
  createdBy: number;
}

export interface UpdateEventInput {
  name?: string;
  description?: string;
  date?: Date;
  time?: string;
  venue?: string;
  price?: number;
  capacity?: number;
  image?: string;
  isActive?: boolean;
}

export interface EventFilters {
  search?: string;
  sortBy?: 'date' | 'price-low' | 'price-high' | 'newest';
  isActive?: boolean;
}

export interface EventResponse {
  id: number;
  name: string;
  description?: string | null;
  date: Date;
  time?: string | null;
  venue: string;
  price: number;
  capacity: number;
  ticketsSold: number;
  image?: string | null;
  createdBy: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
