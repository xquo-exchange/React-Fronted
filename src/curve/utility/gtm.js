export const safePushToDataLayer = (eventData) => {
  // Guarantee GTM dataLayer exists
  if (typeof window === "undefined") return; // SSR safety
  if (!window.dataLayer) window.dataLayer = [];

  // Clone to avoid React Proxy issues
  const payload = JSON.parse(JSON.stringify(eventData));

  try {
    window.dataLayer.push(payload);
    console.log(`📤 GTM push →`, payload.event, payload);
  } catch (err) {
    console.error("❌ Failed to push to GTM dataLayer:", err, payload);
  }
};
