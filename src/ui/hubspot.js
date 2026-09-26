// Optional HubSpot submission (config.hubspot.enabled). Never blocks results.

export async function sendToHubspot(hubspot, record, firstName, contact) {
  if (!hubspot?.enabled || !record) return false;
  const r = record.results;
  const fields = {
    firstname: firstName,
    lastname: contact.lastName,
    email: contact.email,
    healthspan_age: r.healthspanAge === null ? '' : String(Math.round(r.healthspanAge)),
    healthspan_score: String(r.score),
  };
  const body = {
    fields: Object.entries(fields).map(([name, value]) => ({ name, value: String(value ?? '').trim() })),
    context: { pageUri: document.referrer || window.location.href, pageName: 'Healthspan Challenge Calculator' },
  };
  const res = await fetch(hubspot.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });
  return res.ok;
}
