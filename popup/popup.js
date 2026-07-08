const PLATFORMS = {
  x: {
    name: "X",
    categories: [
      { id: "following", label: "Following", desc: "关注" },
      { id: "likes", label: "Likes", desc: "点赞" },
      { id: "bookmarks", label: "Bookmarks", desc: "收藏" },
    ],
  },
  instagram: {
    name: "Instagram",
    categories: [
      { id: "following", label: "Following", desc: "关注" },
      { id: "likes", label: "Likes", desc: "点赞" },
      { id: "saved", label: "Saved", desc: "收藏" },
    ],
  },
  tiktok: {
    name: "TikTok",
    categories: [
      { id: "following", label: "Following", desc: "关注" },
      { id: "likes", label: "Likes", desc: "点赞" },
      { id: "favorites", label: "Favorites", desc: "收藏" },
    ],
  },
  bilibili: {
    name: "Bilibili",
    categories: [
      { id: "following", label: "Following", desc: "关注" },
      { id: "favorites", label: "Favorites", desc: "收藏" },
    ],
  },
  youtube: {
    name: "YouTube",
    categories: [
      { id: "subscriptions", label: "Subscriptions", desc: "订阅" },
      { id: "watchlater", label: "Watch Later", desc: "稍后观看" },
    ],
  },
};

let selectedPlatform = "x";
let selectedCategories = ["following"];
let selectedFormat = "json";

function renderCategories() {
  const container = document.getElementById("categories");
  const cats = PLATFORMS[selectedPlatform].categories;
  container.innerHTML = cats
    .map(
      (c) => `
    <div class="category-item">
      <input type="checkbox" id="cat-${c.id}" value="${c.id}"
        ${selectedCategories.includes(c.id) ? "checked" : ""}>
      <label for="cat-${c.id}">${c.label}</label>
      <span class="category-desc">${c.desc}</span>
    </div>
  `
    )
    .join("");

  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      selectedCategories = [...container.querySelectorAll("input:checked")].map((i) => i.value);
    });
  });
}

function initPlatformButtons() {
  document.querySelectorAll(".platform-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector(".platform-btn.active")?.classList.remove("active");
      btn.classList.add("active");
      selectedPlatform = btn.dataset.platform;
      renderCategories();
    });
  });
}

function initFormatButtons() {
  document.querySelectorAll(".format-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector(".format-btn.active")?.classList.remove("active");
      btn.classList.add("active");
      selectedFormat = btn.dataset.format;
    });
  });
}

function setStatus(text, type = "") {
  const el = document.getElementById("statusText");
  el.textContent = text;
  el.className = "status-text" + (type ? ` ${type}` : "");
}

async function startExport() {
  if (selectedCategories.length === 0) {
    setStatus("Please select at least one category", "error");
    return;
  }

  const btn = document.getElementById("exportBtn");
  btn.disabled = true;
  btn.textContent = "Exporting...";

  const maxItems = parseInt(document.getElementById("maxItems").value, 10) || 1000;

  try {
    const result = await chrome.runtime.sendMessage({
      action: "export",
      platform: selectedPlatform,
      categories: selectedCategories,
      format: selectedFormat,
      maxItems,
    });

    if (result.success) {
      setStatus(`Exported ${result.count} items`, "success");
    } else {
      setStatus(`Error: ${result.error}`, "error");
    }
  } catch (err) {
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Export";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initPlatformButtons();
  initFormatButtons();
  renderCategories();
  document.getElementById("exportBtn").addEventListener("click", startExport);
});
