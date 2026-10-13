/**
 * ExpenseTrack — Client Application
 * Handles API integration, UI interactions, charts, filters, and modals
 */

document.addEventListener('DOMContentLoaded', () => {
  // ===================================================================
  // Application State
  // ===================================================================
  const state = {
    activeTab: 'dashboard-view',
    currentPage: 1,
    limitPerPage: 10,
    filters: {
      search: '',
      category: '',
      payment_method: '',
      startDate: '',
      endDate: '',
      sortBy: 'expense_date',
      sortOrder: 'DESC',
    },
    editingExpenseId: null,
    deletingExpense: null,
    monthlyChart: null,
    categoryChart: null,
    monthlyReportData: null,
  };

  // Predefined Categories & Metadata
  const CATEGORIES = [
    { name: 'Food', icon: 'utensils', color: '#f59e0b' },
    { name: 'Transportation', icon: 'car', color: '#0284c7' },
    { name: 'Education', icon: 'graduation-cap', color: '#7c3aed' },
    { name: 'Shopping', icon: 'shopping-bag', color: '#db2777' },
    { name: 'Entertainment', icon: 'film', color: '#c026d3' },
    { name: 'Healthcare', icon: 'heart-pulse', color: '#dc2626' },
    { name: 'Bills', icon: 'file-text', color: '#ea580c' },
    { name: 'Other', icon: 'layers', color: '#475569' },
  ];

  // Currency & Date Formatters
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // ===================================================================
  // Helper Functions
  // ===================================================================
  const formatINR = (amount) => {
    const num = parseFloat(amount);
    return isNaN(num) ? '₹0.00' : currencyFormatter.format(num);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      // Avoid timezone shift by parsing parts
      const [year, month, day] = dateStr.substring(0, 10).split('-');
      const d = new Date(year, month - 1, day);
      return dateFormatter.format(d);
    } catch {
      return dateStr;
    }
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const updateIcons = () => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  };

  const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    
    const iconName = type === 'error' ? 'alert-circle' : 'check-circle-2';
    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    updateIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  // ===================================================================
  // Health & Header Setup
  // ===================================================================
  const updateCurrentDateHeader = () => {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
    const dateStr = now.toLocaleDateString('en-IN', options);
    const dateEl = document.getElementById('current-date-display');
    if (dateEl) dateEl.textContent = dateStr;
  };

  const checkHealthStatus = async () => {
    const statusDot = document.getElementById('db-status-dot');
    const statusText = document.getElementById('db-status-text');
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (res.ok && data.database === 'connected') {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Database: Connected';
      } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Database: Connecting...';
      }
    } catch {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Database: Disconnected';
    }
  };

  // ===================================================================
  // Navigation & Tab Switching
  // ===================================================================
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const tabViews = document.querySelectorAll('.tab-view');
  const pageTitle = document.getElementById('page-title');

  const switchTab = (tabId) => {
    state.activeTab = tabId;
    tabViews.forEach((view) => {
      view.classList.toggle('active', view.id === tabId);
    });

    navItems.forEach((nav) => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === tabId);
    });

    // Update Header title
    const titles = {
      'dashboard-view': 'Dashboard',
      'transactions-view': 'All Transactions',
      'categories-view': 'Expense Categories',
      'reports-view': 'Monthly Reports',
    };
    pageTitle.textContent = titles[tabId] || 'Dashboard';

    // Refresh data for the active view
    if (tabId === 'dashboard-view') {
      loadDashboard();
    } else if (tabId === 'transactions-view') {
      loadTransactions(state.currentPage);
    } else if (tabId === 'categories-view') {
      loadCategoriesView();
    } else if (tabId === 'reports-view') {
      loadMonthlyReport();
    }

    // Close mobile menu if open
    document.getElementById('sidebar').classList.remove('mobile-open');
  };

  navItems.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('mobile-open');
    });
  }

  const brandLink = document.getElementById('brand-link');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('dashboard-view');
    });
  }

  const viewAllBtn = document.getElementById('view-all-transactions-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      switchTab('transactions-view');
    });
  }

  // Global search jump
  const globalSearch = document.getElementById('global-search-input');
  if (globalSearch) {
    globalSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = globalSearch.value.trim();
        state.filters.search = query;
        document.getElementById('filter-search').value = query;
        switchTab('transactions-view');
      }
    });
  }

  // ===================================================================
  // DASHBOARD DATA LOADERS
  // ===================================================================
  const loadDashboard = async () => {
    await Promise.all([
      loadDashboardSummary(),
      loadMonthlyChart(),
      loadCategoryChart(),
      loadRecentTransactions(),
    ]);
    updateIcons();
  };

  const loadDashboardSummary = async () => {
    try {
      const res = await fetch('/api/summary');
      if (!res.ok) throw new Error('Failed to fetch summary');
      const json = await res.json();
      const { totalExpenses, thisMonthExpenses, highestCategory, totalTransactions } = json.data;

      document.getElementById('card-total-expenses').textContent = formatINR(totalExpenses);
      document.getElementById('card-month-expenses').textContent = formatINR(thisMonthExpenses);
      
      const highestCatEl = document.getElementById('card-highest-category');
      const highestAmtEl = document.getElementById('card-highest-amount');
      if (highestCategory && highestCategory.name !== 'None') {
        highestCatEl.textContent = highestCategory.name;
        highestAmtEl.textContent = `${formatINR(highestCategory.amount)} spent`;
      } else {
        highestCatEl.textContent = 'None';
        highestAmtEl.textContent = '₹0.00 spent';
      }

      document.getElementById('card-total-transactions').textContent = totalTransactions.toLocaleString('en-IN');
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
    }
  };

  const loadMonthlyChart = async () => {
    try {
      const res = await fetch('/api/reports/monthly?months=6');
      if (!res.ok) throw new Error('Failed to fetch monthly chart data');
      const json = await res.json();
      const monthlyData = json.data;

      const labels = monthlyData.map((d) => d.label);
      const dataValues = monthlyData.map((d) => d.total);

      const ctx = document.getElementById('monthlyChart').getContext('2d');

      if (state.monthlyChart) {
        state.monthlyChart.destroy();
      }

      state.monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Expenses (₹)',
              data: dataValues,
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              borderColor: '#059669',
              borderWidth: 1,
              borderRadius: 6,
              hoverBackgroundColor: '#059669',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `Spent: ${formatINR(context.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: 'inherit', size: 12 }, color: '#64748b' },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: {
                font: { family: 'inherit', size: 11 },
                color: '#64748b',
                callback: (val) => `₹${val}`,
              },
            },
          },
        },
      });
    } catch (err) {
      console.error('Error rendering monthly chart:', err);
    }
  };

  const loadCategoryChart = async () => {
    try {
      const res = await fetch('/api/reports/categories');
      if (!res.ok) throw new Error('Failed to fetch category data');
      const json = await res.json();
      const categories = json.data;

      const ctx = document.getElementById('categoryChart').getContext('2d');

      if (state.categoryChart) {
        state.categoryChart.destroy();
      }

      if (!categories || categories.length === 0) {
        // Empty state chart placeholder
        state.categoryChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['No Data'],
            datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { enabled: false },
            },
          },
        });
        return;
      }

      const labels = categories.map((c) => c.category);
      const dataValues = categories.map((c) => c.total);
      
      const palette = [
        '#10b981', '#3b82f6', '#f59e0b', '#ec4899',
        '#8b5cf6', '#ef4444', '#14b8a6', '#64748b'
      ];

      state.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: dataValues,
              backgroundColor: palette.slice(0, categories.length),
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 12,
                font: { size: 11 },
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = context.parsed;
                  return ` ${context.label}: ${formatINR(val)}`;
                },
              },
            },
          },
          cutout: '68%',
        },
      });
    } catch (err) {
      console.error('Error rendering category chart:', err);
    }
  };

  const loadRecentTransactions = async () => {
    const tbody = document.getElementById('recent-transactions-tbody');
    const emptyState = document.getElementById('recent-empty-state');
    try {
      const res = await fetch('/api/expenses?limit=5&sortBy=expense_date&sortOrder=DESC');
      if (!res.ok) throw new Error('Failed to fetch recent expenses');
      const json = await res.json();
      const expenses = json.data;

      if (!expenses || expenses.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';
      tbody.innerHTML = expenses.map(renderTransactionRow).join('');
      attachTableActionListeners(tbody);
    } catch (err) {
      console.error('Error loading recent transactions:', err);
    }
  };

  // ===================================================================
  // ALL TRANSACTIONS VIEW & CRUD
  // ===================================================================
  const renderTransactionRow = (item) => {
    const sanitizedTitle = escapeHtml(item.title);
    const sanitizedDesc = escapeHtml(item.description || '');
    const categoryClass = `cat-${item.category.replace(/\s+/g, '')}`;

    return `
      <tr data-id="${item.id}">
        <td>
          <div class="expense-title-cell">
            <span>${sanitizedTitle}</span>
            ${sanitizedDesc ? `<span class="expense-desc">${sanitizedDesc}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="badge-category ${categoryClass}">${escapeHtml(item.category)}</span>
        </td>
        <td>${formatDateDisplay(item.expense_date)}</td>
        <td>
          <span class="badge-payment">${escapeHtml(item.payment_method || 'Cash')}</span>
        </td>
        <td>
          <span class="amount-cell">${formatINR(item.amount)}</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon btn-edit" data-id="${item.id}" title="Edit Expense">
              <i data-lucide="pencil"></i>
            </button>
            <button class="btn-icon btn-delete" data-id="${item.id}" data-title="${sanitizedTitle}" data-amount="${item.amount}" title="Delete Expense">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  };

  const attachTableActionListeners = (container) => {
    container.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditExpenseModal(id);
      });
    });

    container.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        const amount = btn.getAttribute('data-amount');
        openDeleteModal(id, title, amount);
      });
    });

    updateIcons();
  };

  const loadTransactions = async (page = 1) => {
    state.currentPage = page;
    const tbody = document.getElementById('all-transactions-tbody');
    const emptyState = document.getElementById('all-empty-state');
    const paginationBar = document.getElementById('pagination-bar');
    const infoText = document.getElementById('pagination-info-text');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageNumDisplay = document.getElementById('page-num-display');

    try {
      const params = new URLSearchParams({
        page: state.currentPage,
        limit: state.limitPerPage,
        sortBy: state.filters.sortBy,
        sortOrder: state.filters.sortOrder,
      });

      if (state.filters.search) params.append('search', state.filters.search);
      if (state.filters.category) params.append('category', state.filters.category);
      if (state.filters.payment_method) params.append('payment_method', state.filters.payment_method);
      if (state.filters.startDate) params.append('startDate', state.filters.startDate);
      if (state.filters.endDate) params.append('endDate', state.filters.endDate);

      const res = await fetch(`/api/expenses?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const json = await res.json();
      const { data: expenses, pagination } = json;

      if (!expenses || expenses.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        infoText.textContent = 'Showing 0 of 0 transactions';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        pageNumDisplay.textContent = 'Page 1';
        return;
      }

      emptyState.style.display = 'none';
      tbody.innerHTML = expenses.map(renderTransactionRow).join('');
      attachTableActionListeners(tbody);

      // Pagination setup
      const startIdx = (pagination.page - 1) * pagination.limit + 1;
      const endIdx = Math.min(pagination.page * pagination.limit, pagination.total);
      infoText.textContent = `Showing ${startIdx}-${endIdx} of ${pagination.total} transactions`;
      pageNumDisplay.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;

      prevBtn.disabled = pagination.page <= 1;
      nextBtn.disabled = pagination.page >= pagination.totalPages;
    } catch (err) {
      console.error('Error loading transactions:', err);
      showToast('Error loading transactions.', 'error');
    }
  };

  // Filter input listeners
  const filterSearch = document.getElementById('filter-search');
  const filterCategory = document.getElementById('filter-category');
  const filterPayment = document.getElementById('filter-payment');
  const filterStartDate = document.getElementById('filter-start-date');
  const filterSort = document.getElementById('filter-sort');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');

  let searchTimeout = null;
  filterSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = filterSearch.value.trim();
      loadTransactions(1);
    }, 350);
  });

  filterCategory.addEventListener('change', () => {
    state.filters.category = filterCategory.value;
    loadTransactions(1);
  });

  filterPayment.addEventListener('change', () => {
    state.filters.payment_method = filterPayment.value;
    loadTransactions(1);
  });

  filterStartDate.addEventListener('change', () => {
    state.filters.startDate = filterStartDate.value;
    loadTransactions(1);
  });

  filterSort.addEventListener('change', () => {
    const [sortBy, sortOrder] = filterSort.value.split('-');
    state.filters.sortBy = sortBy;
    state.filters.sortOrder = sortOrder;
    loadTransactions(1);
  });

  resetFiltersBtn.addEventListener('click', () => {
    filterSearch.value = '';
    filterCategory.value = '';
    filterPayment.value = '';
    filterStartDate.value = '';
    filterSort.value = 'expense_date-DESC';

    state.filters = {
      search: '',
      category: '',
      payment_method: '',
      startDate: '',
      endDate: '',
      sortBy: 'expense_date',
      sortOrder: 'DESC',
    };
    loadTransactions(1);
  });

  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (state.currentPage > 1) {
      loadTransactions(state.currentPage - 1);
    }
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    loadTransactions(state.currentPage + 1);
  });

  // ===================================================================
  // CATEGORIES VIEW
  // ===================================================================
  const loadCategoriesView = async () => {
    const container = document.getElementById('categories-cards-container');
    try {
      const res = await fetch('/api/reports/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const json = await res.json();
      const categoryData = json.data;

      // Map API data by category name
      const dataMap = {};
      categoryData.forEach((item) => {
        dataMap[item.category] = item;
      });

      const cardsHtml = CATEGORIES.map((cat) => {
        const record = dataMap[cat.name] || { total: 0, count: 0, percentage: 0 };
        const amountDisplay = formatINR(record.total);
        const countDisplay = `${record.count} transaction${record.count === 1 ? '' : 's'}`;
        const pctDisplay = `${record.percentage || 0}%`;

        return `
          <div class="category-card" data-category="${cat.name}" style="cursor: pointer;">
            <div class="category-card-header">
              <span class="category-badge-title">${cat.name}</span>
              <span class="badge-category cat-${cat.name.replace(/\s+/g, '')}">${pctDisplay}</span>
            </div>
            <div class="category-card-amount">${amountDisplay}</div>
            <div class="progress-track">
              <div class="progress-bar" style="width: ${record.percentage || 0}%; background-color: ${cat.color};"></div>
            </div>
            <div class="category-card-footer">
              <span>${countDisplay}</span>
              <span style="color: var(--accent-green); font-weight: 500;">Filter records &rarr;</span>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = cardsHtml;

      // Add click-to-filter interaction
      container.querySelectorAll('.category-card').forEach((card) => {
        card.addEventListener('click', () => {
          const categoryName = card.getAttribute('data-category');
          filterCategory.value = categoryName;
          state.filters.category = categoryName;
          switchTab('transactions-view');
        });
      });

      updateIcons();
    } catch (err) {
      console.error('Error loading categories view:', err);
    }
  };

  // ===================================================================
  // MONTHLY REPORTS VIEW
  // ===================================================================
  const initReportsControls = () => {
    const yearSelect = document.getElementById('report-year-select');
    const monthSelect = document.getElementById('report-month-select');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    yearSelect.innerHTML = '';
    for (let y = currentYear; y >= currentYear - 4; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    }

    yearSelect.value = currentYear;
    monthSelect.value = currentMonth;

    document.getElementById('load-report-btn').addEventListener('click', () => {
      loadMonthlyReport();
    });

    document.getElementById('export-csv-btn').addEventListener('click', exportReportToCsv);
  };

  const loadMonthlyReport = async () => {
    const year = document.getElementById('report-year-select').value;
    const month = document.getElementById('report-month-select').value;
    const tbody = document.getElementById('report-transactions-tbody');
    const emptyState = document.getElementById('report-empty-state');

    try {
      const res = await fetch(`/api/reports/month-detail?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Failed to load month detail report');
      const json = await res.json();
      state.monthlyReportData = json.data;

      const { total, count, transactions } = state.monthlyReportData;

      // Calculate days in selected month
      const daysInMonth = new Date(year, month, 0).getDate();
      const dailyAvg = count > 0 ? total / daysInMonth : 0;

      const monthName = document.getElementById('report-month-select').options[month - 1].text;
      document.getElementById('report-month-total').textContent = formatINR(total);
      document.getElementById('report-month-label').textContent = `${monthName} ${year}`;
      document.getElementById('report-month-count').textContent = count;
      document.getElementById('report-month-avg').textContent = formatINR(dailyAvg);

      if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';
      tbody.innerHTML = transactions.map(renderTransactionRow).join('');
      attachTableActionListeners(tbody);
    } catch (err) {
      console.error('Error loading monthly report:', err);
      showToast('Error loading monthly report.', 'error');
    }
  };

  const exportReportToCsv = () => {
    if (!state.monthlyReportData || !state.monthlyReportData.transactions || state.monthlyReportData.transactions.length === 0) {
      showToast('No data available to export for this month.', 'error');
      return;
    }

    const year = document.getElementById('report-year-select').value;
    const month = document.getElementById('report-month-select').value;
    const transactions = state.monthlyReportData.transactions;

    const headers = ['ID', 'Title', 'Category', 'Expense Date', 'Payment Method', 'Amount (INR)', 'Description'];
    const rows = transactions.map((t) => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.category || ''}"`,
      t.expense_date ? t.expense_date.substring(0, 10) : '',
      `"${t.payment_method || ''}"`,
      t.amount,
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ExpenseTrack_Report_${year}_${String(month).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Monthly report exported successfully!');
  };

  // ===================================================================
  // MODALS: ADD / EDIT EXPENSE
  // ===================================================================
  const expenseModal = document.getElementById('expense-modal');
  const expenseForm = document.getElementById('expense-form');
  const modalTitle = document.getElementById('modal-title');
  const saveBtnText = document.getElementById('save-expense-btn-text');

  const openAddExpenseModal = () => {
    state.editingExpenseId = null;
    modalTitle.textContent = 'Add New Expense';
    saveBtnText.textContent = 'Save Expense';
    expenseForm.reset();
    document.getElementById('expense-id-input').value = '';
    // Default date to today (YYYY-MM-DD)
    const today = new Date().toISOString().substring(0, 10);
    document.getElementById('expense-date-input').value = today;
    document.getElementById('expense-payment-input').value = 'UPI';

    expenseModal.classList.add('active');
    updateIcons();
    setTimeout(() => document.getElementById('expense-title-input').focus(), 100);
  };

  const openEditExpenseModal = async (id) => {
    try {
      const res = await fetch(`/api/expenses/${id}`);
      if (!res.ok) throw new Error('Failed to fetch expense details');
      const json = await res.json();
      const expense = json.data;

      state.editingExpenseId = id;
      modalTitle.textContent = 'Edit Expense';
      saveBtnText.textContent = 'Update Expense';

      document.getElementById('expense-id-input').value = expense.id;
      document.getElementById('expense-title-input').value = expense.title;
      document.getElementById('expense-amount-input').value = expense.amount;
      document.getElementById('expense-category-input').value = expense.category;
      document.getElementById('expense-date-input').value = expense.expense_date.substring(0, 10);
      document.getElementById('expense-payment-input').value = expense.payment_method || 'Cash';
      document.getElementById('expense-desc-input').value = expense.description || '';

      expenseModal.classList.add('active');
      updateIcons();
    } catch (err) {
      console.error('Error opening edit modal:', err);
      showToast('Could not load expense details.', 'error');
    }
  };

  const closeExpenseModal = () => {
    expenseModal.classList.remove('active');
    expenseForm.reset();
    state.editingExpenseId = null;
  };

  document.getElementById('open-add-modal-btn').addEventListener('click', openAddExpenseModal);
  document.getElementById('close-expense-modal-btn').addEventListener('click', closeExpenseModal);
  document.getElementById('cancel-expense-modal-btn').addEventListener('click', closeExpenseModal);

  // Close modal when clicking outside card
  expenseModal.addEventListener('click', (e) => {
    if (e.target === expenseModal) closeExpenseModal();
  });

  // Handle Form Submission
  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('expense-title-input').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount-input').value);
    const category = document.getElementById('expense-category-input').value;
    const expense_date = document.getElementById('expense-date-input').value;
    const payment_method = document.getElementById('expense-payment-input').value;
    const description = document.getElementById('expense-desc-input').value.trim();

    // Client-side validation
    if (!title) {
      showToast('Please enter an expense title.', 'error');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount greater than zero.', 'error');
      return;
    }
    if (!category) {
      showToast('Please choose a category.', 'error');
      return;
    }
    if (!expense_date) {
      showToast('Please choose an expense date.', 'error');
      return;
    }

    const payload = {
      title,
      amount,
      category,
      expense_date,
      payment_method,
      description: description || null,
    };

    const isEdit = Boolean(state.editingExpenseId);
    const url = isEdit ? `/api/expenses/${state.editingExpenseId}` : '/api/expenses';
    const method = isEdit ? 'PUT' : 'POST';

    const saveBtn = document.getElementById('save-expense-btn');
    saveBtn.disabled = true;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json.errors ? json.errors.join(', ') : json.message;
        throw new Error(errorMsg || 'Failed to save expense');
      }

      showToast(isEdit ? 'Expense updated successfully!' : 'Expense added successfully!');
      closeExpenseModal();

      // Refresh active view and dashboard data
      if (state.activeTab === 'dashboard-view') {
        loadDashboard();
      } else if (state.activeTab === 'transactions-view') {
        loadTransactions(state.currentPage);
      } else if (state.activeTab === 'categories-view') {
        loadCategoriesView();
      } else if (state.activeTab === 'reports-view') {
        loadMonthlyReport();
      }
    } catch (err) {
      console.error('Error saving expense:', err);
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  // ===================================================================
  // MODALS: DELETE CONFIRMATION
  // ===================================================================
  const deleteModal = document.getElementById('delete-modal');
  const deleteTitleEl = document.getElementById('delete-target-title');
  const deleteDetailsEl = document.getElementById('delete-target-details');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  const openDeleteModal = (id, title, amount) => {
    state.deletingExpense = { id, title, amount };
    deleteTitleEl.textContent = title;
    deleteDetailsEl.textContent = `Amount: ${formatINR(amount)}`;
    deleteModal.classList.add('active');
    updateIcons();
  };

  const closeDeleteModal = () => {
    deleteModal.classList.remove('active');
    state.deletingExpense = null;
  };

  document.getElementById('close-delete-modal-btn').addEventListener('click', closeDeleteModal);
  document.getElementById('cancel-delete-modal-btn').addEventListener('click', closeDeleteModal);

  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!state.deletingExpense) return;
    const id = state.deletingExpense.id;

    confirmDeleteBtn.disabled = true;

    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to delete expense');

      showToast('Expense deleted successfully!');
      closeDeleteModal();

      // Refresh data
      if (state.activeTab === 'dashboard-view') {
        loadDashboard();
      } else if (state.activeTab === 'transactions-view') {
        loadTransactions(state.currentPage);
      } else if (state.activeTab === 'categories-view') {
        loadCategoriesView();
      } else if (state.activeTab === 'reports-view') {
        loadMonthlyReport();
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
      showToast(err.message, 'error');
    } finally {
      confirmDeleteBtn.disabled = false;
    }
  });

  // ===================================================================
  // INITIALIZATION
  // ===================================================================
  updateCurrentDateHeader();
  initReportsControls();
  checkHealthStatus();
  loadDashboard();
  setInterval(checkHealthStatus, 15000);
});
