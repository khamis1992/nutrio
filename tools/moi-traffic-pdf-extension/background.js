const MOI_ORIGIN = "https://fees2.moi.gov.qa";
const LIST_PATH = "/moipay/inquiry/violation/companyPlateCount";
const DETAILS_PATH = "/moipay/inquiry/violation/companyPlateNo";
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const NAVIGATION_TIMEOUT_MS = 30_000;
const DETAILS_TIMEOUT_MS = 30_000;
const LIST_PAGE_TIMEOUT_MS = 20_000;
const MILLIMETERS_PER_INCH = 25.4;
const A4_WIDTH_INCHES = 210 / MILLIMETERS_PER_INCH;
const A4_HEIGHT_INCHES = 297 / MILLIMETERS_PER_INCH;

let activeRun = null;

chrome.action.onClicked.addListener(async (tab) => {
  const dashboardUrl = new URL(chrome.runtime.getURL("dashboard.html"));

  if (!tab.id || !isExpectedPage(tab.url, LIST_PATH)) {
    dashboardUrl.searchParams.set(
      "error",
      "افتح صفحة قائمة المركبات أولًا ثم اضغط أيقونة الإضافة مرة أخرى."
    );
  } else {
    dashboardUrl.searchParams.set("tabId", String(tab.id));
  }

  await chrome.tabs.create({ url: dashboardUrl.toString() });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CANCEL_RUN") {
    const matchesActiveRun = activeRun && activeRun.id === message.runId;
    if (matchesActiveRun) {
      activeRun.cancelled = true;
    }
    sendResponse({ ok: Boolean(matchesActiveRun) });
    return false;
  }

  if (message?.type !== "START_ALL_VEHICLES") {
    return false;
  }

  if (activeRun) {
    sendResponse({ ok: false, error: "هناك عملية حفظ أخرى قيد التشغيل." });
    return false;
  }

  const run = {
    id: String(message.runId || ""),
    tabId: Number(message.tabId),
    cancelled: false,
  };
  activeRun = run;

  runAllVehicles(run)
    .then((summary) => sendResponse({ ok: true, summary }))
    .catch((error) => {
      console.error(error);
      sendResponse({ ok: false, error: toUserMessage(error) });
    })
    .finally(() => {
      if (activeRun?.id === run.id) {
        activeRun = null;
      }
    });

  return true;
});

async function runAllVehicles(run) {
  validateRun(run);

  const tab = await chrome.tabs.get(run.tabId);
  if (!isExpectedPage(tab.url, LIST_PATH)) {
    throw new Error("LIST_PAGE_REQUIRED");
  }

  const debuggee = { tabId: run.tabId };
  let attached = false;

  try {
    await chrome.debugger.attach(debuggee, DEBUGGER_PROTOCOL_VERSION);
    attached = true;

    const vehicles = await collectAllVehicles(run);
    if (vehicles.length === 0) {
      throw new Error("NO_VEHICLES_FOUND");
    }

    const summary = {
      total: vehicles.length,
      processed: 0,
      saved: 0,
      skipped: 0,
      failed: 0,
    };

    await notifyRun(run, {
      type: "RUN_PROGRESS",
      stage: "ready",
      ...summary,
    });

    for (let index = 0; index < vehicles.length; index += 1) {
      assertNotCancelled(run);
      const vehicle = vehicles[index];

      await notifyRun(run, {
        type: "RUN_PROGRESS",
        stage: "processing",
        current: index + 1,
        plateNumber: vehicle.plateNumber,
        ...summary,
      });

      try {
        await ensureListPage(run.tabId, vehicle.pageNumber);
        await openVehicle(run.tabId, vehicle.plateNumber);
        await waitForTab(run.tabId, (currentTab) =>
          isExpectedPage(currentTab.url, DETAILS_PATH)
        );
        await waitForVehicleDetails(run.tabId, vehicle.plateNumber);
        assertNotCancelled(run);

        const pdfData = await printAttachedTabToPdf(debuggee);
        const filename = createPdfFilename(vehicle.plateNumber);
        const fileResponse = await sendPdfToDashboard(run, {
          filename,
          originalPlateNumber: vehicle.plateNumber,
          pdfData,
        });

        if (fileResponse.status === "skipped") {
          summary.skipped += 1;
        } else {
          summary.saved += 1;
        }
      } catch (error) {
        if (error?.message === "RUN_CANCELLED") {
          throw error;
        }

        summary.failed += 1;
        await notifyRun(run, {
          type: "VEHICLE_FAILED",
          current: index + 1,
          plateNumber: vehicle.plateNumber,
          error: toUserMessage(error),
          ...summary,
        });
      } finally {
        summary.processed += 1;
        if (!run.cancelled) {
          await returnToListPage(run.tabId);
        }
      }

      await notifyRun(run, {
        type: "RUN_PROGRESS",
        stage: "processed",
        current: index + 1,
        plateNumber: vehicle.plateNumber,
        ...summary,
      });
    }

    return summary;
  } finally {
    if (attached) {
      await chrome.debugger.detach(debuggee).catch(() => undefined);
    }
  }
}

async function collectAllVehicles(run) {
  await selectListPage(run.tabId, 1);
  const firstPage = await readListPage(run.tabId);

  if (!firstPage.totalPages || firstPage.totalPages < 1) {
    throw new Error("PAGINATION_NOT_FOUND");
  }

  const vehicles = [];

  for (let pageNumber = 1; pageNumber <= firstPage.totalPages; pageNumber += 1) {
    assertNotCancelled(run);

    if (pageNumber !== 1) {
      await selectListPage(run.tabId, pageNumber);
    }

    const page = pageNumber === 1 ? firstPage : await readListPage(run.tabId);
    if (page.currentPage !== pageNumber || page.vehicles.length === 0) {
      throw new Error("LIST_PAGE_READ_FAILED");
    }

    for (const vehicle of page.vehicles) {
      vehicles.push({ ...vehicle, pageNumber });
    }

    await notifyRun(run, {
      type: "RUN_PROGRESS",
      stage: "collecting",
      currentPage: pageNumber,
      totalPages: firstPage.totalPages,
      collected: vehicles.length,
    });
  }

  const uniquePlateNumbers = new Set(vehicles.map((vehicle) => vehicle.plateNumber));
  if (uniquePlateNumbers.size !== vehicles.length) {
    throw new Error("DUPLICATE_PLATE_NUMBERS");
  }

  await selectListPage(run.tabId, 1);
  return vehicles;
}

async function readListPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const pageText = document.body.innerText || "";
      const pageMatch = pageText.match(/صفحة\s+(\d+)\s+من\s+(\d+)/);
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const vehicles = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 5) {
          continue;
        }

        const plateNumber = (cells[1].textContent || "").trim();
        const hasDetailsLink = Boolean(cells[4].querySelector("a"));
        if (/^\d+$/.test(plateNumber) && hasDetailsLink) {
          vehicles.push({ plateNumber });
        }
      }

      return {
        currentPage: pageMatch ? Number(pageMatch[1]) : null,
        totalPages: pageMatch ? Number(pageMatch[2]) : null,
        vehicles,
      };
    },
  });

  return result || { currentPage: null, totalPages: null, vehicles: [] };
}

async function selectListPage(tabId, pageNumber) {
  const tab = await chrome.tabs.get(tabId);
  if (!isExpectedPage(tab.url, LIST_PATH)) {
    throw new Error("LIST_PAGE_REQUIRED");
  }

  const [{ result: selectionStarted }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [pageNumber],
    func: (targetPage) => {
      if (typeof globalThis.fetchPage === "function") {
        globalThis.fetchPage(targetPage);
        return true;
      }

      const expectedHref = `javascript:fetchPage(${targetPage});`.toLowerCase();
      const link = Array.from(document.querySelectorAll("a[href]")).find(
        (element) => (element.getAttribute("href") || "").toLowerCase() === expectedHref
      );
      if (link) {
        link.click();
        return true;
      }

      return false;
    },
  });

  if (!selectionStarted) {
    const currentPage = await readListPage(tabId);
    if (currentPage.currentPage === pageNumber) {
      return;
    }
    throw new Error("PAGE_SELECTION_FAILED");
  }

  const deadline = Date.now() + LIST_PAGE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const page = await readListPage(tabId);
    if (page.currentPage === pageNumber && page.vehicles.length > 0) {
      return;
    }
    await delay(300);
  }

  throw new Error("LIST_PAGE_TIMEOUT");
}

async function ensureListPage(tabId, pageNumber) {
  await returnToListPage(tabId);
  await selectListPage(tabId, pageNumber);
}

async function returnToListPage(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (isExpectedPage(tab.url, LIST_PATH)) {
    await waitForListReady(tabId);
    return;
  }

  if (!isExpectedPage(tab.url, DETAILS_PATH)) {
    throw new Error("UNEXPECTED_PAGE");
  }

  const clickedReturnButton = await clickPageReturnButton(tabId);
  let returned = await waitForExpectedPath(tabId, LIST_PATH, 12_000);

  if (!returned) {
    await chrome.tabs.goBack(tabId).catch(() => undefined);
    returned = await waitForExpectedPath(tabId, LIST_PATH, 12_000);
  }

  if (!returned) {
    await chrome.tabs.update(tabId, { url: `${MOI_ORIGIN}${LIST_PATH}` });
    returned = await waitForExpectedPath(tabId, LIST_PATH, NAVIGATION_TIMEOUT_MS);
  }

  if (!returned) {
    throw new Error(clickedReturnButton ? "RETURN_TO_LIST_TIMEOUT" : "NAVIGATION_TIMEOUT");
  }

  await waitForListReady(tabId);
}

async function clickPageReturnButton(tabId) {
  try {
    const [{ result: clicked }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (element) => (element.textContent || "").trim() === "الرجوع"
        );
        if (!button) {
          return false;
        }
        button.click();
        return true;
      },
    });
    return Boolean(clicked);
  } catch {
    return false;
  }
}

async function waitForExpectedPath(tabId, expectedPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (isExpectedPage(tab.url, expectedPath)) {
      return true;
    }
    await delay(250);
  }

  return false;
}

async function waitForListReady(tabId) {
  const deadline = Date.now() + LIST_PAGE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const page = await readListPage(tabId);
      if (page.currentPage && page.totalPages && page.vehicles.length > 0) {
        return;
      }
    } catch {
      // The restored page may not be ready for script injection yet.
    }

    await delay(300);
  }

  throw new Error("RETURN_TO_LIST_TIMEOUT");
}

async function openVehicle(tabId, plateNumber) {
  const [{ result: opened }] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [plateNumber],
    func: (expectedPlate) => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 5) {
          continue;
        }

        const plate = (cells[1].textContent || "").trim();
        const detailsLink = cells[4].querySelector("a");
        if (plate === expectedPlate && detailsLink) {
          detailsLink.click();
          return true;
        }
      }

      return false;
    },
  });

  if (!opened) {
    throw new Error("VEHICLE_NOT_FOUND");
  }
}

async function waitForVehicleDetails(tabId, plateNumber) {
  const deadline = Date.now() + DETAILS_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const [{ result: isReady }] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [plateNumber],
      func: (expectedPlate) => {
        const hasPlate = Array.from(document.querySelectorAll("span")).some(
          (element) => (element.textContent || "").trim() === expectedPlate
        );
        const hasViolationRows = document.querySelectorAll("table tbody tr").length > 0;
        return document.readyState === "complete" && hasPlate && hasViolationRows;
      },
    });

    if (isReady) {
      return;
    }

    await delay(400);
  }

  throw new Error("DETAILS_TIMEOUT");
}

async function printAttachedTabToPdf(debuggee) {
  const result = await chrome.debugger.sendCommand(debuggee, "Page.printToPDF", {
    landscape: false,
    displayHeaderFooter: false,
    printBackground: true,
    scale: 1,
    paperWidth: A4_WIDTH_INCHES,
    paperHeight: A4_HEIGHT_INCHES,
    marginTop: 0.3,
    marginBottom: 0.3,
    marginLeft: 0.3,
    marginRight: 0.3,
    preferCSSPageSize: false,
    transferMode: "ReturnAsBase64",
  });

  if (!result?.data) {
    throw new Error("EMPTY_PDF");
  }

  return result.data;
}

async function sendPdfToDashboard(run, file) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "VEHICLE_PDF_READY",
      runId: run.id,
      file,
    });

    if (!response?.ok || !["saved", "skipped"].includes(response.status)) {
      throw new Error(response?.error || "FILE_WRITE_FAILED");
    }

    return response;
  } catch (error) {
    if (error?.message === "RUN_CANCELLED") {
      throw error;
    }
    throw new Error(error?.message || "DASHBOARD_CLOSED");
  }
}

async function notifyRun(run, message) {
  await chrome.runtime.sendMessage({ ...message, runId: run.id }).catch(() => undefined);
}

function createPdfFilename(plateNumber) {
  const cleanPlateNumber = plateNumber.replace(/^00/, "");
  if (!/^\d+$/.test(cleanPlateNumber)) {
    throw new Error("INVALID_PLATE_NUMBER");
  }
  return `${cleanPlateNumber}.pdf`;
}

function validateRun(run) {
  if (!run.id) {
    throw new Error("INVALID_RUN");
  }
  if (!Number.isInteger(run.tabId) || run.tabId <= 0) {
    throw new Error("INVALID_TAB");
  }
}

function assertNotCancelled(run) {
  if (run.cancelled) {
    throw new Error("RUN_CANCELLED");
  }
}

async function waitForTab(tabId, predicate) {
  const deadline = Date.now() + NAVIGATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (predicate(tab)) {
      return tab;
    }
    await delay(250);
  }

  throw new Error("NAVIGATION_TIMEOUT");
}

function isExpectedPage(rawUrl, expectedPath) {
  if (!rawUrl) {
    return false;
  }

  try {
    const url = new URL(rawUrl);
    return url.origin === MOI_ORIGIN && url.pathname === expectedPath;
  } catch {
    return false;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toUserMessage(error) {
  const messages = {
    INVALID_RUN: "تعذر بدء عملية الحفظ.",
    INVALID_TAB: "تعذر الوصول إلى تبويب المركبات.",
    LIST_PAGE_REQUIRED: "يجب أن يبقى تبويب قائمة المركبات مفتوحًا أثناء التشغيل.",
    NO_VEHICLES_FOUND: "لم أجد أي مركبات في القائمة.",
    PAGINATION_NOT_FOUND: "تعذر تحديد عدد صفحات المركبات.",
    LIST_PAGE_READ_FAILED: "تعذر قراءة إحدى صفحات قائمة المركبات.",
    DUPLICATE_PLATE_NUMBERS: "تحتوي القائمة على أرقام مركبات مكررة؛ أوقفت العملية لحماية الملفات.",
    PAGE_SELECTION_FAILED: "تعذر الانتقال إلى صفحة المركبات المطلوبة.",
    LIST_PAGE_TIMEOUT: "استغرق تحميل صفحة المركبات وقتًا أطول من المتوقع.",
    RETURN_TO_LIST_TIMEOUT: "تم الرجوع إلى قائمة المركبات، لكن الجدول لم يظهر خلال المهلة المحددة.",
    VEHICLE_NOT_FOUND: "تعذر العثور على المركبة في صفحة القائمة.",
    UNEXPECTED_PAGE: "انتقل تبويب الوزارة إلى صفحة غير متوقعة.",
    NAVIGATION_TIMEOUT: "استغرق فتح الصفحة وقتًا أطول من المتوقع.",
    DETAILS_TIMEOUT: "لم تكتمل بيانات مخالفات المركبة خلال المهلة المحددة.",
    INVALID_PLATE_NUMBER: "رقم المركبة غير صالح لإنشاء اسم الملف.",
    EMPTY_PDF: "أنشأ Chrome نتيجة PDF فارغة.",
    FILE_WRITE_FAILED: "تعذر كتابة ملف PDF في المجلد المختار.",
    DASHBOARD_CLOSED: "أُغلقت لوحة الإضافة قبل اكتمال حفظ الملف.",
    RUN_CANCELLED: "تم إيقاف العملية بناءً على طلبك.",
  };

  if (messages[error?.message]) {
    return messages[error.message];
  }

  if (String(error?.message || "").includes("Another debugger is already attached")) {
    return "هناك أداة أخرى متصلة بتبويب المركبات. أغلق أدوات المطور وحاول مرة أخرى.";
  }

  return error?.message || "حدث خطأ غير متوقع أثناء إنشاء ملفات PDF.";
}
