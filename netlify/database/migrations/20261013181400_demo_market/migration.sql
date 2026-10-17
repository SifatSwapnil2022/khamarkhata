-- Demo farm: milking cows, heifers and breeding bulls for sale, plus a few buyer inquiries,
-- so the marketplace has more than Qurbani bulls in it. Rows reference animals by tag.
INSERT INTO "listings" ("farm_id", "animal_id", "slug", "category", "title", "description", "price_tk", "negotiable", "district", "status", "published_at")
SELECT a.farm_id, a.id, v.slug, v.category::listing_category, v.title, v.description, v.price, v.negotiable, 'Sirajganj', 'active', now() - (v.age || ' days')::interval
FROM (VALUES
  ('D-056', 'd-056-rupa-shonali', 'milking_cow', 'Rupa — HF × Local, 11 L a day, pregnant', 'Second lactation, calm in the parlour, milked by hand and machine. Confirmed pregnant by our vet. Full milk record for 90 days is on this page.', 210000, true, 2),
  ('D-038', 'd-038-shorot-shonali', 'milking_cow', 'Shorot — Sahiwal × Local, about 10 L a day', 'Hardy Sahiwal cross that handles the heat well. Good feet, easy calver. Selling to make room for heifers.', 175000, true, 4),
  ('D-040', 'd-040-ahladi-shonali', 'milking_cow', 'Ahladi — HF × Local, 8–9 L a day', 'Steady milker, no mastitis on record. Vaccinated and dewormed on schedule.', 160000, true, 6),
  ('D-017', 'd-017-jui-shonali', 'milking_cow', 'Jui — HF × Local, in milk and pregnant', 'Pregnant again, still giving about 8 L. Good for a family that wants milk now and a calf next year.', 150000, true, 9),
  ('C-029', 'c-029-heifer-shonali', 'heifer', 'HF × Local heifer, 11 months, 185 kg', 'Born on our farm. Mother and AI sire are on record. Growing well on Napier and calf starter.', 85000, true, 3),
  ('C-030', 'c-030-heifer-shonali', 'heifer', 'HF × Local heifer, 10 months, 184 kg', 'Born here, weighed monthly since birth. Ready to breed at about 15 months.', 82000, true, 5),
  ('B-010', 'b-010-kalu-shonali', 'breeding_bull', 'Kalu — HF × Local breeding bull, 566 kg', 'Proven bull with calves on the ground. Quiet to handle. Selling to avoid breeding his own daughters.', 300000, true, 7),
  ('B-009', 'b-009-sindhu-shonali', 'breeding_bull', 'Sindhu — Red Sindhi bull, 517 kg', 'Red Sindhi for heat tolerance and milk. Good libido, sound feet.', 280000, true, 12)
) AS v(tag, slug, category, title, description, price, negotiable, age)
JOIN "animals" a ON a.tag = v.tag
JOIN "farms" f ON f.id = a.farm_id AND f.name LIKE '%(demo)';
--> statement-breakpoint
INSERT INTO "inquiries" ("listing_id", "name", "phone", "message", "status", "created_at")
SELECT l.id, v.name, v.phone, v.message, v.status::inquiry_status, now() - (v.hours || ' hours')::interval
FROM (VALUES
  ('d-056-rupa-shonali', 'Abdul Karim', '+8801800000011', 'Is the price fixed? I can come to Shahjadpur on Friday to see her milked.', 'new', 5),
  ('d-056-rupa-shonali', 'Nasrin Sultana', '+8801800000012', 'How many months pregnant is she?', 'replied', 30),
  ('c-029-heifer-shonali', 'Mizanur Rahman', '+8801800000013', 'Would you sell both heifers together?', 'new', 9),
  ('b-010-kalu-shonali', 'Faruk Hossain', '+8801800000014', 'We run 20 cows in Ullapara. Can you send a video of the bull walking?', 'new', 20),
  ('d-038-shorot-shonali', 'Sumon Ahmed', '+8801800000015', NULL, 'closed', 70)
) AS v(slug, name, phone, message, status, hours)
JOIN "listings" l ON l.slug = v.slug;
--> statement-breakpoint
-- Qurbani buyers ask early: a few questions on the bulls already listed.
INSERT INTO "inquiries" ("listing_id", "name", "phone", "message", "status", "created_at")
SELECT l.id, v.name, v.phone, v.message, v.status::inquiry_status, now() - (v.hours || ' hours')::interval
FROM (
  SELECT id, row_number() OVER (ORDER BY price_tk DESC) AS rn FROM "listings" WHERE category = 'qurbani'
) l
JOIN (VALUES
  (1, 'Rafiqul Islam', '+8801800000021', 'Can you keep him until Eid and deliver to Dhaka? What would delivery cost?', 'new', 2),
  (2, 'Tanvir Hasan', '+8801800000022', 'Seven of us are sharing. Is the final weight guaranteed?', 'replied', 48),
  (3, 'Shahidul Alam', '+8801800000023', 'Price for cash today?', 'new', 12)
) AS v(rn, name, phone, message, status, hours) ON v.rn = l.rn;
