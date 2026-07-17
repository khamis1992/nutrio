const TARGET_DIRECTORY_NAME = "المخالفات المرورية";
const MAX_LOG_ITEMS = 8;

const startButton = document.querySelector("#startButton");
const cancelButton = document.querySelector("#cancelButton");
const progress = document.querySelector("#progress");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const processedCount = document.querySelector("#processedCount");
const savedCount = document.querySelector("#savedCount");
const skippedCount = document.querySelector("#skippedCount");
const failedCount = document.querySelector("#failedCount");
const activityLog = document.querySelector("#activityLog");
const result = document.querySelector("#result");
const params = new URLSearchParams(window.location.search);
const tabId = Number(params.get("tabId"));
const startupError = params.get("error");

let activeRunId = null;
let directoryHandle = null;
let isCancelling = false;

if (startupError) {
  showResult(startupError, "error");
  startButton.disabled = true;
}

if (!("showDirectoryPicker" in window)) {
  showResult("إصدار Chrome الحالي لا يدعم اختيار مجلد الحفظ مباشرة.", "error");
  startButton.disabled = true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!activeRunId || message?.runId !== activeRunId) {
    return false;
  }

  if (message.type === "VEHICLE_PDF_READY") {
    saveVehicleFile(message.file)
      .then((status) => sendResponse({ ok: true, status }))
      .catch((error) => sendResponse({
        ok: false,
        error: error?.message || "تعذر كتابة ملف PDF.",
      }));
    return true;
  }

  if (message.type === "RUN_PROGRESS") {
    updateProgress(message);
    return false;
  }

  if (message.type === "VEHICLE_FAILED") {
    updateStats(message);
    addLog(`تعذر حفظ ${message.plateNumber}: ${message.error}`, "error");
    return false;
  }

  return false;
});

startButton.addEventListener("click", async () => {
  clearResult();
  resetProgress();

  try {
    directoryHandle = await window.showDirectoryPicker({
      id: "moi-traffic-pdf-output",
      mode: "readwrite",
      startIn: "desktop",
    });

    if (directoryHandle.name !== TARGET_DIRECTORY_NAME) {
      throw new Error(`اختر مجلد «${TARGET_DIRECTORY_NAME}» نفسه، وليس مجلدًا آخر.`);
    }

    activeRunId = crypto.randomUUID();
    isCancelling = false;
    setBusy(true);
    setProgressText("جاري جمع المركبات من جميع صفحات القائمة…");

    const response = await chrome.runtime.sendMessage({
      type: "START_ALL_VEHICLES",
      tabId,
      runId: activeRunId,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "تعذر إكمال حفظ المركبات.");
    }

    const { total, saved, skipped, failed } = response.summary;
    const message = failed > 0
      ? `اكتملت المعالجة: ${saved} محفوظ، ${skipped} موجود مسبقًا، و${failed} تعذر حفظه من أصل ${total}.`
      : `اكتملت جميع المركبات: ${saved} محفوظ و${skipped} موجود مسبقًا من أصل ${total}.`;
    showResult(message, failed > 0 ? "warning" : "success");
    setProgressText("اكتملت المعالجة.");
  } catch (error) {
    if (error?.name === "AbortError") {
      showResult("تم إلغاء اختيار المجلد، ولم يبدأ الحفظ.", "error");
    } else if (isCancelling) {
      showResult("تم إيقاف العملية. يمكنك تشغيلها مرة أخرى لاستكمال الملفات المتبقية.", "warning");
    } else {
      showResult(error?.message || "حدث خطأ غير متوقع.", "error");
    }
  } finally {
    setBusy(false);
    activeRunId = null;
    directoryHandle = null;
    isCancelling = false;
  }
});

cancelButton.addEventListener("click", async () => {
  if (!activeRunId || isCancelling) {
    return;
  }

  isCancelling = true;
  cancelButton.disabled = true;
  setProgressText("جاري الإيقاف بعد المركبة الحالية…");
  await chrome.runtime.sendMessage({
    type: "CANCEL_RUN",
    runId: activeRunId,
  }).catch(() => undefined);
});

async function saveVehicleFile(file) {
  if (!directoryHandle) {
    throw new Error("فُقد الوصول إلى مجلد الحفظ. اترك هذه الصفحة مفتوحة أثناء التشغيل.");
  }

  if (await fileExists(directoryHandle, file.filename)) {
    addLog(`${file.filename} موجود مسبقًا — تم تخطيه.`, "skipped");
    return "skipped";
  }

  await writePdf(directoryHandle, file.filename, file.pdfData);
  addLog(`تم حفظ ${file.filename}.`, "saved");
  return "saved";
}

async function fileExists(targetDirectory, filename) {
  try {
    await targetDirectory.getFileHandle(filename);
    return true;
  } catch (error) {
    if (error?.name === "NotFoundError") {
      return false;
    }
    throw error;
  }
}

async function writePdf(targetDirectory, filename, base64Data) {
  const fileHandle = await targetDirectory.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(base64ToBytes(base64Data));
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

function base64ToBytes(base64Data) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function updateProgress(message) {
  updateStats(message);

  if (message.stage === "collecting") {
    setProgressText(
      `جاري جمع المركبات: الصفحة ${message.currentPage} من ${message.totalPages} — ${message.collected} مركبة.`
    );
    setProgressPercent((message.currentPage / message.totalPages) * 10);
    return;
  }

  if (message.stage === "ready") {
    setProgressText(`تم العثور على ${message.total} مركبة. سيبدأ الحفظ الآن.`);
    setProgressPercent(10);
    return;
  }

  if (message.stage === "processing") {
    setProgressText(
      `جاري معالجة المركبة ${message.plateNumber} — ${message.current} من ${message.total}.`
    );
    setProgressPercent(10 + ((message.current - 1) / message.total) * 90);
    return;
  }

  if (message.stage === "processed") {
    setProgressPercent(10 + (message.processed / message.total) * 90);
  }
}

function updateStats(message) {
  if (Number.isFinite(message.processed)) {
    processedCount.textContent = String(message.processed);
  }
  if (Number.isFinite(message.saved)) {
    savedCount.textContent = String(message.saved);
  }
  if (Number.isFinite(message.skipped)) {
    skippedCount.textContent = String(message.skipped);
  }
  if (Number.isFinite(message.failed)) {
    failedCount.textContent = String(message.failed);
  }
}

function addLog(message, type) {
  const item = document.createElement("li");
  item.className = type;
  item.textContent = message;
  activityLog.prepend(item);

  while (activityLog.children.length > MAX_LOG_ITEMS) {
    activityLog.lastElementChild.remove();
  }
}

function setBusy(isBusy) {
  startButton.disabled = isBusy || Boolean(startupError);
  cancelButton.hidden = !isBusy;
  cancelButton.disabled = !isBusy;
  progress.hidden = !isBusy && activityLog.children.length === 0;
}

function resetProgress() {
  activityLog.replaceChildren();
  processedCount.textContent = "0";
  savedCount.textContent = "0";
  skippedCount.textContent = "0";
  failedCount.textContent = "0";
  setProgressPercent(0);
}

function setProgressText(message) {
  progressText.textContent = message;
}

function setProgressPercent(percent) {
  progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

function showResult(message, type) {
  result.textContent = message;
  result.className = `result ${type}`;
  result.hidden = false;
}

function clearResult() {
  result.textContent = "";
  result.className = "result";
  result.hidden = true;
}
