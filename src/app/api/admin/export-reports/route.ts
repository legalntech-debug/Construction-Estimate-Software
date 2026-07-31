import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Authenticate Admin User
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data: role } = await supabase.rpc('get_user_role', { target_user_id: user.id });
  if (role?.toLowerCase() !== 'admin') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Fetch Razorpay Transactions for CSV Report
  const { data: transactions, error } = await supabase.rpc('get_razorpay_transactions');

  if (error || !transactions) {
    return new NextResponse('Error fetching data', { status: 500 });
  }

  // Generate CSV Headers
  const csvRows = [];
  const headers = ['Ref No', 'Customer Name', 'Client Name', 'Payment ID', 'Order ID', 'Amount (INR)', 'Payment Status', 'Created At'];
  csvRows.push(headers.join(','));

  // Format Rows
  transactions.forEach((tx: any) => {
    const row = [
      `"${tx.ref_no || ''}"`,
      `"${tx.customer_name || ''}"`,
      `"${tx.client_name || ''}"`,
      `"${tx.razorpay_payment_id || ''}"`,
      `"${tx.razorpay_order_id || ''}"`,
      tx.user_payment || 0,
      `"${tx.platform_payment_status || ''}"`,
      `"${tx.created_at || ''}"`
    ];
    csvRows.push(row.join(','));
  });

  const csvString = csvRows.join('\n');

  // Return CSV as Downloadable File
  return new NextResponse(csvString, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="admin-financial-report.csv"',
    },
  });
}