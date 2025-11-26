/* MyFinance - script.js
   Menangani: transaksi, render tabel, edit, delete, filter, chart, dark mode
*/

let transactions = JSON.parse(localStorage.getItem('mf_transactions') || '[]');
let theme = localStorage.getItem('mf_theme') || 'light';

// Elemen
const form = document.getElementById("financeForm");
const list = document.getElementById("transactionList");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const balanceEl = document.getElementById("balance");

const filterTypeEl = document.getElementById("filterType");
const filterCategoryEl = document.getElementById("filterCategory");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const clearFilterBtn = document.getElementById("clearFilterBtn");
const resetBtn = document.getElementById("resetBtn");
const themeToggle = document.getElementById("themeToggle");

// Chart instances
let expenseCategoryChart = null;
let incomeExpenseMonthChart = null;

// Init
document.body.classList.toggle('dark', theme === 'dark');
updateThemeButton();

// Helper: simpan ke localStorage
function saveTransactions(){
  localStorage.setItem('mf_transactions', JSON.stringify(transactions));
}

// Format angka sederhana (Rp)
function formatRp(num){
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

// Add / Update
form.addEventListener("submit", function(e){
  e.preventDefault();

  const date = document.getElementById("date").value;
  const type = document.querySelector('input[name="type"]:checked').value;
  const category = document.getElementById("category").value;
  const amount = Number(document.getElementById("amount").value);
  const note = document.getElementById("note").value;
  const editId = document.getElementById("editId").value;

  if(!date || !type || !category || !amount || amount <= 0){
    alert("Semua field wajib diisi dan jumlah harus > 0");
    return;
  }

  if(editId){
    const idx = transactions.findIndex(t => t.id == editId);
    transactions[idx] = { id: Number(editId), date, type, category, amount, note };
    document.getElementById("editId").value = "";
    document.getElementById("formTitle").innerText = "Tambah Transaksi";
    document.getElementById("submitBtn").innerText = "Tambah";
    alert("Transaksi berhasil di-update!");
  } else {
    const trx = { id: Date.now(), date, type, category, amount, note };
    transactions.push(trx);
    alert("Transaksi berhasil ditambahkan!");
  }

  saveTransactions();
  renderTransactions();
  form.reset();
});

// Reset form button
resetBtn.addEventListener("click", function(){
  form.reset();
  document.getElementById("editId").value = "";
  document.getElementById("formTitle").innerText = "Tambah Transaksi";
  document.getElementById("submitBtn").innerText = "Tambah";
});

// Render table & summary
function renderTransactions(data = transactions){
  list.innerHTML = "";
  let totalIncome = 0, totalExpense = 0;

  // sort by date desc
  const sorted = [...data].sort((a,b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${t.type}</td>
      <td>${t.category}</td>
      <td>${formatRp(t.amount)}</td>
      <td>${t.note}</td>
      <td>
        <button class="secondary" onclick="editTransaction(${t.id})">Edit</button>
        <button style="background:${getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#dc2626'}" onclick="deleteTransaction(${t.id})">Hapus</button>
      </td>
    `;
    list.appendChild(tr);

    if(t.type === "Pemasukan") totalIncome += t.amount;
    else totalExpense += t.amount;
  });

  totalIncomeEl.innerText = formatRp(totalIncome);
  totalExpenseEl.innerText = formatRp(totalExpense);
  balanceEl.innerText = formatRp(totalIncome - totalExpense);

  updateCharts(); // refresh grafik
}

// Delete
function deleteTransaction(id){
  if(!confirm("Hapus transaksi ini?")) return;
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderTransactions();
}

// Edit
function editTransaction(id){
  const t = transactions.find(x => x.id === id);
  document.getElementById("date").value = t.date;
  document.querySelector(`input[name="type"][value="${t.type}"]`).checked = true;
  document.getElementById("category").value = t.category;
  document.getElementById("amount").value = t.amount;
  document.getElementById("note").value = t.note;
  document.getElementById("editId").value = t.id;
  document.getElementById("formTitle").innerText = "Edit Transaksi";
  document.getElementById("submitBtn").innerText = "Simpan";
}

// Filter
applyFilterBtn.addEventListener("click", function(){
  applyFilter();
});
clearFilterBtn.addEventListener("click", function(){
  filterTypeEl.value = 'Semua';
  filterCategoryEl.value = 'Semua';
  renderTransactions();
});

function applyFilter(){
  let filtered = [...transactions];
  const type = filterTypeEl.value;
  const category = filterCategoryEl.value;

  if(type !== "Semua") filtered = filtered.filter(t => t.type === type);
  if(category !== "Semua") filtered = filtered.filter(t => t.category === category);

  renderTransactions(filtered);
}

// THEME
themeToggle.addEventListener("click", function(){
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('mf_theme', isDark ? 'dark' : 'light');
  updateThemeButton();
});

function updateThemeButton(){
  const isDark = document.body.classList.contains('dark');
  themeToggle.innerText = isDark ? 'Mode Terang' : 'Mode Gelap';
}

// CHARTS
function updateCharts(){
  const ctxPie = document.getElementById('expenseCategoryChart').getContext('2d');
  const ctxBar = document.getElementById('incomeExpenseMonthChart').getContext('2d');

  // Prepare category totals for pengeluaran
  const categoryTotals = {};
  transactions.forEach(t => {
    if(t.type === 'Pengeluaran'){
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    }
  });

  const labels = Object.keys(categoryTotals);
  const values = Object.values(categoryTotals);

  // Destroy existing to avoid duplicate
  if(expenseCategoryChart) expenseCategoryChart.destroy();
  expenseCategoryChart = new Chart(ctxPie, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        // background colors let Chart.js choose defaults
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).color } },
        title: { display: true, text: 'Pengeluaran per Kategori' }
      }
    }
  });

  // Simple monthly income vs expense for last 6 months
  const now = new Date();
  const months = [];
  for(let i = 5; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  const incomePerMonth = months.map(m => 0);
  const expensePerMonth = months.map(m => 0);

  transactions.forEach(t => {
    const ym = t.date.slice(0,7); // "YYYY-MM"
    const idx = months.indexOf(ym);
    if(idx >= 0){
      if(t.type === 'Pemasukan') incomePerMonth[idx] += t.amount;
      else expensePerMonth[idx] += t.amount;
    }
  });

  if(incomeExpenseMonthChart) incomeExpenseMonthChart.destroy();
  incomeExpenseMonthChart = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Pemasukan', data: incomePerMonth, stack: 'stack1' },
        { label: 'Pengeluaran', data: expensePerMonth, stack: 'stack1' }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Pemasukan vs Pengeluaran (6 bulan terakhir)' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Inisialisasi awal
renderTransactions();

// expose editTransaction/deleteTransaction ke global (dipanggil dari HTML inline buttons)
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.applyFilter = applyFilter;
