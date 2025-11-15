// controllers/settingsController.js
import Setting from "../models/Setting.js";
import asyncHandler from "express-async-handler";

// Get settings
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  res.json(settings);
});

// Update settings
export const updateSettings = asyncHandler(async (req, res) => {
  const {
    companyName,
    GST,
    logoUrl,
    address,
    phone,
    email,
    taxSettings,
    preferences
  } = req.body;

  let settings = await Setting.findOne();
  
  if (!settings) {
    // Create new settings if none exist
    settings = await Setting.create({
      companyName,
      GST,
      logoUrl,
      address,
      phone,
      email,
      taxSettings,
      preferences
    });
  } else {
    // Update existing settings
    settings.companyName = companyName || settings.companyName;
    settings.GST = GST || settings.GST;
    settings.logoUrl = logoUrl || settings.logoUrl;
    settings.address = address || settings.address;
    settings.phone = phone || settings.phone;
    settings.email = email || settings.email;
    
    // Update tax settings
    if (taxSettings) {
      settings.taxSettings = {
        cgst: taxSettings.cgst !== undefined ? taxSettings.cgst : settings.taxSettings.cgst,
        sgst: taxSettings.sgst !== undefined ? taxSettings.sgst : settings.taxSettings.sgst,
        cess: taxSettings.cess !== undefined ? taxSettings.cess : settings.taxSettings.cess
      };
    }
    
    // Update preferences
    if (preferences) {
      settings.preferences = {
        units: {
          fuel: preferences.units?.fuel || settings.preferences.units.fuel,
          currency: preferences.units?.currency || settings.preferences.units.currency
        },
        dateFormat: preferences.dateFormat || settings.preferences.dateFormat,
        timeFormat: preferences.timeFormat || settings.preferences.timeFormat
      };
    }

    await settings.save();
  }

  res.json({
    message: "Settings updated successfully",
    settings
  });
});

// Create backup
export const createBackup = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  settings.lastBackup = new Date();
  await settings.save();

  res.json({
    message: "Backup created successfully",
    lastBackup: settings.lastBackup
  });
});

// Reset to defaults
export const resetSettings = asyncHandler(async (req, res) => {
  await Setting.deleteMany({});
  const settings = await Setting.getSettings();

  res.json({
    message: "Settings reset to defaults",
    settings
  });
});