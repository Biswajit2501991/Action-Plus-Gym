/*
 * Action Plus Gym Management Application
 * This script powers both the login page and the main application. It handles
 * authentication, navigation, member management, PDF generation, and basic
 * search functionality. Data is persisted in localStorage for simplicity.
 */

// Predefined credentials (username: {password, role})
const USERS = {
  'Kaushik01': { password: 'kau123', role: 'staff' },
  'Biswajit01': { password: 'bis123', role: 'admin' },
  'Raj01': { password: 'raj123', role: 'staff' }
};

// In-memory member list loaded from localStorage on startup
let members = [];
let editIndex = null; // Tracks index of member being edited

// Check if we are on the login page or the app page
document.addEventListener('DOMContentLoaded', () => {
  const isLoginPage = document.body.classList.contains('login-page');
  if (isLoginPage) {
    // Attach login handler
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);
  } else {
    // Ensure user is logged in
    checkAuthentication();
    // Load members from storage
    loadMembers();
    // Populate dynamic elements
    populatePaymentMonths();
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
  if (USERS[username] && USERS[username].password === password) {
    // Store logged in user and role in sessionStorage
    sessionStorage.setItem('user', username);
    sessionStorage.setItem('role', USERS[username].role);
    // Redirect to main app
    window.location.href = 'app.html';
  } else {
    errorEl.textContent = 'Invalid username or password.';
  }
}

function checkAuthentication() {
  const user = sessionStorage.getItem('user');
  if (!user) {
    // Not logged in; redirect to login page
    window.location.href = 'login.html';
  } else {
    // Populate staff name for new admissions
    const staffInput = document.getElementById('mStaff');
    if (staffInput) {
      staffInput.value = user;
    }
    // Adjust UI based on role
    adjustRoleBasedUI();
  }
}

/* Adjust UI based on user role (hide sections for non-admin) */
function adjustRoleBasedUI() {
  const role = sessionStorage.getItem('role');
  // Only allow admin to access staff, settings and logs; hide for others
  // Hide certain navigation links for non-admin users
  if (role !== 'admin') {
    const navItems = document.querySelectorAll('.sidebar li');
    navItems.forEach(li => {
      const text = li.textContent.trim().toLowerCase();
      if (text === 'staff' || text === 'settings' || text === 'admin logs') {
        li.style.display = 'none';
      }
    });
  }
}

function logout() {
  sessionStorage.removeItem('user');
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

/* Render the dashboard table */
function renderDashboard() {
  const tbody = document.getElementById('dashboardBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  members.forEach((member, idx) => {
    const tr = document.createElement('tr');
    const cells = [
      member.formNumber || '',
      member.id || '',
      member.name || '',
      member.gender || '',
      member.dob || '',
      member.email || '',
      member.mobile || '',
      member.plan || '',
      member.amount || '',
      member.status || ''
    ];
    cells.forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    // Action cell with PDF download link
    const actionTd = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.onclick = () => {
      loadMemberIntoForm(idx);
      showSection('members');
    };
    actionTd.appendChild(viewBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

/* Search functionality: filter table by name or mobile number */
function performSearch() {
  const query = document.getElementById('searchBar').value.trim().toLowerCase();
  const filtered = members.filter(m => {
    return (
      (m.name && m.name.toLowerCase().includes(query)) ||
      (m.mobile && m.mobile.replace(/\D/g, '').includes(query.replace(/\D/g, '')))
    );
  });
  const tbody = document.getElementById('dashboardBody');
  tbody.innerHTML = '';
  filtered.forEach(member => {
    const idx = members.indexOf(member);
    const tr = document.createElement('tr');
    const cells = [
      member.formNumber || '',
      member.id || '',
      member.name || '',
      member.gender || '',
      member.dob || '',
      member.email || '',
      member.mobile || '',
      member.plan || '',
      member.amount || '',
      member.status || ''
    ];
    cells.forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    const actionTd = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.onclick = () => {
      loadMemberIntoForm(idx);
      showSection('members');
    };
    actionTd.appendChild(viewBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
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
  document.getElementById('mStaff').value = sessionStorage.getItem('user') || '';
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

