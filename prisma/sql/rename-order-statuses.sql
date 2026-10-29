-- One-time: rename order statuses, keeping every existing order's status.
--   PROCESSING -> CONFIRMED
--   SHIPPED    -> IN_COURIER
-- Run ONCE, before `npm run push`:
--   npx prisma db execute --file prisma/sql/rename-order-statuses.sql
ALTER TYPE "OrderStatus" RENAME VALUE 'PROCESSING' TO 'CONFIRMED';
ALTER TYPE "OrderStatus" RENAME VALUE 'SHIPPED' TO 'IN_COURIER';
