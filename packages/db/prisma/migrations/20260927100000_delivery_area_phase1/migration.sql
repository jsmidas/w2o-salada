-- CreateEnum
CREATE TYPE "DropLocation" AS ENUM ('DOOR', 'SECURITY_OFFICE', 'PARCEL_BOX', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryAreaStatus" AS ENUM ('UNKNOWN', 'IN_RANGE', 'OUT_OF_RANGE');

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "apartmentId" TEXT,
ADD COLUMN     "areaStatus" "DeliveryAreaStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "bname" TEXT,
ADD COLUMN     "buildingName" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "dropLocation" "DropLocation" NOT NULL DEFAULT 'DOOR',
ADD COLUMN     "dropNote" TEXT,
ADD COLUMN     "entranceMethod" TEXT,
ADD COLUMN     "entrancePassword" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "geocodedAt" TIMESTAMP(3),
ADD COLUMN     "isApartment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jibunAddress" TEXT,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "roadAddress" TEXT,
ADD COLUMN     "sido" TEXT,
ADD COLUMN     "sigungu" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryHoldNote" TEXT,
ADD COLUMN     "deliveryHoldReason" TEXT,
ADD COLUMN     "deliveryHoldResolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "addressId" TEXT;

-- CreateTable
CREATE TABLE "apartments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "address" TEXT,
    "sigungu" TEXT,
    "bname" TEXT,
    "households" INTEGER,
    "dongCount" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "isServiced" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apartments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apartments_sigungu_bname_idx" ON "apartments"("sigungu", "bname");

-- CreateIndex
CREATE INDEX "apartments_name_idx" ON "apartments"("name");

-- CreateIndex
CREATE INDEX "addresses_sigungu_bname_idx" ON "addresses"("sigungu", "bname");

-- CreateIndex
CREATE INDEX "addresses_buildingName_idx" ON "addresses"("buildingName");

-- CreateIndex
CREATE INDEX "addresses_areaStatus_idx" ON "addresses"("areaStatus");

-- CreateIndex
CREATE INDEX "orders_deliveryHold_idx" ON "orders"("deliveryHold");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

