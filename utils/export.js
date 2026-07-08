function toJSON(data) {
  return JSON.stringify(data, null, 2);
}

function toCSV(data) {
  if (!data.items || data.items.length === 0) return "";
  const headers = ["id", "username", "name", "url", "avatar_url"];
  const rows = data.items.map((item) =>
    headers.map((h) => escapeCSV(String(item[h] ?? ""))).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function escapeCSV(value) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
}

function exportData(data, format) {
  const timestamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    downloadFile(toJSON(data), `${data.platform}_${data.category}_${timestamp}.json`, "application/json");
  } else {
    downloadFile(toCSV(data), `${data.platform}_${data.category}_${timestamp}.csv`, "text/csv");
  }
}

if (typeof module !== "undefined") {
  module.exports = { toJSON, toCSV, downloadFile, exportData };
}
