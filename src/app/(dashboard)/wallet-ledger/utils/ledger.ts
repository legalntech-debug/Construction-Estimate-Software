const getLastDayOfMonth = (yearMonthStr: string): string => {
  const [year, month] = yearMonthStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return String(lastDay).padStart(2, '0');
};

export async function fetchLedgerData({
  supabaseClient,
  selectedUserId,
  selectedMonth,
  fromDate,
  toDate,
}: {
  supabaseClient: any;
  selectedUserId: string;
  selectedMonth: string; // Format: 'YYYY-MM'
  fromDate?: string;
  toDate?: string;
}) {
  const lastDay = getLastDayOfMonth(selectedMonth);
  const startDate = fromDate ? `${fromDate}T00:00:00` : `${selectedMonth}-01T00:00:00`;
  const endDate = toDate ? `${toDate}T23:59:59` : `${selectedMonth}-${lastDay}T23:59:59`;

  // 1. Calculate Opening Balance before startDate
  const { data: prevCredits } = await supabaseClient
    .from('wallet_transactions')
    .select('amount')
    .eq('user_id', selectedUserId)
    .lt('created_at', startDate)
    .eq('type', 'CREDIT');

  const { data: prevDebits } = await supabaseClient
    .from('wallet_transactions')
    .select('amount')
    .eq('user_id', selectedUserId)
    .lt('created_at', startDate)
    .eq('type', 'DEBIT');

  const openingCredit = prevCredits?.reduce((sum: number, item: any) => sum + Number(item.amount), 0) || 0;
  const openingDebit = prevDebits?.reduce((sum: number, item: any) => sum + Number(item.amount), 0) || 0;
  const openingBalance = openingCredit - openingDebit;

  // 2. Fetch Period Transactions
  const { data: transactions, error } = await supabaseClient
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', selectedUserId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // 3. Running balance step-by-step
  let runningCalc = openingBalance;
  const formattedLedger = (transactions || []).map((tx: any) => {
    const amountNum = Number(tx.amount);
    if (tx.type === 'CREDIT') runningCalc += amountNum;
    if (tx.type === 'DEBIT') runningCalc -= amountNum;
    return {
      ...tx,
      runningBalance: runningCalc,
    };
  });

  return {
    openingBalance,
    ledger: formattedLedger,
    closingBalance: runningCalc,
  };
}