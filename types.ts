
export interface TicketData {
  saldo: string;
  codigo: string;
  phone: string;
  valido?: string;
  cortesia?: boolean;
  isTokens?: boolean;
  showExtraData?: boolean;
  extraData?: string;
}

export interface PromoData {
  tipo: string;
  producto?: string;
  promo: string;
  phone: string;
  index: number;
}
