document.addEventListener("DOMContentLoaded", () => {
  const inputCanvas = document.getElementById("input-canvas");
  const backgroundCanvas = document.getElementById("background-canvas");
  const invertButton = document.getElementById("invert");
  const widthInput = document.getElementById("width");
  const heightInput = document.getElementById("height");
  const downloadButton = document.getElementById("download");
  const scaleSelector = document.getElementById("scale-selector");
  const saveButton = document.getElementById("save");
  const loadButton = document.getElementById("load");
  const clearButton = document.getElementById("clear");
  const rightArrow = document.getElementById("right-arrow");
  const leftArrow = document.getElementById("left-arrow");
  const whiteInput = document.getElementById("white-input");
  const blackInput = document.getElementById("black-input");
  const whiteSwatch = document.getElementById("white-swatch");
  const blackSwatch = document.getElementById("black-swatch");
  const uiStage = document.getElementById("ui-stage");
  const appShell = document.querySelector(".app-shell");
  const mainContainer = document.getElementById("main-container");
  const titleBar = document.getElementById("title-bar");
  const closeButton = document.getElementById("close");
  const workspaceShell = document.getElementById("workspace-shell");
  const workspace = document.getElementById("workspace");
  const mobileLayoutQuery = window.matchMedia("(max-width: 480px), (max-aspect-ratio: 4/5)");

  const selectorValueToScale = {
    1: 1,
    2: 2,
    3: 4,
    4: 8,
    5: 16,
    6: 32,
    7: 64,
  };
  const MIN_UI_SCALE = 2;
  const MAX_DESKTOP_UI_SCALE = 2;
  const MAX_MOBILE_UI_SCALE = 2;
  const MAX_PNG_PIXELS = 67_108_864;
  const STAGE_MARGIN = 8;
  const MOBILE_STAGE_TOP = 8;
  const CONTENT_COLLAPSE_DURATION_MS = 220;

  const wallpaperCanvas = document.createElement("canvas");

  const availablePresetFiles = [
    "dots_alternate_inverted.json",
    "dots_alternate_dense_inverted.json",
    "checkerboard.json",
    "dot_grid_inverted.json",
    "dense_columns.json",
    "ne_dense_diagonal_inverted.json",
    "columns.json",
    "squares.json",
    "rain.json",
    "square_grid_dense.json",
    "bricks.json",
    "dot.json",
    "tread_plate.json",
    "circle_tiles.json",
    "fabric.json",
    "trees.json",
    "sine_wave.json",
    "3d_grid.json",
    "amogus.json",
    "blank.json",
    "dots.json",
    "dots_alternate.json",
    "dots_alternate_dense.json",
    "dot_grid.json",
    "dense_rows.json",
    "ne_dense_diagonal.json",
    "rows.json",
    "ne_diagonal.json",
    "center_dot_grid.json",
    "square_grid.json",
    "tiles45.json",
    "quilt.json",
    "acutes.json",
    "wavy.json",
    "scales.json",
    "roof_tiles.json",
    "cherry.json",
    "diamond.json",
    "black.json",
  ];

  let black = blackInput.value;
  let white = whiteInput.value;

  const syncColorControl = (input, swatch) => {
    swatch.style.setProperty("--swatch-color", input.value);
  };

  blackInput.addEventListener("input", () => {
    black = blackInput.value;
    syncColorControl(blackInput, blackSwatch);
    document.documentElement.style.setProperty("--black", black);
    scheduleUpdate();
  });

  whiteInput.addEventListener("input", () => {
    white = whiteInput.value;
    syncColorControl(whiteInput, whiteSwatch);
    document.documentElement.style.setProperty("--white", white);
    scheduleUpdate();
  });

  let activePointerId = null;
  let drawColor = black;
  let needsUpdate = false;
  let dragPointerId = null;
  let dragStartPointer = null;
  let currentUiScale = MIN_UI_SCALE;
  let stageOffset = { x: 0, y: 0 };
  let dragOriginOffset = { x: 0, y: 0 };
  let isCollapsed = false;
  let isCollapseTransitioning = false;
  const scaleControl = scaleSelector.closest(".scale-control");

  const isDesktopLayout = () => !mobileLayoutQuery.matches;

  const setStagePosition = (left, top) => {
    uiStage.style.left = `${left}px`;
    uiStage.style.top = `${top}px`;
  };

  const getStageScreenPosition = () => {
    const left = Number.parseFloat(uiStage.style.left);
    const top = Number.parseFloat(uiStage.style.top);

    return {
      left: Number.isFinite(left) ? left : uiStage.getBoundingClientRect().left,
      top: Number.isFinite(top) ? top : uiStage.getBoundingClientRect().top,
    };
  };

  const syncStageOffsetToPosition = (left, top) => {
    if (!isDesktopLayout()) {
      stageOffset = { x: 0, y: 0 };
      setStagePosition(left, top);
      return;
    }

    const scaledWidth = appShell.offsetWidth * currentUiScale;
    const scaledHeight = appShell.offsetHeight * currentUiScale;
    const baseLeft = Math.floor((window.innerWidth - scaledWidth) / 2);
    const baseTop = Math.floor((window.innerHeight - scaledHeight) / 2);

    stageOffset = {
      x: left - baseLeft,
      y: top - baseTop,
    };
    setStagePosition(left, top);
  };

  const syncStageBounds = () => {
    if (isDesktopLayout()) {
      uiStage.style.maxWidth = "none";
      uiStage.style.maxHeight = "none";
      return;
    }

    const stageMaxWidth = Math.max(
      1,
      Math.floor((window.innerWidth - (STAGE_MARGIN * 2)) / currentUiScale)
    );
    const stageMaxHeight = Math.max(
      1,
      Math.floor((window.innerHeight - (STAGE_MARGIN * 2)) / currentUiScale)
    );

    uiStage.style.maxWidth = `${stageMaxWidth}px`;
    uiStage.style.maxHeight = `${stageMaxHeight}px`;
  };

  const syncStagePosition = () => {
    const scaledWidth = appShell.offsetWidth * currentUiScale;
    const scaledHeight = appShell.offsetHeight * currentUiScale;

    if (!isDesktopLayout()) {
      stageOffset = { x: 0, y: 0 };
      setStagePosition(
        Math.max(STAGE_MARGIN, Math.floor((window.innerWidth - scaledWidth) / 2)),
        MOBILE_STAGE_TOP
      );
      return;
    }

    const baseLeft = Math.floor((window.innerWidth - scaledWidth) / 2);
    const baseTop = Math.floor((window.innerHeight - scaledHeight) / 2);
    const maxX = Math.max(0, baseLeft - STAGE_MARGIN);
    const maxY = Math.max(0, baseTop - STAGE_MARGIN);

    stageOffset = {
      x: Math.min(maxX, Math.max(-maxX, stageOffset.x)),
      y: Math.min(maxY, Math.max(-maxY, stageOffset.y)),
    };
    setStagePosition(baseLeft + stageOffset.x, baseTop + stageOffset.y);
  };

  const clampStageOffset = () => {
    if (!isDesktopLayout()) {
      return;
    }

    syncStagePosition();
  };

  const isInteractiveElement = (element) => {
    return Boolean(
      element.closest(
        "button, input, label, #close, #left-arrow, #right-arrow, #input-canvas td, .scale-labels p"
      )
    );
  };

  const syncCloseButtonLabel = () => {
    const actionLabel = isCollapsed ? "Expand window" : "Collapse window";
    closeButton.setAttribute("aria-label", actionLabel);
    closeButton.setAttribute("title", actionLabel);
  };

  const stopWorkspaceTransition = () => {
    workspaceShell.style.transition = "";
    workspaceShell.removeEventListener("transitionend", handleWorkspaceTransitionEnd);
    workspaceShell.removeEventListener("transitioncancel", handleWorkspaceTransitionEnd);
  };

  function handleWorkspaceTransitionEnd(event) {
    if (event.target !== workspaceShell || event.propertyName !== "height") {
      return;
    }

    isCollapseTransitioning = false;
    stopWorkspaceTransition();
    workspaceShell.style.height = isCollapsed ? "0px" : "auto";
    updateUiScale({ preservePosition: true });
  }

  const toggleCollapsedWindow = () => {
    const startHeight = workspaceShell.offsetHeight;
    const targetHeight = isCollapsed ? workspace.scrollHeight : 0;

    stopWorkspaceTransition();
    isCollapseTransitioning = true;

    isCollapsed = !isCollapsed;
    syncCloseButtonLabel();
    mainContainer.classList.toggle("is-collapsed", isCollapsed);

    workspaceShell.style.height = `${startHeight}px`;
    workspaceShell.offsetHeight;
    workspaceShell.style.transition = `height ${CONTENT_COLLAPSE_DURATION_MS}ms ease-in-out`;
    workspaceShell.addEventListener("transitionend", handleWorkspaceTransitionEnd);
    workspaceShell.addEventListener("transitioncancel", handleWorkspaceTransitionEnd);

    requestAnimationFrame(() => {
      workspaceShell.style.height = `${targetHeight}px`;
    });
  };

  const syncScaleThumb = () => {
    const min = Number(scaleSelector.min);
    const max = Number(scaleSelector.max);
    const value = Number(scaleSelector.value);
    const percent = ((value - min) / (max - min)) * 100;

    scaleControl.style.setProperty("--scale-position", `${percent}%`);
  };

  const setDefaultOutputSize = () => {
    const viewportScale = window.devicePixelRatio || 1;
    const defaultWidth = Math.max(8, Math.round(window.innerWidth * viewportScale));
    const defaultHeight = Math.max(8, Math.round(window.innerHeight * viewportScale));

    widthInput.value = String(defaultWidth);
    heightInput.value = String(defaultHeight);
  };

  const hexToRgb = (hex) => {
    const normalizedHex = hex.replace("#", "");

    return [
      parseInt(normalizedHex.slice(0, 2), 16),
      parseInt(normalizedHex.slice(2, 4), 16),
      parseInt(normalizedHex.slice(4, 6), 16),
    ];
  };

  const crcTable = (() => {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index++) {
      let value = index;

      for (let bit = 0; bit < 8; bit++) {
        value = (value & 1) === 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
      }

      table[index] = value >>> 0;
    }

    return table;
  })();

  const crc32 = (data) => {
    let crc = 0xFFFFFFFF;

    for (let index = 0; index < data.length; index++) {
      crc = crcTable[(crc ^ data[index]) & 0xFF] ^ (crc >>> 8);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
  };

  const adler32 = (data) => {
    let a = 1;
    let b = 0;

    for (let index = 0; index < data.length; index++) {
      a = (a + data[index]) % 65521;
      b = (b + a) % 65521;
    }

    return ((b << 16) | a) >>> 0;
  };

  const writeUint32 = (target, offset, value) => {
    target[offset] = (value >>> 24) & 0xFF;
    target[offset + 1] = (value >>> 16) & 0xFF;
    target[offset + 2] = (value >>> 8) & 0xFF;
    target[offset + 3] = value & 0xFF;
  };

  const makeChunk = (type, data = new Uint8Array(0)) => {
    const chunk = new Uint8Array(12 + data.length);
    const typeBytes = new TextEncoder().encode(type);

    writeUint32(chunk, 0, data.length);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    writeUint32(chunk, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));

    return chunk;
  };

  const deflateStore = (data) => {
    const blockSize = 65535;
    const blockCount = Math.ceil(data.length / blockSize);
    const output = new Uint8Array(2 + data.length + (blockCount * 5) + 4);
    let inputOffset = 0;
    let outputOffset = 0;

    output[outputOffset++] = 0x78;
    output[outputOffset++] = 0x01;

    while (inputOffset < data.length) {
      const remaining = data.length - inputOffset;
      const currentBlockSize = Math.min(blockSize, remaining);
      const isFinalBlock = inputOffset + currentBlockSize >= data.length;

      output[outputOffset++] = isFinalBlock ? 0x01 : 0x00;
      output[outputOffset++] = currentBlockSize & 0xFF;
      output[outputOffset++] = (currentBlockSize >>> 8) & 0xFF;

      const inverseLength = (~currentBlockSize) & 0xFFFF;
      output[outputOffset++] = inverseLength & 0xFF;
      output[outputOffset++] = (inverseLength >>> 8) & 0xFF;

      output.set(data.subarray(inputOffset, inputOffset + currentBlockSize), outputOffset);
      inputOffset += currentBlockSize;
      outputOffset += currentBlockSize;
    }

    writeUint32(output, outputOffset, adler32(data));

    return output;
  };

  const createIndexedPngBlob = (width, height, scale, pattern) => {
    const bytesPerRow = Math.ceil(width / 8);
    const rawData = new Uint8Array(height * (1 + bytesPerRow));
    const patternHeight = pattern.length;
    const patternWidth = pattern[0].length;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * (1 + bytesPerRow);
      const patternRow = pattern[Math.floor(y / scale) % patternHeight];

      rawData[rowOffset] = 0;

      for (let x = 0; x < width; x++) {
        const paletteIndex = patternRow[Math.floor(x / scale) % patternWidth] === 1 ? 1 : 0;
        rawData[rowOffset + 1 + (x >> 3)] |= paletteIndex << (7 - (x & 7));
      }
    }

    const ihdr = new Uint8Array(13);
    const [whiteRed, whiteGreen, whiteBlue] = hexToRgb(white);
    const [blackRed, blackGreen, blackBlue] = hexToRgb(black);
    const plte = new Uint8Array([
      whiteRed, whiteGreen, whiteBlue,
      blackRed, blackGreen, blackBlue,
    ]);
    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    writeUint32(ihdr, 0, width);
    writeUint32(ihdr, 4, height);
    ihdr[8] = 1;
    ihdr[9] = 3;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const pngBytes = [
      signature,
      makeChunk("IHDR", ihdr),
      makeChunk("PLTE", plte),
      makeChunk("IDAT", deflateStore(rawData)),
      makeChunk("IEND"),
    ];

    return new Blob(pngBytes, { type: "image/png" });
  };

  const updateUiScale = ({ preservePosition = false } = {}) => {
    const anchoredPosition = preservePosition ? getStageScreenPosition() : null;

    syncStageBounds();

    const stageWidth = appShell.offsetWidth;
    const stageHeight = appShell.offsetHeight;
    const availableWidth = Math.max(1, window.innerWidth - (STAGE_MARGIN * 2));
    const availableHeight = Math.max(1, window.innerHeight - (STAGE_MARGIN * 2));
    const fitScale = Math.min(
      availableWidth / stageWidth,
      availableHeight / stageHeight
    );
    let uiScale = Math.max(1, Math.floor(fitScale));

    if (isDesktopLayout()) {
      uiScale = Math.min(uiScale, MAX_DESKTOP_UI_SCALE);
    } else {
      uiScale = Math.min(uiScale, MAX_MOBILE_UI_SCALE);
    }

    uiScale = Math.max(uiScale, MIN_UI_SCALE);
    currentUiScale = uiScale;

    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
    syncStageBounds();

    if (anchoredPosition) {
      syncStageOffsetToPosition(anchoredPosition.left, anchoredPosition.top);
      return;
    }

    syncStagePosition();
  };

  const readPattern = () => {
    const pattern = [];

    for (let row of inputCanvas.rows) {
      const rowData = [];
      for (let cell of row.cells) {
        rowData.push(varToHex(cell.style.backgroundColor) === black ? 1 : 0);
      }
      pattern.push(rowData);
    }

    return pattern;
  };

  const createPatternCanvas = (pattern) => {
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = 8;
    patternCanvas.height = 8;

    const patternCtx = patternCanvas.getContext("2d");
    patternCtx.imageSmoothingEnabled = false;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        patternCtx.fillStyle = pattern[y][x] ? black : white;
        patternCtx.fillRect(x, y, 1, 1);
      }
    }

    return patternCanvas;
  };

  const tileCanvas = (targetCanvas, sourceCanvas, width, height) => {
    targetCanvas.width = width;
    targetCanvas.height = height;

    const ctx = targetCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < height; y += sourceCanvas.height) {
      for (let x = 0; x < width; x += sourceCanvas.width) {
        ctx.drawImage(sourceCanvas, x, y, sourceCanvas.width, sourceCanvas.height);
      }
    }
  };

  const generateWallpaper = () => {
    const pattern = readPattern();
    const patternCanvas = createPatternCanvas(pattern);
    const previewScale = selectorValueToScale[scaleSelector.value];
    const viewportScale = window.devicePixelRatio || 1;
    const viewportWidth = Math.max(1, Math.ceil((window.innerWidth * viewportScale) / previewScale));
    const viewportHeight = Math.max(1, Math.ceil((window.innerHeight * viewportScale) / previewScale));

    // Get the width and height of the inputs
    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);

    tileCanvas(backgroundCanvas, patternCanvas, viewportWidth, viewportHeight);
    tileCanvas(wallpaperCanvas, patternCanvas, width, height);

  };

  const scheduleUpdate = () => {
    if (!needsUpdate) {
      needsUpdate = true;
      requestAnimationFrame(() => {
        generateWallpaper();
        needsUpdate = false;
      });
    }
  };

  const hexToVar = (hex) => {
    return hex === black ? "var(--black)" : "var(--white)";
  };

  const varToHex = (varString) => {
    return varString === "var(--black)" ? black : white;
  };

  const paintCell = (cell) => {
    if (!cell || cell.tagName !== "TD") {
      return;
    }

    if (cell.style.backgroundColor !== drawColor) {
      cell.style.backgroundColor = drawColor;
      scheduleUpdate();
    }
  };

  const applyPatternToInputCanvas = (pattern) => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        inputCanvas.rows[row].cells[col].style.backgroundColor =
          pattern[row][col] === 1 ? hexToVar(black) : hexToVar(white);
      }
    }
  };

  const handleGridPointerDown = (event) => {
    if (event.target.tagName !== "TD") {
      return;
    }

    event.preventDefault();
    const initialColor = varToHex(event.target.style.backgroundColor);
    drawColor = initialColor === black ? hexToVar(white) : hexToVar(black);
    activePointerId = event.pointerId;
    paintCell(event.target);
  };

  const handleGridPointerMove = (event) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
    const hoveredCell = hoveredElement ? hoveredElement.closest("#input-canvas td") : null;
    paintCell(hoveredCell);
  };

  const stopGridPointer = (event) => {
    if (activePointerId === event.pointerId) {
      activePointerId = null;
    }
  };

  const stopStageDrag = (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    dragPointerId = null;
    dragStartPointer = null;
    titleBar.classList.remove("is-dragging");
  };

  titleBar.addEventListener("pointerdown", (event) => {
    if (!isDesktopLayout() || event.button !== 0 || isInteractiveElement(event.target)) {
      return;
    }

    dragPointerId = event.pointerId;
    dragStartPointer = { x: event.clientX, y: event.clientY };
    dragOriginOffset = { ...stageOffset };
    titleBar.classList.add("is-dragging");
    titleBar.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  titleBar.addEventListener("pointermove", (event) => {
    if (dragPointerId !== event.pointerId || !dragStartPointer) {
      return;
    }

    stageOffset = {
      x: dragOriginOffset.x + (event.clientX - dragStartPointer.x),
      y: dragOriginOffset.y + (event.clientY - dragStartPointer.y),
    };
    clampStageOffset();
    event.preventDefault();
  });

  titleBar.addEventListener("pointerup", stopStageDrag);
  titleBar.addEventListener("pointercancel", stopStageDrag);

  closeButton.addEventListener("click", () => {
    toggleCollapsedWindow();
  });

  closeButton.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleCollapsedWindow();
  });

  // Initialize 8x8 input canvas
  for (let row = 0; row < 8; row++) {
    const tr = document.createElement("tr");
    for (let col = 0; col < 8; col++) {
      const td = document.createElement("td");
      td.style.backgroundColor = hexToVar(white);
      if ((row % 2 === 0 && col % 2 === 0) || (row % 2 === 1 && col % 2 === 1)) {
        td.style.backgroundColor = hexToVar(black);
      }
      tr.appendChild(td);
    }
    inputCanvas.appendChild(tr);
  }

  inputCanvas.addEventListener("pointerdown", handleGridPointerDown);
  document.addEventListener("pointermove", handleGridPointerMove, { passive: false });
  document.addEventListener("pointerup", stopGridPointer);
  document.addEventListener("pointercancel", stopGridPointer);

  // Invert the 8x8 design
  invertButton.addEventListener("click", () => {
    for (let row of inputCanvas.rows) {
      for (let cell of row.cells) {
        cell.style.backgroundColor = varToHex(cell.style.backgroundColor) === black ?
          hexToVar(white) : hexToVar(black);
      } 
    }
    scheduleUpdate();
  });


  //validate input values no less than 8 for width and height on blur
  widthInput.addEventListener("blur", () => {
    if (widthInput.value < 8) {
      widthInput.value = 8;
    }
  });

  heightInput.addEventListener("blur", () => {
    if (heightInput.value < 8) {
      heightInput.value = 8;
    }
  });

  // Update wallpaper when resizing the input canvas and validate input values
  widthInput.addEventListener("input", () => {
    if (!isNaN(widthInput.value)) {
      scheduleUpdate();
    }
  });

  heightInput.addEventListener("input", () => {
    if (!isNaN(heightInput.value)) {
      scheduleUpdate();
    }
  });

  // Update wallpaper when changing the scale
  scaleSelector.addEventListener("input", () => {
    syncScaleThumb();
    scheduleUpdate();
  });

  // When pressing the download button, download the wallpaperCavas as an image
  // with the selected scale applied inside the fixed output dimensions
  downloadButton.addEventListener("click", (event) => {
    event.preventDefault();

    const pattern = readPattern();
    const scale = selectorValueToScale[scaleSelector.value];
    const width = Number.parseInt(widthInput.value, 10);
    const height = Number.parseInt(heightInput.value, 10);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8) {
      window.alert("Width and height must be at least 8.");
      return;
    }

    if ((width * height) > MAX_PNG_PIXELS) {
      window.alert("Export size is too large.");
      return;
    }

    const blob = createIndexedPngBlob(width, height, scale, pattern);
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.download = "wallpaper.png";
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });



  // Save the configuration of the 8x8 design as a JSON file
  saveButton.addEventListener("click", (event) => {
    event.preventDefault();
    const pattern = [];
    for (let row of inputCanvas.rows) {
      const rowData = [];
      for (let cell of row.cells) {
        rowData.push(varToHex(cell.style.backgroundColor) === black ? 1 : 0);
      }
      pattern.push(rowData);
    }
    const json = JSON.stringify({
      width: parseInt(widthInput.value),
      height: parseInt(heightInput.value),
      pattern,
    });
    const link = document.createElement("a");
    link.download = "pattern.json";
    link.href = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    );
    link.click();
  });

  // Load a configuration from a JSON file
  loadButton.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const json = JSON.parse(reader.result);
        widthInput.value = json.width;
        heightInput.value = json.height;
        applyPatternToInputCanvas(json.pattern);
        scheduleUpdate();
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // Load a preset file when clicking on the arrows (scroll through the available presets)
  // the preset files are in "./examplePatterns/macOs_system3_1986/" folder
  let currentPresetIndex = -1;
  rightArrow.addEventListener("click", () => {
    currentPresetIndex = (currentPresetIndex + 1) % availablePresetFiles.length;
    const presetFile = availablePresetFiles[currentPresetIndex];
    fetch(`./examplePatterns/macOs_system3_1986/${presetFile}`)
      .then((response) => response.json())
      .then((json) => {
        applyPatternToInputCanvas(json.pattern);
        scheduleUpdate();
      });
  });

  leftArrow.addEventListener("click", () => {
    currentPresetIndex =
      (currentPresetIndex - 1 + availablePresetFiles.length) %
      availablePresetFiles.length;
    const presetFile = availablePresetFiles[currentPresetIndex];
    fetch(`./examplePatterns/macOs_system3_1986/${presetFile}`)
      .then((response) => response.json())
      .then((json) => {
        applyPatternToInputCanvas(json.pattern);
        scheduleUpdate();
      });
  });

  // Clear the 8x8 design
  clearButton.addEventListener("click", () => {
    for (let row of inputCanvas.rows) {
      for (let cell of row.cells) {
        cell.style.backgroundColor = white;
      }
    }
    scheduleUpdate();
  });

  // select all the text in the input when clicked
  widthInput.addEventListener("click", () => {
    widthInput.select();
  });

  heightInput.addEventListener("click", () => {
    heightInput.select();
  });

  // Keep the UI stage fitted, and rerender the live background at the new viewport resolution.
  window.addEventListener("resize", updateUiScale);
  window.addEventListener("resize", scheduleUpdate);

  if (typeof ResizeObserver !== "undefined") {
    const stageResizeObserver = new ResizeObserver(() => {
      if (!isCollapsed && !workspaceShell.style.transition) {
        workspaceShell.style.height = "auto";
      }
      updateUiScale({ preservePosition: isCollapseTransitioning });
    });
    stageResizeObserver.observe(mainContainer);
  }

  // Initial wallpaper generation
  syncCloseButtonLabel();
  syncColorControl(whiteInput, whiteSwatch);
  syncColorControl(blackInput, blackSwatch);
  setDefaultOutputSize();
  updateUiScale();
  syncScaleThumb();
  scheduleUpdate();
});

// Expose the range setter for the inline scale labels.
window.setRangeValue = (value) => {
  document.getElementById("scale-selector").value = value;
  document.getElementById("scale-selector").dispatchEvent(new Event("input"));
};
