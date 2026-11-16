"use strict";

(() => {
  const moneyPattern = /(?<![\p{L}\d.,])(?:\$\s*)?(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{3,}(?:,\d{1,2})?|\d{1,3}(?:,\d{1,2})?)(?![\p{L}\d])/gu;
  const promoWords = ["promo", "oferta", "descuento", "ahorro", "lleva", "2x", "3x", "segunda unidad"];
  const unitWords = ["/kg", "por kg", "precio x kg", "precio por kilo", "/kilo", "por kilo", "/lt", "$/l", "por litro", "precio x litro", "precio por litro", "por 100 g", "por 100ml"];
  const retailWords = ["precio regular", "precio venta", "precio unitario", "venta al público", "venta al publico", "pvp", "precio final", "contado"];
  const wholesaleWords = ["mayorista", "por bulto", "precio por caja", "precio por pack"];

  function parseARS(raw) {
    let value = raw.trim().replace(/\$/g, "").replace(/\s/g, "");
    if (!value) return null;
    if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
    else if (/\.\d{3}$/.test(value)) value = value.replace(/\./g, "");
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
    const [whole, fraction = ""] = value.split(".");
    const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
    return Number.isSafeInteger(cents) ? cents : null;
  }

  function formatARS(cents) {
    const amount = BigInt(Math.round(cents));
    const whole = amount / 100n;
    const fraction = String(amount % 100n).padStart(2, "0");
    return `$ ${whole.toLocaleString("es-AR")},${fraction}`;
  }

  function parseQuantity(value) {
    const normalized = String(value).trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) return null;
    const [whole, fraction = ""] = normalized.split(".");
    const milli = Number(whole) * 1000 + Number((fraction + "000").slice(0, 3));
    return Number.isSafeInteger(milli) && milli > 0 ? milli : null;
  }

  function subtotalCents(priceCents, quantityMilli) {
    return Math.floor((priceCents * quantityMilli + 500) / 1000);
  }

  function parseLines(lines) {
    const allText = lines.map(line => line.text).join(" ").toLowerCase();
    const candidates = [];
    for (const line of lines) {
      for (const match of line.text.matchAll(moneyPattern)) {
        const raw = match[0], digits = raw.replace(/\D/g, "").length;
        if (!raw.includes("$") && !raw.includes(",") && digits < 3) continue;
        const after = line.text.slice(match.index + raw.length);
        if (/^\s*(?:kg|kilo|gr|g\b|ml|lt|l\b|un\b|u\b|cm|%)/i.test(after)) continue;
        const cents = parseARS(raw);
        if (cents === null || cents <= 0) continue;
        const nearby = lines.filter(other => other !== line && Math.abs(other.y - line.y) < .13).map(other => other.text).join(" ");
        const context = `${line.text} ${nearby}`.toLowerCase();
        const promo = promoWords.some(word => context.includes(word));
        const unit = unitWords.some(word => context.includes(word));
        const retail = retailWords.some(word => context.includes(word));
        const wholesale = wholesaleWords.some(word => context.includes(word));
        let score = line.confidence * .45;
        if (retail) score += .3;
        if (promo) score += .12;
        if (unit) score -= .55;
        if (wholesale) score -= .45;
        if (line.y > .12 && line.y < .9) score += .08;
        if (allText.includes("precio") && !unit) score += .06;
        candidates.push({ cents, source: line.text, promo, unit, retail, wholesale, confidence: Math.max(0, Math.min(1, score)) });
      }
    }
    const unique = candidates.filter((price, index) => candidates.findIndex(other => other.cents === price.cents && other.source === price.source) === index).sort((a, b) => b.confidence - a.confidence);
    const names = lines.map(line => line.text.replace(moneyPattern, "").replace(/^[\s$:\-|]+|[\s$:\-|]+$/g, "").trim())
      .filter(text => /\p{L}/u.test(text) && ![...promoWords, ...unitWords, ...retailWords, ...wholesaleWords].some(word => text.toLowerCase().includes(word)))
      .sort((a, b) => b.length - a.length);
    const first = unique[0];
    const confident = first && (first.confidence >= .72 || unique.length === 1) && !first.unit && !first.wholesale && !(first.promo && !first.retail);
    return { name: names[0] || "", prices: unique, suggestedPriceIndex: confident ? 0 : null };
  }

  window.MiCompraParser = { parseARS, formatARS, parseQuantity, subtotalCents, parseLines };
})();
