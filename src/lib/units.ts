import { ProductUnit, UnitDimension } from "@/types/product";

export const PRODUCT_UNITS: { value: ProductUnit; label: string; dimension: UnitDimension }[] = [
  // Mass / Weight units (Fertilizers, seeds, powders)
  { value: "BAGS", label: "Bags (e.g. 50kg, 25kg)", dimension: "MASS" },
  { value: "KG", label: "Kilograms (Kg)", dimension: "MASS" },
  { value: "G", label: "Grams (g)", dimension: "MASS" },

  // Liquid / Volume units (Pesticides, liquid nutrients)
  { value: "BOTTLES", label: "Bottles (e.g. 1L, 500ml)", dimension: "VOLUME" },
  { value: "CANS", label: "Cans (e.g. 5L, 20L)", dimension: "VOLUME" },
  { value: "L", label: "Litres (L)", dimension: "VOLUME" },
  { value: "ML", label: "Millilitres (ml)", dimension: "VOLUME" },

  // Discrete / Count units (Sprayers, accessories, traps)
  { value: "BOXES", label: "Boxes", dimension: "COUNT" },
  { value: "PACKETS", label: "Packets", dimension: "COUNT" },
  { value: "PIECES", label: "Pieces (Pcs)", dimension: "COUNT" },
];

export const UNIT_DIMENSION_MAP: Record<ProductUnit, UnitDimension> = {
  BAGS: "MASS",
  KG: "MASS",
  G: "MASS",
  BOTTLES: "VOLUME",
  CANS: "VOLUME",
  L: "VOLUME",
  ML: "VOLUME",
  BOXES: "COUNT",
  PACKETS: "COUNT",
  PIECES: "COUNT",
};

/**
 * Checks if two units are dimensionally compatible for conversion.
 * Cross-dimensional conversions (e.g., converting KG to Litres without density) are rejected.
 */
export function areUnitsCompatible(primaryUnit: ProductUnit, baseUnit: ProductUnit): boolean {
  if (primaryUnit === baseUnit) {
    return true;
  }
  const primaryDim = UNIT_DIMENSION_MAP[primaryUnit];
  const baseDim = UNIT_DIMENSION_MAP[baseUnit];
  return primaryDim !== undefined && baseDim !== undefined && primaryDim === baseDim;
}

/**
 * Converts a quantity from primary unit to base unit using product's configured ratio.
 * Formula: 1 Primary = Ratio Base. (e.g., 2 Bags * 50 = 100 Kg).
 */
export function toBaseUnits(primaryQty: number, ratio: number): number {
  if (ratio <= 0) return primaryQty;
  return primaryQty * ratio;
}

/**
 * Converts a quantity from base unit to primary unit.
 * Formula: (e.g., 100 Kg / 50 = 2 Bags).
 */
export function toPrimaryUnits(baseQty: number, ratio: number): number {
  if (ratio <= 0) return baseQty;
  return baseQty / ratio;
}

/**
 * Calculates profit margin and margin percentage accurately.
 * Margin = Selling Price - Purchase Price.
 * Subsidized/clearance items with sellingPrice < purchasePrice produce negative margins accurately without errors.
 */
export function calculateMargin(
  purchasePrice: number,
  sellingPrice: number
): { margin: number; marginPercent: number } {
  const margin = Number((sellingPrice - purchasePrice).toFixed(2));
  let marginPercent = 0;
  if (purchasePrice > 0) {
    marginPercent = Number(((margin / purchasePrice) * 100).toFixed(2));
  }
  return { margin, marginPercent };
}

