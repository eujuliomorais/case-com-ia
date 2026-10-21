export const money = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
}).format(value || 0);

export const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value || 0);
