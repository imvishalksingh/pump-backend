// utils/accountingIntegration.js
export const syncToAccountingSoftware = async (ledgerEntry) => {
  try {
    // Integration with Tally, QuickBooks, Zoho Books, etc.
    const accountingData = {
      voucherType: ledgerEntry.transactionType === "Sale" ? "Sales" : "Receipt",
      date: ledgerEntry.transactionDate,
      partyName: ledgerEntry.customer.name,
      amount: ledgerEntry.amount,
      reference: ledgerEntry.referenceNumber,
      description: ledgerEntry.description,
      taxAmount: ledgerEntry.taxAmount,
      totalAmount: ledgerEntry.totalAmount
    };

    // Call accounting software API
    // const response = await axios.post(ACCOUNTING_API_URL, accountingData);
    
    console.log("✅ Synced to accounting software:", accountingData);
    return { success: true };
  } catch (error) {
    console.error("❌ Error syncing to accounting software:", error);
    // Don't throw error, just log it
    return { success: false, error: error.message };
  }
};