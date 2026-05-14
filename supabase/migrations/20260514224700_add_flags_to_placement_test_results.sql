-- Add flags column to placement_test_results for behavioral detection
ALTER TABLE placement_test_results 
ADD COLUMN IF NOT EXISTS flags text[] DEFAULT '{}';
