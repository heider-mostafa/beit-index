-- Bank Data Marketplace
--
-- Banks can browse and purchase access to anonymized completed appraisal reports.
-- Supports bulk checkout with volume discounts.

-- ============================================================================
-- REPORT LISTINGS TABLE (Anonymized marketplace view)
-- ============================================================================

CREATE TABLE report_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_request_id UUID NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,

  -- Anonymized property info (copied from job, sanitized)
  property_type TEXT NOT NULL,
  governorate_id UUID REFERENCES governorates(id),
  city_id UUID REFERENCES cities(id),
  district_id UUID REFERENCES districts(id),
  approximate_area INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  report_kind TEXT NOT NULL,

  -- Appraiser info (public)
  appraiser_id UUID NOT NULL REFERENCES users(id),

  -- Valuation summary (visible after purchase)
  valuation_amount_piasters BIGINT,

  -- Pricing
  listing_price_piasters INTEGER NOT NULL DEFAULT 50000, -- 500 EGP default

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  listed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one listing per job
  UNIQUE(job_request_id)
);

-- Indexes for filtering
CREATE INDEX idx_report_listings_active ON report_listings(is_active) WHERE is_active = true;
CREATE INDEX idx_report_listings_filters ON report_listings(property_type, governorate_id, city_id, is_active);
CREATE INDEX idx_report_listings_appraiser ON report_listings(appraiser_id);
CREATE INDEX idx_report_listings_date ON report_listings(listed_at DESC);

-- ============================================================================
-- VOLUME DISCOUNT CONFIGURATION
-- ============================================================================

CREATE TABLE bank_volume_discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  min_quantity INTEGER NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(min_quantity)
);

-- Seed default volume discounts
INSERT INTO bank_volume_discounts (min_quantity, discount_percent) VALUES
  (10, 15.00),
  (25, 25.00),
  (50, 35.00);

-- ============================================================================
-- BANK CART (Pre-checkout shopping cart)
-- ============================================================================

CREATE TABLE bank_cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES report_listings(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One listing per bank cart
  UNIQUE(bank_account_id, listing_id)
);

CREATE INDEX idx_bank_cart_account ON bank_cart_items(bank_account_id);

-- ============================================================================
-- BANK PURCHASES (Completed orders)
-- ============================================================================

CREATE TABLE bank_report_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  purchased_by UUID NOT NULL REFERENCES users(id),

  -- Payment details
  item_count INTEGER NOT NULL DEFAULT 0,
  subtotal_piasters BIGINT NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount_piasters BIGINT NOT NULL DEFAULT 0,
  total_piasters BIGINT NOT NULL,

  -- Paymob integration
  paymob_order_id TEXT,
  paymob_transaction_id TEXT,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, refunded

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_purchases_account ON bank_report_purchases(bank_account_id, created_at DESC);
CREATE INDEX idx_bank_purchases_status ON bank_report_purchases(status);

-- ============================================================================
-- PURCHASE LINE ITEMS (Individual reports in a purchase)
-- ============================================================================

CREATE TABLE bank_purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES bank_report_purchases(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES report_listings(id),
  price_piasters INTEGER NOT NULL, -- Price at time of purchase
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- No duplicate listings in same purchase
  UNIQUE(purchase_id, listing_id)
);

CREATE INDEX idx_bank_purchase_items_purchase ON bank_purchase_items(purchase_id);
CREATE INDEX idx_bank_purchase_items_listing ON bank_purchase_items(listing_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE report_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_volume_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_report_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_purchase_items ENABLE ROW LEVEL SECURITY;

-- Report listings: Banks can view active listings
CREATE POLICY report_listings_bank_read ON report_listings
  FOR SELECT USING (
    is_active = true
    AND current_user_role() IN ('bank', 'admin')
  );

-- Report listings: Admins have full access
CREATE POLICY report_listings_admin ON report_listings
  FOR ALL USING (current_user_role() = 'admin');

-- Volume discounts: Anyone can read active discounts
CREATE POLICY volume_discounts_read ON bank_volume_discounts
  FOR SELECT USING (is_active = true);

-- Volume discounts: Admins can manage
CREATE POLICY volume_discounts_admin ON bank_volume_discounts
  FOR ALL USING (current_user_role() = 'admin');

-- Cart: Bank users can manage their own cart
CREATE POLICY cart_bank_access ON bank_cart_items
  FOR ALL USING (
    bank_account_id IN (
      SELECT bank_account_id FROM bank_users
      WHERE user_id = (SELECT id FROM users WHERE auth_id = current_user_id())
    )
  );

-- Purchases: Bank users can view their own purchases
CREATE POLICY purchases_bank_read ON bank_report_purchases
  FOR SELECT USING (
    bank_account_id IN (
      SELECT bank_account_id FROM bank_users
      WHERE user_id = (SELECT id FROM users WHERE auth_id = current_user_id())
    )
  );

-- Purchases: Admins have full access
CREATE POLICY purchases_admin ON bank_report_purchases
  FOR ALL USING (current_user_role() = 'admin');

-- Purchase items: Bank users can view their own purchase items
CREATE POLICY purchase_items_bank_read ON bank_purchase_items
  FOR SELECT USING (
    purchase_id IN (
      SELECT id FROM bank_report_purchases
      WHERE bank_account_id IN (
        SELECT bank_account_id FROM bank_users
        WHERE user_id = (SELECT id FROM users WHERE auth_id = current_user_id())
      )
    )
  );

-- Purchase items: Admins have full access
CREATE POLICY purchase_items_admin ON bank_purchase_items
  FOR ALL USING (current_user_role() = 'admin');

-- ============================================================================
-- AUTO-LIST COMPLETED JOBS TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_list_completed_report()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when job transitions to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Only list if there's an assigned appraiser
    IF NEW.assigned_appraiser_id IS NOT NULL THEN
      INSERT INTO report_listings (
        job_request_id,
        property_type,
        governorate_id,
        city_id,
        district_id,
        approximate_area,
        bedrooms,
        bathrooms,
        report_kind,
        appraiser_id,
        listing_price_piasters
      ) VALUES (
        NEW.id,
        NEW.property_type,
        NEW.governorate_id,
        NEW.city_id,
        NEW.district_id,
        NEW.approximate_area,
        NEW.bedrooms,
        NEW.bathrooms,
        NEW.report_kind,
        NEW.assigned_appraiser_id,
        50000  -- Default 500 EGP, admin can adjust
      )
      ON CONFLICT (job_request_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_list_report
  AFTER UPDATE ON job_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_list_completed_report();

-- ============================================================================
-- HELPER FUNCTION: Calculate volume discount
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_volume_discount(p_quantity INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  v_discount NUMERIC(5,2) := 0;
BEGIN
  SELECT discount_percent INTO v_discount
  FROM bank_volume_discounts
  WHERE min_quantity <= p_quantity
    AND is_active = true
  ORDER BY min_quantity DESC
  LIMIT 1;

  RETURN COALESCE(v_discount, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- HELPER FUNCTION: Check if bank has purchased a listing
-- ============================================================================

CREATE OR REPLACE FUNCTION bank_has_purchased_listing(
  p_bank_account_id UUID,
  p_listing_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM bank_purchase_items pi
    JOIN bank_report_purchases p ON p.id = pi.purchase_id
    WHERE p.bank_account_id = p_bank_account_id
      AND pi.listing_id = p_listing_id
      AND p.status = 'completed'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS: Updated_at
-- ============================================================================

CREATE TRIGGER report_listings_updated_at
  BEFORE UPDATE ON report_listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER bank_volume_discounts_updated_at
  BEFORE UPDATE ON bank_volume_discounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER bank_report_purchases_updated_at
  BEFORE UPDATE ON bank_report_purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE report_listings IS 'Anonymized marketplace listings of completed appraisal reports available for bank purchase';
COMMENT ON TABLE bank_volume_discounts IS 'Volume discount tiers for bulk report purchases';
COMMENT ON TABLE bank_cart_items IS 'Shopping cart for bank report purchases';
COMMENT ON TABLE bank_report_purchases IS 'Completed purchase orders from banks';
COMMENT ON TABLE bank_purchase_items IS 'Individual report items within a purchase order';
COMMENT ON FUNCTION calculate_volume_discount IS 'Returns applicable discount percentage based on quantity';
COMMENT ON FUNCTION bank_has_purchased_listing IS 'Checks if a bank has purchased access to a specific listing';
