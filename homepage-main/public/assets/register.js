// 公开注册:邮箱验证码 + 选填 QQ。注册成功默认 guest,自动登录后跳首页。
const el = (id) => document.getElementById(id);

function toast(msg, ok) {
  if (window.siteToast) window.siteToast(msg, ok ? "success" : "error");
  const t = el("register-toast");
  if (!t) return;
  t.textContent = msg;
  t.style.color = ok ? "#16a34a" : "#dc2626";
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error((data.error || "请求失败") + (data.ref ? `(错误码 ${data.ref})` : ""));
  return data;
}

function startCountdown(btn, sec) {
  btn.disabled = true;
  const tick = () => {
    btn.textContent = `${sec}s 后重发`;
    if (sec <= 0) {
      btn.disabled = false;
      btn.textContent = "获取验证码";
      return;
    }
    sec -= 1;
    setTimeout(tick, 1000);
  };
  tick();
}

const sendBtn = el("send-code-btn");
if (sendBtn) {
  sendBtn.addEventListener("click", async () => {
    const email = el("reg-email").value.trim();
    if (!email) return toast("请先填写邮箱", false);
    sendBtn.disabled = true;
    if (window.siteToast) window.siteToast("正在发送验证码…", "info");
    try {
      await postJson("/api/auth/send-code", { email });
      toast("验证码已发送,请查收邮箱(10 分钟内有效)。", true);
      startCountdown(sendBtn, 60);
    } catch (err) {
      sendBtn.disabled = false;
      toast(`发送失败:${err instanceof Error ? err.message : String(err)}`, false);
    }
  });
}

const form = el("register-form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
    try {
      const data = await postJson("/api/auth/register", {
        email: el("reg-email").value.trim(),
        code: el("reg-code").value.trim(),
        username: el("reg-username").value.trim(),
        displayName: el("reg-display-name").value.trim(),
        qq: el("reg-qq").value.trim(),
        password: el("reg-password").value,
      });
      toast("注册成功,正在进入…", true);
      const url = data.user?.profileUrl || "/";
      setTimeout(() => window.location.assign(url), 800);
    } catch (err) {
      toast(`注册失败:${err instanceof Error ? err.message : String(err)}`, false);
    } finally {
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    }
  });
}
