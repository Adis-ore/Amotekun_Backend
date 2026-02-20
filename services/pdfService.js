const puppeteer = require("puppeteer");
const { Cluster } = require("puppeteer-cluster");
const fs = require("fs").promises;
const path = require("path");

const templatePath = path.join(__dirname, "../templates/form.html");
const logosDir = path.join(__dirname, "../logos");

let cluster;
let activeJobs = 0;

/* ─── Conditional block renderer ─── */
function replaceConditionalBlocks(html, data) {
  // {{#if FIELD}} ... {{else}} ... {{/if}}
  const ifElse = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  html = html.replace(ifElse, (_, field, trueBlock, falseBlock) => {
    const val = data[field];
    return val && String(val).trim() ? trueBlock : falseBlock;
  });

  // {{#if FIELD}} ... {{/if}}  (no else)
  const ifOnly = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  html = html.replace(ifOnly, (_, field, block) => {
    const val = data[field];
    return val && String(val).trim() ? block : "";
  });

  return html;
}

/* ─── Build the HTML string from the template + data ─── */
async function buildHTML(data) {
  let html = await fs.readFile(templatePath, "utf-8");

  // Format submitted date
  const submittedDate = new Date(data.submittedDate);
  const formattedSubmittedDate =
    submittedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }) +
    " " +
    submittedDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  // Format date of birth
  const birthDate = new Date(data.dateOfBirth);
  const formattedBirthDate = birthDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  // Embed logos as base64 data URIs — avoids file:// access issues in Puppeteer sandbox
  const oyoLogoData = await fs.readFile(path.resolve(logosDir, "OyoLogo.png"));
  const oyoStateLogo = `data:image/png;base64,${oyoLogoData.toString("base64")}`;
  const amotekunData = await fs.readFile(path.resolve(logosDir, "amo.jpg"));
  const amotekunLogo = `data:image/jpeg;base64,${amotekunData.toString("base64")}`;

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
    AMOTEKUN_LOGO: amotekunLogo,
  };

  html = replaceConditionalBlocks(html, replacements);

  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    html = html.replace(regex, value);
  }

  return html;
}

/* ─── Initialize the browser cluster (called once at startup) ─── */
async function initCluster() {
  cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 5,
    puppeteerOptions: {
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
    timeout: 60000,
    retryLimit: 2,
    retryDelay: 1000,
    monitor: false,
  });

  cluster.on("taskerror", (err) => {
    console.error("Cluster task error:", err.message);
  });

  console.log("Browser cluster ready (maxConcurrency=5)");
}

/* ─── Generate a PDF — each request runs in its own browser context ─── */
async function generatePDF(data) {
  return new Promise((resolve, reject) => {
    activeJobs++;

    cluster.queue(data, async ({ page, data }) => {
      try {
        const html = await buildHTML(data);
        await page.setContent(html, { waitUntil: "domcontentloaded" });
        const pdf = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
        });
        resolve(pdf);
      } catch (err) {
        reject(err);
      } finally {
        activeJobs--;
      }
    });
  });
}

/* ─── Graceful shutdown ─── */
async function closeCluster() {
  if (cluster) {
    await cluster.idle();
    await cluster.close();
  }
}

/* ─── Active job count for health check ─── */
function getActiveJobs() {
  return activeJobs;
}

module.exports = { initCluster, generatePDF, closeCluster, getActiveJobs };
