type OpenStockInput = {
  physicalStock: number | null | undefined;
  beachStock: number | null | undefined;
  openingQuantity: number | null | undefined;
};

type CloseStockInput = {
  physicalStock: number | null | undefined;
  beachStock: number | null | undefined;
};

export function shouldTrackStock(value: unknown) {
  return value === true;
}

export function openBeachStockFromPhysical(input: OpenStockInput) {
  const physicalStock = toStock(input.physicalStock);
  const openingQuantity = toStock(input.openingQuantity);
  const movedQuantity = Math.min(physicalStock, openingQuantity);

  return {
    physicalStock: physicalStock - movedQuantity,
    beachStock: movedQuantity,
    blockedByStock: movedQuantity <= 0,
  };
}

export function closeBeachStockToPhysical(input: CloseStockInput) {
  const physicalStock = toStock(input.physicalStock);
  const beachStock = toStock(input.beachStock);

  return {
    physicalStock: physicalStock + beachStock,
    beachStock: 0,
    blockedByStock: true,
  };
}

export function toStock(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}
