const express = require("express");
const router = express.Router();
const portalGuard = require("../middleware/portalGuard");
const { getNextFormNumber } = require("../services/counterService");
const { generatePDF } = require("../services/pdfService");
const { appendRow } = require("../services/sheetsService");
const { insertRegistration } = require("../services/supabaseService");

// Simple in-process concurrency counter — reject if load is too high
let activeRequests = 0;
const MAX_CONCURRENT = 200;

router.post("/", portalGuard, async (req, res) => {
  if (activeRequests >= MAX_CONCURRENT) {
    return res.status(503).json({
      error: "Server is busy, please try again in a moment.",
    });
  }

  activeRequests++;
  try {
    // Validate required fields
    const requiredFields = [
      "fullName",
      "phoneNumber",
      "dateOfBirth",
      "lga",
      "homeAddress",
      "gender",
      "qualification",
      "hasSecurityExp",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        fields: missingFields,
      });
    }

    // Get next form number
    const formNo = await getNextFormNumber();

    // Build data object
    const data = {
      formNo,
      submittedDate: new Date().toISOString(),
      fullName: req.body.fullName,
      phoneNumber: req.body.phoneNumber,
      dateOfBirth: req.body.dateOfBirth,
      lga: req.body.lga,
      homeAddress: req.body.homeAddress,
      gender: req.body.gender,
      qualification: req.body.qualification,
      hasSecurityExp: req.body.hasSecurityExp,
      organizationName: req.body.organizationName || "",
      membershipDuration: req.body.membershipDuration || "",
      specialSkill: req.body.specialSkill || "",
      otherInfo: req.body.otherInfo || "",
      passportPhoto: req.body.passportPhoto || "",
    };

    // Generate PDF directly
    let pdfBuffer;
    try {
      pdfBuffer = await generatePDF(data);
    } catch (pdfError) {
      console.error("PDF generation failed:", pdfError);
      return res.status(500).json({ error: "PDF generation failed, try again" });
    }

    // Send PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Amotekun-${formNo}.pdf"`
    );
    res.send(pdfBuffer);

    // Save to Google Sheets and Supabase asynchronously (don't await)
    setImmediate(() => {
      appendRow(data).catch((error) => {
        console.error("Background sheet append failed:", error);
      });
      insertRegistration(data);
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Registration failed",
      message: error.message,
    });
  } finally {
    activeRequests--;
  }
});

module.exports = router;
