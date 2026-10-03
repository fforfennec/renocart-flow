GRANT INSERT, UPDATE, DELETE ON public.suppliers, public.supplier_branches, public.supplier_contacts TO anon;
CREATE POLICY "Anon can write suppliers (test mode)" ON public.suppliers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can write branches (test mode)" ON public.supplier_branches FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can write contacts (test mode)" ON public.supplier_contacts FOR ALL TO anon USING (true) WITH CHECK (true);