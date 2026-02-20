const fs = require("fs").promises;
const path = require("path");
const { Mutex } = require("async-mutex");

const counterFile = path.join(__dirname, "../counter.json");
const mutex = new Mutex();

async function ensureCounterExists() {
  try {
    await fs.access(counterFile);
  } catch {
    await fs.writeFile(counterFile, JSON.stringify({ current: 3000 }));
  }
}

async function getNextFormNumber() {
  const release = await mutex.acquire();
  try {
    await ensureCounterExists();
    const data = await fs.readFile(counterFile, "utf-8");
    let counter = JSON.parse(data);
    
    counter.current += 1;
    await fs.writeFile(counterFile, JSON.stringify(counter, null, 2));
    
    const paddedNumber = String(counter.current).padStart(4, "0");
    return `AMOE${paddedNumber}`;
  } finally {
    release();
  }
}

module.exports = {
  getNextFormNumber,
};
