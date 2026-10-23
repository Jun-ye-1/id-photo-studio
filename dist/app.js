(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const elements = {
    fileInput: $("#fileInput"),
    chooseButton: $("#chooseButton"),
    replaceButton: $("#replaceButton"),
    dropZone: $("#dropZone"),
    emptyState: $("#emptyState"),
    canvasWrap: $("#canvasWrap"),
    canvas: $("#previewCanvas"),
    guideOverlay: $("#guideOverlay"),
    guideToggle: $("#guideToggle"),
    fileName: $("#fileName"),
    sourceMeta: $("#sourceMeta"),
    readyBadge: $("#readyBadge"),
    preset: $("#presetSelect"),
    width: $("#widthInput"),
    height: $("#heightInput"),
    pixelOutput: $("#pixelOutput"),
    qualityHint: $("#qualityHint"),
    cropControls: $("#cropControls"),
    backgroundControls: $("#backgroundControls"),
    zoom: $("#zoomRange"),
    zoomValue: $("#zoomValue"),
    vertical: $("#verticalRange"),
    verticalValue: $("#verticalValue"),
    format: $("#formatSelect"),
    qualityControl: $("#qualityControl"),
    jpegQuality: $("#jpegQuality"),
    jpegQualityValue: $("#jpegQualityValue"),
    download: $("#downloadButton"),
    downloadMeta: $("#downloadMeta"),
    toast: $("#toast"),
  };

  const state = {
    image: null,
    objectUrl: null,
    originalName: "photo",
    widthMm: 35,
    heightMm: 45,
    dpi: 300,
    mode: "cover",
    background: "#ffffff",
    zoom: 1,
    panX: 0,
    panY: 0,
    dragging: null,
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mmToPx = (mm, dpi) => Math.max(1, Math.round((mm / 25.4) * dpi));

  function getTargetSize() {
    return {
      width: mmToPx(state.widthMm, state.dpi),
      height: mmToPx(state.heightMm, state.dpi),
    };
  }

  function validateTarget() {
    const { width, height } = getTargetSize();
    if (!(state.widthMm >= 5 && state.widthMm <= 300 && state.heightMm >= 5 && state.heightMm <= 300)) {
      throw new Error("宽度和高度需在 5–300 mm 之间");
    }
    if (width > 12000 || height > 12000 || width * height > 50_000_000) {
      throw new Error("输出图片过大，请降低尺寸或 DPI");
    }
    return { width, height };
  }

  function setRangeProgress(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    input.style.setProperty("--range-progress", `${((value - min) / (max - min)) * 100}%`);
  }

  function getRenderMetrics(outWidth, outHeight) {
    if (!state.image) return null;
    const imageRatio = state.image.naturalWidth / state.image.naturalHeight;
    const targetRatio = outWidth / outHeight;
    let baseScale;

    if (state.mode === "cover") {
      baseScale = imageRatio > targetRatio
        ? outHeight / state.image.naturalHeight
        : outWidth / state.image.naturalWidth;
      baseScale *= state.zoom;
    } else {
      baseScale = imageRatio > targetRatio
        ? outWidth / state.image.naturalWidth
        : outHeight / state.image.naturalHeight;
    }

    const drawWidth = state.image.naturalWidth * baseScale;
    const drawHeight = state.image.naturalHeight * baseScale;
    const overflowX = Math.max(0, drawWidth - outWidth);
    const overflowY = Math.max(0, drawHeight - outHeight);
    const maxPanX = overflowX / 2;
    const maxPanY = overflowY / 2;
    const x = (outWidth - drawWidth) / 2 + state.panX * maxPanX;
    const y = (outHeight - drawHeight) / 2 + state.panY * maxPanY;

    return { baseScale, drawWidth, drawHeight, maxPanX, maxPanY, x, y };
  }

  function renderToCanvas(canvas, outWidth, outHeight) {
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = outWidth;
    canvas.height = outHeight;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = state.background;
    context.fillRect(0, 0, outWidth, outHeight);

    if (!state.image) return null;
    const metrics = getRenderMetrics(outWidth, outHeight);
    context.drawImage(
      state.image,
      metrics.x,
      metrics.y,
      metrics.drawWidth,
      metrics.drawHeight,
    );
    return metrics;
  }

  function updateGuideSize() {
    requestAnimationFrame(() => {
      const rect = elements.canvas.getBoundingClientRect();
      elements.guideOverlay.style.setProperty("--canvas-width", `${rect.width}px`);
      elements.guideOverlay.style.setProperty("--canvas-height", `${rect.height}px`);
    });
  }

  function drawPreview() {
    const target = getTargetSize();
    const scale = Math.min(1, 920 / Math.max(target.width, target.height));
    const previewWidth = Math.max(1, Math.round(target.width * scale));
    const previewHeight = Math.max(1, Math.round(target.height * scale));
    renderToCanvas(elements.canvas, previewWidth, previewHeight);
    elements.canvas.style.aspectRatio = `${target.width} / ${target.height}`;
    updateGuideSize();
    updateQualityHint();
  }

  function updateQualityHint() {
    if (!state.image) {
      elements.qualityHint.textContent = "选择照片后检测清晰度";
      elements.qualityHint.style.color = "";
      return;
    }
    const target = getTargetSize();
    const metrics = getRenderMetrics(target.width, target.height);
    if (metrics.baseScale > 1.08) {
      elements.qualityHint.textContent = "原图偏小，导出可能不够清晰";
      elements.qualityHint.style.color = "#d84a32";
    } else {
      elements.qualityHint.textContent = "原图清晰度充足";
      elements.qualityHint.style.color = "#1e6c6d";
    }
  }

  function updateOutputInfo() {
    const target = getTargetSize();
    elements.pixelOutput.textContent = `${target.width} × ${target.height} px`;
    const format = elements.format.value === "image/png" ? "PNG" : "JPG";
    elements.downloadMeta.textContent = `${format} · ${state.dpi} DPI`;
    drawPreview();
  }

  function resetPosition() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    elements.zoom.value = "100";
    elements.vertical.value = "0";
    elements.zoomValue.textContent = "100%";
    elements.verticalValue.textContent = "居中";
    setRangeProgress(elements.zoom);
    setRangeProgress(elements.vertical);
  }

  function showToast(message) {
    clearTimeout(showToast.timer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
  }

  function openFilePicker() {
    elements.fileInput.value = "";
    elements.fileInput.click();
  }

  function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("请选择 JPG、PNG、WebP 或 BMP 图片");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      showToast("图片超过 30 MB，请先压缩后再试");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = url;
      state.image = image;
      state.originalName = file.name.replace(/\.[^.]+$/, "") || "photo";
      resetPosition();

      elements.emptyState.hidden = true;
      elements.canvasWrap.hidden = false;
      elements.replaceButton.hidden = false;
      elements.download.disabled = false;
      elements.fileName.textContent = file.name;
      elements.sourceMeta.textContent = `${image.naturalWidth} × ${image.naturalHeight} px · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
      elements.readyBadge.textContent = "可以导出";
      elements.readyBadge.classList.add("is-ready");
      elements.canvasWrap.classList.remove("has-dragged");
      drawPreview();
      showToast("照片已载入，可拖动调整构图");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("无法读取这张图片，请换一个文件");
    };
    image.src = url;
  }

  function updatePreset() {
    const custom = elements.preset.value === "custom";
    elements.width.disabled = !custom;
    elements.height.disabled = !custom;
    if (!custom) {
      const [width, height] = elements.preset.value.split(",").map(Number);
      state.widthMm = width;
      state.heightMm = height;
      elements.width.value = String(width);
      elements.height.value = String(height);
    }
    resetPosition();
    updateOutputInfo();
  }

  function updateCustomSize() {
    const width = Number(elements.width.value);
    const height = Number(elements.height.value);
    if (Number.isFinite(width) && width > 0) state.widthMm = width;
    if (Number.isFinite(height) && height > 0) state.heightMm = height;
    resetPosition();
    updateOutputInfo();
  }

  function setMode(mode) {
    state.mode = mode;
    $$(".fit-option").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    elements.cropControls.hidden = mode !== "cover";
    elements.backgroundControls.hidden = mode !== "contain";
    resetPosition();
    drawPreview();
  }

  function handlePointerDown(event) {
    if (!state.image || state.mode !== "cover") return;
    elements.canvas.setPointerCapture(event.pointerId);
    state.dragging = { x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event) {
    if (!state.dragging || !state.image) return;
    const rect = elements.canvas.getBoundingClientRect();
    const metrics = getRenderMetrics(elements.canvas.width, elements.canvas.height);
    const dx = ((event.clientX - state.dragging.x) / rect.width) * elements.canvas.width;
    const dy = ((event.clientY - state.dragging.y) / rect.height) * elements.canvas.height;

    if (metrics.maxPanX > 0) state.panX = clamp(state.panX + dx / metrics.maxPanX, -1, 1);
    if (metrics.maxPanY > 0) state.panY = clamp(state.panY + dy / metrics.maxPanY, -1, 1);
    state.dragging = { x: event.clientX, y: event.clientY };
    elements.vertical.value = String(Math.round(state.panY * 100));
    updateVerticalLabel();
    setRangeProgress(elements.vertical);
    elements.canvasWrap.classList.add("has-dragged");
    drawPreview();
  }

  function handlePointerUp(event) {
    if (state.dragging && elements.canvas.hasPointerCapture(event.pointerId)) {
      elements.canvas.releasePointerCapture(event.pointerId);
    }
    state.dragging = null;
  }

  function updateVerticalLabel() {
    const value = Number(elements.vertical.value);
    elements.verticalValue.textContent = value === 0 ? "居中" : value > 0 ? `下移 ${value}%` : `上移 ${Math.abs(value)}%`;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("浏览器无法生成图片")), type, quality);
    });
  }

  function writeUint32(target, offset, value) {
    target[offset] = (value >>> 24) & 255;
    target[offset + 1] = (value >>> 16) & 255;
    target[offset + 2] = (value >>> 8) & 255;
    target[offset + 3] = value & 255;
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function patchJpegDpi(blob, dpi) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let cursor = 2;
    while (cursor + 17 < bytes.length && bytes[cursor] === 0xff) {
      const marker = bytes[cursor + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = (bytes[cursor + 2] << 8) | bytes[cursor + 3];
      const isJfif = marker === 0xe0 &&
        bytes[cursor + 4] === 0x4a && bytes[cursor + 5] === 0x46 &&
        bytes[cursor + 6] === 0x49 && bytes[cursor + 7] === 0x46 && bytes[cursor + 8] === 0;
      if (isJfif) {
        const patched = bytes.slice();
        patched[cursor + 11] = 1;
        patched[cursor + 12] = (dpi >> 8) & 255;
        patched[cursor + 13] = dpi & 255;
        patched[cursor + 14] = (dpi >> 8) & 255;
        patched[cursor + 15] = dpi & 255;
        return new Blob([patched], { type: "image/jpeg" });
      }
      if (length < 2) break;
      cursor += 2 + length;
    }

    const header = new Uint8Array([
      0xff, 0xe0, 0x00, 0x10,
      0x4a, 0x46, 0x49, 0x46, 0x00,
      0x01, 0x01, 0x01,
      (dpi >> 8) & 255, dpi & 255,
      (dpi >> 8) & 255, dpi & 255,
      0x00, 0x00,
    ]);
    return new Blob([bytes.slice(0, 2), header, bytes.slice(2)], { type: "image/jpeg" });
  }

  async function patchPngDpi(blob, dpi) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const pixelsPerMeter = Math.round(dpi / 0.0254);
    const data = new Uint8Array(9);
    writeUint32(data, 0, pixelsPerMeter);
    writeUint32(data, 4, pixelsPerMeter);
    data[8] = 1;
    const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]);
    const crcInput = new Uint8Array(type.length + data.length);
    crcInput.set(type, 0);
    crcInput.set(data, type.length);
    const chunk = new Uint8Array(21);
    writeUint32(chunk, 0, 9);
    chunk.set(type, 4);
    chunk.set(data, 8);
    writeUint32(chunk, 17, crc32(crcInput));

    const parts = [bytes.slice(0, 8)];
    let cursor = 8;
    while (cursor + 12 <= bytes.length) {
      const length = ((bytes[cursor] << 24) | (bytes[cursor + 1] << 16) | (bytes[cursor + 2] << 8) | bytes[cursor + 3]) >>> 0;
      const end = cursor + 12 + length;
      if (end > bytes.length) break;
      const isPhys = bytes[cursor + 4] === 0x70 && bytes[cursor + 5] === 0x48 && bytes[cursor + 6] === 0x59 && bytes[cursor + 7] === 0x73;
      const isIhdr = bytes[cursor + 4] === 0x49 && bytes[cursor + 5] === 0x48 && bytes[cursor + 6] === 0x44 && bytes[cursor + 7] === 0x52;
      if (!isPhys) parts.push(bytes.slice(cursor, end));
      if (isIhdr) parts.push(chunk);
      cursor = end;
    }
    return new Blob(parts, { type: "image/png" });
  }

  async function downloadPhoto() {
    if (!state.image) return;
    try {
      const target = validateTarget();
      elements.download.disabled = true;
      elements.download.querySelector("span").lastChild.textContent = " 正在生成…";

      const output = document.createElement("canvas");
      renderToCanvas(output, target.width, target.height);
      const type = elements.format.value;
      const quality = Number(elements.jpegQuality.value) / 100;
      let blob = await canvasToBlob(output, type, quality);
      blob = type === "image/png"
        ? await patchPngDpi(blob, state.dpi)
        : await patchJpegDpi(blob, state.dpi);

      const extension = type === "image/png" ? "png" : "jpg";
      const safeName = state.originalName.replace(/[\\/:*?"<>|]+/g, "_");
      const filename = `${safeName}_${state.widthMm}x${state.heightMm}mm_${state.dpi}dpi.${extension}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast(`已生成 ${target.width} × ${target.height} px 照片`);
    } catch (error) {
      showToast(error.message || "生成失败，请重试");
    } finally {
      elements.download.disabled = false;
      elements.download.querySelector("span").lastChild.textContent = " 下载转换后的照片";
    }
  }

  elements.chooseButton.addEventListener("click", openFilePicker);
  elements.replaceButton.addEventListener("click", openFilePicker);
  elements.fileInput.addEventListener("change", (event) => loadFile(event.target.files[0]));

  ["dragenter", "dragover"].forEach((name) => {
    elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("is-dragging");
    });
  });
  elements.dropZone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));
  elements.dropZone.addEventListener("dblclick", () => {
    if (!state.image) openFilePicker();
  });

  elements.preset.addEventListener("change", updatePreset);
  elements.width.addEventListener("input", updateCustomSize);
  elements.height.addEventListener("input", updateCustomSize);

  $$("[data-dpi]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dpi = Number(button.dataset.dpi);
      $$("[data-dpi]").forEach((item) => item.classList.toggle("active", item === button));
      updateOutputInfo();
    });
  });

  $$(".fit-option").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  $$(".color-dot").forEach((button) => {
    button.addEventListener("click", () => {
      state.background = button.dataset.color;
      $$(".color-dot").forEach((item) => item.classList.toggle("active", item === button));
      drawPreview();
    });
  });

  elements.zoom.addEventListener("input", () => {
    state.zoom = Number(elements.zoom.value) / 100;
    elements.zoomValue.textContent = `${elements.zoom.value}%`;
    setRangeProgress(elements.zoom);
    drawPreview();
  });

  elements.vertical.addEventListener("input", () => {
    state.panY = Number(elements.vertical.value) / 100;
    updateVerticalLabel();
    setRangeProgress(elements.vertical);
    drawPreview();
  });

  elements.canvas.addEventListener("pointerdown", handlePointerDown);
  elements.canvas.addEventListener("pointermove", handlePointerMove);
  elements.canvas.addEventListener("pointerup", handlePointerUp);
  elements.canvas.addEventListener("pointercancel", handlePointerUp);
  elements.guideToggle.addEventListener("change", () => {
    elements.guideOverlay.classList.toggle("is-hidden", !elements.guideToggle.checked);
  });

  elements.format.addEventListener("change", () => {
    elements.qualityControl.hidden = elements.format.value !== "image/jpeg";
    updateOutputInfo();
  });
  elements.jpegQuality.addEventListener("input", () => {
    elements.jpegQualityValue.textContent = `${elements.jpegQuality.value}%`;
    setRangeProgress(elements.jpegQuality);
  });
  elements.download.addEventListener("click", downloadPhoto);
  window.addEventListener("resize", updateGuideSize);
  window.addEventListener("beforeunload", () => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  });

  [elements.zoom, elements.vertical, elements.jpegQuality].forEach(setRangeProgress);
  updateOutputInfo();
})();
