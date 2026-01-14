
export interface TicketData {
  saldo: string;
  codigo: string;
  phone: string;
}

export interface PromoData {
  tipo: string;
  producto?: string;
  promo: string;
  phone: string;
  index: number;
}
