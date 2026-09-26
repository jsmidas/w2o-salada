-- CreateEnum
CREATE TYPE "RouteOwnership" AS ENUM ('OWN', 'OUTSOURCED');

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "lastRouteId" TEXT;

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "routeId" TEXT;

-- CreateTable
CREATE TABLE "delivery_routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driverUserId" TEXT,
    "vehicleNo" TEXT,
    "ownership" "RouteOwnership" NOT NULL DEFAULT 'OWN',
    "maxStops" INTEGER NOT NULL DEFAULT 100,
    "departOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "memo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_routes_name_key" ON "delivery_routes"("name");

-- CreateIndex
CREATE INDEX "deliveries_routeId_scheduledDate_idx" ON "deliveries"("routeId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_lastRouteId_fkey" FOREIGN KEY ("lastRouteId") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_driverUserId_fkey" FOREIGN KEY ("driverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS (다른 테이블과 동일하게 기본 거부)
ALTER TABLE "public"."delivery_routes" ENABLE ROW LEVEL SECURITY;
