export type Address = {
  id: string;
  address: string;
  city?: string;
  addressCategory?: number; // 1 = home, 2 = work, 3/4 = others
  name?: string;
};

export type PublicData = {
  address: Address[];
};

export type TierCode = 'PURE_BRED_MALLU' | 'MALLU_EXPLORER' | 'WEEKEND_MALLU' | 'NON_MALLU';

export type VerificationResult = {
  isMallu: boolean;
  score: number;
  tierCode: TierCode;
  tierLabel: string;
  displayName: string;
  keralaAddressCount: number;
  totalAddressCount: number;
};

