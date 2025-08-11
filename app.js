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
    // Populate dynamic elements
    populatePaymentMonths();
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
  const navPerms = ['dashboard', 'members', 'sms', 'finance', 'staff', 'settings', 'logs'];
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
  sessionStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}

/* Sidebar toggle for small screens */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');
}

function toggleMobileView() {
  document.body.classList.toggle('mobile');
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
      break;
    case 'sms':
      document.getElementById('smsSection').style.display = '';
      navItems[2].classList.add('active');
      break;
    case 'finance':
      document.getElementById('financeSection').style.display = '';
      navItems[3].classList.add('active');
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
      break;
    case 'logs':
      document.getElementById('logsSection').style.display = '';
      navItems[6].classList.add('active');
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
  }
  saveUsers();
  renderStaffTable();
  hideUserForm();
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
  // Apply search filter across name (case-insensitive) and digits of mobile
  const search = dashboardState.searchQuery.trim().toLowerCase();
  const searchDigits = search.replace(/\D/g, '');
  if (search) {
    dataset = dataset.filter(m => {
      const nameMatch = m.name && m.name.toLowerCase().includes(search);
      const mobileMatch = m.mobile && m.mobile.replace(/\D/g, '').includes(searchDigits);
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
    // Name
    const nameTd = document.createElement('td');
    nameTd.textContent = member.name || '';
    tr.appendChild(nameTd);
    // Plan
    const planTd = document.createElement('td');
    planTd.textContent = member.plan || '';
    tr.appendChild(planTd);
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
  ['Active', 'Hold', 'Cancelled', 'Deactivated'].forEach(status => {
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
  // Generate ID if not present
  let idVal = idAuto;
  if (!idVal) {
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
    status,
    holdDuration,
    paymentMethod,
    payMonth,
    remark,
    photo: photoBase64,
    // PDF will be generated below
    pdfUrl: ''
  };
  // Duplicate checks when creating new
  if (editIndex === null) {
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
  // Generate PDF using jsPDF
  generateMemberPDF(record).then(pdfDataUrl => {
    record.pdfUrl = pdfDataUrl;
    if (editIndex === null) {
      members.push(record);
    } else {
      members[editIndex] = record;
    }
    saveMembers();
    renderDashboard();
    clearMemberForm();
    alert('Member saved successfully.');
  });
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
}

function updateMember() {
  if (editIndex === null) {
    alert('Please select a member from the dashboard to update.');
    return;
  }
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

