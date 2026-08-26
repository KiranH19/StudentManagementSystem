/* =========================================================
   settings.js — Institute profile (name, logo, address, phone,
   email) and theme preference.
   ========================================================= */
(function(){
  document.addEventListener('DOMContentLoaded', () => {
    initLayout();

    const settings = dbGet(DB.SETTINGS, {});
    const form = document.getElementById('settingsForm');
    form.instituteName.value = settings.instituteName || '';
    form.address.value = settings.address || '';
    form.phone.value = settings.phone || '';
    form.email.value = settings.email || '';
    if(settings.logo){
      document.getElementById('logoPreview').src = settings.logo;
      document.getElementById('logoPreview').style.display = 'block';
      document.getElementById('logoIcon').style.display = 'none';
    }

    const logoBox = document.getElementById('logoBox');
    const logoInput = document.getElementById('logoInput');
    logoBox.addEventListener('click', ()=>logoInput.click());
    logoInput.addEventListener('change', ()=>{
      const file = logoInput.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = e=>{
        document.getElementById('logoPreview').src = e.target.result;
        document.getElementById('logoPreview').style.display = 'block';
        document.getElementById('logoIcon').style.display = 'none';
      };
      reader.readAsDataURL(file);
    });

    form.addEventListener('submit', e=>{
      e.preventDefault();
      if(!validateRequired(form)){ toast('Missing information', 'Please fill all required fields.', 'error'); return; }
      const logo = document.getElementById('logoPreview').style.display !== 'none' ? document.getElementById('logoPreview').src : '';
      const updated = {
        instituteName: form.instituteName.value.trim(),
        address: form.address.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        logo
      };
      dbSet(DB.SETTINGS, updated);
      toast('Settings saved', 'Your institute profile has been updated.', 'success');
      document.querySelectorAll('.js-institute-name').forEach(el=>el.textContent = updated.instituteName);
    });

    // Theme toggle button (mirrors topbar toggle)
    function refreshThemeLabel(){
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.getElementById('themeLabel').textContent = isDark ? 'Disable Dark Mode' : 'Enable Dark Mode';
    }
    refreshThemeLabel();
    document.getElementById('settingsThemeToggle').addEventListener('click', ()=>{
      const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(now);
      localStorage.setItem(DB.THEME, now);
      refreshThemeLabel();
    });
  });
})();
