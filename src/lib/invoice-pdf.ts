import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { formatCurrency } from './currency';

export interface InvoiceData {
  invoiceNumber: string;
  invoiceType: 'wallet_topup' | 'subscription' | 'order' | 'partner_payout' | 'driver_payout';
  issueDate: string;
  dueDate?: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  paidAt?: string;
  
  // Customer/Recipient info
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  
  // Items
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  
  // Totals
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  
  // Metadata
  notes?: string;
  paymentMethod?: string;
  transactionId?: string;
}

export class InvoicePDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.width;
    this.pageHeight = this.doc.internal.pageSize.height;
  }

  generateInvoice(data: InvoiceData): jsPDF {
    this.addHeader(data);
    this.addInvoiceDetails(data);
    this.addRecipientInfo(data);
    this.addItemsTable(data);
    this.addTotals(data);
    this.addFooter(data);
    
    return this.doc;
  }

  private addHeader(data: InvoiceData): void {
    // Company Logo/Name
    this.doc.setFontSize(24);
    this.doc.setTextColor(34, 197, 94); // Green color
    this.doc.text('Nutrio', this.margin, 30);
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('Healthy Meal Delivery & Nutrition', this.margin, 38);
    
    // Invoice Title
    this.doc.setFontSize(28);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('INVOICE', this.pageWidth - this.margin, 30, { align: 'right' });
    
    // Invoice Type Badge
    const typeLabels: Record<string, string> = {
      'wallet_topup': 'Wallet Top-up',
      'subscription': 'Subscription',
      'order': 'Order',
      'partner_payout': 'Partner Payout',
      'driver_payout': 'Driver Payout'
    };
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text(typeLabels[data.invoiceType] || 'Invoice', this.pageWidth - this.margin, 38, { align: 'right' });
  }

  private addInvoiceDetails(data: InvoiceData): void {
    const startY = 55;
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(100, 100, 100);
    
    // Left column
    this.doc.text('Invoice Number:', this.margin, startY);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(data.invoiceNumber, this.margin, startY + 5);
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('Issue Date:', this.margin, startY + 12);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(format(new Date(data.issueDate), 'dd MMM yyyy'), this.margin, startY + 17);
    
    if (data.dueDate) {
      this.doc.setTextColor(100, 100, 100);
      this.doc.text('Due Date:', this.margin, startY + 24);
      this.doc.setTextColor(0, 0, 0);
      this.doc.text(format(new Date(data.dueDate), 'dd MMM yyyy'), this.margin, startY + 29);
    }
    
    // Right column - Status
    const statusColors: Record<string, [number, number, number]> = {
      'draft': [100, 100, 100],
      'sent': [59, 130, 246],
      'paid': [34, 197, 94],
      'cancelled': [239, 68, 68]
    };
    
    const color = statusColors[data.status] || [100, 100, 100];
    this.doc.setTextColor(...color);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(data.status.toUpperCase(), this.pageWidth - this.margin, startY, { align: 'right' });
    
    if (data.paidAt) {
      this.doc.setFontSize(9);
      this.doc.setTextColor(100, 100, 100);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Paid on ${format(new Date(data.paidAt), 'dd MMM yyyy')}`, this.pageWidth - this.margin, startY + 7, { align: 'right' });
    }
  }

  private addRecipientInfo(data: InvoiceData): void {
    const startY = 100;
    
    this.doc.setFontSize(11);
    this.doc.setTextColor(100, 100, 100);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('BILL TO:', this.margin, startY);
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(data.recipientName, this.margin, startY + 7);
    
    let currentY = startY + 14;
    
    if (data.recipientEmail) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(data.recipientEmail, this.margin, currentY);
      currentY += 5;
    }
    
    if (data.recipientPhone) {
      this.doc.text(data.recipientPhone, this.margin, currentY);
      currentY += 5;
    }
    
    if (data.recipientAddress) {
      const addressLines = data.recipientAddress.split('\n');
      addressLines.forEach(line => {
        this.doc.text(line, this.margin, currentY);
        currentY += 5;
      });
    }
  }

  private addItemsTable(data: InvoiceData): void {
    const startY = 145;
    
    const tableData = data.items.map(item => [
      item.description,
      item.quantity.toString(),
      formatCurrency(item.unitPrice, true),
      formatCurrency(item.totalPrice, true)
    ]);
    
    (this.doc as any).autoTable({
      startY: startY,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: this.margin, right: this.margin }
    });
  }

  private addTotals(data: InvoiceData): void {
    const startY = (this.doc as any).lastAutoTable.finalY + 15;
    const rightX = this.pageWidth - this.margin;
    
    this.doc.setFontSize(10);
    
    // Subtotal
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('Subtotal:', rightX - 80, startY, { align: 'left' });
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(formatCurrency(data.subtotal, true), rightX, startY, { align: 'right' });
    
    // Tax
    if (data.taxAmount > 0) {
      this.doc.setTextColor(100, 100, 100);
      this.doc.text('Tax:', rightX - 80, startY + 7, { align: 'left' });
      this.doc.setTextColor(0, 0, 0);
      this.doc.text(formatCurrency(data.taxAmount, true), rightX, startY + 7, { align: 'right' });
    }
    
    // Total
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(rightX - 80, startY + 12, rightX, startY + 12);
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(34, 197, 94);
    this.doc.text('TOTAL:', rightX - 80, startY + 20, { align: 'left' });
    this.doc.text(formatCurrency(data.totalAmount, true), rightX, startY + 20, { align: 'right' });
    
    // Reset font
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
  }

  private addFooter(data: InvoiceData): void {
    const footerY = this.pageHeight - 40;
    
    // Notes
    if (data.notes) {
      this.doc.setFontSize(9);
      this.doc.setTextColor(100, 100, 100);
      this.doc.text('Notes:', this.margin, footerY);
      this.doc.setTextColor(0, 0, 0);
      
      const splitNotes = this.doc.splitTextToSize(data.notes, this.pageWidth - (this.margin * 2));
      this.doc.text(splitNotes, this.margin, footerY + 5);
    }
    
    // Payment info
    if (data.paymentMethod || data.transactionId) {
      const infoY = footerY + 20;
      this.doc.setFontSize(9);
      this.doc.setTextColor(100, 100, 100);
      
      if (data.paymentMethod) {
        this.doc.text(`Payment Method: ${data.paymentMethod}`, this.margin, infoY);
      }
      if (data.transactionId) {
        this.doc.text(`Transaction ID: ${data.transactionId}`, this.margin, infoY + 5);
      }
    }
    
    // Footer line
    this.doc.setDrawColor(34, 197, 94);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.pageHeight - 20, this.pageWidth - this.margin, this.pageHeight - 20);
    
    // Company info
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text(
      'Nutrio - Healthy Meal Delivery | Doha, Qatar | support@nutrio.app | www.nutrio.app',
      this.pageWidth / 2,
      this.pageHeight - 10,
      { align: 'center' }
    );
  }

  download(data: InvoiceData, filename?: string): void {
    const doc = this.generateInvoice(data);
    const defaultFilename = `invoice-${data.invoiceNumber}.pdf`;
    doc.save(filename || defaultFilename);
  }

  async generateBlob(data: InvoiceData): Promise<Blob> {
    const doc = this.generateInvoice(data);
    return doc.output('blob');
  }

  async generateBase64(data: InvoiceData): Promise<string> {
    const doc = this.generateInvoice(data);
    return doc.output('datauristring');
  }
}

export function generateWalletTopupInvoice(params: {
  invoiceNumber: string;
  recipientName: string;
  recipientEmail?: string;
  topupAmount: number;
  bonusAmount: number;
  paymentMethod?: string;
  transactionId?: string;
  issueDate: string;
}): jsPDF {
  const generator = new InvoicePDFGenerator();
  
  const data: InvoiceData = {
    invoiceNumber: params.invoiceNumber,
    invoiceType: 'wallet_topup',
    issueDate: params.issueDate,
    status: 'paid',
    paidAt: params.issueDate,
    recipientName: params.recipientName,
    recipientEmail: params.recipientEmail,
    items: [
      {
        description: 'Wallet Top-up',
        quantity: 1,
        unitPrice: params.topupAmount,
        totalPrice: params.topupAmount
      }
    ],
    subtotal: params.topupAmount,
    taxAmount: 0,
    totalAmount: params.topupAmount + params.bonusAmount,
    currency: 'QAR',
    paymentMethod: params.paymentMethod,
    transactionId: params.transactionId,
    notes: params.bonusAmount > 0 
      ? `Includes QAR ${params.bonusAmount.toFixed(2)} bonus credit. Total credits: QAR ${(params.topupAmount + params.bonusAmount).toFixed(2)}`
      : undefined
  };
  
  if (params.bonusAmount > 0) {
    data.items.push({
      description: 'Bonus Credit',
      quantity: 1,
      unitPrice: 0,
      totalPrice: params.bonusAmount
    });
  }
  
  return generator.generateInvoice(data);
}

export function downloadInvoice(data: InvoiceData, filename?: string): void {
  const generator = new InvoicePDFGenerator();
  generator.download(data, filename);
}

export default InvoicePDFGenerator;
