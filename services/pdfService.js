const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const path = require("path");

const templatePath = path.join(__dirname, "../templates/form.html");

function replaceConditionalBlocks(html, data) {
  // Handle {{#if FIELD}} ... {{else}} ... {{/if}} blocks
  const ifBlockRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  
  html = html.replace(ifBlockRegex, (match, field, trueBlock, falseBlock) => {
    const value = data[field];
    return value && value.toString().trim() ? trueBlock : falseBlock;
  });

  // Handle simple {{#if FIELD}} ... {{/if}} blocks (no else)
  const simpleIfRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  
  html = html.replace(simpleIfRegex, (match, field, block) => {
    const value = data[field];
    return value && value.toString().trim() ? block : "";
  });

  return html;
}

async function generatePDF(data) {
  try {
    // Read the HTML template
    let html = await fs.readFile(templatePath, "utf-8");

    // Format dates
    const submittedDate = new Date(data.submittedDate);
    const formattedSubmittedDate = submittedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }) + " " + submittedDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const birthDate = new Date(data.dateOfBirth);
    const formattedBirthDate = birthDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

    // Construct logo paths
    const logosDir = path.join(__dirname, "../logos");
    const oyoStateLogo = `file:///${path.resolve(logosDir, "oyo-state.png").replace(/\\/g, "/")}`;
    const amotekun_logo = `file:///${path.resolve(logosDir, "amotekun.png").replace(/\\/g, "/")}`;

    // Build replacement data
    const replacements = {
      FORM_NO: data.formNo || "",
      SUBMITTED_DATE: formattedSubmittedDate,
      FULL_NAME: (data.fullName || "").toUpperCase(),
      PHONE_NUMBER: data.phoneNumber || "",
      DATE_OF_BIRTH: formattedBirthDate,
      LGA: data.lga || "",
      HOME_ADDRESS: data.homeAddress || "",
      GENDER: data.gender?.toUpperCase() || "",
      QUALIFICATION: data.qualification || "",
      HAS_SECURITY_EXP: data.hasSecurityExp || "",
      ORGANIZATION_NAME: data.organizationName || "",
      MEMBERSHIP_DURATION: data.membershipDuration || "",
      SPECIAL_SKILL: data.specialSkill || "",
      OTHER_INFO: data.otherInfo || "",
      PASSPORT_PHOTO: data.passportPhoto || "",
      OYO_STATE_LOGO: oyoStateLogo,
      AMOTEKUN_LOGO: amotekun_logo,
    };

    // Replace conditional blocks
    html = replaceConditionalBlocks(html, replacements);

    // Replace all placeholders
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      html = html.replace(regex, value);
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });

    await browser.close();

    return pdfBuffer;
  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
}

module.exports = {
  generatePDF,
};

