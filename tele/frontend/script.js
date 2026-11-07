(() => {
  const MAX_BYTES = 50_000_000;
  const apiBase = (window.APP_CONFIG?.API_BASE_URL || "").replace(/\/+$/, "");
  const form = document.getElementById("uploadForm");
  const fileInput = document.getElementById("fileInput");
  const dropzone = document.getElementById("dropzone");
  const fileMeta = document.getElementById("fileMeta");
  const statusEl = document.getElementById("status");
  const submitButton = document.getElementById("submitButton");
  const progressWrap = document.getElementById("progressWrap");
  let selectedFile = null;

  const formatSize = bytes => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  function setStatus(message, type = "") {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  function chooseFile(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      selectedFile = null;
      fileInput.value = "";
      fileMeta.hidden = true;
      setStatus("File vượt quá giới hạn 50 MB. Vui lòng chọn file nhỏ hơn.", "error");
      return;
    }
    selectedFile = file;
    document.getElementById("fileName").textContent = file.name;
    document.getElementById("fileSize").textContent = formatSize(file.size);
    document.getElementById("fileTitle").textContent = "Đã chọn file";
    document.getElementById("fileHint").textContent = "Bạn có thể chọn file khác nếu muốn";
    fileMeta.hidden = false;
    setStatus("");
  }

  fileInput.addEventListener("change", () => chooseFile(fileInput.files[0]));
  document.getElementById("removeFile").addEventListener("click", () => {
    selectedFile = null;
    fileInput.value = "";
    fileMeta.hidden = true;
    document.getElementById("fileTitle").textContent = "Chọn file để tải lên";
    document.getElementById("fileHint").textContent = "Nhấn để chọn hoặc kéo thả file vào đây";
    setStatus("");
  });

  ["dragenter", "dragover"].forEach(eventName => dropzone.addEventListener(eventName, event => {
    event.preventDefault(); dropzone.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach(eventName => dropzone.addEventListener(eventName, event => {
    event.preventDefault(); dropzone.classList.remove("drag");
  }));
  dropzone.addEventListener("drop", event => chooseFile(event.dataTransfer.files[0]));

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!apiBase || apiBase.includes("YOUR-RENDER-SERVICE")) {
      setStatus("Website chưa được cấu hình địa chỉ Render API trong frontend/config.js.", "error");
      return;
    }
    if (!selectedFile) {
      setStatus("Vui lòng chọn một file trước khi gửi.", "error");
      return;
    }
    const password = document.getElementById("password").value;
    if (!password) {
      setStatus("Vui lòng nhập mật khẩu gửi file.", "error");
      return;
    }

    const data = new FormData();
    data.append("file", selectedFile, selectedFile.name);
    data.append("password", password);

    submitButton.disabled = true;
    progressWrap.hidden = false;
    document.getElementById("progressBar").style.width = "0%";
    document.getElementById("progressText").textContent = "Đang tải file lên máy chủ...";
    document.getElementById("progressPercent").textContent = "0%";
    setStatus("");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBase}/api/upload`);
    xhr.upload.addEventListener("progress", event => {
      if (!event.lengthComputable) return;
      const percent = Math.min(99, Math.round(event.loaded / event.total * 100));
      document.getElementById("progressBar").style.width = `${percent}%`;
      document.getElementById("progressPercent").textContent = `${percent}%`;
    });
    xhr.addEventListener("load", () => {
      submitButton.disabled = false;
      let result = {};
      try { result = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        document.getElementById("progressBar").style.width = "100%";
        document.getElementById("progressPercent").textContent = "100%";
        document.getElementById("progressText").textContent = "Hoàn tất";
        setStatus("Gửi file đến Telegram thành công!", "success");
        selectedFile = null;
        fileInput.value = "";
        fileMeta.hidden = true;
        document.getElementById("fileTitle").textContent = "Chọn file để tải lên";
        document.getElementById("fileHint").textContent = "Nhấn để chọn hoặc kéo thả file vào đây";
        form.reset();
      } else {
        progressWrap.hidden = true;
        setStatus(result.error || "Không thể gửi file. Vui lòng thử lại.", "error");
      }
    });
    xhr.addEventListener("error", () => {
      submitButton.disabled = false;
      progressWrap.hidden = true;
      setStatus("Không kết nối được máy chủ. Kiểm tra Render API hoặc thử lại sau.", "error");
    });
    xhr.addEventListener("timeout", () => {
      submitButton.disabled = false;
      progressWrap.hidden = true;
      setStatus("Yêu cầu quá thời gian chờ. Vui lòng thử lại.", "error");
    });
    xhr.timeout = 180000;
    xhr.send(data);
  });
})();
