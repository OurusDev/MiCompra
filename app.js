"use strict";

(() => {
  const $ = selector => document.querySelector(selector);
  const parser = window.MiCompraParser;
  const STORAGE_KEY = "mi-compra-web-v1";
  const currency = parser.formatARS;
  let state = loadState();
  let workerPromise;
  let toastTimer;
  let reviewImage = null;
  let editingId = null;
  let pendingPhoto = null;

  const els = {
    total: $("#purchase-total"), count: $("#product-count"), products: $("#products"), empty: $("#empty-state"),
    scan: $("#scan-button"), file: $("#photo-input"), review: $("#review-dialog"), history: $("#history-dialog"),
    name: $("#product-name"), price: $("#product-price"), quantity: $("#product-quantity"), unit: $("#product-unit"),
    subtotal: $("#product-subtotal"), candidates: $("#price-candidates"), candidateList: $("#candidate-list"),
    message: $("#ocr-message"), preview: $("#preview"), save: $("#save-product"), title: $("#review-title"),
    manual: $("#manual-entry"), toast: $("#toast"), historyList: $("#history-list")
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.purchases?.length) {
        const active = saved.purchases.find(p => p.status === "active");
        return { purchases: saved.purchases, activeId: active?.id || null };
      }
    } catch (_) { /* Recuperamos con una compra nueva si el almacenamiento está dañado. */ }
    const purchase = newPurchase();
    return { purchases: [purchase], activeId: purchase.id };
  }

  function newPurchase() { return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), finishedAt: null, status: "active", supermarketName: "", products: [] }; }
  function activePurchase() { return state.purchases.find(p => p.id === state.activeId) || null; }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
  function notify(message) { els.toast.textContent = message; els.toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove("visible"), 2600); }
  function subtotal(product) { return parser.subtotalCents(product.priceCents, product.quantityMilli); }
  function total(purchase) { return purchase.products.reduce((sum, item) => sum + subtotal(item), 0); }

  function render() {
    const purchase = activePurchase();
    const active = Boolean(purchase);
    $("#purchase-status").textContent = active ? "Compra activa" : "Compra finalizada";
    els.total.textContent = currency(active ? total(purchase) : 0);
    els.count.textContent = `${active ? purchase.products.length : 0} ${active && purchase.products.length === 1 ? "producto" : "productos"}`;
    els.products.replaceChildren();
    if (active) {
      for (const product of [...purchase.products].reverse()) els.products.append(createProductCard(product));
    }
    els.empty.hidden = !active || purchase.products.length > 0;
    els.scan.disabled = !active;
    $("#finish-button").hidden = !active;
    $("#new-purchase-button").hidden = active;
  }

  function createProductCard(product) {
    const card = document.createElement("article"); card.className = "product-card";
    const main = document.createElement("div"); main.className = "product-main";
    const name = document.createElement("div"); name.className = "product-name"; name.textContent = product.name;
    const meta = document.createElement("div"); meta.className = "product-meta";
    const quantity = product.quantityMilli / 1000;
    meta.textContent = `${currency(product.priceCents)} × ${quantity.toLocaleString("es-AR")}${product.unit ? ` ${product.unit}` : ""}`;
    const price = document.createElement("div"); price.className = "product-subtotal"; price.textContent = currency(subtotal(product));
    const actions = document.createElement("div"); actions.className = "product-actions";
    const edit = document.createElement("button"); edit.type = "button"; edit.title = "Editar"; edit.setAttribute("aria-label", `Editar ${product.name}`); edit.textContent = "✎"; edit.addEventListener("click", () => openEditor(product));
    const remove = document.createElement("button"); remove.type = "button"; remove.title = "Eliminar"; remove.setAttribute("aria-label", `Eliminar ${product.name}`); remove.textContent = "×"; remove.addEventListener("click", () => {
      const current = activePurchase(); current.products = current.products.filter(item => item.id !== product.id); persist(); notify("Producto eliminado");
    });
    main.append(name, meta); actions.append(edit, remove); card.append(main, price, actions); return card;
  }

  function openReview({ image = null, parsed = null, message = "", existing = null } = {}) {
    reviewImage = image; editingId = existing?.id || null;
    els.title.textContent = existing ? "Editar producto" : "Confirmar producto";
    els.save.textContent = existing ? "Guardar cambios" : "Agregar a la compra";
    els.name.value = existing?.name ?? parsed?.name ?? "";
    els.price.value = existing ? currency(existing.priceCents).replace(/^\$\s*/, "") : "";
    els.quantity.value = existing ? String(existing.quantityMilli / 1000).replace(".", ",") : "1";
    els.unit.value = existing?.unit || "";
    els.message.textContent = message; els.message.hidden = !message;
    els.manual.hidden = !image || Boolean(existing);
    if (image) { els.preview.src = image; els.preview.hidden = false; }
    else { els.preview.removeAttribute("src"); els.preview.hidden = true; }
    renderCandidates(parsed?.prices || [], parsed?.suggestedPriceIndex ?? null);
    updateSubtotal();
    if (!els.review.open) els.review.showModal();
  }

  function renderCandidates(prices, selectedIndex) {
    els.candidateList.replaceChildren(); els.candidates.hidden = prices.length === 0;
    prices.forEach((candidate, index) => {
      const button = document.createElement("button"); button.className = "candidate"; button.type = "button";
      const content = document.createElement("span");
      const amount = document.createElement("strong"); amount.textContent = currency(candidate.cents);
      const source = document.createElement("small"); source.textContent = candidate.source;
      content.append(amount, source); button.append(content);
      if (candidate.promo) button.insertAdjacentHTML("beforeend", '<span class="badge">Promo</span>');
      if (candidate.unit) button.insertAdjacentHTML("beforeend", '<span class="badge unit">Por medida</span>');
      if (candidate.wholesale) button.insertAdjacentHTML("beforeend", '<span class="badge wholesale">Mayorista</span>');
      if (index === selectedIndex) { const check = document.createElement("span"); check.className = "check"; check.textContent = "✓"; button.append(check); }
      button.addEventListener("click", () => { els.price.value = currency(candidate.cents).replace(/^\$\s*/, ""); updateSubtotal(); [...els.candidateList.children].forEach(row => row.querySelector(".check")?.remove()); const mark = document.createElement("span"); mark.className = "check"; mark.textContent = "✓"; button.append(mark); });
      els.candidateList.append(button);
    });
    if (selectedIndex !== null && prices[selectedIndex]) els.price.value = currency(prices[selectedIndex].cents).replace(/^\$\s*/, "");
  }

  function updateSubtotal() {
    const cents = parser.parseARS(els.price.value), quantity = parser.parseQuantity(els.quantity.value);
    els.subtotal.textContent = cents !== null && quantity !== null ? currency(parser.subtotalCents(cents, quantity)) : currency(0);
  }

  function openEditor(product) { openReview({ existing: product }); }

  async function handlePhoto(file) {
    if (!file) return;
    pendingPhoto = file;
    const imageURL = URL.createObjectURL(file);
    openReview({ image: imageURL, message: "Procesando la etiqueta en este dispositivo…" });
    els.save.disabled = true; els.manual.hidden = true;
    try {
      const worker = await getOCRWorker();
      const result = await worker.recognize(file, {}, { blocks: true });
      const width = result.data.imageSize?.width || 1, height = result.data.imageSize?.height || 1;
      const blocks = result.data.blocks || [];
      const ocrLines = blocks.flatMap(block => block.paragraphs || []).flatMap(paragraph => paragraph.lines || []);
      const lines = ocrLines.map(line => ({ text: line.text, confidence: line.confidence / 100, y: 1 - ((line.bbox.y0 + line.bbox.y1) / 2) / height }));
      const parsed = parser.parseLines(lines);
      openReview({ image: imageURL, parsed, message: lines.length ? "Revisá los datos y elegí el precio correcto si la etiqueta muestra más de uno." : "No se reconoció texto. Podés completar los campos manualmente." });
      els.manual.hidden = false;
    } catch (error) {
      openReview({ image: imageURL, message: `No se pudo leer la etiqueta (${error.message}). Si es la primera vez, conectate a internet para descargar el OCR local; después se guarda para usarlo sin conexión.` });
      els.manual.hidden = false;
    } finally { els.save.disabled = false; }
  }

  function getOCRWorker() {
    if (!workerPromise) {
      workerPromise = (async () => {
        if (!window.Tesseract) throw new Error("No está disponible el motor OCR");
        const base = new URL("./", location.href).href;
        return window.Tesseract.createWorker("spa", 1, {
          workerPath: new URL("vendor/worker.min.js", base).href,
          corePath: new URL("vendor/", base).href,
          langPath: new URL("lang", base).href,
          logger: event => { if (event.status === "recognizing text") els.message.textContent = `Leyendo etiqueta… ${Math.round((event.progress || 0) * 100)}%`; },
          errorHandler: error => console.warn("OCR local:", error),
          cacheMethod: "write",
          gzip: true
        });
      })().catch(error => { workerPromise = null; throw error; });
    }
    return workerPromise;
  }

  function saveProduct() {
    const name = els.name.value.trim(), priceCents = parser.parseARS(els.price.value), quantityMilli = parser.parseQuantity(els.quantity.value);
    if (!name || priceCents === null || priceCents <= 0 || quantityMilli === null) { notify("Completá nombre, precio y cantidad válidos"); return; }
    const purchase = activePurchase();
    if (!purchase) { notify("Iniciá una compra para agregar productos"); return; }
    const values = { name, priceCents, quantityMilli, unit: els.unit.value.trim(), imageData: pendingPhoto ? null : undefined };
    if (editingId) Object.assign(purchase.products.find(item => item.id === editingId), values);
    else purchase.products.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...values });
    pendingPhoto = null; els.review.close(); persist(); notify(editingId ? "Cambios guardados" : "Producto agregado"); editingId = null;
  }

  function finishPurchase() {
    const purchase = activePurchase(); if (!purchase) return;
    purchase.status = "finished"; purchase.finishedAt = new Date().toISOString(); state.activeId = null; persist(); notify("Compra finalizada");
  }

  function startPurchase() {
    const purchase = newPurchase(); state.purchases.unshift(purchase); state.activeId = purchase.id; persist(); els.history.close(); notify("Nueva compra lista");
  }

  function renderHistory() {
    els.historyList.replaceChildren();
    const purchases = [...state.purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!purchases.length) { els.historyList.innerHTML = '<div class="history-empty">Todavía no hay compras.</div>'; return; }
    for (const purchase of purchases) {
      const row = document.createElement("article"); row.className = "history-row";
      const head = document.createElement("div"); head.className = "history-head";
      const title = document.createElement("strong"); title.textContent = purchase.supermarketName || (purchase.status === "active" ? "Compra en curso" : "Compra finalizada");
      const amount = document.createElement("b"); amount.textContent = currency(total(purchase)); head.append(title, amount);
      const meta = document.createElement("div"); meta.className = "history-meta"; meta.textContent = `${new Date(purchase.createdAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })} · ${purchase.products.length} productos`;
      const items = document.createElement("div"); items.className = "history-items";
      if (purchase.products.length) for (const product of purchase.products) { const line = document.createElement("div"); line.className = "history-item"; const label = document.createElement("span"); label.textContent = `${product.name} × ${(product.quantityMilli / 1000).toLocaleString("es-AR")}`; const cost = document.createElement("strong"); cost.textContent = currency(subtotal(product)); line.append(label, cost); items.append(line); }
      else { const empty = document.createElement("div"); empty.className = "history-meta"; empty.textContent = "Sin productos"; items.append(empty); }
      row.append(head, meta, items); els.historyList.append(row);
    }
  }

  els.scan.addEventListener("click", () => els.file.click());
  $("#manual-scan-button").addEventListener("click", () => { pendingPhoto = null; openReview({ message: "Completá los datos manualmente. El subtotal se calcula al ingresar precio y cantidad." }); });
  els.file.addEventListener("change", event => { const file = event.target.files?.[0]; handlePhoto(file); event.target.value = ""; });
  els.save.addEventListener("click", saveProduct);
  els.manual.addEventListener("click", () => { els.name.value = ""; els.price.value = ""; els.quantity.value = "1"; els.unit.value = ""; els.candidates.hidden = true; els.message.textContent = "Completá los datos del producto manualmente."; updateSubtotal(); });
  [els.price, els.quantity].forEach(input => input.addEventListener("input", updateSubtotal));
  $("#finish-button").addEventListener("click", finishPurchase);
  $("#new-purchase-button").addEventListener("click", startPurchase);
  $("#history-button").addEventListener("click", () => { renderHistory(); els.history.showModal(); });
  $("#close-history").addEventListener("click", () => els.history.close());
  els.review.addEventListener("close", () => { if (reviewImage) URL.revokeObjectURL(reviewImage); reviewImage = null; pendingPhoto = null; editingId = null; });

  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").then(() => {
    if (!navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  }).catch(error => console.warn("No se pudo preparar el uso sin conexión:", error));
})();
