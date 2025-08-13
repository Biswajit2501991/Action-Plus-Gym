/*
 * Action Plus Gym Management Application
 * This script powers both the login page and the main application. It handles
 * authentication, navigation, member management, PDF generation, and basic
 * search functionality. Data is persisted in localStorage for simplicity.
 */

// ------------------------------
// Role and permission definitions
// ------------------------------
/*
 * We implement a simple role-based access control system. Each role maps to a
 * set of view permissions corresponding to sections of the application. Users
 * may optionally have explicit grants or revokes that override the base
 * permissions associated with their role. The effective permissions array is
 * computed by combining the role permissions with grants and subtracting
 * revokes.
 */
const rolePermissions = {
  'admin': ['dashboard', 'members', 'sms', 'finance', 'staff', 'settings', 'logs'],
  'staff-basic': ['dashboard', 'members', 'sms'],
  'staff-extended': ['dashboard', 'members', 'sms', 'staff']
};

// A flat list of all possible permissions (used for generating toggle UI)
const allPermissions = ['dashboard', 'members', 'sms', 'finance', 'staff', 'settings', 'logs'];

// In-memory users list loaded from localStorage on startup
let users = [];
// Tracks index of user currently being edited in the staff form
let editingUserIndex = null;

// In-memory member list loaded from localStorage on startup
let members = [];
let editIndex = null; // Tracks index of member being edited

// ------------------------------
// Dropdown settings management
// ------------------------------
/*
 * Dropdown values for gender, status, payment methods, membership plans and
 * hold durations are stored in a single settings object. These values can
 * be modified via the Settings page. The settings object is persisted
 * under the key 'apgm.settings.v1'. Each property holds an array of
 * strings. When the application starts, default values are seeded if no
 * settings exist.
 */
let settings = {};

function loadSettings() {
  try {
    const saved = localStorage.getItem('apgm.settings.v1');
    if (saved) {
      settings = JSON.parse(saved);
    } else {
      settings = {};
    }
    // Define default values for each settings category. These will be used
    // if the stored value is missing or of the wrong type. This ensures
    // backwards compatibility with older formats.
    const defaultSettings = {
      gender: ['Male', 'Female', 'Other'],
      status: ['Active', 'Hold', 'Deactivated', 'Cancelled'],
      paymentMethod: ['Cash', 'Google Pay', 'PhonePe', 'Cash+Online'],
      membershipPlan: [
        'Basic Plan',
        'Basic-Weekly-Plan',
        'PT - RAJA',
        'Yoga',
        '1 Week PT',
        '2 Week PT',
        '3 Months Basic',
        '6 Months Basic',
        'PT - Kaushik',
        'PT - Biswajit'
      ],
      holdDuration: [
        '1 Month',
        '2 Months',
        '3 Months',
        '4 Months',
        '5 Months',
        '6 Months',
        'Rejoining 6-12 months',
        'Readmission after 1 year'
      ],
      templates: {
        gmail: '',
        welcome: '',
        reminder: '',
        success: '',
        fine: '',
        hold: '',
        deactivate: ''
      }
    };
    // Merge defaults into settings; if property missing or incorrect type, assign default
    Object.keys(defaultSettings).forEach(key => {
      const defVal = defaultSettings[key];
      const savedVal = settings[key];
      if (Array.isArray(defVal)) {
        if (!Array.isArray(savedVal)) {
          settings[key] = [...defVal];
        }
      } else if (typeof defVal === 'object') {
        if (typeof savedVal !== 'object' || savedVal === null) {
          settings[key] = { ...defVal };
        } else {
          // Ensure each template key exists
          Object.keys(defVal).forEach(tKey => {
            if (typeof settings[key][tKey] !== 'string') {
              settings[key][tKey] = '';
            }
          });
        }
      }
    });
    saveSettings();
  } catch (err) {
    // Reset to defaults on parse error
    settings = {
      gender: ['Male', 'Female', 'Other'],
      status: ['Active', 'Hold', 'Deactivated', 'Cancelled'],
      paymentMethod: ['Cash', 'Google Pay', 'PhonePe', 'Cash+Online'],
      membershipPlan: [
        'Basic Plan',
        'Basic-Weekly-Plan',
        'PT - RAJA',
        'Yoga',
        '1 Week PT',
        '2 Week PT',
        '3 Months Basic',
        '6 Months Basic',
        'PT - Kaushik',
        'PT - Biswajit'
      ],
      holdDuration: [
        '1 Month',
        '2 Months',
        '3 Months',
        '4 Months',
        '5 Months',
        '6 Months',
        'Rejoining 6-12 months',
        'Readmission after 1 year'
      ],
      templates: {
        gmail: '',
        welcome: '',
        reminder: '',
        success: '',
        fine: '',
        hold: '',
        deactivate: ''
      }
    };
    saveSettings();
  }
}

function saveSettings() {
  localStorage.setItem('apgm.settings.v1', JSON.stringify(settings));
}

/* Populate dropdown fields in the member form from settings. This is called
 * after loading settings and whenever settings change. */
function populateDropdowns() {
  // Gender
  const genderSelect = document.getElementById('mGender');
  if (genderSelect) {
    genderSelect.innerHTML = '<option value="">Select</option>';
    settings.gender.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      genderSelect.appendChild(opt);
    });
  }
  // Status
  const statusSelect = document.getElementById('mStatus');
  if (statusSelect) {
    statusSelect.innerHTML = '';
    settings.status.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      statusSelect.appendChild(opt);
    });
  }
  // Membership plan
  const planSelect = document.getElementById('mPlan');
  if (planSelect) {
    planSelect.innerHTML = '<option value="">Select Plan</option>';
    settings.membershipPlan.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      planSelect.appendChild(opt);
    });
  }
  // Hold duration
  const holdSelect = document.getElementById('mHold');
  if (holdSelect) {
    holdSelect.innerHTML = '<option value="">Select duration</option>';
    settings.holdDuration.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      holdSelect.appendChild(opt);
    });
    // Initially disabled; the toggleHoldField will enable when needed
    if (document.getElementById('mStatus').value !== 'Hold') {
      holdSelect.disabled = true;
    }
  }
  // Payment method
  const paymentSelect = document.getElementById('mPaymentMethod');
  if (paymentSelect) {
    paymentSelect.innerHTML = '<option value="">Select method</option>';
    settings.paymentMethod.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      paymentSelect.appendChild(opt);
    });
  }
}

/* Track unsaved changes on the member form. Attach listeners to all
 * editable fields so that any change sets the unsavedChanges flag to true.
 */
function setupUnsavedTracking() {
  const form = document.getElementById('memberForm');
  if (!form) return;
  const fields = form.querySelectorAll('input, select, textarea');
  fields.forEach(field => {
    // ignore read-only fields
    if (field.readOnly) return;
    field.addEventListener('input', () => { unsavedChanges = true; });
    field.addEventListener('change', () => { unsavedChanges = true; });
  });
}

/* Render Settings page using cards with chips for each dropdown category and
 * editable templates for messages. This function is called whenever the
 * settings page is shown or when settings are updated. */
function renderSettings() {
  const container = document.getElementById('settingsContainer');
  if (!container) return;
  container.innerHTML = '';
  // Define categories to show as chips. Each has a key in the settings object
  const categories = [
    { key: 'gender', label: 'Gender', placeholder: 'Enter new gender' },
    { key: 'status', label: 'Status', placeholder: 'Enter new status' },
    { key: 'paymentMethod', label: 'Payment Method', placeholder: 'Enter new payment method' },
    { key: 'membershipPlan', label: 'Membership Plan', placeholder: 'Enter new plan' },
    { key: 'holdDuration', label: 'Hold Duration', placeholder: 'Enter new duration' }
  ];
  // Create a card for each dropdown category
  categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'settings-category';
    // Heading
    const h3 = document.createElement('h3');
    h3.textContent = cat.label;
    card.appendChild(h3);
    // Chip container
    const chipsDiv = document.createElement('div');
    settings[cat.key].forEach((val, idx) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = val;
      // Delete icon inside chip
      const del = document.createElement('span');
      del.className = 'chip-delete';
      del.innerHTML = '\u2716'; // multiplication sign as delete
      del.title = 'Remove';
      del.onclick = () => {
        settings[cat.key].splice(idx, 1);
        saveSettings();
        populateDropdowns();
        renderSettings();
        showToast('Value deleted');
      };
      chip.appendChild(del);
      chipsDiv.appendChild(chip);
    });
    card.appendChild(chipsDiv);
    // Add new value input and button
    const addDiv = document.createElement('div');
    addDiv.style.marginTop = '0.5rem';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = cat.placeholder;
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.onclick = () => {
      const newVal = input.value.trim();
      if (newVal && !settings[cat.key].includes(newVal)) {
        settings[cat.key].push(newVal);
        saveSettings();
        populateDropdowns();
        renderSettings();
        input.value = '';
        showToast('Value added');
      }
    };
    addDiv.appendChild(input);
    addDiv.appendChild(addBtn);
    card.appendChild(addDiv);
    container.appendChild(card);
  });
  // Render message templates as separate cards
  const templateLabels = {
    gmail: 'Gmail',
    welcome: 'Welcome Message',
    reminder: 'Reminder Message',
    success: 'Success SMS',
    fine: 'Fine SMS',
    hold: 'Hold SMS',
    deactivate: 'Deactivate SMS'
  };
  Object.keys(templateLabels).forEach(key => {
    const tCard = document.createElement('div');
    tCard.className = 'template-card';
    const title = document.createElement('h3');
    title.textContent = templateLabels[key];
    tCard.appendChild(title);
    const textarea = document.createElement('textarea');
    textarea.value = settings.templates[key] || '';
    textarea.placeholder = `Enter ${templateLabels[key].toLowerCase()}`;
    // Save value on blur
    textarea.onchange = () => {
      settings.templates[key] = textarea.value;
      saveSettings();
      showToast('Template saved');
    };
    tCard.appendChild(textarea);
    container.appendChild(tCard);
  });
}

/* Display a non-blocking toast notification. Messages are shown in the
 * top-right corner and automatically disappear after a few seconds. */
function showToast(msg, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') toast.classList.add('error');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
    if (container.childElementCount === 0) {
      container.remove();
    }
  }, 3500);
}

/* Handler for close icon on non-dashboard pages. Navigates back to the
 * dashboard. If unsaved changes handling is added in the future, this
 * function can prompt the user before discarding changes. */
function handleClosePage() {
  // If there are unsaved changes in the member form, ask for confirmation
  if (unsavedChanges) {
    const ok = confirm('You have unsaved changes. Leave this page and return to Dashboard?');
    if (!ok) {
      return;
    }
  }
  // Reset the form and unsaved flag when leaving
  if (document.getElementById('memberForm')) {
    clearMemberForm();
  }
  unsavedChanges = false;
  showSection('dashboard');
}

// Flag used to determine if a member should be saved as a new record even
// when editing an existing one. This is set by the Save button's click
// handler and reset after saving. When true, saveMember() will push a
// new record rather than updating the existing record at editIndex.
let saveAsNew = false;

// Flag indicating whether there are unsaved changes in the member form. When
// true and the user attempts to navigate away via the close icon, we will
// prompt for confirmation. This is set whenever any editable field in the
// member form changes and reset after saving or clearing the form.
let unsavedChanges = false;

// ------------------------------
// Dashboard state for segmented views
// ------------------------------
/*
 * The dashboard is split into four tables (Active, Hold, Cancelled, Deactivated).
 * Each table has its own sort key/direction and current page. A global search
 * term filters across all four tables at once. The default sort for each
 * status is by joinDate descending. When a header is clicked the sort order
 * cycles: asc → desc → default. Pagination defaults to 10 rows per table.
 */
const dashboardState = {
  Active: { sortKey: 'joinDate', sortDir: 'desc', page: 1 },
  Hold: { sortKey: 'joinDate', sortDir: 'desc', page: 1 },
  Cancelled: { sortKey: 'joinDate', sortDir: 'desc', page: 1 },
  Deactivated: { sortKey: 'joinDate', sortDir: 'desc', page: 1 },
  searchQuery: ''
};
const pageSize = 10;

// ------------------------------
// Admin logs state and settings
// ------------------------------
/*
 * Logs are stored in localStorage under the key 'apgm.logs.v1'. When actions
 * occur (login, logout, member create/update, user create/update), a log
 * event is recorded via logEvent(). The logs page filters by date, actor,
 * action and search term, with its own pagination. Only the last 90 days of
 * logs are kept, capped to 5,000 entries.
 */
const logsState = {
  from: '',     // ISO date string for start of range
  to: '',       // ISO date string for end of range
  actor: '',    // username filter
  action: '',   // action filter (e.g., member.create)
  search: '',   // free text search
  page: 1,
  pageSize: 25
};
let logsFilterTimeout = null;

// Check if we are on the login page or the app page
document.addEventListener('DOMContentLoaded', () => {
  const isLoginPage = document.body.classList.contains('login-page');
  if (isLoginPage) {
    // Attach login handler and load users
    loadUsers();
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);
  } else {
    // Ensure user is logged in
    // Load users and members
    loadUsers();
    checkAuthentication();
    // Load members from storage
    loadMembers();
    // Load dropdown settings and populate selects
    loadSettings();
    populateDropdowns();
    // Populate dynamic elements
    populatePaymentMonths();
    // Attach field highlighting handlers to member form inputs
    setupFieldHighlights();
    // Setup unsaved change tracking on form fields
    setupUnsavedTracking();
    // Automatically compute Payment By when billing date changes
    const billInput = document.getElementById('mBill');
    const payByInput = document.getElementById('mPaymentBy');
    if (billInput && payByInput) {
      billInput.addEventListener('change', () => {
        const val = billInput.value;
        if (!val) {
          payByInput.value = '';
        } else {
          const d = new Date(val);
          if (!isNaN(d)) {
            d.setDate(d.getDate() + 7);
            payByInput.value = d.toISOString().split('T')[0];
          }
        }
      });
    }
    // Set default finance date range (last 30 days) on initial load
    setDefaultFinanceRange();
    // Initially render staff table (if admin navigates to staff)
    renderStaffTable();
    // Render dashboard
    renderDashboard();
    // Set initial view
    showSection('dashboard');
  }
});

/* Authentication logic */
function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  // Ensure users are loaded
  loadUsers();
  // Find matching user
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    // Compute effective permissions and store user in sessionStorage
    const effective = computeEffectivePermissions(user);
    const storedUser = { ...user, effectivePermissions: effective };
    sessionStorage.setItem('currentUser', JSON.stringify(storedUser));
    // Log login event
    try {
      logEvent({
        actor: user.username,
        action: 'auth.login',
        targetType: 'system',
        summary: 'Logged in'
      });
    } catch (err) {
      // ignore logging errors
    }
    // Redirect to main app
    window.location.href = 'app.html';
  } else {
    errorEl.textContent = 'Invalid username or password.';
  }
}

function checkAuthentication() {
  const stored = sessionStorage.getItem('currentUser');
  if (!stored) {
    // Not logged in; redirect to login page
    window.location.href = 'login.html';
  } else {
    // Set staff name for new admissions
    const staffInput = document.getElementById('mStaff');
    if (staffInput) {
      const userObj = JSON.parse(stored);
      staffInput.value = userObj.username;
    }
    // Adjust UI based on permissions
    adjustRoleBasedUI();
  }
}

/* Adjust UI based on user role (hide sections for non-admin) */
function adjustRoleBasedUI() {
  const stored = sessionStorage.getItem('currentUser');
  if (!stored) return;
  const userObj = JSON.parse(stored);
  const perms = userObj.effectivePermissions || [];
  const navItems = document.querySelectorAll('.sidebar li');
  // Map nav items by index to permission names
  const navPerms = ['dashboard','members','sms','finance','staff','settings','logs'];
  navItems.forEach((li, idx) => {
    const perm = navPerms[idx];
    if (!perms.includes(perm)) {
      li.style.display = 'none';
    } else {
      li.style.display = '';
    }
  });
}

function logout() {
  // Log logout event before clearing session
  try {
    const stored = sessionStorage.getItem('currentUser');
    if (stored) {
      const uObj = JSON.parse(stored);
      logEvent({
        actor: uObj.username,
        action: 'auth.logout',
        targetType: 'system',
        summary: 'Logged out'
      });
    }
  } catch (err) {
    // ignore logging errors
  }
  sessionStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}

/* Sidebar toggle for small screens */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');
}

function toggleMobileView() {
  // Toggle the mobile-view class on the body to switch between desktop
  // and mobile layouts. CSS rules in style.css will adjust the UI
  // accordingly (hide sidebar, stack layout, etc.).
  document.body.classList.toggle('mobile-view');
}

/* Navigation between sections */
function showSection(section) {
  // Permission check: ensure current user can view the requested section
  const stored = sessionStorage.getItem('currentUser');
  if (stored) {
    try {
      const userObj = JSON.parse(stored);
      const perms = userObj.effectivePermissions || [];
      if (!perms.includes(section)) {
        alert('You are not authorized to access this section.');
        return;
      }
    } catch (err) {
      // no-op
    }
  }
  // Hide all sections
  const sections = document.querySelectorAll('.main-content > section');
  sections.forEach(sec => sec.style.display = 'none');
  // Remove active class from all nav items
  const navItems = document.querySelectorAll('.sidebar li');
  navItems.forEach(li => li.classList.remove('active'));
  // Show requested section
  switch (section) {
    case 'dashboard':
      document.getElementById('dashboardSection').style.display = '';
      navItems[0].classList.add('active');
      renderDashboard();
      break;
    case 'members':
      document.getElementById('membersSection').style.display = '';
      navItems[1].classList.add('active');
      // ensure dropdown values are up to date when entering members section
      populateDropdowns();
      // reattach unsaved tracking on form fields
      setupUnsavedTracking();
      break;
    case 'sms':
      document.getElementById('smsSection').style.display = '';
      navItems[2].classList.add('active');
      break;
    case 'finance':
      document.getElementById('financeSection').style.display = '';
      navItems[3].classList.add('active');
      // Render finance summary each time we enter the finance section
      renderFinance();
      break;
    case 'staff':
      document.getElementById('staffSection').style.display = '';
      navItems[4].classList.add('active');
      // Refresh staff table when navigating to the staff section
      renderStaffTable();
      break;
    case 'settings':
      document.getElementById('settingsSection').style.display = '';
      navItems[5].classList.add('active');
      // When navigating to settings, render the settings UI
      renderSettings();
      break;
    case 'logs':
      document.getElementById('logsSection').style.display = '';
      navItems[6].classList.add('active');
      // Render logs each time we enter the logs section
      renderLogs();
      break;
  }
}

/* Load members from localStorage */
function loadMembers() {
  try {
    const saved = localStorage.getItem('members');
    members = saved ? JSON.parse(saved) : [];
  } catch (err) {
    members = [];
  }
}

/* Persist members to localStorage */
function saveMembers() {
  localStorage.setItem('members', JSON.stringify(members));
}

/* ------------------------------ */
/* User management functions      */
/* ------------------------------ */

/* Load users from localStorage (with seeding) */
function loadUsers() {
  try {
    const saved = localStorage.getItem('users');
    if (saved) {
      users = JSON.parse(saved);
    } else {
      // Seed default users if none exist
      users = [
        { username: 'Bis', password: 'a123', role: 'admin', grants: [], revokes: [] },
        { username: 'Raja', password: 'r123', role: 'staff-basic', grants: [], revokes: [] },
        { username: 'Kishan', password: 'k123', role: 'staff-extended', grants: [], revokes: [] }
      ];
      saveUsers();
    }
  } catch (err) {
    users = [];
  }
}

/* Persist users to localStorage */
function saveUsers() {
  localStorage.setItem('users', JSON.stringify(users));
}

/* Compute effective permissions for a user based on role, grants and revokes */
function computeEffectivePermissions(user) {
  const base = rolePermissions[user.role] ? [...rolePermissions[user.role]] : [];
  let perms = [...base];
  if (Array.isArray(user.grants)) {
    user.grants.forEach(p => {
      if (!perms.includes(p)) perms.push(p);
    });
  }
  if (Array.isArray(user.revokes)) {
    user.revokes.forEach(p => {
      const idx = perms.indexOf(p);
      if (idx >= 0) perms.splice(idx, 1);
    });
  }
  return perms;
}

/* Render the staff users table */
function renderStaffTable() {
  const tbody = document.querySelector('#staffTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  users.forEach((user, idx) => {
    const tr = document.createElement('tr');
    const unameTd = document.createElement('td');
    unameTd.textContent = user.username;
    const roleTd = document.createElement('td');
    roleTd.textContent = user.role;
    const actionsTd = document.createElement('td');
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => showUserForm(idx);
    actionsTd.appendChild(editBtn);
    // Delete button (only visible to admin)
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.style.marginLeft = '0.5rem';
    delBtn.onclick = () => deleteUser(idx);
    actionsTd.appendChild(delBtn);
    tr.appendChild(unameTd);
    tr.appendChild(roleTd);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

/* Show the user add/edit form
 * If index is null, this is a new user. Otherwise, we edit existing user at index. */
function showUserForm(index) {
  editingUserIndex = index !== null && index !== undefined ? index : null;
  const formContainer = document.getElementById('userFormContainer');
  const formTitle = document.getElementById('userFormTitle');
  const usernameInput = document.getElementById('uUsername');
  const passwordInput = document.getElementById('uPassword');
  const confirmInput = document.getElementById('uConfirm');
  const roleSelect = document.getElementById('uRole');
  // Reset fields
  passwordInput.value = '';
  confirmInput.value = '';
  // Determine add vs edit
  if (editingUserIndex === null) {
    formTitle.textContent = 'Add User';
    usernameInput.value = '';
    usernameInput.readOnly = false;
    roleSelect.value = '';
    // Clear existing grants/revokes toggles
    renderPermissionToggles();
  } else {
    formTitle.textContent = 'Edit User';
    const user = users[editingUserIndex];
    usernameInput.value = user.username;
    usernameInput.readOnly = true; // Do not allow editing username
    roleSelect.value = user.role;
    // Render toggles according to user effective permissions
    renderPermissionToggles();
  }
  // Show modal
  formContainer.style.display = 'flex';
}

/* Hide the user form modal */
function hideUserForm() {
  const formContainer = document.getElementById('userFormContainer');
  if (formContainer) formContainer.style.display = 'none';
  editingUserIndex = null;
}

/* Render permission checkboxes based on selected role and current grants/revokes */
function renderPermissionToggles() {
  const container = document.getElementById('permissionToggles');
  if (!container) return;
  container.innerHTML = '';
  const roleSelect = document.getElementById('uRole');
  const selectedRole = roleSelect ? roleSelect.value : '';
  // Determine current user effective permissions if editing
  let effective = [];
  let base = [];
  if (selectedRole) {
    base = rolePermissions[selectedRole] ? [...rolePermissions[selectedRole]] : [];
  }
  if (editingUserIndex !== null && editingUserIndex !== undefined) {
    const user = users[editingUserIndex];
    // If role has changed while editing, compute using new role
    const tempUser = { role: selectedRole || user.role, grants: user.grants || [], revokes: user.revokes || [] };
    effective = computeEffectivePermissions(tempUser);
  } else {
    effective = base;
  }
  // Create a checkbox for each permission
  allPermissions.forEach(p => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = p;
    checkbox.checked = effective.includes(p);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + capitalize(p)));
    container.appendChild(label);
  });
}

/* Capitalize first letter of a string */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* Save new user or update existing user */
function saveUser() {
  const username = document.getElementById('uUsername').value.trim();
  const password = document.getElementById('uPassword').value;
  const confirm = document.getElementById('uConfirm').value;
  const role = document.getElementById('uRole').value;
  const toggles = document.querySelectorAll('#permissionToggles input[type=checkbox]');
  // Basic validation
  if (!username) {
    alert('Username is required.');
    return;
  }
  if (!role) {
    alert('Please select a role.');
    return;
  }
  // When adding a new user, require password and confirm
  if (editingUserIndex === null) {
    if (!password || !confirm) {
      alert('Password and confirmation are required for a new user.');
      return;
    }
    if (password !== confirm) {
      alert('Passwords do not match.');
      return;
    }
    // Unique username check
    const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      alert('A user with this username already exists.');
      return;
    }
  } else {
    // Editing existing user: if password provided, ensure confirmation matches
    if (password || confirm) {
      if (password !== confirm) {
        alert('Passwords do not match.');
        return;
      }
    }
  }
  // Compute selected permissions
  const selectedPerms = [];
  toggles.forEach(cb => {
    if (cb.checked) selectedPerms.push(cb.value);
  });
  const basePerms = rolePermissions[role] ? [...rolePermissions[role]] : [];
  // Determine grants and revokes relative to the selected role
  const grants = selectedPerms.filter(p => !basePerms.includes(p));
  const revokes = basePerms.filter(p => !selectedPerms.includes(p));
  // Determine if this is a new user or an update, and capture old user state for logging
  const isNewUser = (editingUserIndex === null);
  let oldUserCopy = null;
  if (!isNewUser && users[editingUserIndex]) {
    oldUserCopy = { ...users[editingUserIndex] };
  }
  if (editingUserIndex === null) {
    // Add new user
    const newUser = {
      username: username,
      password: password,
      role: role,
      grants: grants,
      revokes: revokes
    };
    users.push(newUser);
    // Log user creation event
    try {
      const currStr = sessionStorage.getItem('currentUser');
      const currObj = currStr ? JSON.parse(currStr) : {};
      const actor = currObj.username || '';
      logEvent({
        actor: actor,
        action: 'user.create',
        targetType: 'user',
        targetId: newUser.username,
        summary: `Created user ${newUser.username}`,
        meta: { role: newUser.role, grants: newUser.grants, revokes: newUser.revokes }
      });
    } catch (err) {
      // ignore logging errors
    }
  } else {
    // Update existing user
    const user = users[editingUserIndex];
    user.role = role;
    user.grants = grants;
    user.revokes = revokes;
    // If a new password was provided, update it
    if (password) {
      user.password = password;
    }
    // If editing the currently logged in user, update sessionStorage permissions immediately
    const currString = sessionStorage.getItem('currentUser');
    if (currString) {
      try {
        const currUser = JSON.parse(currString);
        if (currUser.username === user.username) {
          const newEff = computeEffectivePermissions(user);
          const updated = { ...user, effectivePermissions: newEff };
          sessionStorage.setItem('currentUser', JSON.stringify(updated));
          // Re-adjust UI as permissions may have changed
          adjustRoleBasedUI();
        }
      } catch (err) {
        // ignore
      }
    }
    // Log user update event
    try {
      const currStr2 = sessionStorage.getItem('currentUser');
      const currObj2 = currStr2 ? JSON.parse(currStr2) : {};
      const actor2 = currObj2.username || '';
      if (oldUserCopy) {
        logEvent({
          actor: actor2,
          action: 'user.update',
          targetType: 'user',
          targetId: user.username,
          summary: `Updated user ${user.username}`,
          meta: {
            roleBefore: oldUserCopy.role,
            roleAfter: user.role,
            grants: user.grants,
            revokes: user.revokes
          }
        });
      }
    } catch (err) {
      // ignore logging errors
    }
  }
  saveUsers();
  renderStaffTable();
  hideUserForm();
}

/* Delete a user from the staff list after confirmation. If the user
   being deleted is the currently logged in user, sign them out. */
function deleteUser(index) {
  if (index === null || index === undefined || index < 0 || index >= users.length) return;
  const user = users[index];
  if (!user) return;
  const confirmed = confirm(`Are you sure you want to delete the user "${user.username}"?`);
  if (!confirmed) return;
  // Prevent deleting the last remaining admin
  const admins = users.filter(u => u.role === 'admin');
  if (user.role === 'admin' && admins.length <= 1) {
    alert('Cannot delete the last remaining admin.');
    return;
  }
  // Remove user from array
  users.splice(index, 1);
  saveUsers();
  renderStaffTable();
  // If deleting currently logged in user, force logout
  try {
    const currStr = sessionStorage.getItem('currentUser');
    const currObj = currStr ? JSON.parse(currStr) : {};
    if (currObj && currObj.username === user.username) {
      alert('Your account has been deleted. Logging out now.');
      logout();
    }
  } catch (err) {
    // ignore
  }
  // Log deletion event
  try {
    const currStr2 = sessionStorage.getItem('currentUser');
    const currObj2 = currStr2 ? JSON.parse(currStr2) : {};
    const actor = currObj2.username || '';
    logEvent({
      actor: actor,
      action: 'user.delete',
      targetType: 'user',
      targetId: user.username,
      summary: `Deleted user ${user.username}`,
      meta: { role: user.role }
    });
  } catch (err) {
    // ignore
  }
  // Show deletion toast
  showToast(`Staff ${user.username} deleted successfully.`);
}

/* Populate Payment Month dropdown with current and next year months */
function populatePaymentMonths() {
  const paySelect = document.getElementById('mPayMonth');
  if (!paySelect) return;
  paySelect.innerHTML = '';
  const now = new Date();
  const year = now.getFullYear();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (let i = 0; i < 12; i++) {
    const option = document.createElement('option');
    option.value = `${months[i]}-${year}`;
    option.textContent = `${months[i]} ${year}`;
    paySelect.appendChild(option);
  }
  // Optionally include next year as well
  for (let i = 0; i < 12; i++) {
    const option = document.createElement('option');
    option.value = `${months[i]}-${year + 1}`;
    option.textContent = `${months[i]} ${year + 1}`;
    paySelect.appendChild(option);
  }
}

/* Render the segmented dashboard tables. This replaces the earlier single-table dashboard. */
function renderDashboard() {
  const statuses = ['Active', 'Hold', 'Cancelled', 'Deactivated'];
  statuses.forEach(status => {
    renderStatusTable(status);
  });
}

/* Render a single status table. Handles search, sorting and pagination. */
function renderStatusTable(status) {
  // Ensure the DOM elements exist
  const bodyId = status.toLowerCase() + 'Body';
  const headerId = status.toLowerCase() + 'Header';
  const paginationId = status.toLowerCase() + 'Pagination';
  const tableId = status.toLowerCase() + 'Table';
  const tbody = document.getElementById(bodyId);
  const headerEl = document.getElementById(headerId);
  const paginationEl = document.getElementById(paginationId);
  const tableEl = document.getElementById(tableId);
  if (!tbody || !headerEl || !paginationEl || !tableEl) return;

  // Derive the dataset for this status
  let dataset = members.filter(m => m.status === status);
  // Apply search filter across name and mobile only
  const search = dashboardState.searchQuery.trim().toLowerCase();
  const searchDigits = search.replace(/\D/g, '');
  if (search) {
    dataset = dataset.filter(m => {
      const nameMatch = m.name && m.name.toLowerCase().includes(search);
      const mobileDigits = m.mobile ? m.mobile.replace(/\D/g, '') : '';
      const mobileMatch = searchDigits && mobileDigits.includes(searchDigits);
      return nameMatch || mobileMatch;
    });
  }
  // Update count in header
  headerEl.textContent = `${status} (${dataset.length})`;
  // Extract the current table state
  const state = dashboardState[status];
  // Sort dataset
  const sorted = [...dataset];
  const key = state.sortKey;
  const dir = state.sortDir;
  sorted.sort((a, b) => {
    // Default sort (joinDate desc) when using 'joinDate' and dir=desc
    let valA = a[key];
    let valB = b[key];
    // Convert values based on key
    if (key === 'amount') {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else if (key === 'joinDate' || key === 'billingDate') {
      valA = valA ? new Date(valA) : new Date(0);
      valB = valB ? new Date(valB) : new Date(0);
    } else {
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
    }
    if (valA < valB) return dir === 'asc' ? -1 : 1;
    if (valA > valB) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  // Pagination
  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  // Ensure current page is within bounds
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);
  // Render rows
  tbody.innerHTML = '';
  paginated.forEach(member => {
    const tr = document.createElement('tr');
    // ID
    const idTd = document.createElement('td');
    idTd.textContent = member.id || '';
    tr.appendChild(idTd);
    // Name
    const nameTd = document.createElement('td');
    nameTd.textContent = member.name || '';
    tr.appendChild(nameTd);
    // Plan
    const planTd = document.createElement('td');
    planTd.textContent = member.plan || '';
    tr.appendChild(planTd);
    // Mobile
    const mobileTd = document.createElement('td');
    mobileTd.textContent = member.mobile || '';
    tr.appendChild(mobileTd);
    // Amount
    const amountTd = document.createElement('td');
    amountTd.textContent = member.amount || '';
    tr.appendChild(amountTd);
    // Join Date
    const joinTd = document.createElement('td');
    joinTd.textContent = member.joinDate || '';
    tr.appendChild(joinTd);
    // Billing Date
    const billTd = document.createElement('td');
    billTd.textContent = member.billingDate || '';
    tr.appendChild(billTd);
    // Payment By
    const payByTd = document.createElement('td');
    payByTd.textContent = member.paymentBy || '';
    tr.appendChild(payByTd);
    // Status with colored chip
    const statusTd = document.createElement('td');
    const chip = document.createElement('span');
    chip.textContent = member.status || '';
    chip.classList.add('status-chip', 'status-' + (member.status || '').toLowerCase());
    statusTd.appendChild(chip);
    tr.appendChild(statusTd);
    // Action cell
    const actionTd = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.onclick = () => {
      const idx = members.indexOf(member);
      loadMemberIntoForm(idx);
      showSection('members');
    };
    actionTd.appendChild(viewBtn);
    tr.appendChild(actionTd);
    // Row click also triggers view
    tr.onclick = () => {
      const idx = members.indexOf(member);
      loadMemberIntoForm(idx);
      showSection('members');
    };
    tbody.appendChild(tr);
  });
  // Setup sort handlers on table headers (only once per table)
  const ths = tableEl.querySelectorAll('th.sortable');
  ths.forEach(th => {
    // Attach handler if not already attached
    if (!th.dataset.listenerAdded) {
      th.addEventListener('click', () => handleSort(status, th.dataset.key));
      th.dataset.listenerAdded = 'true';
    }
  });
  // Update sort icons via data-sortdir attributes
  ths.forEach(th => {
    const keyAttr = th.dataset.key;
    if (!keyAttr) return;
    if (state.sortKey === keyAttr) {
      th.dataset.sortdir = state.sortDir;
    } else {
      th.dataset.sortdir = 'default';
    }
  });
  // Render pagination controls
  paginationEl.innerHTML = '';
  function addButton(label, disabled, handler) {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (disabled) {
      btn.classList.add('disabled');
    } else {
      btn.onclick = handler;
    }
    return btn;
  }
  // First and Prev
  paginationEl.appendChild(addButton('« First', state.page === 1, () => {
    state.page = 1;
    renderStatusTable(status);
  }));
  paginationEl.appendChild(addButton('‹ Prev', state.page === 1, () => {
    if (state.page > 1) state.page--;
    renderStatusTable(status);
  }));
  // Page info
  const infoSpan = document.createElement('span');
  infoSpan.textContent = `Page ${state.page} of ${totalPages}`;
  paginationEl.appendChild(infoSpan);
  // Next and Last
  paginationEl.appendChild(addButton('Next ›', state.page === totalPages, () => {
    if (state.page < totalPages) state.page++;
    renderStatusTable(status);
  }));
  paginationEl.appendChild(addButton('Last »', state.page === totalPages, () => {
    state.page = totalPages;
    renderStatusTable(status);
  }));
}

/* Handle clicks on sortable table headers. Cycles sorting between ascending,
 * descending and default (joinDate descending). Resets to page 1. */
function handleSort(status, key) {
  const state = dashboardState[status];
  // If the clicked key is the current sort key, cycle through asc → desc → default
  if (state.sortKey === key) {
    if (state.sortDir === 'asc') {
      state.sortDir = 'desc';
    } else if (state.sortDir === 'desc') {
      // Reset to default sort (joinDate desc)
      state.sortKey = 'joinDate';
      state.sortDir = 'desc';
    } else {
      // Should not reach here, but treat as ascending
      state.sortDir = 'asc';
    }
  } else {
    // New sort key; start with ascending
    state.sortKey = key;
    state.sortDir = 'asc';
  }
  // Reset page on sort
  state.page = 1;
  renderStatusTable(status);
}

/* Search functionality: filter table by name or mobile number */
function performSearch() {
  // Update the global search query for the dashboard and re-render tables
  const query = document.getElementById('searchBar').value.trim().toLowerCase();
  dashboardState.searchQuery = query;
  // Reset page to 1 for all statuses on new search
  ['Active','Hold','Cancelled','Deactivated'].forEach(status => {
    dashboardState[status].page = 1;
  });
  renderDashboard();
}

/* Toggle hold duration field depending on status */
function toggleHoldField() {
  const status = document.getElementById('mStatus').value;
  const holdSelect = document.getElementById('mHold');
  if (status === 'Hold') {
    holdSelect.disabled = false;
  } else {
    holdSelect.disabled = true;
    holdSelect.value = '';
  }
}

/* Apply light background to fields that contain values. This provides a
   visual cue that the field has been filled. It is called on
   DOMContentLoaded to attach handlers, and whenever a member is loaded
   into the form. */
function setupFieldHighlights() {
  const fields = document.querySelectorAll('#memberForm input, #memberForm select, #memberForm textarea');
  fields.forEach(el => {
    // Highlight initial values
    updateFieldHighlight(el);
    // Listen for changes or input events
    el.addEventListener('input', () => updateFieldHighlight(el));
    el.addEventListener('change', () => updateFieldHighlight(el));
  });
}

function updateFieldHighlight(el) {
  // Skip file inputs from highlighting
  if (el.type === 'file') return;
  const value = (el.value || '').trim();
  if (value) {
    el.classList.add('filled-field');
  } else {
    el.classList.remove('filled-field');
  }
}

/* Preview uploaded member photo */
function previewMemberPhoto(event) {
  const file = event.target.files[0];
  const previewEl = document.getElementById('mPhotoPreview');
  const placeholder = document.getElementById('mPhotoPlaceholder');
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      previewEl.src = e.target.result;
      previewEl.style.display = 'block';
      placeholder.style.display = 'none';
      // Store base64 on input element
      event.target.dataset.base64 = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    previewEl.src = '';
    previewEl.style.display = 'none';
    placeholder.style.display = 'block';
    event.target.dataset.base64 = '';
  }
}

/* Save or update member data */
function saveMember() {
  // Gather values
  const name = document.getElementById('mName').value.trim();
  const dob = document.getElementById('mDob').value;
  const gender = document.getElementById('mGender').value;
  const mobile = document.getElementById('mMobile').value.trim();
  const email = document.getElementById('mEmail').value.trim();
  const address = document.getElementById('mAddress').value.trim();
  const formNumber = document.getElementById('mFormNumber').value.trim();
  const idAuto = document.getElementById('mId').value;
  const staffName = document.getElementById('mStaff').value;
  const amount = document.getElementById('mAmount').value.trim();
  const plan = document.getElementById('mPlan').value;
  const joinDate = document.getElementById('mJoin').value;
  const billingDate = document.getElementById('mBill').value;
  const status = document.getElementById('mStatus').value;
  const holdDuration = document.getElementById('mHold').value || '';
  const paymentMethod = document.getElementById('mPaymentMethod').value;
  const payMonth = document.getElementById('mPayMonth').value;
  const remark = document.getElementById('mRemark').value.trim();
  const photoInput = document.getElementById('mPhoto');
  const photoBase64 = photoInput.dataset.base64 || '';
  // Basic validation
  if (!name || !dob || !gender || !mobile || !amount || !plan || !joinDate || !billingDate || !status || !remark || !paymentMethod) {
    alert('Please fill all mandatory fields.');
    return;
  }
  // Ensure membership amount is a positive integer
  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    alert('Membership amount must be a positive number.');
    return;
  }
  // When status is Hold, hold duration is required
  if (status === 'Hold' && !holdDuration) {
    alert('Please select a hold duration when status is Hold.');
    return;
  }

  // If updating an existing member (not saving as new) and the billing date
  // is today or in the past, prompt the user for confirmation before
  // proceeding. This helps prevent accidental updates with outdated
  // billing information.
  if (!saveAsNew && editIndex !== null) {
    const billDt = billingDate ? new Date(billingDate) : null;
    const today = new Date();
    // Normalize to start of day for comparison
    if (billDt && billDt.setHours(0,0,0,0) <= today.setHours(0,0,0,0)) {
      const proceed = confirm('The billing date is today or earlier. Do you wish to continue updating this member?');
      if (!proceed) {
        return;
      }
    }
  }
  // Normalize phone (store as entered with country code +91 if 10 digits)
  const digits = mobile.replace(/\D/g, '');
  let mobileNo;
  if (digits.length === 10) {
    mobileNo = '+91' + digits;
  } else if (digits.startsWith('91') && digits.length === 12) {
    mobileNo = '+' + digits;
  } else if (mobile.startsWith('+')) {
    mobileNo = mobile;
  } else {
    alert('Invalid mobile number format.');
    return;
  }
  // Determine if saving as new (even when editing) or updating existing record
  const isNewMember = saveAsNew || (editIndex === null);
  // Generate a new ID when creating new or copying existing; when updating, keep existing ID
  let idVal = idAuto;
  if (isNewMember || !idVal) {
    const year = new Date().getFullYear().toString().slice(-2);
    const num = formNumber || (members.length + 1).toString();
    idVal = `APG-${num}/${year}`;
    document.getElementById('mId').value = idVal;
  }
  const record = {
    formNumber,
    id: idVal,
    name,
    dob,
    gender,
    mobile: mobileNo,
    email,
    address,
    staff: staffName,
    amount: parseFloat(amount).toFixed(2),
    plan,
    joinDate,
    billingDate,
    paymentBy: '',
    status,
    holdDuration,
    paymentMethod,
    payMonth,
    remark,
    photo: photoBase64,
    // PDF will be generated below
    pdfUrl: ''
  };

  // Compute paymentBy as 7 days after billingDate
  if (billingDate) {
    try {
      const d = new Date(billingDate);
      // Add 7 days
      d.setDate(d.getDate() + 7);
      record.paymentBy = d.toISOString().split('T')[0];
      // Update UI field immediately
      const paymentByInput = document.getElementById('mPaymentBy');
      if (paymentByInput) paymentByInput.value = record.paymentBy;
    } catch (err) {
      record.paymentBy = '';
    }
  }
  // Duplicate checks when creating new or saving as new
  if (isNewMember) {
    const dupForm = members.find(m => m.formNumber && m.formNumber === formNumber);
    const dupMobile = members.find(m => m.mobile && m.mobile === mobileNo);
    if (dupForm) {
      alert('Form number already exists.');
      return;
    }
    if (dupMobile) {
      alert('Mobile number already exists.');
      return;
    }
  }
  // Capture old member for diff when updating
  let oldMember = null;
  if (!isNewMember && members[editIndex]) {
    oldMember = { ...members[editIndex] };
  }
  // Generate PDF using jsPDF. If PDF generation fails (e.g. jsPDF not loaded),
  // proceed to save the record anyway with an empty pdfUrl. Without this
  // wrapper, a failure in generateMemberPDF() would prevent the member
  // from being saved and the user would see no feedback.
  const finishSave = (pdfData) => {
    record.pdfUrl = pdfData || '';
    // Save record to members array
    if (isNewMember) {
      members.push(record);
    } else {
      members[editIndex] = record;
    }
    saveMembers();
    // Log the event
    try {
      const storedCurr = sessionStorage.getItem('currentUser');
      const currObj = storedCurr ? JSON.parse(storedCurr) : {};
      const actor = currObj.username || '';
      if (isNewMember) {
        logEvent({
          actor: actor,
          action: 'member.create',
          targetType: 'member',
          targetId: record.id,
          summary: `Created member ${record.name} (${record.id})`,
          meta: { status: record.status, plan: record.plan }
        });
      } else if (oldMember) {
        const diff = {};
        Object.keys(record).forEach(key => {
          if (record[key] !== oldMember[key]) {
            diff[key] = { before: oldMember[key], after: record[key] };
          }
        });
        logEvent({
          actor: actor,
          action: 'member.update',
          targetType: 'member',
          targetId: record.id,
          summary: `Updated ${record.name} (${record.id})`,
          meta: { diff: diff, statusBefore: oldMember.status, statusAfter: record.status }
        });
      }
    } catch (err) {
      // ignore logging errors
    }
    // Reset unsaved changes and reattach tracking after a successful save
    unsavedChanges = false;
    setupUnsavedTracking();
    // After saving, reset saveAsNew and editIndex if a copy was created
    if (isNewMember) {
      editIndex = null;
    }
    // Reset the saveAsNew flag for subsequent operations
    saveAsNew = false;
    renderDashboard();
    clearMemberForm();
    // Show success toast indicating whether created or updated
    if (isNewMember) {
      showToast(`Member ${record.name} created successfully.`);
    } else {
      showToast(`Member ${record.name} updated successfully.`);
    }
  };
  try {
    // Attempt to generate PDF. If jsPDF is unavailable, this will throw.
    generateMemberPDF(record).then(pdfDataUrl => {
      finishSave(pdfDataUrl);
    }).catch(err => {
      console.error('PDF generation failed:', err);
      finishSave('');
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    finishSave('');
  }
}

/* Generate a simple PDF summary for the member using jsPDF */
async function generateMemberPDF(member) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text('Action Plus Gym Membership Form', 10, 15);
  doc.setFontSize(10);
  let y = 30;
  const lineHeight = 7;
  const fields = [
    ['Form Number', member.formNumber],
    ['ID', member.id],
    ['Name', member.name],
    ['DOB', member.dob],
    ['Gender', member.gender],
    ['Mobile', member.mobile],
    ['Email', member.email],
    ['Address', member.address],
    ['Staff', member.staff],
    ['Plan', member.plan],
    ['Amount', member.amount],
    ['Joining Date', member.joinDate],
    ['Billing Date', member.billingDate],
    ['Status', member.status],
    ['Hold Duration', member.holdDuration],
    ['Payment Method', member.paymentMethod],
    ['Payment Month', member.payMonth],
    ['Payment By', member.paymentBy],
    ['Remark', member.remark]
  ];
  fields.forEach(item => {
    doc.text(`${item[0]}: ${item[1] || ''}`, 10, y);
    y += lineHeight;
  });
  doc.text('Member Signature: ______________________', 10, y + 10);
  return doc.output('datauristring');
}

/* Load member into form for editing */
function loadMemberIntoForm(index) {
  const member = members[index];
  if (!member) return;
  editIndex = index;
  document.getElementById('mName').value = member.name || '';
  document.getElementById('mDob').value = member.dob || '';
  document.getElementById('mGender').value = member.gender || '';
  document.getElementById('mMobile').value = member.mobile ? member.mobile.replace(/\D/g, '').slice(-10) : '';
  document.getElementById('mEmail').value = member.email || '';
  document.getElementById('mAddress').value = member.address || '';
  document.getElementById('mFormNumber').value = member.formNumber || '';
  document.getElementById('mId').value = member.id || '';
  document.getElementById('mStaff').value = member.staff || '';
  document.getElementById('mAmount').value = member.amount || '';
  document.getElementById('mPlan').value = member.plan || '';
  document.getElementById('mJoin').value = member.joinDate || '';
  document.getElementById('mBill').value = member.billingDate || '';
  document.getElementById('mStatus').value = member.status || '';
  toggleHoldField();
  document.getElementById('mHold').value = member.holdDuration || '';
  document.getElementById('mPayMonth').value = member.payMonth || '';
  const payByInput = document.getElementById('mPaymentBy');
  if (payByInput) payByInput.value = member.paymentBy || '';
  // Set payment method
  const pmSelect = document.getElementById('mPaymentMethod');
  if (pmSelect) pmSelect.value = member.paymentMethod || '';
  document.getElementById('mRemark').value = member.remark || '';
  // Load photo
  const previewEl = document.getElementById('mPhotoPreview');
  const placeholder = document.getElementById('mPhotoPlaceholder');
  if (member.photo) {
    previewEl.src = member.photo;
    previewEl.style.display = 'block';
    placeholder.style.display = 'none';
    document.getElementById('mPhoto').dataset.base64 = member.photo;
  } else {
    previewEl.style.display = 'none';
    placeholder.style.display = 'block';
    document.getElementById('mPhoto').dataset.base64 = '';
  }
  // Update field highlights after populating values
  setupFieldHighlights();
  // Reset unsaved flag and reattach tracking on editable fields
  unsavedChanges = false;
  setupUnsavedTracking();
}

function updateMember() {
  if (editIndex === null) {
    alert('Please select a member from the dashboard to update.');
    return;
  }
  // Ensure we are updating the existing record, not saving a copy
  saveAsNew = false;
  saveMember();
}

function clearMemberForm() {
  document.getElementById('memberForm').reset();
  document.getElementById('mId').value = '';
  document.getElementById('mHold').disabled = true;
  // Populate staff name with the current user's username
  const curr = sessionStorage.getItem('currentUser');
  let staffName = '';
  if (curr) {
    try {
      staffName = JSON.parse(curr).username || '';
    } catch (err) {
      staffName = '';
    }
  }
  document.getElementById('mStaff').value = staffName;
  // Reset photo
  const previewEl = document.getElementById('mPhotoPreview');
  const placeholder = document.getElementById('mPhotoPlaceholder');
  previewEl.style.display = 'none';
  placeholder.style.display = 'block';
  document.getElementById('mPhoto').dataset.base64 = '';
  editIndex = null;
  // Reset payment method
  const pmSelect = document.getElementById('mPaymentMethod');
  if (pmSelect) pmSelect.value = '';
  // Update field highlights after clearing
  setupFieldHighlights();
  // Reset unsaved flag and reattach tracking
  unsavedChanges = false;
  setupUnsavedTracking();
}

/* Member Overview (Preview) */
function showOverview() {
  const overview = document.getElementById('overviewSection');
  const content = document.getElementById('overviewContent');
  if (!overview || !content) return;
  // Build HTML representation of form data
  const name = document.getElementById('mName').value;
  const fields = {
    'Name': name,
    'DOB': document.getElementById('mDob').value,
    'Gender': document.getElementById('mGender').value,
    'Mobile': document.getElementById('mMobile').value,
    'Email': document.getElementById('mEmail').value,
    'Address': document.getElementById('mAddress').value,
    'Form Number': document.getElementById('mFormNumber').value,
    'ID': document.getElementById('mId').value,
    'Staff Name': document.getElementById('mStaff').value,
    'Amount': document.getElementById('mAmount').value,
    'Plan': document.getElementById('mPlan').value,
    'Joining Date': document.getElementById('mJoin').value,
    'Billing Date': document.getElementById('mBill').value,
    'Status': document.getElementById('mStatus').value,
    'Hold Duration': document.getElementById('mHold').value,
    'Payment Month': document.getElementById('mPayMonth').value,
    'Remark': document.getElementById('mRemark').value
  };
  let html = '';
  for (const key in fields) {
    html += `<p><strong>${key}:</strong> ${fields[key]}</p>`;
  }
  // Show photo if uploaded
  const photoData = document.getElementById('mPhoto').dataset.base64;
  if (photoData) {
    html += `<p><strong>Photo:</strong><br><img src="${photoData}" style="max-height:150px;"/></p>`;
  }
  content.innerHTML = html;
  overview.style.display = 'block';
}

function hideOverview() {
  const overview = document.getElementById('overviewSection');
  if (overview) overview.style.display = 'none';
}

// Expose clear functions to global scope so they can be called via onclick in HTML
window.clearPersonalInfo = clearPersonalInfo;
window.clearManagementInfo = clearManagementInfo;

/* Clear personal information fields */
function clearPersonalInfo() {
  // Reset personal information fields
  const names = ['mName', 'mDob', 'mGender', 'mMobile', 'mPhoto', 'mEmail', 'mAddress'];
  names.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'file') {
        el.value = '';
        el.dataset.base64 = '';
      } else {
        el.value = '';
      }
    }
  });
  // Reset photo preview
  const previewEl = document.getElementById('mPhotoPreview');
  const placeholder = document.getElementById('mPhotoPlaceholder');
  if (previewEl && placeholder) {
    previewEl.style.display = 'none';
    placeholder.style.display = 'block';
  }
}

/* Clear management information fields */
function clearManagementInfo() {
  // Reset management fields except staff name and id (auto)
  const ids = ['mFormNumber', 'mId', 'mAmount', 'mPlan', 'mJoin', 'mBill', 'mStatus', 'mHold', 'mPaymentMethod', 'mPayMonth'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'mId') {
        // clear generated ID only if not editing
        if (editIndex === null) el.value = '';
      } else if (id === 'mHold') {
        el.value = '';
        el.disabled = true;
      } else {
        el.value = '';
      }
    }
  });
  // Reset status to default (Active)
  const statusSel = document.getElementById('mStatus');
  if (statusSel) statusSel.value = 'Active';
  // Reset hold field disabled state
  toggleHoldField();
}

/* ===================================================================== */
/* Logs management functions                                             */
/* ===================================================================== */

// Retrieve logs array from localStorage
function getLogs() {
  try {
    const saved = localStorage.getItem('apgm.logs.v1');
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    return [];
  }
}

// Save logs array to localStorage and prune to last 60 days and 5k entries
function setLogs(logs) {
  const now = Date.now();
  // Only keep logs from the past 60 days
  const cutoff = now - (60 * 24 * 60 * 60 * 1000);
  // Filter logs within cutoff and cap to 5000 entries (keep newest)
  const pruned = logs.filter(l => new Date(l.ts).getTime() >= cutoff).slice(-5000);
  localStorage.setItem('apgm.logs.v1', JSON.stringify(pruned));
}

// Log an event; event is an object with actor, action, targetType, targetId, summary, meta
function logEvent(event) {
  if (!event) return;
  const logs = getLogs();
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString().slice(2);
  const entry = {
    id: id,
    ts: new Date().toISOString(),
    actor: event.actor || '',
    action: event.action || '',
    targetType: event.targetType || '',
    targetId: event.targetId || '',
    summary: event.summary || '',
    meta: event.meta || {}
  };
  logs.push(entry);
  setLogs(logs);
}

// Render the logs table according to current logsState filters
function renderLogs() {
  const tbody = document.getElementById('logsBody');
  const pagDiv = document.getElementById('logsPagination');
  const actorSelect = document.getElementById('logActor');
  const actionSelect = document.getElementById('logAction');
  const emptyMsg = document.getElementById('logsEmpty');
  if (!tbody || !pagDiv || !actorSelect || !actionSelect) return;
  let logs = getLogs();
  // Set default date range if not set (last 30 days)
  if (!logsState.from || !logsState.to) {
    const today = new Date();
    const toStr = today.toISOString().split('T')[0];
    // Default to last 60 days instead of 30 days so that recent activity is visible
    const fromDate = new Date(today.getTime() - (60 * 24 * 60 * 60 * 1000));
    const fromStr = fromDate.toISOString().split('T')[0];
    if (!logsState.from) logsState.from = fromStr;
    if (!logsState.to) logsState.to = toStr;
    // Set input values
    const fromInput = document.getElementById('logFrom');
    const toInput = document.getElementById('logTo');
    if (fromInput && !fromInput.value) fromInput.value = logsState.from;
    if (toInput && !toInput.value) toInput.value = logsState.to;
  }
  // Populate actor and action select options from logs and users list
  const uniqueActors = new Set();
  const uniqueActions = new Set();
  logs.forEach(l => {
    if (l.actor) uniqueActors.add(l.actor);
    if (l.action) uniqueActions.add(l.action);
  });
  // Also include all current usernames in actor list (useful when no logs yet)
  users.forEach(u => uniqueActors.add(u.username));
  // Clear and repopulate actor select
  actorSelect.innerHTML = '';
  const allActorOption = document.createElement('option');
  allActorOption.value = '';
  allActorOption.textContent = 'All Staff';
  actorSelect.appendChild(allActorOption);
  Array.from(uniqueActors).sort().forEach(actor => {
    const opt = document.createElement('option');
    opt.value = actor;
    opt.textContent = actor;
    actorSelect.appendChild(opt);
  });
  // Restore selected actor
  actorSelect.value = logsState.actor || '';
  // Populate action select
  actionSelect.innerHTML = '';
  const allActionOption = document.createElement('option');
  allActionOption.value = '';
  allActionOption.textContent = 'All Actions';
  actionSelect.appendChild(allActionOption);
  Array.from(uniqueActions).sort().forEach(act => {
    const opt = document.createElement('option');
    opt.value = act;
    opt.textContent = act;
    actionSelect.appendChild(opt);
  });
  actionSelect.value = logsState.action || '';
  // Apply filters
  const fromMs = logsState.from ? new Date(logsState.from).setHours(0,0,0,0) : 0;
  const toMs = logsState.to ? new Date(logsState.to).setHours(23,59,59,999) : Date.now();
  const actorFilter = logsState.actor || '';
  const actionFilter = logsState.action || '';
  const q = (logsState.search || '').toLowerCase();
  let list = logs.filter(l => {
    const tsMs = new Date(l.ts).getTime();
    if (tsMs < fromMs || tsMs > toMs) return false;
    if (actorFilter && l.actor !== actorFilter) return false;
    if (actionFilter && l.action !== actionFilter) return false;
    if (q) {
      const summaryMatch = l.summary && l.summary.toLowerCase().includes(q);
      const targetMatch = l.targetId && String(l.targetId).toLowerCase().includes(q);
      const actionMatch = l.action && l.action.toLowerCase().includes(q);
      const actorMatch = l.actor && l.actor.toLowerCase().includes(q);
      return summaryMatch || targetMatch || actionMatch || actorMatch;
    }
    return true;
  });
  // Sort newest first
  list.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  // Pagination
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / logsState.pageSize));
  if (logsState.page > totalPages) logsState.page = totalPages;
  const start = (logsState.page - 1) * logsState.pageSize;
  const pageItems = list.slice(start, start + logsState.pageSize);
  // Render rows
  tbody.innerHTML = '';
  if (pageItems.length === 0) {
    emptyMsg.style.display = '';
  } else {
    emptyMsg.style.display = 'none';
    pageItems.forEach(l => {
      const tr = document.createElement('tr');
      const timeTd = document.createElement('td');
      timeTd.textContent = new Date(l.ts).toLocaleString();
      const actorTd = document.createElement('td');
      actorTd.textContent = l.actor;
      const actionTd = document.createElement('td');
      // Use chip to display action
      const chip = document.createElement('span');
      chip.className = 'action-chip ' + (l.action ? l.action.replace(/\./g, '-') : '');
      chip.textContent = l.action;
      actionTd.appendChild(chip);
      const targetTd = document.createElement('td');
      targetTd.textContent = l.targetType + (l.targetId ? ' / ' + l.targetId : '');
      const summaryTd = document.createElement('td');
      summaryTd.textContent = l.summary;
      const viewTd = document.createElement('td');
      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'View';
      viewBtn.onclick = () => showLogDetail(l.id);
      viewTd.appendChild(viewBtn);
      tr.appendChild(timeTd);
      tr.appendChild(actorTd);
      tr.appendChild(actionTd);
      tr.appendChild(targetTd);
      tr.appendChild(summaryTd);
      tr.appendChild(viewTd);
      tr.onclick = () => showLogDetail(l.id);
      tbody.appendChild(tr);
    });
  }
  // Pagination controls
  updateLogsPagination(total);
}

/* ------------------------------ */
/* Finance page rendering           */
/* ------------------------------ */

/* Renders the finance summary table based on payment method totals
   and the selected date range. The date range is determined by the
   inputs with IDs 'finFrom' and 'finTo'. Totals are computed on
   billingDate values of members. */
function renderFinance() {
  const fromInput = document.getElementById('finFrom');
  const toInput = document.getElementById('finTo');
  const bodyEl = document.getElementById('financeBody');
  const footEl = document.getElementById('financeFoot');
  const emptyEl = document.getElementById('financeEmpty');
  if (!bodyEl || !footEl) return;
  // Parse date range
  let from = fromInput && fromInput.value ? new Date(fromInput.value) : null;
  let to = toInput && toInput.value ? new Date(toInput.value) : null;
  // If only one bound is provided, set the other to min/max
  if (from) {
    from.setHours(0, 0, 0, 0);
  }
  if (to) {
    to.setHours(23, 59, 59, 999);
  }
  // Filter members within date range (using billingDate). Convert
  // billingDate strings to Date objects; if missing, skip record.
  const filtered = members.filter(m => {
    if (!m.billingDate) return false;
    const d = new Date(m.billingDate);
    if (isNaN(d)) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  // Compute totals per payment method
  const totals = {};
  let grandTotal = 0;
  filtered.forEach(m => {
    const pm = m.paymentMethod || 'Unknown';
    const amt = parseFloat(m.amount) || 0;
    if (!totals[pm]) totals[pm] = 0;
    totals[pm] += amt;
    grandTotal += amt;
  });
  // Clear table body and foot
  bodyEl.innerHTML = '';
  footEl.innerHTML = '';
  const methodNames = Object.keys(totals);
  // If no payments in range, show empty message and exit
  if (methodNames.length === 0) {
    emptyEl.style.display = '';
    return;
  } else {
    emptyEl.style.display = 'none';
  }
  methodNames.forEach(pm => {
    const tr = document.createElement('tr');
    const methodTd = document.createElement('td');
    methodTd.textContent = pm;
    const amountTd = document.createElement('td');
    amountTd.textContent = totals[pm].toFixed(2);
    tr.appendChild(methodTd);
    tr.appendChild(amountTd);
    bodyEl.appendChild(tr);
  });
  // Add a footer row with the grand total
  const footTr = document.createElement('tr');
  const totalLabelTd = document.createElement('td');
  totalLabelTd.textContent = 'Total';
  totalLabelTd.style.fontWeight = 'bold';
  const totalAmtTd = document.createElement('td');
  totalAmtTd.textContent = grandTotal.toFixed(2);
  totalAmtTd.style.fontWeight = 'bold';
  footTr.appendChild(totalLabelTd);
  footTr.appendChild(totalAmtTd);
  footEl.appendChild(footTr);
}

/* Set default date range for finance filters to cover the last 30 days. */
function setDefaultFinanceRange() {
  const fromInput = document.getElementById('finFrom');
  const toInput = document.getElementById('finTo');
  if (!fromInput || !toInput) return;
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - 30);
  // Set valueAsDate to ensure proper formatting in the date input
  fromInput.valueAsDate = fromDate;
  toInput.valueAsDate = now;
}

// Update logs pagination controls
function updateLogsPagination(totalCount) {
  const pag = document.getElementById('logsPagination');
  if (!pag) return;
  const totalPages = Math.max(1, Math.ceil(totalCount / logsState.pageSize));
  pag.innerHTML = '';
  // Helper to create button
  function createBtn(label, disabled, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (disabled) {
      btn.classList.add('disabled');
      btn.disabled = true;
    } else {
      btn.onclick = onClick;
    }
    return btn;
  }
  // First and Prev
  pag.appendChild(createBtn('« First', logsState.page === 1, () => {
    logsState.page = 1;
    renderLogs();
  }));
  pag.appendChild(createBtn('‹ Prev', logsState.page === 1, () => {
    logsState.page--;
    renderLogs();
  }));
  // Page indicator
  const span = document.createElement('span');
  span.textContent = `Page ${logsState.page} of ${totalPages}`;
  pag.appendChild(span);
  // Next and Last
  pag.appendChild(createBtn('Next ›', logsState.page === totalPages, () => {
    logsState.page++;
    renderLogs();
  }));
  pag.appendChild(createBtn('Last »', logsState.page === totalPages, () => {
    logsState.page = totalPages;
    renderLogs();
  }));
}

// Apply filters from toolbar controls and re-render
function setLogsFilter() {
  const fromInput = document.getElementById('logFrom');
  const toInput = document.getElementById('logTo');
  const actorSelect = document.getElementById('logActor');
  const actionSelect = document.getElementById('logAction');
  const searchInput = document.getElementById('logSearch');
  if (fromInput) logsState.from = fromInput.value;
  if (toInput) logsState.to = toInput.value;
  if (actorSelect) logsState.actor = actorSelect.value;
  if (actionSelect) logsState.action = actionSelect.value;
  if (searchInput) logsState.search = searchInput.value.trim();
  logsState.page = 1;
  renderLogs();
}

// Debounced filter for search to avoid excessive re-renders
function debouncedSetLogsFilter() {
  if (logsFilterTimeout) clearTimeout(logsFilterTimeout);
  logsFilterTimeout = setTimeout(() => {
    setLogsFilter();
  }, 300);
}

// Show log detail modal
function showLogDetail(logId) {
  const modal = document.getElementById('logDetailModal');
  const content = document.getElementById('logDetailContent');
  if (!modal || !content) return;
  const logs = getLogs();
  const log = logs.find(l => l.id === logId);
  if (!log) return;
  // Build details HTML
  let html = '';
  html += `<p><strong>Time:</strong> ${new Date(log.ts).toLocaleString()}</p>`;
  html += `<p><strong>Actor:</strong> ${log.actor}</p>`;
  html += `<p><strong>Action:</strong> ${log.action}</p>`;
  html += `<p><strong>Target:</strong> ${log.targetType}${log.targetId ? ' / ' + log.targetId : ''}</p>`;
  html += `<p><strong>Summary:</strong> ${log.summary}</p>`;
  if (log.meta) {
    html += '<p><strong>Meta:</strong></p>';
    html += `<pre>${JSON.stringify(log.meta, null, 2)}</pre>`;
  }
  content.innerHTML = html;
  modal.style.display = 'flex';
}

function hideLogDetail() {
  const modal = document.getElementById('logDetailModal');
  if (modal) modal.style.display = 'none';
}

// Export current filtered logs to CSV
function exportLogsCsv() {
  // Build filtered list (without pagination)
  let logs = getLogs();
  const fromMs = logsState.from ? new Date(logsState.from).setHours(0,0,0,0) : 0;
  const toMs = logsState.to ? new Date(logsState.to).setHours(23,59,59,999) : Date.now();
  const actorFilter = logsState.actor || '';
  const actionFilter = logsState.action || '';
  const q = (logsState.search || '').toLowerCase();
  let list = logs.filter(l => {
    const tsMs = new Date(l.ts).getTime();
    if (tsMs < fromMs || tsMs > toMs) return false;
    if (actorFilter && l.actor !== actorFilter) return false;
    if (actionFilter && l.action !== actionFilter) return false;
    if (q) {
      const summaryMatch = l.summary && l.summary.toLowerCase().includes(q);
      const targetMatch = l.targetId && String(l.targetId).toLowerCase().includes(q);
      const actionMatch = l.action && l.action.toLowerCase().includes(q);
      const actorMatch = l.actor && l.actor.toLowerCase().includes(q);
      return summaryMatch || targetMatch || actionMatch || actorMatch;
    }
    return true;
  });
  // Sort newest first
  list.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  // Build CSV
  let csv = 'Time,Actor,Action,Target,Summary\n';
  list.forEach(l => {
    const timeStr = new Date(l.ts).toLocaleString().replace(/,/g, '');
    const target = l.targetType + (l.targetId ? ' / ' + l.targetId : '');
    // Escape commas in summary
    let summary = l.summary || '';
    if (summary.includes(',')) summary = '"' + summary.replace(/"/g, '""') + '"';
    csv += `${timeStr},${l.actor},${l.action},${target},${summary}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'admin_logs.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Expose logs functions globally for HTML inline handlers
window.setLogsFilter = setLogsFilter;
window.debouncedSetLogsFilter = debouncedSetLogsFilter;
window.exportLogsCsv = exportLogsCsv;
window.showLogDetail = showLogDetail;
window.hideLogDetail = hideLogDetail;

