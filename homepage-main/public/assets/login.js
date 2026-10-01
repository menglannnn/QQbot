// 专用登录页:登录成功后按身份跳转(员工→后台,普通用户→账户页/首页)。
const el = (id) => document.getElementById(id);
function toast(msg, ok) {
  if (window.siteToast) window.siteToast(msg, ok ? "success" : "error");
  const t = el("login-toast");
  if (!t) return;
  t.textContent = msg;
  t.style.color = ok ? "#16a34a" : "#dc2626";
}

const form = el("login-form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: el("login-username").value.trim(),
          password: el("login-password").value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (res.status === 429) throw new Error("尝试过于频繁,请稍后再试");
        if (data.ref) throw new Error(`${data.error || "登录失败"}(错误码 ${data.ref})`);
        throw new Error("用户名或密码错误");
      }
      const user = data.user;
      window.dispatchEvent(new CustomEvent("site:auth-changed", { detail: { user } }));
      toast("登录成功,正在跳转…", true);

      const perms = Array.isArray(user?.permissions) ? user.permissions : [];
      const has = (c) => perms.includes("*") || perms.includes(c);
      const staff = has("users.manage") || has("roles.configure") || has("changelog.manage") ||
        has("mods.manage") || has("developers.manage") || has("feedback.manage") || has("workshop.review");
      let target = "/account.html";
      if (user?.mustChangePassword) target = "/account.html"; // 先去改密
      else if (staff) target = "/admin.html";
      else if (user?.profileUrl) target = user.profileUrl;
      setTimeout(() => window.location.assign(target), 600);
    } catch (err) {
      toast(`登录失败:${err instanceof Error ? err.message : String(err)}`, false);
    } finally {
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
    }
  });
}
