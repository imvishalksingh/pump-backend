// utils/inventoryIntegration.js
export const updateInventoryOnCreditSale = async (creditSale) => {
  try {
    const TankConfig = mongoose.model("TankConfig");
    const tank = await TankConfig.findOne({
      product: creditSale.fuelType === "Petrol" ? "MS" : 
               creditSale.fuelType === "Diesel" ? "HSD" : "CNG"
    });

    if (tank) {
      const FuelStock = mongoose.model("FuelStock");
      await FuelStock.create({
        tank: tank._id,
        transactionType: "credit_sale",
        quantity: -creditSale.quantity,
        previousStock: tank.currentStock,
        newStock: tank.currentStock - creditSale.quantity,
        product: tank.product,
        reference: `Credit Sale: ${creditSale.billNumber}`,
        shift: creditSale.shift,
        customer: creditSale.customer,
        createdBy: creditSale.createdBy
      });

      tank.currentStock -= creditSale.quantity;
      tank.currentLevel = Math.round((tank.currentStock / tank.capacity) * 100);
      tank.alert = tank.currentLevel <= 20;
      tank.lastUpdated = new Date();
      await tank.save();

      return {
        success: true,
        tank: tank.tankName,
        deduction: creditSale.quantity,
        newStock: tank.currentStock
      };
    }

    return { success: false, error: "Tank not found" };
  } catch (error) {
    console.error("❌ Error updating inventory:", error);
    throw error;
  }
};