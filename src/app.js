(function () {
  "use strict";

  var LogLoom = globalThis.LogLoom;
  var sourceList = document.getElementById("source-list");
  var sourceTemplate = document.getElementById("source-template");
  var errorMessage = document.getElementById("error-message");
  errorMessage.tabIndex = -1;
  var emptyState = document.getElementById("empty-state");
  var noMatch = document.getElementById("no-match");
  var tableWrap = document.getElementById("table-wrap");
  var resultBody = document.getElementById("result-body");
  var resultCount = document.getElementById("result-count");
  var filters = document.getElementById("filters");
  var exportActions = document.getElementById("export-actions");
  var sourceFilter = document.getElementById("source-filter");
  var levelFilter = document.getElementById("level-filter");
  var queryFilter = document.getElementById("query-filter");
  var events = [];
  var visibleEvents = [];
  var nextSourceNumber = 1;

  function showError(error) {
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
    errorMessage.hidden = false;
    errorMessage.focus();
  }

  function clearError() {
    errorMessage.hidden = true;
    errorMessage.textContent = "";
  }

  function byteSize(text) {
    return new TextEncoder().encode(text).length;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    return (bytes / 1024 / 1024).toFixed(2) + " MiB";
  }

  function updateByteCount(card) {
    var count = card.querySelector(".byte-count");
    var bytes = byteSize(card.querySelector(".source-text").value);
    count.textContent = formatBytes(bytes) + " / 5 MiB";
    count.classList.toggle("is-over", bytes > LogLoom.MAX_SOURCE_BYTES);
  }

  function addSource() {
    var card = sourceTemplate.content.firstElementChild.cloneNode(true);
    var number = nextSourceNumber++;
    var nameInput = card.querySelector(".source-name");
    var textInput = card.querySelector(".source-text");
    var nameLabel = card.querySelector(".source-name-field label");
    var textLabel = card.querySelector(".field:nth-child(2) label");
    nameInput.id = "source-name-" + number;
    textInput.id = "source-text-" + number;
    nameLabel.htmlFor = nameInput.id;
    textLabel.htmlFor = textInput.id;
    nameInput.value = "来源 " + number;
    textInput.placeholder = "粘贴 " + nameInput.value + " 的日志…";
    textInput.addEventListener("input", function () { updateByteCount(card); });
    card.querySelector(".remove-source").addEventListener("click", function () {
      card.remove();
      if (!sourceList.children.length) addSource();
    });
    sourceList.appendChild(card);
    nameInput.focus();
  }

  function collectSources() {
    var sources = [];
    sourceList.querySelectorAll(".source-card").forEach(function (card) {
      var name = card.querySelector(".source-name").value.trim();
      var text = card.querySelector(".source-text").value;
      if (!name || !text) throw new Error("每个来源都需要名称和日志文本。");
      if (byteSize(text) > LogLoom.MAX_SOURCE_BYTES) {
        throw new Error("“" + name + "”超过每来源 5 MiB 的限制。");
      }
      sources.push({ name: name, text: text });
    });
    return sources;
  }

  function appendCell(row, label, value, className) {
    var cell = document.createElement("td");
    cell.dataset.label = label;
    cell.textContent = value == null ? "" : String(value);
    if (className) cell.className = className;
    row.appendChild(cell);
    return cell;
  }

  function renderResults() {
    resultBody.replaceChildren();
    visibleEvents.forEach(function (event) {
      var row = document.createElement("tr");
      appendCell(row, "时间", event.timestamp == null ? "Unparsed" : event.timestamp);
      appendCell(row, "来源", event.source);
      var levelCell = appendCell(row, "级别", "");
      var badge = document.createElement("span");
      badge.className = "level";
      badge.dataset.level = event.level;
      badge.textContent = event.level;
      levelCell.appendChild(badge);
      appendCell(row, "消息", event.message, "message-cell");
      appendCell(row, "原始日志", event.raw, "raw-cell");
      resultBody.appendChild(row);
    });

    var hasResults = visibleEvents.length > 0;
    resultCount.textContent = "显示 " + visibleEvents.length + " / " + events.length + " 条";
    tableWrap.hidden = !hasResults;
    noMatch.hidden = hasResults;
    exportActions.hidden = !hasResults;
  }

  function applyFilters() {
    try {
      visibleEvents = LogLoom.filterEvents(events, {
        sources: sourceFilter.value ? [sourceFilter.value] : [],
        levels: levelFilter.value ? [levelFilter.value] : [],
        query: queryFilter.value
      });
      clearError();
      renderResults();
    } catch (error) {
      showError(error);
    }
  }

  function replaceOptions(select, firstLabel, values) {
    select.replaceChildren();
    var first = document.createElement("option");
    first.value = "";
    first.textContent = firstLabel;
    select.appendChild(first);
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function parse() {
    clearError();
    try {
      var offsetInput = document.getElementById("utc-offset");
      events = LogLoom.parseSources(collectSources(), offsetInput.value);
      visibleEvents = events;

      var sourceNames = [];
      events.forEach(function (event) {
        if (!sourceNames.includes(event.source)) sourceNames.push(event.source);
      });
      replaceOptions(sourceFilter, "全部来源", sourceNames);
      replaceOptions(levelFilter, "全部级别", LogLoom.LEVELS);
      queryFilter.value = "";
      filters.hidden = false;
      emptyState.hidden = true;
      renderResults();
      document.getElementById("results-title").scrollIntoView({ block: "start" });
    } catch (error) {
      showError(error);
    }
  }

  function download(filename, contents, type) {
    var url = URL.createObjectURL(new Blob([contents], { type: type }));
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportTimeline(format) {
    try {
      clearError();
      if (format === "markdown") {
        download("logloom-timeline.md", LogLoom.toMarkdown(visibleEvents), "text/markdown;charset=utf-8");
      } else {
        download("logloom-timeline.json", LogLoom.toJson(visibleEvents), "application/json;charset=utf-8");
      }
    } catch (error) {
      showError(error);
    }
  }

  if (!LogLoom) {
    showError(new Error("LogLoom 核心脚本未能加载。"));
    document.getElementById("parse-button").disabled = true;
    return;
  }

  document.getElementById("add-source").addEventListener("click", addSource);
  document.getElementById("parse-button").addEventListener("click", parse);
  sourceFilter.addEventListener("change", applyFilters);
  levelFilter.addEventListener("change", applyFilters);
  queryFilter.addEventListener("input", applyFilters);
  document.getElementById("download-markdown").addEventListener("click", function () { exportTimeline("markdown"); });
  document.getElementById("download-json").addEventListener("click", function () { exportTimeline("json"); });
  addSource();
}());
