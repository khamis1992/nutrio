import { supabase } from '@/integrations/supabase/client';
import { InvoicePDFGenerator, generateWalletTopupInvoice } from '@/lib/invoice-pdf';
import { resendService } from '@/lib/resend';
import { formatCurrency } from '@/lib/currency';

export interface WalletTopupResult {
  success: boolean;
  invoiceId?: string;
  paymentId?: string;
  error?: string;
}

export async function processWalletTopup(
  userId: string,
  packageId: string,
  userEmail: string,
  userName: string
): Promise<WalletTopupResult> {
  try {
    // Get package details
    const { data: pkg, error: pkgError } = await supabase
      .from('wallet_topup_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (pkgError || !pkg) {
      return { success: false, error: 'Package not found' };
    }

    // Credit wallet with bonus amount
    const totalCredit = pkg.amount + pkg.bonus_amount;
    const { data: walletTxId, error: creditError } = await supabase.rpc('credit_wallet', {
      p_user_id: userId,
      p_amount: totalCredit,
      p_type: 'credit',
      p_reference_type: 'topup',
      p_description: `Wallet top-up: ${formatCurrency(pkg.amount)} + ${formatCurrency(pkg.bonus_amount)} bonus`,
      p_metadata: {
        package_id: packageId,
        bonus_amount: pkg.bonus_amount,
        topup_amount: pkg.amount,
      },
    });

    if (creditError) {
      console.error('Wallet credit failed:', creditError);
      return { success: false, error: 'Failed to credit wallet' };
    }

    // Create invoice
    const invoiceNumber = `WAL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        user_id: userId,
        invoice_type: 'wallet_topup',
        amount: pkg.amount,
        tax_amount: 0,
        total_amount: totalCredit,
        status: 'paid',
        paid_at: new Date().toISOString(),
        metadata: {
          package_id: packageId,
          bonus_amount: pkg.bonus_amount,
          topup_amount: pkg.amount,
        },
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Invoice creation failed:', invoiceError);
      // Continue anyway since wallet was credited
    }

    // Generate PDF
    const pdfDoc = generateWalletTopupInvoice({
      invoiceNumber,
      recipientName: userName,
      recipientEmail: userEmail,
      topupAmount: pkg.amount,
      bonusAmount: pkg.bonus_amount,
      issueDate: new Date().toISOString(),
    });

    const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

    // Save PDF URL (in production, this would be uploaded to storage)
    if (invoice) {
      await supabase
        .from('invoices')
        .update({ pdf_url: `data:application/pdf;base64,${pdfBase64}` })
        .eq('id', invoice.id);
    }

    // Send email if Resend is configured
    if (resendService.isConfigured() && userEmail) {
      try {
        await resendService.sendInvoiceEmail({
          to: userEmail,
          recipientName: userName,
          invoiceNumber,
          amount: totalCredit,
          pdfBase64,
          invoiceType: 'wallet_topup',
        });
        
        // Log email sent
        if (invoice) {
          await supabase.from('email_logs').insert({
            invoice_id: invoice.id,
            recipient_email: userEmail,
            recipient_name: userName,
            email_type: 'invoice',
            status: 'sent',
          });
        }
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the top-up if email fails
      }
    }

    return {
      success: true,
      invoiceId: invoice?.id,
      paymentId: walletTxId,
    };

  } catch (error: unknown) {
    console.error('Wallet top-up processing failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function downloadInvoice(invoiceId: string): Promise<void> {
  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error('Invoice not found');
    }

    const generator = new InvoicePDFGenerator();
    
    const invoiceData = {
      invoiceNumber: invoice.invoice_number,
      invoiceType: invoice.invoice_type,
      issueDate: invoice.created_at,
      status: invoice.status,
      paidAt: invoice.paid_at,
      recipientName: 'Customer', // Simplified for now
      recipientEmail: '',
      items: [
        {
          description: 'Wallet Top-up',
          quantity: 1,
          unitPrice: invoice.amount,
          totalPrice: invoice.amount,
        }
      ],
      subtotal: invoice.amount,
      taxAmount: invoice.tax_amount,
      totalAmount: invoice.total_amount,
      currency: invoice.currency,
    };

    generator.download(invoiceData, `invoice-${invoice.invoice_number}.pdf`);
  } catch (error) {
    console.error('Failed to download invoice:', error);
    throw error;
  }
}