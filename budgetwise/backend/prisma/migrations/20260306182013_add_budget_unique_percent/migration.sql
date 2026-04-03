-- RedefineIndex
DROP INDEX "Budget_user_year_month_idx";
CREATE INDEX "Budget_userId_year_month_idx" ON "Budget"("userId", "year", "month");

-- RedefineIndex
DROP INDEX "Budget_user_month_year_category_key";
CREATE UNIQUE INDEX "Budget_userId_month_year_category_key" ON "Budget"("userId", "month", "year", "category");
