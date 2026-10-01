// 账户设置:自助改资料 / 头像 / 密码。
const el = (id) => document.getElementById(id);
function toast(id, msg, ok) {
  if (window.siteToast) window.siteToast(msg, ok ? "success" : "error");
  const t = el(id);
  if (!t) return;
  t.textContent = msg;
  t.style.color = ok ? "#16a34a" : "#dc2626";
}
async function api(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error((data.error || "请求失败") + (data.ref ? `(错误码 ${data.ref})` : ""));
  return data;
}
const json = (url, method, body) => api(url, {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

let me = null;

function fill(user) {
  me = user;
  el("account-who").textContent = `你好,${user.displayName || user.username}`;
  el("account-username").textContent = user.username;
  el("account-role").textContent = `${user.roleName}(L${user.level})`;
  el("account-display-name").value = user.displayName || "";
  el("account-qq").value = user.qq || "";
  el("account-intro").value = user.intro || "";
  el("account-avatar-preview").src = user.avatar || "/assets/logo.png";
}

async function boot() {
  let data;
  try {
    data = await api("/api/auth/me");
  } catch {
    data = { user: null };
  }
  if (!data.user) {
    el("account-who").textContent = "未登录";
    el("account-guard").hidden = false;
    el("account-body").hidden = true;
    return;
  }
  el("account-guard").hidden = true;
  el("account-body").hidden = false;
  fill(data.user);
  initModToken(data.user);
}

// 保存资料
const profileForm = el("profile-form");
if (profileForm) {
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await json("/api/auth/profile", "PATCH", {
        displayName: el("account-display-name").value.trim(),
        qq: el("account-qq").value.trim(),
        intro: el("account-intro").value.trim(),
      });
      fill(data.user);
      toast("profile-toast", "资料已保存。", true);
      if (window.__SITE_REFRESH_AUTH) window.__SITE_REFRESH_AUTH();
    } catch (err) {
      toast("profile-toast", `保存失败:${err instanceof Error ? err.message : String(err)}`, false);
    }
  });
}

// 上传头像
const avatarFile = el("account-avatar-file");
if (avatarFile) {
  avatarFile.addEventListener("change", async () => {
    const file = avatarFile.files && avatarFile.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast("profile-toast", "头像不能超过 10MB。", false);
    try {
      const buf = await file.arrayBuffer();
      const data = await api("/api/auth/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(file.name) },
        body: buf,
      });
      fill(data.user);
      toast("profile-toast", "头像已更新。", true);
      if (window.__SITE_REFRESH_AUTH) window.__SITE_REFRESH_AUTH();
    } catch (err) {
      toast("profile-toast", `上传失败:${err instanceof Error ? err.message : String(err)}`, false);
    } finally {
      avatarFile.value = "";
    }
  });
}

// 改密码
const pwForm = el("password-form");
if (pwForm) {
  pwForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await json("/api/auth/change-password", "POST", {
        oldPassword: el("account-old-password").value,
        newPassword: el("account-new-password").value,
      });
      el("account-old-password").value = "";
      el("account-new-password").value = "";
      toast("password-toast", "密码已修改。", true);
    } catch (err) {
      toast("password-toast", `修改失败:${err instanceof Error ? err.message : String(err)}`, false);
    }
  });
}

// Mod 授权令牌
async function loadModToken() {
  try {
    const data = await api("/api/mod/token");
    if (!data.token) {
      el("mod-token-empty").hidden = false;
      el("mod-token-info").hidden = true;
      return;
    }
    el("mod-token-empty").hidden = true;
    el("mod-token-info").hidden = false;
    el("mod-token-value").value = data.token.token;

    // 绑定状态提示
    const statusEl = el("mod-token-status");
    if (data.token.hasBound) {
      statusEl.innerHTML = `<span style="color:#16a34a">✓ 已绑定设备</span>（绑定于 ${data.token.boundAt?.slice(0,10) ?? "—"}）`;
    } else {
      statusEl.innerHTML = `<span style="color:#ea580c">未绑定设备</span>，首次启动游戏后自动绑定。`;
    }

    // 重置按钮冷却倒计时（24小时）
    const resetBtn = el("mod-token-reset");
    if (data.token.resetAt) {
      const lastReset = new Date(data.token.resetAt).getTime();
      const cooldownMs = 24 * 3600 * 1000;

      const tick = () => {
        const remaining = cooldownMs - (Date.now() - lastReset);
        if (remaining <= 0) {
          clearInterval(window._resetCooldownTimer);
          resetBtn.disabled = false;
          resetBtn.textContent = "重置设备绑定";
          return;
        }
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        const pad = n => String(n).padStart(2, "0");
        resetBtn.disabled = true;
        resetBtn.textContent = `冷却中 ${pad(h)}:${pad(m)}:${pad(s)}`;
      };

      tick();
      clearInterval(window._resetCooldownTimer);
      window._resetCooldownTimer = setInterval(tick, 1000);
    }
  } catch (err) {
    toast("mod-token-toast", `加载令牌失败:${err instanceof Error ? err.message : String(err)}`, false);
  }
}

function initModToken(user) {
  if (user.level < 1) return;
  el("mod-token-panel").hidden = false;
  loadModToken();

  // 生成令牌
  const generateBtn = el("mod-token-generate");
  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      generateBtn.disabled = true;
      try {
        await json("/api/mod/token/generate", "POST", {});
        toast("mod-token-toast", "令牌已生成。", true);
        await loadModToken();
      } catch (err) {
        toast("mod-token-toast", `生成失败:${err instanceof Error ? err.message : String(err)}`, false);
        generateBtn.disabled = false;
      }
    });
  }

  // 复制令牌
  const copyBtn = el("mod-token-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const val = el("mod-token-value").value;
      navigator.clipboard.writeText(val).then(() => {
        copyBtn.textContent = "已复制";
        setTimeout(() => copyBtn.textContent = "复制", 2000);
      });
    });
  }

  // 重置绑定
  const resetBtn = el("mod-token-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (!confirm("确认重置设备绑定？原设备将无法再使用此令牌（24小时冷却）。")) return;
      resetBtn.disabled = true;
      try {
        await json("/api/mod/token/reset", "POST", {});
        toast("mod-token-toast", "设备绑定已重置，下次启动游戏将重新绑定。", true);
        await loadModToken();
      } catch (err) {
        toast("mod-token-toast", `重置失败:${err instanceof Error ? err.message : String(err)}`, false);
        resetBtn.disabled = false;
      }
    });
  }
}

boot();
