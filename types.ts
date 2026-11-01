export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  SITE_NAME: string;
  SITE_URL: string;
  ADMIN_EMAIL: string;
  JWT_SECRET?: string;
  PASSWORD_PEPPER?: string;
}

export interface Admin {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: number;
}

export interface Service {
  id: number;
  slug: string;
  category: string;
  title_en: string;
  title_bn: string;
  description_en: string;
  description_bn: string;
  short_desc_en?: string;
  short_desc_bn?: string;
  icon?: string;
  price_label?: string;
  is_featured: number;
  is_active: number;
  sort_order: number;
}

export interface Project {
  id: number;
  slug: string;
  title_en: string;
  title_bn: string;
  description_en: string;
  description_bn: string;
  category: string;
  client_name?: string;
  image_url?: string;
  demo_url?: string;
  is_featured: number;
  is_active: number;
  sort_order: number;
  completed_at?: string;
}

export interface Review {
  id: number;
  customer_name: string;
  service_taken?: string;
  rating: number;
  review_text_en: string;
  review_text_bn?: string;
  is_approved: number;
  is_published: number;
  created_at: string;
}

export interface Order {
  id: number;
  reference_no: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  service_id?: number;
  service_title?: string;
  package_id?: number;
  requirements?: string;
  preferred_contact: string;
  status: string;
  admin_notes?: string;
  amount?: number;
  created_at: string;
}

export interface Package {
  id: number;
  slug: string;
  name_en: string;
  name_bn: string;
  description_en?: string;
  description_bn?: string;
  price: number;
  original_price?: number;
  currency: string;
  features_en: string;
  features_bn: string;
  is_popular: number;
  is_active: number;
  badge_en?: string;
}

export interface Post {
  id: number;
  slug: string;
  title_en: string;
  title_bn: string;
  excerpt_en?: string;
  content_en: string;
  cover_image?: string;
  status: string;
  published_at?: string;
}

export interface Message {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface FAQ {
  id: number;
  question_en: string;
  question_bn: string;
  answer_en: string;
  answer_bn: string;
  category?: string;
  sort_order: number;
}