/**
 * Pricing tool — lógica estática de sugestão de preço.
 * Migrado de ai-tools.ts original.
 */
export function executeSuggestPrice(args: any) {
  const service = args.service_name.toLowerCase();
  const region = args.region_type.toLowerCase();

  let basePrice = 50;

  if (service.includes("manicure")) basePrice = 45;
  if (service.includes("pedicure")) basePrice = 55;
  if (service.includes("nail art")) basePrice = 90;
  if (service.includes("unha") && service.includes("gel")) basePrice = 120;
  if (service.includes("corte")) basePrice = 60;
  if (service.includes("escova")) basePrice = 60;
  if (service.includes("hidratação") || service.includes("hidratacao")) basePrice = 80;
  if (service.includes("penteado")) basePrice = 120;
  if (service.includes("progressiva") || service.includes("botox capilar")) basePrice = 180;
  if (service.includes("luzes")) basePrice = 200;
  if (service.includes("platinado")) basePrice = 200;
  if (service.includes("coloração") || service.includes("mechas")) basePrice = 250;
  if (service.includes("design") && service.includes("sobrancelha")) basePrice = 50;
  if (service.includes("maquiagem")) basePrice = 150;
  if (service.includes("sobrancelha") && service.includes("micro")) basePrice = 450;
  if (service.includes("depilação") || service.includes("depilacao")) basePrice = 80;
  if (service.includes("massagem")) basePrice = 120;
  if (service.includes("spa") && (service.includes("pé") || service.includes("pe"))) basePrice = 70;
  if (service.includes("lash") || service.includes("cílios") || service.includes("cilios")) basePrice = 180;
  if (service.includes("alongamento") && (service.includes("cílios") || service.includes("cilios"))) basePrice = 250;
  if (service.includes("barba")) basePrice = 40;
  if (service.includes("trança") || service.includes("tranca")) basePrice = 100;

  let multiplier = 1;
  if (region.includes("nobre") || region.includes("shopping")) multiplier = 1.6;
  if (region.includes("popular") || region.includes("interior")) multiplier = 0.8;
  if (region.includes("centro")) multiplier = 1.1;

  const suggestedPrice = Math.round(basePrice * multiplier);
  const minPrice = Math.round(suggestedPrice * 0.85);
  const maxPrice = Math.round(suggestedPrice * 1.25);

  return {
    success: true,
    action_type: "PRICE_SUGGESTION",
    service: args.service_name,
    suggested_price: suggestedPrice,
    range: `R$ ${minPrice} até R$ ${maxPrice}`,
    justification: `Estimativa para '${args.service_name}' em região '${args.region_type}'. Faixa: R$${minPrice}–R$${maxPrice}. Ajuste conforme sua experiência e concorrência local.`,
    disclaimer: "Valores estimados com base em referências de mercado.",
  };
}
