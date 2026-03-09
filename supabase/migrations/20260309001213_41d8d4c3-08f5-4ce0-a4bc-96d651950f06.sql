-- ============================================
-- RenoCart Delivery Management Platform Schema
-- ============================================

-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'supplier');
CREATE TYPE public.supplier_type AS ENUM ('material', 'delivery');

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  supplier_type public.supplier_type,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER ROLES TABLE (separate from profiles)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECK
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_address TEXT NOT NULL,
  client_phone TEXT,
  delivery_date DATE NOT NULL,
  delivery_time_window TEXT NOT NULL,
  truck_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'fulfilled', 'cancelled')),
  internal_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  client_note TEXT,
  sort_order INTEGER DEFAULT 0
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SUPPLIER ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE public.supplier_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_type public.supplier_type NOT NULL DEFAULT 'material',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(order_id, supplier_id)
);

ALTER TABLE public.supplier_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SUPPLIER RESPONSES TABLE
-- ============================================
CREATE TABLE public.supplier_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.supplier_assignments(id) ON DELETE CASCADE,
  can_deliver_truck BOOLEAN,
  alternative_truck TEXT,
  can_deliver_date BOOLEAN,
  alternative_date DATE,
  can_deliver_time BOOLEAN,
  alternative_time TEXT,
  supplier_general_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  responded_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

ALTER TABLE public.supplier_responses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ITEM RESPONSES TABLE
-- ============================================
CREATE TABLE public.item_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID NOT NULL REFERENCES public.supplier_responses(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  can_fulfill BOOLEAN DEFAULT true,
  supplier_note TEXT,
  UNIQUE(response_id, item_id)
);

ALTER TABLE public.item_responses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Orders policies
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Suppliers can view assigned orders" ON public.orders FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.supplier_assignments sa
    WHERE sa.order_id = id AND sa.supplier_id = auth.uid()
  )
);

-- Order items policies
CREATE POLICY "Admins can manage all order items" ON public.order_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Suppliers can view assigned order items" ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.supplier_assignments sa
    WHERE sa.order_id = order_id AND sa.supplier_id = auth.uid()
  )
);

-- Supplier assignments policies
CREATE POLICY "Admins can manage all assignments" ON public.supplier_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Suppliers can view own assignments" ON public.supplier_assignments FOR SELECT USING (supplier_id = auth.uid());

-- Supplier responses policies
CREATE POLICY "Admins can view all responses" ON public.supplier_responses FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Suppliers can manage their responses" ON public.supplier_responses FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.supplier_assignments sa
    WHERE sa.id = assignment_id AND sa.supplier_id = auth.uid()
  )
);

-- Item responses policies
CREATE POLICY "Admins can view all item responses" ON public.item_responses FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Suppliers can manage their item responses" ON public.item_responses FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.supplier_responses sr
    JOIN public.supplier_assignments sa ON sa.id = sr.assignment_id
    WHERE sr.id = response_id AND sa.supplier_id = auth.uid()
  )
);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('order-documents', 'order-documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('order-photos', 'order-photos', true);

-- Storage policies
CREATE POLICY "Admins can manage order documents" ON storage.objects FOR ALL USING (bucket_id = 'order-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Suppliers can view order documents" ON storage.objects FOR SELECT USING (bucket_id = 'order-documents');
CREATE POLICY "Anyone can view photos" ON storage.objects FOR SELECT USING (bucket_id = 'order-photos');
CREATE POLICY "Admins can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'order-photos' AND public.has_role(auth.uid(), 'admin'));