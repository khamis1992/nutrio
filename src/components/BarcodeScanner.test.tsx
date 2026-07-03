import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarcodeScanner, ScannedProduct } from "@/components/BarcodeScanner";

const mockOnScan = vi.fn();
const mockOnClose = vi.fn();

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        scan_barcode: "Scan Barcode",
        camera_required: "Camera access is required to scan barcodes.",
        try_again: "Try Again",
        looking_up: "Looking up product...",
        querying_db: "Querying Open Food Facts database",
        cal: "cal",
        protein: "protein",
        carbs: "carbs",
        fat: "fat",
        fiber: "fiber",
        scan_another: "Scan Another",
        add_product: "Add This Product",
        point_camera: "Point your camera at a barcode to scan",
        scanning: "Scanning...",
        or_enter_manually: "Or enter barcode manually:",
        enter_barcode: "Enter barcode number",
        search: "Search",
        supported_formats: "Supported formats:",
        data_source: "Data source",
        take_photo: "Take Another Photo",
        close: "Close",
      };
      return map[key] ?? key;
    },
    language: "en",
  }),
}));

vi.mock("@/lib/capacitor", () => ({
  isNative: false,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@zxing/library", () => {
  const mockDecodeOnceInner = vi.fn().mockResolvedValue({ getText: () => "5901234123457" });
  return {
    BrowserMultiFormatReader: vi.fn().mockImplementation(function () {
      return {
        decodeOnceFromVideoElement: mockDecodeOnceInner,
        decodeFromCanvas: vi.fn().mockResolvedValue({ getText: () => "5901234123457" }),
        reset: vi.fn(),
      };
    }),
    NotFoundException: class extends Error {
      constructor() {
        super("Barcode not found");
        this.name = "NotFoundException";
      }
    },
  };
});
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

const mockProduct: ScannedProduct = {
  name: "Test Product",
  barcode: "5901234123457",
  brand: "Test Brand",
  calories: 250,
  protein: 10,
  carbs: 30,
  fat: 8,
  fiber: 3,
  imageUrl: "https://example.com/image.jpg",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  });
  vi.stubGlobal("navigator", {
    ...navigator,
    mediaDevices: { getUserMedia: mockGetUserMedia },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BarcodeScanner", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the scanner UI when open", async () => {
    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );
    expect(await screen.findByText("Scan Barcode")).toBeTruthy();
  });

  it("shows camera permission denied state", async () => {
    mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));

    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );

    expect(await screen.findByText("Camera access denied. Please allow camera permissions.")).toBeTruthy();
  });

  it("shows manual barcode entry section", async () => {
    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );

    expect(await screen.findByText("Or enter barcode manually:")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter barcode number")).toBeTruthy();
    expect(screen.getByText("Search")).toBeTruthy();
  });

  it("shows supported formats section", async () => {
    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );

    expect(await screen.findByText("UPC (Product barcodes)")).toBeTruthy();
    expect(screen.getByText("EAN (International barcodes)")).toBeTruthy();
  });

  it("calls onClose when close button is clicked", async () => {
    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );

    const closeButton = await screen.findByLabelText("Close");
    await userEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onScan with product data when Add This Product is clicked", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, product: mockProduct },
      error: null,
    });

    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );

    const addButton = await screen.findByText("Add This Product", {}, { timeout: 5000 });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnScan).toHaveBeenCalledWith(mockProduct);
    });
  });

  it("handles edge function error gracefully", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );

    await waitFor(() => {
      expect(screen.getByText("Scan Barcode")).toBeTruthy();
    });
  });

  it("handles product not found response", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: false, error: "Product not found in database" },
      error: null,
    });

    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );

    await waitFor(() => {
      expect(screen.getByText("Scan Barcode")).toBeTruthy();
    });
  });

  it("displays Scan Another button after product is found", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, product: mockProduct },
      error: null,
    });

    render(
      <BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} isOpen={true} />
    );

    await waitFor(() => {
      expect(screen.getByText("Scan Another")).toBeTruthy();
    });
  });
});
