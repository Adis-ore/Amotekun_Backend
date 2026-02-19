module.exports = (req, res, next) => {
  const portalLaunchDate = process.env.PORTAL_LAUNCH_DATE;
  
  if (!portalLaunchDate) {
    return res.status(500).json({ error: "Portal launch date not configured" });
  }
  
  const launchDate = new Date(portalLaunchDate);
  const deadline = new Date(launchDate);
  deadline.setDate(deadline.getDate() + 21);
  
  if (Date.now() > deadline) {
    return res.status(403).json({
      error: "Registration portal is closed",
      closedAt: deadline.toISOString(),
    });
  }
  
  next();
};
